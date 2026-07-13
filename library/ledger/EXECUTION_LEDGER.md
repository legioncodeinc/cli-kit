# Execution Ledger â€” PRD-002: cli-kit hardening & shared-mechanism expansion

> **Created:** 2026-07-12
> **Source:** [`prd-002-cli-kit-hardening`](../requirements/backlog/prd-002-cli-kit-hardening/)
> **Orchestrator:** the-smoker
> **Status:** OPEN — 68/75 acceptance criteria verified
> **Prior run:** PRD-001 is complete and retained as history under [`requirements/completed/prd-001-cli-kit`](../requirements/completed/prd-001-cli-kit/). Its completed execution ledger has been superseded by this PRD-002 ledger.

## Ledger rules

- `OPEN` means the criterion has not yet been proven. Change status only when verification evidence is recorded.
- Verification evidence starts blank by design. Record concrete commands, test names, artifact paths, diffs, CI run URLs, release assets, or adoption-checklist paths.
- A criterion is not complete because implementation exists; it is complete only when its exact observable requirement is verified.
- PRD-002 closes only when all 75 rows below are verified, including release, editor, cross-repository adoption, and CI/provenance criteria.

## Module-level acceptance criteria

| ID | Criterion | Status | Proposed owner | Verification evidence | Dependencies |
|---|---|---|---|---|---|
| AC-1 | The runtime-exported `VERSION` equals `package.json`'s `version` for every published build, enforced by a test (`002a`). | VERIFIED | typescript-node-worker-bee | VERIFIED: `npm test` 194/194; `tests/integration.test.ts` VERSION/package assertion; packed 0.2.0 artifact. | 002a |
| AC-2 | `finalizeOneShot` can be exercised end-to-end in a unit test without spying on `process._getActiveHandles` or working around the test runner's IPC handles (`002b`). | VERIFIED | typescript-node-worker-bee | VERIFIED: `tests/shutdown.test.ts` injected fakes; `npm test` 194/194; no `_getActiveHandles` spy. | 002b |
| AC-3 | Every behavior change a sister CLI inherits on adoption is either enforced in code (`002c`) or documented in an adoption/migration note with a compatibility path (`002d`). | OPEN | library-worker-bee | OPEN: Sister-CLI adoption has not occurred; compatibility note exists but inherited behavior is not proven across adopters. | 002c, 002d |
| AC-4 | After adoption, a fresh install of any one Apiary CLI creates **only** `~/.apiary/` in the user's home directory â€” no `~/.daemon`, `~/.deeplake`, or `~/.honeycomb` top-level dirs (`002i`). | OPEN | typescript-node-worker-bee | OPEN: Sister repos still reference/create legacy top-level directories; no fresh-install adoption proof. | 002i; sister adoption |
| AC-5 | `resolveConfigDir()` resolves under the invoking user's home directory and **refuses** to return any system/global directory; this is covered by a cross-platform test (`002i`). | VERIFIED | typescript-node-worker-bee | VERIFIED: `tests/config-dir.test.ts` global/root refusal matrix; security report; 194/194 tests. | 002i; security review |
| AC-6 | Existing installs' legacy directories are migrated (or transparently redirected) to the `~/.apiary/` root with no data loss (`002i`). | VERIFIED | typescript-node-worker-bee | VERIFIED: `tests/config-dir.test.ts` migrates all three legacy roots, preserves files, reruns idempotently, rejects symlinks. | 002c before 002i; migration tests |
| AC-7 | Importing a single leaf helper (e.g. `bold`) does not pull the shutdown module's process-touching code into a consumer bundle (`002k`). | VERIFIED | typescript-node-worker-bee | VERIFIED: esbuild leaf-consumer spot check returned `SHUTDOWN_ABSENT bytes=120`. | 002e, 002k |
| AC-8 | The `@see â€¦/cli-contract.md` reference in every kit source file resolves to a file that exists inside the published package / kit repo (`002f`). | VERIFIED | library-worker-bee | VERIFIED: `npm pack --dry-run --json` contains `library/notes/cli-contract.md`; all source contract links target it. | 002f; packed-artifact inspection |
| AC-9 | Every sub-feature preserves the kit's zero-runtime-dependency invariant: `npm view @legioncodeinc/cli-kit dependencies` stays empty. | VERIFIED | quality-worker-bee | VERIFIED: `npm view @legioncodeinc/cli-kit version dependencies --json` => 0.2.0 and `{}`. | all implementation; published package |

## PRD-002a â€” Version single-source

| ID | Criterion | Status | Proposed owner | Verification evidence | Dependencies |
|---|---|---|---|---|---|
| AC-a1 | The value exported as `VERSION` is derived from `package.json`'s `version` (via a build-time `define`/codegen step or a runtime read of the package's own `package.json`), not a hand-typed literal. | VERIFIED | typescript-node-worker-bee | VERIFIED: `scripts/generate-version.mjs` reads package.json and writes `src/generated/version.ts`; prebuild runs it. | build pipeline |
| AC-a2 | A unit test asserts `VERSION === <package.json version>` and fails CI if they diverge. | VERIFIED | typescript-node-worker-bee | VERIFIED: VERSION/package assertion passes in 194-test suite. | AC-a1 |
| AC-a3 | The fix ships as a patch release that corrects the currently-wrong `0.1.0` â†’ `0.2.x` value. | VERIFIED | devops-worker-bee | VERIFIED: registry reports published `@legioncodeinc/cli-kit@0.2.0`; runtime artifact exports 0.2.0. | AC-a1â€“a2; release |
| AC-a4 | The zero-dependency and ESM constraints are preserved (no new deps; any codegen uses built-ins only). | VERIFIED | typescript-node-worker-bee | VERIFIED: package has no runtime dependencies; generator uses Node built-ins; ESM type/module build passes. | AC-a1 |

## PRD-002b â€” Shutdown testability seam

| ID | Criterion | Status | Proposed owner | Verification evidence | Dependencies |
|---|---|---|---|---|---|
| AC-b1 | `finalizeOneShot(code, deps?)` accepts an **optional** injected-deps object covering: the dispatcher lookup/close, the active-handle enumeration + unref, the `exitCode` setter, and the backstop timer (`setTimeout` + `exit`). The `FinalizeDeps` type is **exported publicly** so consumers can type-check their own fakes. | VERIFIED | typescript-node-worker-bee | VERIFIED: `src/shutdown.ts` exports optional `FinalizeDeps`; root declaration exports the public type. |  |
| AC-b2 | Called with no `deps`, behavior is identical to today (default deps bind to the real `globalThis`/`process`/`setTimeout`). | VERIFIED | typescript-node-worker-bee | VERIFIED: default deps bind global dispatcher, active handles, exitCode, timer/exit; regression tests pass. | AC-b1 |
| AC-b3 | The rewritten `tests/shutdown.test.ts` no longer spies on `process._getActiveHandles` and no longer needs the tinypool-IPC workaround; it injects fakes instead. | VERIFIED | typescript-node-worker-bee | VERIFIED: shutdown tests inject dispatcher/handles/exit/timer fakes; grep finds no active-handle spy/workaround. | AC-b1 |
| AC-b4 | All existing shutdown ACs from PRD-001b (`002`â€¦ the undici close, unref sweep, no `process.exit` on the happy path, unref'd backstop) still pass. | VERIFIED | quality-worker-bee | VERIFIED: shutdown regression cases pass within 194/194 suite. | AC-b1â€“b3; PRD-001b regression suite |
| AC-b5 | Zero new runtime deps; the default-deps path imports nothing. | VERIFIED | typescript-node-worker-bee | VERIFIED: shutdown default path imports nothing; package runtime dependencies empty. | AC-b1 |

## PRD-002c â€” One-shot scope guard

| ID | Criterion | Status | Proposed owner | Verification evidence | Dependencies |
|---|---|---|---|---|---|
| AC-c1 | `isOneShot(argv, options?)` returns `false` when the first command token matches a configured watchdog command, `true` otherwise (including bare/help/unknown invocations). | VERIFIED | typescript-node-worker-bee | VERIFIED: `isOneShot` tests cover watchdog false and all other invocations true. |  |
| AC-c2 | Watchdog commands are configurable via `options.watchdogCommands: string[]` (default matches Doctor's precedent: `["run"]`). | VERIFIED | typescript-node-worker-bee | VERIFIED: default `run` and custom watchdog-list tests pass. | AC-c1 |
| AC-c3 | The predicate is pure, total, and never throws on pathological argv (empty, non-string elements). | VERIFIED | typescript-node-worker-bee | VERIFIED: pathological non-string/undefined argv tests pass without throw. | AC-c1 |
| AC-c4 | Unit tests cover: one-shot verb â†’ true; watchdog verb â†’ false; empty argv â†’ true; custom watchdog list. | VERIFIED | typescript-node-worker-bee | VERIFIED: required four cases present in `tests/shutdown.test.ts`; suite passes. | AC-c1â€“c3 |
| AC-c5 | Doc-comments in `shutdown.ts` are updated to point at `isOneShot` as the enforcement mechanism, replacing the "convention only" caveat. | VERIFIED | typescript-node-worker-bee | VERIFIED: `src/shutdown.ts` docs identify `isOneShot` enforcement. | AC-c1 |

## PRD-002d â€” Exit-code migration documentation

| ID | Criterion | Status | Proposed owner | Verification evidence | Dependencies |
|---|---|---|---|---|---|
| AC-d1 | An adoption/migration note (in the kit's docs and its CHANGELOG) explicitly flags `declined` moving from `2` (Doctor's `EXIT_DECLINED`) to `0`, with a before/after example. | VERIFIED | library-worker-bee | VERIFIED: README, CHANGELOG, and adoption checklist document 2-to-0 before/after. |  |
| AC-d2 | The note lists the concrete Doctor touch-points: remove `EXIT_DECLINED`, route declines through `declined()`, and update tests asserting `2`. | VERIFIED | library-worker-bee | VERIFIED: adoption checklist names remove constant, use `declined()`, update assertions. | AC-d1 |
| AC-d3 | A grep-backed check across consumer repos determines whether anything depends on `EXIT_DECLINED=2`; the finding is recorded in the note and, if positive, is called out prominently (release notes / CHANGELOG highlight), but does **not** trigger a compat export. | VERIFIED | library-worker-bee | VERIFIED: grep-backed consumer finding recorded; live grep confirms Doctor depends on `EXIT_DECLINED`. | consumer repos available |
| AC-d4 | No compat shim (e.g. a `LEGACY_EXIT_DECLINED` alias) is provided under any grep outcome. The breaking change ships as a documented breaking change, not a bridged one. | VERIFIED | typescript-node-worker-bee | VERIFIED: source/root export and tests confirm no compatibility alias. | AC-d3 |
| AC-d5 | The kit README's "pure import-path change" claim is corrected to carve out the exit-code semantics. | VERIFIED | library-worker-bee | VERIFIED: README explicitly carves exit semantics out of import-path-only adoption. | AC-d1 |

## PRD-002e â€” Explicit exports

| ID | Criterion | Status | Proposed owner | Verification evidence | Dependencies |
|---|---|---|---|---|---|
| AC-e1 | `src/index.ts` uses explicit named re-exports (`export { a, b } from "./mod.js"`) instead of `export *` for every module. | VERIFIED | typescript-node-worker-bee | VERIFIED: `src/index.ts` contains named value/type re-exports only; no `export *` statement. |  |
| AC-e2 | The emitted public surface (`dist/index.d.ts`) is unchanged from before the refactor â€” verified by diffing the declaration output. | VERIFIED | typescript-node-worker-bee | VERIFIED: `npm run qa:packaging`; 30-name pre-refactor baseline in `library/notes/public-surface-baseline.json` remains exported. | baseline declaration; AC-e1 |
| AC-e3 | A deliberately-introduced duplicate export name causes a TypeScript compile error (spot-checked once during implementation, not committed). | VERIFIED | typescript-node-worker-bee | VERIFIED: `npm run qa:packaging` creates an isolated duplicate named-export fixture and requires TypeScript TS2300. | AC-e1 |
| AC-e4 | `VERSION` and all existing exports remain available from the package root. | VERIFIED | quality-worker-bee | VERIFIED: root integration/import tests pass and declarations expose VERSION plus legacy exports. | AC-e1 |

## PRD-002f â€” Vendored contract and parity audit

| ID | Criterion | Status | Proposed owner | Verification evidence | Dependencies |
|---|---|---|---|---|---|
| AC-f1 | `cli-kit/library/notes/cli-contract.md` exists in the kit repo and matches the parent's canonical version at vendor time. | VERIFIED | library-worker-bee | VERIFIED: vendored contract exists; `npm run docs:check` matches parent canonical source. | canonical parent contract available |
| AC-f2 | Every `@see â€¦/cli-contract.md` reference in the kit's `src/` resolves to the vendored file (paths corrected if needed). | VERIFIED | library-worker-bee | VERIFIED: all `src` contract references resolve to `../library/notes/cli-contract.md`. | AC-f1 |
| AC-f3 | A documented sync step (script or CI check) detects when the vendored copy drifts from the parent canonical copy. | VERIFIED | devops-worker-bee | VERIFIED: `scripts/sync-vendored-docs.mjs`; documented `docs:check`; check passes. | AC-f1 |
| AC-f4 | The contract is shipped inside the published npm tarball â€” the `files` allowlist includes `library/notes/cli-contract.md`, so `@see` links resolve for npm-only consumers, not just GitHub browsers. | VERIFIED | typescript-node-worker-bee | VERIFIED: package allowlist and dry-run tarball both include contract. | AC-f1; package allowlist |
| AC-f5 | The parity audit (the other repo-only doc the sources cite) is vendored the same way, alongside the contract, and included in the `files` allowlist. | VERIFIED | library-worker-bee | VERIFIED: parity audit vendored, sync-checked, and present in dry-run tarball. | canonical parity audit available; AC-f4 |

## PRD-002g â€” JSON output

| ID | Criterion | Status | Proposed owner | Verification evidence | Dependencies |
|---|---|---|---|---|---|
| AC-g1 | `emitJson(value, options?)` writes canonical JSON to stdout with a single trailing newline (normalized like the exit-codes `writeLine` helper). | VERIFIED | typescript-node-worker-bee | VERIFIED: JSON tests prove pretty JSON plus exactly one newline. |  |
| AC-g2 | A dedicated `setJsonMode()` helper ties JSON mode to color: calling it invokes `disableColor()`. The CLI calls `setJsonMode()` at bootstrap alongside `setColorEnabled()`; `emitJson()` itself does not touch color state. | OPEN | typescript-node-worker-bee | OPEN: Helper disables color and is tested, but no adopted CLI bootstrap calls `setJsonMode()` alongside color setup. | existing color module |
| AC-g3 | Output is deterministic and pipe-safe: no ANSI, no trailing spaces, stable key order for a given input. | VERIFIED | typescript-node-worker-bee | VERIFIED: JSON tests prove no ANSI/trailing spaces and stable output for a fixed input. | AC-g1â€“g2 |
| AC-g4 | Serialization failures (circular refs, BigInt) are handled without throwing out of the helper â€” they surface as a usage/runtime error path, not a crash. | VERIFIED | typescript-node-worker-bee | VERIFIED: circular and BigInt tests return false and surface callback errors without throw. | AC-g1 |
| AC-g5 | Zero runtime deps; built on `JSON.stringify` + the process streams only. | VERIFIED | typescript-node-worker-bee | VERIFIED: implementation uses JSON.stringify/stream only; runtime dependencies empty. | AC-g1 |

## PRD-002h â€” Confirm prompt

| ID | Criterion | Status | Proposed owner | Verification evidence | Dependencies |
|---|---|---|---|---|---|
| AC-h1 | `confirm(question, options?)` returns a `Promise<boolean>`; `true` = confirmed, `false` = declined. | VERIFIED | typescript-node-worker-bee | VERIFIED: public async `confirm` returns Promise<boolean>; tests cover both results. |  |
| AC-h2 | When stdin is not a TTY (piped/CI), `confirm` does **not** block: it returns the configured default (default `false`/decline) without reading. | VERIFIED | typescript-node-worker-bee | VERIFIED: non-TTY test returns false without invoking prompt. | AC-h1 |
| AC-h3 | An `options.assumeYes` (wired by the consumer from `--yes`/`--force`) short-circuits to `true` without prompting. | VERIFIED | typescript-node-worker-bee | VERIFIED: assumeYes test returns true without prompting. | AC-h1 |
| AC-h4 | The prompt renders a clear `[y/N]` (or `[Y/n]` when the default is yes) suffix reflecting the default; empty input takes the default. | VERIFIED | typescript-node-worker-bee | VERIFIED: tests cover y/N, Y/n, explicit answers, and empty-input default. | AC-h1 |
| AC-h5 | Documentation shows the canonical compose: `if (!(await confirm(q))) return declined("Aborted.");` â†’ exit `0`. | VERIFIED | library-worker-bee | VERIFIED: README contains canonical confirm/declined composition and exit 0. | AC-h1; declined helper |
| AC-h6 | Zero runtime deps (`node:readline`/`node:readline/promises` only); never throws out of the function. | VERIFIED | typescript-node-worker-bee | VERIFIED: only node:readline/promises import; rejection test resolves default; runtime deps empty. | AC-h1 |

## PRD-002i â€” Config directory consolidation and migration

| ID | Criterion | Status | Proposed owner | Verification evidence | Dependencies |
|---|---|---|---|---|---|
| AC-i1 | `resolveConfigDir(toolName?)` returns a path under `~/.apiary/`; with a `toolName` it returns `~/.apiary/<toolName>/`, without one it returns the root (`apiaryHome()`). | VERIFIED | typescript-node-worker-bee | VERIFIED: resolver/root tests cover `.apiary` and named child path. | **002c must land first or alongside 002i** |
| AC-i2 | The resolved base is always within `os.homedir()`; the resolver **refuses** (typed error, never a silent fallback) any system/global directory: `/etc`, `/var`, `/usr`, `/`, a Windows drive root, `C:\ProgramData`, `C:\Windows`. | VERIFIED | typescript-node-worker-bee | VERIFIED: typed ConfigDirError tests reject Unix/Windows roots and global dirs. | security review |
| AC-i3 | After adoption, a fresh install of any single Apiary CLI creates **only** `~/.apiary/` in `$HOME` â€” no `~/.daemon`, `~/.deeplake`, or `~/.honeycomb` top-level directories. | OPEN | typescript-node-worker-bee | OPEN: No sister fresh-install adoption proof; live sister grep still finds legacy roots. | 002i implementation; sister adoption |
| AC-i4 | Works correctly on Windows (`%USERPROFILE%`), macOS, and Linux â€” one cross-platform test suite covers all three path shapes. | VERIFIED | typescript-node-worker-bee | VERIFIED: table-driven Windows, macOS, and Linux path-shape tests pass. | AC-i1â€“i2; CI matrix |
| AC-i5 | Existing installs are migrated: legacy `~/.daemon`, `~/.deeplake`, `~/.honeycomb` (and pre-existing `~/.apiary` content) are moved (or transparently redirected) under the new root with **no data loss**, and the migration is idempotent/re-runnable. | VERIFIED | typescript-node-worker-bee | VERIFIED: migration tests prove move, preserved content, idempotence, partial merge, and safe symlink refusal. | **002c; AC-i1â€“i2** |
| AC-i6 | The resolver is the single source of home-path truth: sisters delete their own home-resolution code and call the kit (tracked as a per-sister adoption checklist). | OPEN | library-worker-bee | OPEN: Sisters have not deleted local home-resolution code or uniformly adopted kit resolver. | sister adoption repositories |
| AC-i7 | Zero runtime deps (`node:os`, `node:path`, `node:fs` only). | VERIFIED | typescript-node-worker-bee | VERIFIED: module uses node:fs/os/path plus local guard only; runtime deps empty. | 002i implementation |
| AC-i8 | An `APIARY_HOME` env var, when set, relocates the root; when it resolves to a system/global directory or a filesystem root it is **rejected** with the same typed error as AC-i2 (the override cannot escape the home-anchored guarantee). Covered by test. | VERIFIED | typescript-node-worker-bee | VERIFIED: APIARY_HOME relocation and root/global/outside-home/symlink rejection tests pass. | AC-i2 |
| AC-i9 | The legacy-directory move only runs during a one-shot invocation (gated by `isOneShot()` from `002c`); a long-running daemon/watchdog invocation never triggers a move, so a migration is never attempted while that same process's own directory might be in active use. | VERIFIED | typescript-node-worker-bee | VERIFIED: migration calls isOneShot; watchdog skip test proves no move. | **002c is a hard dependency** |

## PRD-002j â€” Consumer version helper

| ID | Criterion | Status | Proposed owner | Verification evidence | Dependencies |
|---|---|---|---|---|---|
| AC-j1 | `readPackageVersion(importMetaUrl)` locates the nearest ancestor `package.json` from the given module URL and returns its `version` string. | VERIFIED | typescript-node-worker-bee | VERIFIED: nearest ancestor package test returns 3.2.1. |  |
| AC-j2 | On a missing/unreadable/invalid `package.json`, it returns a typed error or a documented fallback â€” it never throws out of the helper. | VERIFIED | typescript-node-worker-bee | VERIFIED: missing, invalid, and malformed URL tests return undefined without throw. | AC-j1 |
| AC-j3 | Works under ESM on Node `>=22.5.0` with `import.meta.url`; documented usage example provided. | VERIFIED | typescript-node-worker-bee | VERIFIED: ESM import.meta.url usage documented; engine >=22.5.0; typecheck passes. | AC-j1 |
| AC-j4 | Zero runtime deps (`node:fs`, `node:path`, `node:url` only). | VERIFIED | typescript-node-worker-bee | VERIFIED: only node:fs/path/url imports; runtime deps empty. | AC-j1 |
| AC-j5 | Documented as a standalone consumer-facing helper â€” the kit's own `VERSION` (`002a`) does **not** use it, since `002a` resolved to a build-time inject instead (no dogfooding relationship; see `002a`'s Resolved decisions). | VERIFIED | library-worker-bee | VERIFIED: README documents standalone consumer use; kit VERSION imports generated build-time value. | 002a decision retained |

## PRD-002k â€” Side-effects-free declaration

| ID | Criterion | Status | Proposed owner | Verification evidence | Dependencies |
|---|---|---|---|---|---|
| AC-k1 | `package.json` declares `"sideEffects": false`. | VERIFIED | typescript-node-worker-bee | VERIFIED: package.json has `sideEffects: false`. |  |
| AC-k2 | Verified true: no kit module performs work at import time (only declarations/exports). Confirmed by inspection during implementation. | VERIFIED | typescript-node-worker-bee | VERIFIED: source inspection found declarations/functions only at import time. | all modules implemented |
| AC-k3 | A representative consumer bundle importing a single leaf export (e.g. `bold`) excludes the `shutdown` module's code (spot-checked with a bundler). | VERIFIED | quality-worker-bee | VERIFIED: esbuild root-barrel leaf import excludes shutdown markers (`SHUTDOWN_ABSENT`, 120 bytes). | AC-k1â€“k2; 002e |
| AC-k4 | The color module's module-level `let enabled = false` is confirmed to be a declaration, not a side effect (it is), so the flag is accurate. | VERIFIED | typescript-node-worker-bee | VERIFIED: `let enabled = false` is declaration-only; no import-time call. | source inspection |

## PRD-002l â€” Declaration maps

| ID | Criterion | Status | Proposed owner | Verification evidence | Dependencies |
|---|---|---|---|---|---|
| AC-l1 | `tsconfig.json` sets `declarationMap: true` (and `sourceMap`/`declaration` as needed for the maps to resolve). | VERIFIED | typescript-node-worker-bee | VERIFIED: tsconfig enables declaration and declarationMap; build emits maps. |  |
| AC-l2 | The published package's `files` allowlist includes `src/` (and the `.d.ts.map` files) so the maps resolve on the consumer side. | VERIFIED | typescript-node-worker-bee | VERIFIED: allowlist ships src; dry-run tarball contains every `.d.ts.map` and source. | AC-l1; package allowlist |
| AC-l3 | Go-to-definition on a kit export in a consuming project opens the kit's `.ts` source, verified once in an editor. | VERIFIED | quality-worker-bee | VERIFIED: `npm run qa:packaging` packs/extracts the package, uses TypeScript language-service lookup, and resolves the declaration map to shipped `src/color.ts`. | AC-l1â€“l2; consuming project/editor |
| AC-l4 | The change does not alter the runtime `dist/` JS output or the public type surface. | VERIFIED | typescript-node-worker-bee | VERIFIED: `npm run qa:packaging` compiles all 12 sources with declarationMap off/on; JS is byte-identical and normalized declarations match. | baseline artifacts; AC-l1â€“l2 |

## PRD-002m â€” Publish provenance and SBOM

| ID | Criterion | Status | Proposed owner | Verification evidence | Dependencies |
|---|---|---|---|---|---|
| AC-m1 | The release workflow publishes with `npm publish --provenance` (from a trusted CI with the required OIDC permissions). | VERIFIED | devops-worker-bee | VERIFIED: workflow uses OIDC id-token write and publish --provenance; npm registry exposes SLSA provenance attestation for 0.2.0. | trusted CI; release workflow |
| AC-m2 | `publishConfig` in `package.json` is set appropriately (`"access": "public"`, `"provenance": true`) for the scoped public package. | VERIFIED | typescript-node-worker-bee | VERIFIED: publishConfig access=public and provenance=true. |  |
| AC-m3 | A CycloneDX SBOM is generated for each release and attached (release asset or tarball), reflecting the zero-runtime-dependency tree. | OPEN | devops-worker-bee | OPEN: Workflow is configured for the next release, but GitHub release v0.2.0 has zero assets; no executed release proves SBOM attachment. | trusted CI; GitHub release |
| AC-m4 | The provenance/SBOM steps run in CI, not from a maintainer's laptop, so attestation is trustworthy. | OPEN | devops-worker-bee | OPEN: Workflow locates generation/attachment in GitHub Actions, but absent v0.2.0 SBOM evidence leaves successful external execution unproven. | AC-m1, AC-m3 |
| AC-m5 | Documentation notes how a consumer verifies provenance (`npm audit signatures` / registry UI). | VERIFIED | library-worker-bee | VERIFIED: RELEASE-AUTOMATION.md documents npm audit signatures and registry provenance UI. | AC-m1 |

## Dependency and wave plan

| Wave | Scope | Proposed owners | Entry condition | Exit condition |
|---|---|---|---|---|
| 0 â€” Baselines | Capture current declaration output, runtime build output, package tarball, dependency state, source citations, consumer-repo grep results, and release-workflow state. | typescript-node-worker-bee, library-worker-bee | Ledger opened | Reproducible baselines/evidence paths recorded before refactors. |
| 1 â€” Adoption-safety foundation | 002b shutdown DI; **002c one-shot guard**; 002d migration note/repo grep; 002e explicit exports; 002f vendored docs and sync check. | typescript-node-worker-bee, library-worker-bee | Wave 0 complete | All bâ€“f implementation/tests/docs verified. **002c must be verified before 002i migration work begins.** |
| 2 â€” Correctness and independent shared helpers | 002a version injection; 002g JSON output; 002h confirm prompt; 002j version helper. | typescript-node-worker-bee, library-worker-bee | Shared barrel strategy from 002e is stable | All a, g, h, j criteria verified except release-only AC-a3. |
| 3 â€” Home-root migration | 002i resolver, refusal rules, migration engine, symlink fallback, idempotency, one-shot gating, cross-platform tests, and per-sister adoption checklist. | typescript-node-worker-bee, security-worker-bee, library-worker-bee | **002c verified**; Wave 0 migration fixtures/baselines captured | All local 002i tests pass; security trust-boundary review passes; adoption checklist exists. |
| 4 â€” Packaging polish | 002k side-effects flag/bundle proof; 002l declaration maps/editor proof; 002m publish config, provenance workflow, SBOM workflow, verification docs. | typescript-node-worker-bee, devops-worker-bee, quality-worker-bee | Public surface stable after Waves 1â€“3 | kâ€“m implementation and locally/CI-verifiable criteria proven. |
| 5 â€” Adoption, release, and final QA | Sister adoption/fresh-install proofs, legacy migration proofs, patch release, published dependency check, provenance attestation, SBOM release asset, packed-package citation checks, full 75-row audit. | the-smoker, quality-worker-bee, devops-worker-bee | Waves 1â€“4 complete | Every row is VERIFIED with durable evidence; PRD moves to completed. |

## Hard dependencies and close-out gates

- **002i depends on 002c.** No legacy-directory move or symlink fallback may be implemented or invoked without the verified `isOneShot()` gate. AC-i5 and AC-i9 are therefore blocked until 002c is verified.
- 002e should precede final integration of new root exports so the explicit barrel remains the public-surface control point.
- 002f must be complete before packed-artifact verification; source `@see` paths and both vendored documents must resolve inside the package.
- AC-m3 and AC-m4 require an executed release with an attached SBOM; workflow configuration alone cannot verify them.
- AC-i3 and AC-i6 require sister-CLI adoption evidence; kit-only tests cannot close them.
- AC-l3 is durably verified through the TypeScript language-service plus packed declaration-map/source chain in `npm run qa:packaging`.
- Final QA must reconcile all 75 rows against the PRD sources and leave no `OPEN`, `BLOCKED`, `PARKED`, or blank-evidence row before completion.
