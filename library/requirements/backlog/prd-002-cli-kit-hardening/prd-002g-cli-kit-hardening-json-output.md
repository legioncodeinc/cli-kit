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
| AC-g2 | A documented mechanism ties JSON mode to color: entering JSON mode calls `disableColor()` (either `emitJson` does it, or a dedicated `setJsonMode()` helper does, decided in review). |
| AC-g3 | Output is deterministic and pipe-safe: no ANSI, no trailing spaces, stable key order for a given input. |
| AC-g4 | Serialization failures (circular refs, BigInt) are handled without throwing out of the helper — they surface as a usage/runtime error path, not a crash. |
| AC-g5 | Zero runtime deps; built on `JSON.stringify` + the process streams only. |

## Implementation notes

Two small pieces: `emitJson(value, { stream? })` for the write, and the color coupling. Prefer a dedicated `setJsonMode()` (or have `emitJson` idempotently call `disableColor()`) so a consumer cannot enter JSON mode with color still on. Reuse the exit-codes newline-normalization discipline. Consider an optional `{ ok, data, error }` envelope type but keep it opt-in — many commands just want the raw object.

## Open questions

- [ ] Does `emitJson` disable color itself, or is that a separate `setJsonMode()` the CLI calls at bootstrap (alongside `setColorEnabled`)? Leaning separate `setJsonMode()` so bootstrap owns all mode resolution in one place.
- [ ] Ship a standard result envelope, or leave shape to the caller? Leaning caller-owned in v1.

## Related

- [`prd-001a-cli-kit-color`](../../completed/prd-001-cli-kit/prd-001a-cli-kit-color.md) — the `disableColor()` this couples to.
- Duplication source: `honeycomb/src/commands/*` (`--json` + `JSON.stringify(…, null, 2)`).
