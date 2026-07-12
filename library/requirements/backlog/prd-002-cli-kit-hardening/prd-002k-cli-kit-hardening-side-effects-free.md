<!-- library/requirements/backlog/prd-002-cli-kit-hardening/prd-002k-cli-kit-hardening-side-effects-free.md -->

# PRD-002k: `"sideEffects": false` for tree-shaking

> **Parent:** [`prd-002-cli-kit-hardening`](./prd-002-cli-kit-hardening-index.md)
> **Status:** Backlog · **Priority:** P3 · **Effort:** XS (< 1h) · **Band:** Packaging polish

---

## Overview

The kit is pure functions plus one enum — no module executes side effects at import. But `package.json` does not declare `"sideEffects": false`, so a bundler must conservatively assume every module might have import-time effects. That means a consumer importing only `bold` can still pull in the `shutdown` module's process-touching code (the undici symbol lookup, `_getActiveHandles` access). Declaring the package side-effect-free lets bundlers drop unused modules.

## Goals

- Consumers that import a subset of the kit only bundle what they use.

## Non-Goals

- Splitting the package into subpath exports (root-only stays the contract, `002e`). Tree-shaking works through the barrel with this flag.
- Refactoring any module to *become* side-effect-free — it already is; this only declares it.

## User stories

- As a consumer importing only `bold`, my bundle does not include the shutdown module's process-poking code.

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-k1 | `package.json` declares `"sideEffects": false`. |
| AC-k2 | Verified true: no kit module performs work at import time (only declarations/exports). Confirmed by inspection during implementation. |
| AC-k3 | A representative consumer bundle importing a single leaf export (e.g. `bold`) excludes the `shutdown` module's code (spot-checked with a bundler). |
| AC-k4 | The color module's module-level `let enabled = false` is confirmed to be a declaration, not a side effect (it is), so the flag is accurate. |

## Implementation notes

One-line `package.json` change plus a verification pass. The only thing to double-check is that no module runs code at load — `color.ts` has a module-level `let`, which is initialization, not a side effect. If any future module needs an import-time effect, it must be excluded from the flag (`"sideEffects": ["./dist/that-module.js"]`).

## Open questions

- None.

## Related

- [`prd-002e-…-explicit-exports`](./prd-002e-cli-kit-hardening-explicit-exports.md) — complementary packaging hygiene.
- Source: [`cli-kit/package.json`](../../../../cli-kit/package.json).
