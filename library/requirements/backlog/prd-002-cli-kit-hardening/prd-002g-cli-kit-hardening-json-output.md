<!-- library/requirements/backlog/prd-002-cli-kit-hardening/prd-002g-cli-kit-hardening-json-output.md -->

# PRD-002g: JSON output mode (`emitJson` + `--json` coupling)

> **Parent:** [`prd-002-cli-kit-hardening`](./prd-002-cli-kit-hardening-index.md)
> **Status:** Backlog · **Priority:** P2 · **Effort:** M (3–8h) · **Band:** Coverage expansion

---

## Overview

Machine-readable output is the most-duplicated pattern across the sisters: many `honeycomb` commands hand-roll `JSON.stringify(x, null, 2)` behind a `--json` flag (`src/commands/*`), and each must *also* remember to call `disableColor()` so ANSI codes don't corrupt the JSON. The kit's own `color` module documents that `--json` handling is "the caller's job" — which is exactly how drift and forgotten `disableColor()` calls creep in. This sub-PRD provides one shared `emitJson()` helper and formalizes the `--json → disableColor()` coupling so it lives in one place.

## Goals

- One helper that serializes a result to stdout as canonical JSON.
- A documented, single-call way to put a CLI into JSON mode that also disables color, so the two never drift apart.

## Non-Goals

- Owning flag parsing. The consumer parses `--json` (via `002`'s arg-parser or its own) and calls the helper. The kit does not dispatch.
- A schema/validation layer or an output envelope standard beyond a minimal, optional shape. (An envelope MAY be offered but must be opt-in.)
- Streaming/NDJSON output — single-value serialization only in v1.

## User stories

- As a consumer, I call one function to enter JSON mode and get color disabled for free, so piped output is never polluted by ANSI escapes.
- As a consumer, I call `emitJson(result)` instead of re-typing `JSON.stringify(x, null, 2)` + a trailing newline in every command.

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-g1 | `emitJson(value, options?)` writes canonical JSON to stdout with a single trailing newline (normalized like the exit-codes `writeLine` helper). |
| AC-g2 | A dedicated `setJsonMode()` helper ties JSON mode to color: calling it invokes `disableColor()`. The CLI calls `setJsonMode()` at bootstrap alongside `setColorEnabled()`; `emitJson()` itself does not touch color state. |
| AC-g3 | Output is deterministic and pipe-safe: no ANSI, no trailing spaces, stable key order for a given input. |
| AC-g4 | Serialization failures (circular refs, BigInt) are handled without throwing out of the helper — they surface as a usage/runtime error path, not a crash. |
| AC-g5 | Zero runtime deps; built on `JSON.stringify` + the process streams only. |

## Implementation notes

Two small, separate pieces: `emitJson(value, { stream? })` for the write — serializes exactly what the caller passes, no envelope — and `setJsonMode()` for the mode/color coupling, called once at bootstrap next to `setColorEnabled()`. Reuse the exit-codes newline-normalization discipline for the trailing newline.

## Resolved decisions

- **Color coupling → separate `setJsonMode()` at bootstrap** (2026-07-12). The CLI calls `setJsonMode()` alongside `setColorEnabled()` when it resolves its own run mode; `emitJson()` stays a pure serializer with no side effects on color state. Keeps all "how is this CLI configured" decisions in one place at bootstrap.
- **Output shape → caller-owned, no envelope** (2026-07-12). `emitJson(value)` serializes whatever the caller passes. No standard `{ ok, data, error }` envelope in v1 — matches how the sisters' commands already shape their output, and avoids imposing a bigger, more opinionated contract than any consumer has asked for.

## Open questions

- None.

## Related

- [`prd-001a-cli-kit-color`](../../completed/prd-001-cli-kit/prd-001a-cli-kit-color.md) — the `disableColor()` this couples to.
- Duplication source: `honeycomb/src/commands/*` (`--json` + `JSON.stringify(…, null, 2)`).
