<!--
Schema v2 paths on disk:

Index (this file):
  library/requirements/backlog/prd-002-cli-kit-hardening/prd-002-cli-kit-hardening-index.md

Sub-feature PRDs alongside the index:
  library/requirements/backlog/prd-002-cli-kit-hardening/prd-002a-cli-kit-hardening-version-single-source.md
  ... (b through m)

QA report (authored by quality-worker-bee):
  library/requirements/backlog/prd-002-cli-kit-hardening/qa/prd-002-cli-kit-hardening-qa.md

Lifecycle moves:
  backlog/ -> in-work/ -> completed/   (entire prd-002-cli-kit-hardening/ folder moves)
-->

# PRD-002: cli-kit hardening & shared-mechanism expansion

> **Status:** Backlog
> **Priority:** P1
> **Effort:** XL (> 3d — spans 13 sub-features)
> **Schema changes:** None (library) — but sub-PRD `002i` performs a **user home-directory filesystem migration** (`~/.apiary`, `~/.daemon`, `~/.deeplake`, `~/.honeycomb` → a single `~/.apiary/` root).
> **Depends on:** [`prd-001-cli-kit`](../../completed/prd-001-cli-kit/prd-001-cli-kit-index.md) (the shipped v1 this PRD hardens and extends), [`the-apiary/library/notes/cli-contract.md`](../../../../library/notes/cli-contract.md) (normative contract)

---

## Overview

PRD-001 shipped `@legioncodeinc/cli-kit` v0.2.0 — a zero-dependency mechanism library (color, shutdown, exit-codes, arg-parser, telemetry, usage) built to end mechanism drift across the four Apiary CLIs (`honeycomb`, `doctor`, `hive`, `nectar`). The kit is built and correct, but **no sister CLI has adopted it yet**, and a review of the v1 surface against its own reference implementation (Doctor) surfaced correctness bugs, testability regressions, migration hazards, and coverage gaps that should be resolved *before* the sisters migrate.

This PRD covers that hardening pass plus the highest-value **new** shared mechanisms the sisters still hand-roll. It groups thirteen discrete sub-features into four bands:

1. **Correctness** — a stale `VERSION` literal that ships the wrong number (`002a`).
2. **Adoption safety** — regressions and hazards that change the adoption contract and must land before any sister migrates (`002b`–`002f`).
3. **Coverage expansion** — new shared modules for mechanisms the sisters still duplicate, led by the **home-directory consolidation** (`002i`), the single most impactful item in this PRD (`002g`–`002j`).
4. **Packaging polish** — small, high-leverage supply-chain and DX improvements (`002k`–`002m`).

The kit's founding constraints from PRD-001 are non-negotiable here: **zero runtime dependencies**, **ESM-only**, **Node `>=22.5.0`**, **root-only exports**, and **narrow-and-stable scope** (no product surface, no command framework, no TUI beyond the single `confirm` gate scoped in `002h`).

---

## Goals

- **Ship a correct `VERSION`.** The kit must never report a version that disagrees with `package.json`.
- **Restore testability parity with Doctor.** The extracted `finalizeOneShot` must be as unit-testable as the reference implementation it was lifted from.
- **De-risk adoption.** Every behavior change a sister inherits on migration (exit-code semantics, one-shot guard, missing spec doc) is either turned into code or documented as a breaking change with a migration path — no silent surprises.
- **Consolidate the suite's home-directory footprint** under a single `~/.apiary/` root, owned by one kit-provided resolver that is explicitly home-anchored and refuses system directories.
- **Absorb the next tier of drift-prone mechanisms** (JSON output, confirm gate, version helper) the sisters currently re-implement.
- **Match the supply-chain posture** PRD-001 flagged as a SHOULD (provenance, tree-shaking, source maps).

## Non-Goals

- **No command framework.** Unchanged from PRD-001 — no verb tables, dispatchers, or Commander/Yargs equivalent.
- **No product surface migration.** Banner text, telemetry keys, version *constants*, and command tables stay per-CLI. (`002j` provides a *helper* to single-source a version; it does not host any CLI's version value.)
- **No broad TUI/prompts library.** `002h` adds exactly one `confirm()` gate. Rich interactive pickers (Honeycomb's org picker, Nectar's review-matches) stay per-CLI.
- **No per-module subpath exports.** Root-only exports remain the contract; `002e` makes the barrel explicit but does not open subpaths.
- **No new runtime dependencies.** Every sub-feature here is built on Node built-ins.

---

## Sub-features

| Sub-PRD | Scope | Band | Priority | Status |
|---|---|---|---|---|
| [`prd-002a-…-version-single-source`](./prd-002a-cli-kit-hardening-version-single-source.md) | Fix the stale `VERSION` literal; single-source it from `package.json`. | Correctness | P1 | Draft |
| [`prd-002b-…-shutdown-testability`](./prd-002b-cli-kit-hardening-shutdown-testability.md) | Re-introduce the injectable-deps seam to `finalizeOneShot`. | Adoption safety | P1 | Draft |
| [`prd-002c-…-one-shot-guard`](./prd-002c-cli-kit-hardening-one-shot-guard.md) | Export `isOneShot(argv, …)` so the one-shot scope rule is code, not a comment. | Adoption safety | P2 | Draft |
| [`prd-002d-…-exit-code-migration`](./prd-002d-cli-kit-hardening-exit-code-migration.md) | Document the `declined 2→0` behavior change; provide a Doctor migration note + shim. | Adoption safety | P1 | Draft |
| [`prd-002e-…-explicit-exports`](./prd-002e-cli-kit-hardening-explicit-exports.md) | Replace `export *` with explicit named re-exports so collisions are compile errors. | Adoption safety | P2 | Draft |
| [`prd-002f-…-vendor-contract`](./prd-002f-cli-kit-hardening-vendor-contract.md) | Vendor the CLI Contract into the kit repo so `@see` links resolve for external consumers. | Adoption safety | P2 | Draft |
| [`prd-002g-…-json-output`](./prd-002g-cli-kit-hardening-json-output.md) | `emitJson()` result helper + documented `--json → disableColor()` coupling. | Coverage | P2 | Draft |
| [`prd-002h-…-confirm-prompt`](./prd-002h-cli-kit-hardening-confirm-prompt.md) | Zero-dep `confirm()` y/N gate; non-TTY/`--yes` aware; composes with `declined()`. | Coverage | P2 | Draft |
| [`prd-002i-…-config-dir`](./prd-002i-cli-kit-hardening-config-dir.md) | **`resolveConfigDir()` — consolidate all suite dirs under one home-anchored `~/.apiary/` root; never a system dir.** | Coverage | **P0** | Draft |
| [`prd-002j-…-version-helper`](./prd-002j-cli-kit-hardening-version-helper.md) | Export `readPackageVersion(importMetaUrl)` so consumers single-source their own version. | Coverage | P3 | Draft |
| [`prd-002k-…-side-effects-free`](./prd-002k-cli-kit-hardening-side-effects-free.md) | Add `"sideEffects": false` for tree-shaking. | Packaging | P3 | Draft |
| [`prd-002l-…-declaration-maps`](./prd-002l-cli-kit-hardening-declaration-maps.md) | Emit `declarationMap` + ship `src` for go-to-definition. | Packaging | P3 | Draft |
| [`prd-002m-…-publish-provenance`](./prd-002m-cli-kit-hardening-publish-provenance.md) | `npm publish --provenance` + `publishConfig` + SBOM. | Packaging | P3 | Draft |

---

## Acceptance criteria (module-level)

Sub-PRD-level criteria live in their respective files.

| ID | Criterion |
|---|---|
| AC-1 | The runtime-exported `VERSION` equals `package.json`'s `version` for every published build, enforced by a test (`002a`). |
| AC-2 | `finalizeOneShot` can be exercised end-to-end in a unit test without spying on `process._getActiveHandles` or working around the test runner's IPC handles (`002b`). |
| AC-3 | Every behavior change a sister CLI inherits on adoption is either enforced in code (`002c`) or documented in an adoption/migration note with a compatibility path (`002d`). |
| AC-4 | After adoption, a fresh install of any one Apiary CLI creates **only** `~/.apiary/` in the user's home directory — no `~/.daemon`, `~/.deeplake`, or `~/.honeycomb` top-level dirs (`002i`). |
| AC-5 | `resolveConfigDir()` resolves under the invoking user's home directory and **refuses** to return any system/global directory; this is covered by a cross-platform test (`002i`). |
| AC-6 | Existing installs' legacy directories are migrated (or transparently redirected) to the `~/.apiary/` root with no data loss (`002i`). |
| AC-7 | Importing a single leaf helper (e.g. `bold`) does not pull the shutdown module's process-touching code into a consumer bundle (`002k`). |
| AC-8 | The `@see …/cli-contract.md` reference in every kit source file resolves to a file that exists inside the published package / kit repo (`002f`). |
| AC-9 | Every sub-feature preserves the kit's zero-runtime-dependency invariant: `npm view @legioncodeinc/cli-kit dependencies` stays empty. |

---

## Data model changes

None at the database level — the kit remains stateless. Sub-PRD `002i` defines an **on-disk directory contract** (the `~/.apiary/` layout) and a one-time migration of legacy home directories; see that sub-PRD for the layout map and migration plan.

---

## API changes

No HTTP/daemon/IPC changes. New TypeScript surface added to the kit's root export:

- `002c` — `isOneShot(argv, options?)`
- `002g` — `emitJson(value, options?)` (and any result-envelope types)
- `002h` — `confirm(question, options?)`
- `002i` — `resolveConfigDir(toolName?, options?)` (+ `apiaryHome()` root accessor)
- `002j` — `readPackageVersion(importMetaUrl)`

All additive; no existing signature changes except `002b`, which adds an **optional** injected-deps parameter to `finalizeOneShot` (backward-compatible).

---

## Rollout & sequencing

The bands are ordered by dependency and risk:

1. **`002a`** first — it is a shipped bug; fix and patch-release immediately.
2. **`002b`–`002f`** (adoption safety) before *any* sister migrates. These change what "adopt the kit" means; landing them after a migration would force re-work.
3. **`002i`** (config-dir) is P0 and the highest-value item, but it carries a filesystem migration — it ships as its own minor with a migration guide and is adopted per-CLI deliberately, not on a flag day.
4. **`002g`, `002h`, `002j`** (other new modules) land opportunistically as sisters need them.
5. **`002k`–`002m`** (packaging) can land anytime; they are independent and low-risk.

Each sub-feature is its own PR + changeset in the `cli-kit` repo, governed by the semver discipline from PRD-001 (mechanism bug = patch, new helper = minor, signature/enum break = major).

---

## Resolved decisions

Resolved 2026-07-12:

- **`002i` migration strategy → move + symlink fallback.** Move legacy dirs into `~/.apiary/` on next start; symlink legacy → new when a move is blocked by open handles, with a logged deprecation warning, completing on a later clean start. (See `002i` AC-i5.)
- **`002d` shim policy → grep first, then decide.** Run the cross-repo grep for reliance on Doctor's `EXIT_DECLINED=2`; ship the deprecated `LEGACY_EXIT_DECLINED` compat shim **only if** a real dependency exists, otherwise document-only. (See `002d` AC-d3/AC-d4.)
- **`002i` `APIARY_HOME` override → in scope, still home-anchored.** Supported, but subject to the same "never a system directory" refusal — an override cannot escape the guarantee. (See `002i` AC-i8.)

## Open questions

- [ ] `002i`: whether any service must run *before* the daemon can be safely stopped, which decides exactly which invocations trigger a move vs. defer to a clean start.
- [ ] `002i`: final subpath namespace map (`daemon/` vs `runtime/daemon/`, etc.) — settle with each service owner.
- [ ] `002d`: if the grep finds a dependency, the shim's removal target (which major).

---

## Related

- [`prd-001-cli-kit`](../../completed/prd-001-cli-kit/prd-001-cli-kit-index.md) — the shipped v1. Its "Resolved decisions" explicitly deferred the shutdown DI seam (`002b`) and the confirm helper (`002h`), and flagged provenance/SBOM as a SHOULD (`002m`); this PRD picks those up.
- [`the-apiary/library/notes/cli-contract.md`](../../../../library/notes/cli-contract.md) — the normative contract; `002f` vendors a copy into the kit.
- Review source for this PRD: the kit's own modules ([`src/index.ts`](../../../../cli-kit/src/index.ts), [`src/shutdown.ts`](../../../../cli-kit/src/shutdown.ts), [`src/exit-codes.ts`](../../../../cli-kit/src/exit-codes.ts)) and Doctor's reference implementations (`doctor/src/cli/shutdown.ts`, `doctor/src/cli/dispatch.ts`).
