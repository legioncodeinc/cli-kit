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
- Doctor's migration is a documented, mechanical step — a clean break, not a lingering compatibility shim to maintain.

## Non-Goals

- Re-introducing `EXIT_DECLINED = 2`. The `0` behavior is the intended contract; this sub-PRD does not reverse it.
- Rewriting Doctor's dispatcher wholesale — only the exit-code seam and its tests.
- **Providing any compat/legacy export.** Resolved (2026-07-12): the kit does not ship a bridging `LEGACY_EXIT_DECLINED` or similar, under any grep outcome. The migration note is the entire mitigation.

## User stories

- As a Doctor maintainer, I read the adoption note, see that decline now exits `0`, update my tests and any scripts, and migrate with eyes open.
- As a downstream script author, the release notes tell me the exit code for "declined" changed, so I can adjust.

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-d1 | An adoption/migration note (in the kit's docs and its CHANGELOG) explicitly flags `declined` moving from `2` (Doctor's `EXIT_DECLINED`) to `0`, with a before/after example. |
| AC-d2 | The note lists the concrete Doctor touch-points: remove `EXIT_DECLINED`, route declines through `declined()`, and update tests asserting `2`. |
| AC-d3 | A grep-backed check across consumer repos determines whether anything depends on `EXIT_DECLINED=2`; the finding is recorded in the note and, if positive, is called out prominently (release notes / CHANGELOG highlight), but does **not** trigger a compat export. |
| AC-d4 | No compat shim (e.g. a `LEGACY_EXIT_DECLINED` alias) is provided under any grep outcome. The breaking change ships as a documented breaking change, not a bridged one. |
| AC-d5 | The kit README's "pure import-path change" claim is corrected to carve out the exit-code semantics. |

## Implementation notes

A documentation + release-notes deliverable only — no code-level compat export. The grep (AC-d3) still runs: it sizes the blast radius and determines how loudly the migration note must be surfaced (e.g. a top-of-CHANGELOG breaking-change callout vs. a routine mention), but its outcome no longer gates a shim.

## Resolved decisions

- **Shim policy → no shim, ever** (2026-07-12). Regardless of what the AC-d3 grep finds, the kit does not ship a bridging/deprecated export for the old `2`-on-decline behavior. If the grep finds a real dependency, that finding is surfaced prominently in the migration note and release notes so affected consumers see it before upgrading — but the fix on their side is to update their check, not to lean on a compatibility shim.
- **Shim removal timing → moot.** Since no shim ships, there is no removal-target question to resolve.

## Open questions

- None.

## Related

- [`prd-001c-cli-kit-exit-codes`](../../completed/prd-001-cli-kit/prd-001c-cli-kit-exit-codes.md) — the shipped exit-code spec.
- Reference: `doctor/src/cli/dispatch.ts` (`EXIT_DECLINED = 2`).
- [`the-apiary/library/notes/cli-contract.md`](../../../../library/notes/cli-contract.md) §9.
