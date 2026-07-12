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

Two viable approaches, pick one in review:

1. **Build-time inject** (preferred, matches the org's `sync-versions` pattern referenced elsewhere in the suite): a small build step reads `package.json.version` and substitutes it into the emitted `VERSION` (e.g. an esbuild `define`, or a generated `version.ts` produced before `tsc`). Keeps the runtime read-free.
2. **Runtime read**: resolve the package's own `package.json` via `import.meta.url` + `node:fs` and read `version` once at module load. Simpler, but adds a file read at import time — acceptable given it is one small read, but less clean than inject.

Whichever is chosen, the stale literal in `src/index.ts:34` and its misleading doc-comment must be removed, and the doc-comment must describe the actual mechanism.

## Open questions

- [ ] Build-time inject vs runtime read — decide in review. (Inject preferred for import-time purity.)

## Related

- [`prd-002j-…-version-helper`](./prd-002j-cli-kit-hardening-version-helper.md) — generalizes this into a helper the sisters use.
- Source: [`cli-kit/src/index.ts`](../../../../cli-kit/src/index.ts) (the stale literal), [`cli-kit/package.json`](../../../../cli-kit/package.json).
