<!-- library/requirements/backlog/prd-002-cli-kit-hardening/prd-002e-cli-kit-hardening-explicit-exports.md -->

# PRD-002e: Explicit named barrel exports

> **Parent:** [`prd-002-cli-kit-hardening`](./prd-002-cli-kit-hardening-index.md)
> **Status:** Backlog · **Priority:** P2 · **Effort:** XS (< 1h) · **Band:** Adoption safety

---

## Overview

`src/index.ts` re-exports the whole surface with flat `export *` per module, resting on the note that the six modules "were verified at wiring time to have NO export-name collisions." That verification is a point-in-time fact, not an invariant. As this PRD adds modules (`002g` JSON output, `002h` `confirm`, `002i` `resolveConfigDir`, `002j` version helper), a future duplicate export name becomes a **silent shadow** — `export *` resolves the collision by last-wins with no error. Making the barrel explicit turns any future collision into a compile-time failure.

## Goals

- The public surface is enumerated explicitly, so name collisions are caught by the compiler, not shipped silently.

## Non-Goals

- Opening per-module subpath exports — root-only stays the contract (PRD-001 resolved decision).
- Changing any exported name or signature. This is a mechanical, behavior-preserving refactor.

## User stories

- As a maintainer adding a new module, if I accidentally reuse an exported name, the build fails immediately instead of silently shadowing an existing export.

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-e1 | `src/index.ts` uses explicit named re-exports (`export { a, b } from "./mod.js"`) instead of `export *` for every module. |
| AC-e2 | The emitted public surface (`dist/index.d.ts`) is unchanged from before the refactor — verified by diffing the declaration output. |
| AC-e3 | A deliberately-introduced duplicate export name causes a TypeScript compile error (spot-checked once during implementation, not committed). |
| AC-e4 | `VERSION` and all existing exports remain available from the package root. |

## Implementation notes

Replace each `export * from "./mod.js";` with an explicit list. Keep the list alphabetized per module for reviewability. This pairs naturally with `002a`'s cleanup of the `VERSION` export.

## Open questions

- None.

## Related

- Source: [`cli-kit/src/index.ts`](../../../../cli-kit/src/index.ts).
- All new-module sub-PRDs (`002g`–`002j`) add names to this barrel.
