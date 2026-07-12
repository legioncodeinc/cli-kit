<!-- library/requirements/backlog/prd-002-cli-kit-hardening/prd-002l-cli-kit-hardening-declaration-maps.md -->

# PRD-002l: Declaration maps + ship `src` for go-to-definition

> **Parent:** [`prd-002-cli-kit-hardening`](./prd-002-cli-kit-hardening-index.md)
> **Status:** Backlog · **Priority:** P3 · **Effort:** XS (< 1h) · **Band:** Packaging polish

---

## Overview

Consumers using "go to definition" on a kit symbol land in the emitted `.d.ts`, not the real source with its extensive doc-comments (the shutdown/undici rationale, the parser grammar). Emitting declaration maps (`declarationMap: true`) and shipping `src/` in the published tarball lets editors jump straight to the authored TypeScript — a meaningful DX win given how much of the kit's value is in its heavily-documented source.

## Goals

- "Go to definition" from a consumer lands in the kit's authored `.ts` source, not the `.d.ts`.

## Non-Goals

- Shipping source maps for *runtime* debugging is a separate concern (may be added, but the driver here is editor navigation).
- Changing the compiled output or the public API.

## User stories

- As a consumer, jumping to a kit symbol's definition shows me the documented source, so I understand the mechanism without opening GitHub.

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-l1 | `tsconfig.json` sets `declarationMap: true` (and `sourceMap`/`declaration` as needed for the maps to resolve). |
| AC-l2 | The published package's `files` allowlist includes `src/` (and the `.d.ts.map` files) so the maps resolve on the consumer side. |
| AC-l3 | Go-to-definition on a kit export in a consuming project opens the kit's `.ts` source, verified once in an editor. |
| AC-l4 | The change does not alter the runtime `dist/` JS output or the public type surface. |

## Implementation notes

Set `declarationMap: true` in `tsconfig.json`; ensure `declaration` is on (it is, since `types` is published). Add `src` and the map files to the `files` array in `package.json` (currently `["dist", "README.md", "LICENSE.md"]`). Confirm the `.d.ts.map` files reference `../src/*.ts` correctly.

## Resolved decisions

- **Scope → declaration maps only, no runtime source maps** (2026-07-12). Solves the actual DX problem this sub-PRD targets (go-to-definition into the documented source) and keeps the tarball leaner. Revisit runtime `sourceMap`/`.js.map` output later only if stack-trace fidelity becomes a real, separate ask.

## Open questions

- None.

## Related

- [`prd-002k-…-side-effects-free`](./prd-002k-cli-kit-hardening-side-effects-free.md) — sibling packaging change.
- Source: [`cli-kit/tsconfig.json`](../../../../cli-kit/tsconfig.json), [`cli-kit/package.json`](../../../../cli-kit/package.json) `files`.
