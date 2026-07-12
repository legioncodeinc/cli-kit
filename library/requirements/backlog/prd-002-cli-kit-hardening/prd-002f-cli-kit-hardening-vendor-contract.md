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
| AC-f4 | If the contract is shipped in the npm tarball, the `files` allowlist includes it; if intentionally repo-only, that decision is documented. |
| AC-f5 | Any other repo-only doc the sources cite (e.g. the parity audit) is handled the same way or the reference is removed. |

## Implementation notes

Simplest path: copy `the-apiary/library/notes/cli-contract.md` into `cli-kit/library/notes/` and add a small sync check (a CI step that diffs the two, or a `scripts/sync-contract.mjs`). Decide whether the contract ships in the published tarball (`files` includes `library/notes/cli-contract.md`) or stays repo-only (fine for GitHub browsing, but then `@see` links in *published* `.js`/`.d.ts` still dangle for npm-only consumers — prefer shipping it).

## Open questions

- [ ] Ship the contract in the npm tarball, or repo-only? Leaning ship-it, so npm-only consumers get resolvable links.
- [ ] Does the parity audit also need vendoring, or should its references be dropped from the kit sources?

## Related

- [`the-apiary/library/notes/cli-contract.md`](../../../../library/notes/cli-contract.md) — canonical source.
- Every kit module `@see`s this contract; see [`cli-kit/src/exit-codes.ts`](../../../../cli-kit/src/exit-codes.ts) et al.
