<!-- library/requirements/backlog/prd-002-cli-kit-hardening/prd-002f-cli-kit-hardening-vendor-contract.md -->

# PRD-002f: Vendor the CLI Contract into the kit

> **Parent:** [`prd-002-cli-kit-hardening`](./prd-002-cli-kit-hardening-index.md)
> **Status:** Backlog · **Priority:** P2 · **Effort:** S (1–3h) · **Band:** Adoption safety

---

## Overview

Every kit source file references the normative spec it implements via `@see ../library/notes/cli-contract.md` (relative to `src/`, i.e. `cli-kit/library/notes/cli-contract.md`), and the README links it too. **That file does not exist inside the `cli-kit` submodule** — its `library/notes/` holds only a README. The contract lives solely in the parent monorepo (`the-apiary/library/notes/cli-contract.md`). Because `cli-kit` is its own published npm package and its own GitHub repo, the normative specification it claims to implement is an unreachable/dead link for every external consumer and for anyone browsing the standalone repo.

This sub-PRD makes the contract travel with the kit.

## Goals

- The CLI Contract (and any companion spec the sources cite, e.g. the parity audit) is present inside the kit repo/package, so `@see` links resolve.
- The vendored copy stays in sync with the parent's canonical version.

## Non-Goals

- Forking the contract's ownership. The parent monorepo copy remains canonical; the kit carries a synced copy, not a divergent one.
- Rewriting the contract's content.

## User stories

- As an external consumer reading the published package, I can open the CLI Contract the source comments reference.
- As a maintainer, the sync mechanism keeps the vendored copy from drifting away from the canonical one.

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-f1 | `cli-kit/library/notes/cli-contract.md` exists in the kit repo and matches the parent's canonical version at vendor time. |
| AC-f2 | Every `@see …/cli-contract.md` reference in the kit's `src/` resolves to the vendored file (paths corrected if needed). |
| AC-f3 | A documented sync step (script or CI check) detects when the vendored copy drifts from the parent canonical copy. |
| AC-f4 | The contract is shipped inside the published npm tarball — the `files` allowlist includes `library/notes/cli-contract.md`, so `@see` links resolve for npm-only consumers, not just GitHub browsers. |
| AC-f5 | The parity audit (the other repo-only doc the sources cite) is vendored the same way, alongside the contract, and included in the `files` allowlist. |

## Implementation notes

Copy `the-apiary/library/notes/cli-contract.md` **and** `the-apiary/library/notes/cli-parity-audit.md` into `cli-kit/library/notes/`, add both to the `files` allowlist, and add a small sync check (a CI step that diffs the vendored copies against the parent's canonical versions, or a `scripts/sync-contract.mjs`) so drift is caught.

## Resolved decisions

- **Contract shipping → ship in the npm tarball** (2026-07-12). npm-only consumers (the majority) get resolvable `@see` links in the published `.js`/`.d.ts`; the doc is small, so the tarball-size cost is negligible.
- **Parity audit → vendor it alongside the contract** (2026-07-12). Same treatment as the contract: copied in, synced, and shipped — every citation in the kit's source comments resolves for an external reader.

## Open questions

- None.

## Related

- [`the-apiary/library/notes/cli-contract.md`](../../../../library/notes/cli-contract.md) — canonical source.
- Every kit module `@see`s this contract; see [`cli-kit/src/exit-codes.ts`](../../../../cli-kit/src/exit-codes.ts) et al.
