<!-- library/requirements/backlog/prd-002-cli-kit-hardening/prd-002a-cli-kit-hardening-version-single-source.md -->

# PRD-002a: Version single-source (fix the stale `VERSION` literal)

> **Parent:** [`prd-002-cli-kit-hardening`](./prd-002-cli-kit-hardening-index.md)
> **Status:** Backlog · **Priority:** P1 · **Effort:** S (1–3h) · **Band:** Correctness

---

## Overview

`src/index.ts` exports `export const VERSION = "0.1.0";` while `package.json` is at `0.2.0`. The doc-comment above the literal claims it is "single-sourced from package.json at release time," but nothing rewrites it — it is a hand-maintained literal that was never bumped. Any consumer or diagnostic that reads the kit's `VERSION` gets a value that disagrees with the actually-published package. This is a shipped correctness bug and the poster child for the version-drift problem `002j` generalizes for the sisters.

## Goals

- The runtime `VERSION` export always equals `package.json`'s `version`.
- The equality is enforced mechanically so it cannot silently drift again.

## Non-Goals

- Building the reusable consumer-facing version helper — that is `002j`. This sub-PRD fixes the kit's *own* value only.
- Changing the version *number* itself or the release cadence.

## User stories

- As a consumer, when I read `VERSION` from `@legioncodeinc/cli-kit`, I get the version I actually installed, so telemetry/diagnostics are trustworthy.
- As a maintainer, when I bump `package.json` and release, I never have to remember to hand-edit a second literal.

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-a1 | The value exported as `VERSION` is derived from `package.json`'s `version` (via a build-time `define`/codegen step or a runtime read of the package's own `package.json`), not a hand-typed literal. |
| AC-a2 | A unit test asserts `VERSION === <package.json version>` and fails CI if they diverge. |
| AC-a3 | The fix ships as a patch release that corrects the currently-wrong `0.1.0` → `0.2.x` value. |
| AC-a4 | The zero-dependency and ESM constraints are preserved (no new deps; any codegen uses built-ins only). |

## Implementation notes

A build step reads `package.json.version` and substitutes it into the emitted `VERSION` (e.g. an esbuild `define`, or a generated `version.ts` produced before `tsc`), matching the org's `sync-versions` pattern referenced elsewhere in the suite. This keeps the runtime read-free — no file read at import time, unlike a `readPackageVersion()`-based approach.

The stale literal in `src/index.ts:34` and its misleading doc-comment must be removed, and the doc-comment must describe the actual (build-time) mechanism.

## Resolved decisions

- **Approach → build-time inject** (2026-07-12), not a runtime read. Zero import-time file-read cost, and consistent with the suite's existing `sync-versions` convention. Note this means the kit's own `VERSION` fix does **not** dogfood `002j`'s `readPackageVersion()` helper — that helper remains available for consumers who prefer (or need) a runtime read, but the kit's own build uses inject.

## Open questions

- None.

## Related

- [`prd-002j-…-version-helper`](./prd-002j-cli-kit-hardening-version-helper.md) — generalizes this into a helper the sisters use.
- Source: [`cli-kit/src/index.ts`](../../../../cli-kit/src/index.ts) (the stale literal), [`cli-kit/package.json`](../../../../cli-kit/package.json).
