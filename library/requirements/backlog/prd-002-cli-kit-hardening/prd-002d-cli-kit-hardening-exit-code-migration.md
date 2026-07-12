<!-- library/requirements/backlog/prd-002-cli-kit-hardening/prd-002d-cli-kit-hardening-exit-code-migration.md -->

# PRD-002d: Exit-code migration safety (`declined` 2 → 0)

> **Parent:** [`prd-002-cli-kit-hardening`](./prd-002-cli-kit-hardening-index.md)
> **Status:** Backlog · **Priority:** P1 · **Effort:** S (1–3h) · **Band:** Adoption safety

---

## Overview

The kit's `exit-codes` module deliberately retires Doctor's `EXIT_DECLINED = 2`: a user-declined confirmation now returns `EXIT_OK` (`0`) via `declined()`, per CLI Contract §9 ("a deliberate 'no' is intentional output, not failure"). This is the correct ruling. **But** PRD-001's README/adoption framing sells exit-codes as a "pure import-path change," and it is not: Doctor today defines `EXIT_DECLINED = 2` and returns `2` when a user declines a gate. Swapping the import silently changes a **user-facing exit code** — any script, CI check, or Doctor test asserting `2` on decline will break.

This sub-PRD makes that change safe and explicit: document it as a breaking behavior change and give Doctor a concrete migration path, rather than letting adopters discover it in production.

## Goals

- No adopter is surprised by the `declined 2 → 0` change.
- Doctor's migration is a documented, mechanical step with a compatibility option.

## Non-Goals

- Re-introducing `EXIT_DECLINED = 2`. The `0` behavior is the intended contract; this sub-PRD does not reverse it.
- Rewriting Doctor's dispatcher wholesale — only the exit-code seam and its tests.

## User stories

- As a Doctor maintainer, I read the adoption note, see that decline now exits `0`, update my tests and any scripts, and migrate with eyes open.
- As a downstream script author, the release notes tell me the exit code for "declined" changed, so I can adjust.

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-d1 | An adoption/migration note (in the kit's docs and its CHANGELOG) explicitly flags `declined` moving from `2` (Doctor's `EXIT_DECLINED`) to `0`, with a before/after example. |
| AC-d2 | The note lists the concrete Doctor touch-points: remove `EXIT_DECLINED`, route declines through `declined()`, and update tests asserting `2`. |
| AC-d3 | A grep-backed check across consumer repos determines whether anything depends on `EXIT_DECLINED=2`; the finding is recorded in the note. |
| AC-d4 | If (and only if) a real dependency on `2` is found, a clearly-labeled, deprecated compat export (e.g. `LEGACY_EXIT_DECLINED = 2`) is provided as a temporary bridge, with a removal target. |
| AC-d5 | The kit README's "pure import-path change" claim is corrected to carve out the exit-code semantics. |

## Implementation notes

Primarily a documentation + release-notes deliverable, plus an optional compat export. The grep (AC-d3) is the gating input for AC-d4: if nothing in the suite reads `EXIT_DECLINED` as `2` for control flow, skip the shim and just document. Keep any compat export deprecated-from-birth so it does not become load-bearing.

## Resolved decisions

- **Shim policy → grep first, then decide** (2026-07-12). Run the AC-d3 grep across consumer repos + downstream scripts/CI. Ship the deprecated `LEGACY_EXIT_DECLINED=2` shim (AC-d4) **only if** a real dependency on exit `2`-for-declined is found; otherwise `002d` is documentation + release notes + updating Doctor's tests. The grep is the gate.

## Open questions

- [ ] (Pending the grep) — if a dependency is found, what is the shim's removal target (which major)?

## Related

- [`prd-001c-cli-kit-exit-codes`](../../completed/prd-001-cli-kit/prd-001c-cli-kit-exit-codes.md) — the shipped exit-code spec.
- Reference: `doctor/src/cli/dispatch.ts` (`EXIT_DECLINED = 2`).
- [`the-apiary/library/notes/cli-contract.md`](../../../../library/notes/cli-contract.md) §9.
