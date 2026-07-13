# Execution Ledger — PRD-003: Apiary CLI interface standard

> **Created:** 2026-07-12
> **Source:** [`prd-003-apiary-cli-interface-standard`](../requirements/backlog/prd-003-apiary-cli-interface-standard/)
> **Orchestrator:** the-smoker
> **Active scope:** cli-kit preparation and local verification only
> **Excluded scope:** deployment, repository changes, native product CI, and releases for Doctor, Hive, Honeycomb, and Nectar
> **Status:** PREP COMPLETE — 16/56 acceptance criteria VERIFIED locally; 40 BLOCKED by user scope; 0 DONE/OPEN/IN PROGRESS

## Prior-run history

- PRD-001 is completed under [`requirements/completed/prd-001-cli-kit`](../requirements/completed/prd-001-cli-kit/). It is history, not an active ledger row.
- PRD-002 hardening was the previous active run (68/75 verified at handoff). Its criteria are history, not active rows in this PRD-003 ledger.

## Ledger rules

- `OPEN` means the exact criterion can be implemented and verified inside cli-kit without changing or releasing a product repository.
- `DONE` means the cli-kit-local preparation is implemented and has concrete local test/build/package evidence; it does not claim product deployment.
- `BLOCKED` means the exact wording inherently requires product-repository deployment, a packed product artifact, native product CI, or a published product release excluded by the user.
- `VERIFIED` is allowed only after durable command, test, artifact, or document evidence is recorded against the exact observable requirement.
- Every blocked row records `Deferred by user scope` and the precise future proof required.
- PRD-003 does not move to completed in this run because the user explicitly excluded deployment to the four CLIs.

## Parent acceptance criteria

| ID | Exact criterion | Status | Owner | Evidence / future proof | Dependencies |
|---|---|---|---|---|---|
| AC-1 | Doctor, Hive, Honeycomb, and Nectar expose every required command in the matrix; Doctor alone is exempt from `register`. | BLOCKED | product maintainers | Deferred by user scope. Future proof: packed command inventories from all four adopted product CLIs, including Doctor's sole `register` exemption. | 003a–003e; product adoption |
| AC-2 | The same command has the same operator-level meaning, success behavior, exit-code class, and help placement in every product. | BLOCKED | product maintainers, quality-worker-bee | Deferred by user scope. Future proof: cross-product behavioral and golden-test results from all four adopted CLIs. | AC-a2–a9; 003b–003d |
| AC-3 | Bare invocation and `--help` render product-specific ASCII art, the product name in uppercase, version, usage, grouped commands, and the exact credit `Legion Code Inc. x Activeloop`. | BLOCKED | product maintainers | Deferred by user scope. Future proof: packed bare/help golden output for Doctor, Hive, Honeycomb, and Nectar. | 003d; product art |
| AC-4 | Each product's `logs` command tails only that product's service logs and cannot silently fall through to another product's log source. | BLOCKED | product maintainers, security-worker-bee | Deferred by user scope. Future proof: packed product log-isolation tests against authoritative sources for all four products. | 003c; product log adapters |
| AC-5 | Each non-Doctor product can register itself with Doctor, and Doctor status reflects the resulting registry entry without requiring a Doctor `register` command. | BLOCKED | product maintainers | Deferred by user scope. Future proof: Hive, Honeycomb, and Nectar registration integration tests plus Doctor registry/status observation. | registry adapters; product adoption |
| AC-6 | Shared conformance tests execute the minimum command matrix against all four products and fail when a required verb, help row, banner element, exit-code rule, or JSON contract drifts. | BLOCKED | quality-worker-bee | Deferred by user scope. Future proof: suite-level run over four packed adopted CLIs with deliberate drift fixtures proving failures. | AC-a8; packed products |
| AC-7 | Existing product-specific commands remain available and are listed separately from the standard operational commands. | BLOCKED | product maintainers | Deferred by user scope. Future proof: pre/post command inventories and packed help/dispatch tests from each product. | product adoption; product manifests |
| AC-8 | Human-readable output is visually consistent across the suite, while `--json` output contains no banner, ANSI sequence, prose credit, or prompt. | BLOCKED | quality-worker-bee | Deferred by user scope. Future proof: cross-product human goldens and JSON-cleanliness runs over all four packed CLIs. | 003a, 003d; packed products |

## PRD-003a — Shared command and dispatch contract

| ID | Exact criterion | Status | Owner | Evidence / future proof | Dependencies |
|---|---|---|---|---|---|
| AC-a1 | cli-kit exports a typed baseline command manifest containing every required verb, its group, summary, destructive/idempotent metadata, and whether Doctor is exempt. | VERIFIED | typescript-node-worker-bee | `src/command-contract.ts` exports typed `BASELINE_COMMANDS`/`CommandSpec` with all 12 verbs and required metadata; `tests/command-contract.test.ts` verifies the complete baseline and Doctor exemption; root declarations/build/package gates pass. | manifest design |
| AC-a2 | Every product builds help from the manifest plus its product-specific manifest; required commands are not duplicated as hand-written help rows. | BLOCKED | product maintainers | Deferred by user scope. Future proof: source diffs and help tests in every adopted product proving manifest composition and no handwritten baseline rows. | AC-a1; product adoption |
| AC-a3 | Canonical parsing recognizes `service-install` and `service-uninstall`; historical aliases may dispatch but are marked deprecated and are absent from the primary command list. | VERIFIED | typescript-node-worker-bee | `resolveCommand` recognizes both canonical verbs and deprecated `install-service`/`uninstall-service` aliases; focused tests prove aliases dispatch canonically and are absent from advertised names. | AC-a1; parser |
| AC-a4 | Unknown commands and usage errors return `2`; runtime failures return `1`; successful and already-satisfied idempotent operations return `0`. | VERIFIED | typescript-node-worker-bee | `exitCodeFor` and `runReferenceCli` implement the 2/1/0 contract; command-contract and four-product reference tests cover unknown, simulated runtime failure, success, and idempotent outcomes. | exit-code helpers |
| AC-a5 | Every baseline operational command accepts `--json` and emits a stable object containing `product`, `command`, `ok`, and `message`. | VERIFIED | typescript-node-worker-bee | Every `BASELINE_COMMANDS` entry declares `json: true`; `CommandResult` defines the envelope and `runReferenceCli` emits it; manifest validation and JSON reference-path tests pass. | AC-a1; JSON helpers |
| AC-a6 | JSON mode emits no ANSI, banner, credit, prompt, or extra prose and ends with one newline. | VERIFIED | typescript-node-worker-bee | `runReferenceCli` isolates JSON output; four-product help/version/success/failure/unknown tests parse the sole stdout document, reject ANSI/credit, require empty stderr, and render one trailing newline. | JSON mode; rendering primitives |
| AC-a7 | Product-specific commands remain dispatchable and render under a separate `Product commands` help group. | BLOCKED | product maintainers | Deferred by user scope. Future proof: packed dispatch and help tests for each product's retained command surface. | AC-a1–a2; product adoption |
| AC-a8 | A shared conformance harness loads each product manifest and fails on missing verbs, incorrect Doctor exemption, duplicate canonical names, wrong group order, or absent JSON support. | VERIFIED | quality-worker-bee, typescript-node-worker-bee | `validateManifest` checks all named failure classes; focused tests validate all four reference manifests and deliberately broken missing/Doctor/duplicate/group/JSON fixtures. | AC-a1, AC-a5 |
| AC-a9 | Golden tests cover bare invocation, `--help`, `--version`, unknown command, human success/failure, and JSON success/failure for each product. | BLOCKED | quality-worker-bee | Deferred by user scope. Future proof: complete golden matrix executed against every adopted packed product CLI. | product adoption; packed artifacts |

## PRD-003b — Lifecycle, installation, update, and registration

| ID | Exact criterion | Status | Owner | Evidence / future proof | Dependencies |
|---|---|---|---|---|---|
| AC-b1 | All four products implement the binding semantics for `start`, `stop`, `restart`, `install`, `uninstall`, `service-install`, `service-uninstall`, and `update`. | BLOCKED | product maintainers | Deferred by user scope. Future proof: handler and packed integration tests for every listed command in all four products. | product adapters; adoption |
| AC-b2 | Hive, Honeycomb, and Nectar implement `register`; Doctor rejects `doctor register` as an unknown command with exit `2` and does not list it in help. | BLOCKED | product maintainers | Deferred by user scope. Future proof: packed registration tests for three products and Doctor unknown/help tests. | registry integration; adoption |
| AC-b3 | `start`, `stop`, `service-install`, `service-uninstall`, and `register` are idempotent and return `0` when the requested state already exists. | BLOCKED | product maintainers | Deferred by user scope. Future proof: per-product adapter tests proving repeated requested-state operations return 0. | product service/registry adapters |
| AC-b4 | `restart` does not report success until the restarted service passes its product-specific running or health check within a bounded timeout. | BLOCKED | product maintainers | Deferred by user scope. Future proof: per-product restart tests for healthy, timeout, and unhealthy outcomes. | product health adapters |
| AC-b5 | `service-uninstall` leaves product state and Doctor registration intact; `uninstall` follows the full confirmed product-removal transaction. | BLOCKED | product maintainers, security-worker-bee | Deferred by user scope. Future proof: product filesystem/registry integration tests proving the contrasting transactions. | product retention policies |
| AC-b6 | Uninstall never removes shared credentials, shared registry data belonging to other products, or another product's `~/.apiary/<name>` directory. | BLOCKED | security-worker-bee, product maintainers | Deferred by user scope. Future proof: destructive-path boundary tests and security review in every product repository. | product uninstall implementations |
| AC-b7 | `update` reports installed and target versions, preserves state, uses the approved product release channel, and rolls back or reports a hard failure when post-update health verification fails. | BLOCKED | product maintainers | Deferred by user scope. Future proof: per-product updater integration tests with approved channels, state preservation, health failure, and rollback/hard-failure evidence. | product release channels/updaters |
| AC-b8 | OS service adapters are covered by fixed-argv unit tests for Windows, macOS, and Linux; no user-controlled value is interpolated into a shell command. | BLOCKED | product maintainers, security-worker-bee | Deferred by user scope. Future proof: fixed-argv adapter test suites and command-construction security review for all product platforms. | native product adapters |
| AC-b9 | Each service definition sends stdout and stderr to the authoritative product log destination consumed by `logs`. | BLOCKED | product maintainers | Deferred by user scope. Future proof: installed service-definition inspection and logs adapter correlation for each product/platform. | service definitions; log adapters |
| AC-b10 | Migration notes identify every renamed command and temporary alias, including Hive's `install-service`/`uninstall-service` to `service-install`/`service-uninstall`. | BLOCKED | library-worker-bee, product maintainers | Deferred by user scope. Future proof: finalized migration notes in every adopted product, including the named Hive aliases and all discovered renames. | final product migrations |

## PRD-003c — Status, service logs, and telemetry

| ID | Exact criterion | Status | Owner | Evidence / future proof | Dependencies |
|---|---|---|---|---|---|
| AC-c1 | Every product implements the ordered human status fields and an equivalent structured `status --json` response. | BLOCKED | product maintainers | Deferred by user scope. Future proof: packed human/JSON status goldens for every product and required state. | product status adapters |
| AC-c2 | `logs` defaults to the last 100 lines plus follow mode and supports `--lines`, `--no-follow`, and `--since`. | VERIFIED | typescript-node-worker-bee | `parseLogTailOptions` implements 100/follow defaults and all three options, including duration/timestamp parsing; focused default, valid-form, and invalid-form tests pass. | log-tail primitive |
| AC-c3 | Each `logs` adapter is hard-bound to the invoking product's validated service identifier and authoritative log destination. | BLOCKED | product maintainers, security-worker-bee | Deferred by user scope. Future proof: source-binding and adversarial adapter tests for each adopted product. | product log adapters |
| AC-c4 | Tests prove Doctor cannot tail Hive/Honeycomb/Nectar logs and each non-Doctor product cannot tail another product's logs through its standard `logs` command. | BLOCKED | quality-worker-bee | Deferred by user scope. Future proof: complete cross-product negative log-isolation matrix against adopted CLIs. | AC-c3; packed products |
| AC-c5 | Log output redacts recognized bearer tokens, API keys, authorization headers, and credential values without modifying the stored log. | VERIFIED | typescript-node-worker-bee, security-worker-bee | `redactLogSecrets` is a non-mutating string transform used before writes; table tests cover authorization bearer, API key/token/password credentials, URL credentials, and followed appended content. | log-tail primitive |
| AC-c6 | Ctrl+C stops follow mode cleanly with exit `0`; missing/unreadable logs return a concise error and exit `1`. | VERIFIED | typescript-node-worker-bee | `tailProductLog` maps abort to `{ok:true}`, closes its watcher, and returns concise missing/read errors as `{ok:false}` for the shared exit-1 path; focused abort/close/missing/unreadable tests pass. | AC-c2; exit-code helpers |
| AC-c7 | Bare `telemetry` is read-only and reports enabled/opted-out state, controlling setting, destination class, and available delivery health without printing secrets. | VERIFIED | typescript-node-worker-bee, security-worker-bee | `TelemetrySummary` and pure human/JSON renderers cover state, controlling setting, destination, queue, last success/error, and opt-out instruction; enabled/opted-out focused tests add no credential field. | manifest/output contract |
| AC-c8 | `status`, bounded `logs --no-follow`, and `telemetry` never start or restart the service as a side effect. | VERIFIED | typescript-node-worker-bee | `status.ts` and `telemetry-summary.ts` are pure data renderers; bounded `tailProductLog` reads only injected filesystem and does not watch when `follow:false`; focused tests prove no watch/lifecycle seam is invoked. | shared status/log/telemetry seams |
| AC-c9 | Golden tests cover running, stopped, not-installed, unhealthy, missing-log, telemetry-enabled, and telemetry-opted-out output in human and JSON modes. | BLOCKED | quality-worker-bee | Deferred by user scope. Future proof: per-product human/JSON goldens for every named state against adopted CLIs. | product adapters/adoption |

## PRD-003d — Product branding, help, and version

| ID | Exact criterion | Status | Owner | Evidence / future proof | Dependencies |
|---|---|---|---|---|---|
| AC-d1 | Doctor, Hive, Honeycomb, and Nectar each ship distinct ASCII-only product art reviewed for recognizability and width at 80 columns. | BLOCKED | product maintainers | Deferred by user scope. Future proof: reviewed product-owned art shipped and width-tested in all four repositories. | product design/adoption |
| AC-d2 | Bare invocation and `--help` show the art, unspaced uppercase product name, descriptor, package-derived version, exact `Legion Code Inc. x Activeloop` credit, usage, and grouped commands. | BLOCKED | product maintainers | Deferred by user scope. Future proof: packed bare/help goldens for every product containing all required anatomy. | shared renderer; product adoption |
| AC-d3 | Honeycomb retains its recognizable honeycomb motif and becomes the structural reference without forcing the other products to copy its art. | BLOCKED | Honeycomb maintainer | Deferred by user scope. Future proof: Honeycomb adopted golden plus distinct art goldens for Doctor, Hive, and Nectar. | product art/adoption |
| AC-d4 | Help rendering is pure and side-effect-free; tests prove it performs no filesystem write, service-manager call, network request, registry mutation, or daemon startup. | VERIFIED | typescript-node-worker-bee | `renderProductBanner`/`renderGroupedHelp` and `runReferenceCli` are data-only; repeated-output purity test covers the absence of filesystem, network, registry, service, and daemon seams. | banner/help primitives |
| AC-d5 | `NO_COLOR`, non-TTY output, and `--no-color` contain no ANSI while preserving identical text content. | VERIFIED | typescript-node-worker-bee | Shared branding output is ASCII-only and contains no escape sequence at source; branding/reference tests reject ANSI and preserve identical uncolored content, so NO_COLOR, non-TTY, and `--no-color` require no text rewrite. | color helpers; renderer |
| AC-d6 | JSON mode contains no banner or attribution prose. | VERIFIED | typescript-node-worker-bee | Four-product JSON reference tests cover help/version/success/failure/unknown paths and assert no ANSI or `Legion Code Inc.` attribution while remaining parseable. | JSON mode; renderer |
| AC-d7 | `--version` prints exactly `<product> v<package-version>\n`; the version is single-sourced and tested against the product package manifest. | BLOCKED | product maintainers | Deferred by user scope. Future proof: exact packed stdout and package-manifest parity test for every product. | product manifests/adoption |
| AC-d8 | `--version --json` emits the standard JSON envelope with a `version` field and no additional output. | VERIFIED | typescript-node-worker-bee | `renderVersionJson` emits the standard envelope plus `version` and one newline; exact parsed-object and four-product reference tests require empty stderr/no extra output. | AC-a5–a6 |
| AC-d9 | Snapshot/golden tests cover each product at 80 columns, narrow terminal wrapping, color disabled, bare invocation, `--help`, and `--version`. | BLOCKED | quality-worker-bee | Deferred by user scope. Future proof: full named golden matrix from every adopted product. | product art/manifests/adoption |
| AC-d10 | The rendered credit uses the exact capitalization and punctuation `Legion Code Inc. x Activeloop` in all four products. | BLOCKED | product maintainers | Deferred by user scope. Future proof: packed rendered-credit assertions in all four products. | product adoption |

## PRD-003e — Per-product adoption and conformance

| ID | Exact criterion | Status | Owner | Evidence / future proof | Dependencies |
|---|---|---|---|---|---|
| AC-e1 | Honeycomb's packed CLI passes the full shared matrix and retains all pre-adoption product-specific commands. | BLOCKED | Honeycomb maintainer, quality-worker-bee | Deferred by user scope. Future proof: packed Honeycomb conformance run plus pre/post product-command inventory. | Honeycomb adoption/release candidate |
| AC-e2 | Doctor's packed CLI passes the matrix with only the documented `register` exemption and continues to validate non-Doctor registry entries. | BLOCKED | Doctor maintainer, quality-worker-bee | Deferred by user scope. Future proof: packed Doctor conformance and non-Doctor registry validation integration results. | Doctor adoption/release candidate |
| AC-e3 | Hive's packed CLI passes the matrix; canonical service verbs are `service-install`/`service-uninstall`, with old spellings tested as deprecated aliases for the migration window. | BLOCKED | Hive maintainer, quality-worker-bee | Deferred by user scope. Future proof: packed Hive conformance plus canonical/help/deprecated-alias tests. | Hive adoption/release candidate |
| AC-e4 | Nectar's packed CLI passes the matrix and retains its brood, search, projects, brooding, prune, review, and projection surfaces. | BLOCKED | Nectar maintainer, quality-worker-bee | Deferred by user scope. Future proof: packed Nectar conformance plus retained-surface inventory/tests. | Nectar adoption/release candidate |
| AC-e5 | Every repository has a changelog/migration note listing added commands, renamed aliases, changed semantics, and automation-impacting exit/output changes. | BLOCKED | product maintainers, library-worker-bee | Deferred by user scope. Future proof: reviewed changelog/migration note in each of the four product repositories. | completed product migrations |
| AC-e6 | Native CI verifies service adapter behavior on Windows, macOS, and Linux for every product. | BLOCKED | product maintainers, devops-worker-bee | Deferred by user scope. Future proof: successful native Windows/macOS/Linux CI runs for every adopted product. | product CI/adapters |
| AC-e7 | A suite-level conformance job installs the packed versions of all four products and verifies command presence, help structure, banners, credit, versions, JSON cleanliness, and log-source isolation. | BLOCKED | devops-worker-bee, quality-worker-bee | Deferred by user scope. Future proof: successful suite CI URL/artifacts for the four packed adopted products and every named check. | AC-e1–e6; packed artifacts |
| AC-e8 | No product is marked adopted while any required command is a silent stub, exits success without doing the documented work, or delegates to the wrong product's service/state/log source. | BLOCKED | quality-worker-bee, product maintainers | Deferred by user scope. Future proof: per-product non-stub behavioral audit and source-isolation tests before adoption marking. | product implementations |
| AC-e9 | Documentation presents one suite-wide command matrix and links to product-specific command details without duplicating the normative semantics. | VERIFIED | library-worker-bee | `library/notes/prd-003-command-matrix.md` presents one suite matrix and points normative meanings to PRD-003; `library/notes/prd-003-adoption-checklist.md` directs products to retain/link specialized details without duplicating semantics; docs/package checks pass. | shared manifest/contract |
| AC-e10 | All four releases containing the adoption are published before PRD-003 moves to completed. | BLOCKED | product maintainers, devops-worker-bee | Deferred by user scope. Future proof: published release URLs and package versions for Doctor, Hive, Honeycomb, and Nectar containing adoption. | AC-e1–e9; product releases |

## Dependency and wave plan

| Wave | Scope | Owners | Entry condition | Exit condition |
|---|---|---|---|---|
| 0 — Contract baseline — DONE | Inventory 56 criteria; capture current public surface, parser/output behavior, package constraints, and exact product-deployment boundary. | the-smoker, library-worker-bee, typescript-node-worker-bee | Ledger opened | 56/56 IDs reconciled with no missing/extra rows; deployment boundary recorded. |
| 1 — Typed command foundation — DONE | AC-a1, AC-a3–a6, AC-a8: manifest, aliases, result semantics, JSON envelope, and conformance validator. | typescript-node-worker-bee, quality-worker-bee | Wave 0 complete | Six command/lifecycle-focused criteria DONE; 13 focused tests plus full suite/type/build/package gates pass. |
| 2 — Observability primitives — DONE | AC-c2, AC-c5–c8: safe log options/follow/redaction, telemetry summary, and read-only seams. | typescript-node-worker-bee, security-worker-bee | Wave 1 output contract stable | Five observability criteria DONE; 23 focused tests plus full suite/type/build/package gates pass. |
| 3 — Branding/help/version primitives — DONE | AC-d4–d6, AC-d8: pure banner/help rendering, color equivalence, JSON suppression, and version JSON. | typescript-node-worker-bee, quality-worker-bee | Wave 1 manifest stable | Four rendering criteria DONE; eight reference goldens and branding/reference tests pass. |
| 4 — Documentation and packaging — VERIFIED | AC-e9; public exports, README/migration guidance, suite matrix, examples, declaration/tarball checks, and zero-runtime-dependency audit. | library-worker-bee, typescript-node-worker-bee, quality-worker-bee | Waves 1–3 stable | All 16 local rows VERIFIED; docs check, typecheck, 261 tests, build, packaging QA, zero-vulnerability audit, and pack dry-run pass. |
| 5 — Scoped close-out / deferred product adoption | All 40 BLOCKED criteria: implementation PRs, packed CLI tests, native CI, cross-suite conformance, changelogs, and releases. | product maintainers, devops-worker-bee, quality-worker-bee | User authorizes product deployment | Scoped close-out is 16 VERIFIED / 40 BLOCKED / 0 DONE, OPEN, or IN PROGRESS. Required future proof remains recorded for every blocked row. |

## Summary counts

| Scope | Total | OPEN | IN PROGRESS | DONE | VERIFIED | BLOCKED |
|---|---:|---:|---:|---:|---:|---:|
| Parent PRD-003 | 8 | 0 | 0 | 0 | 0 | 8 |
| PRD-003a | 9 | 0 | 0 | 0 | 6 | 3 |
| PRD-003b | 10 | 0 | 0 | 0 | 0 | 10 |
| PRD-003c | 9 | 0 | 0 | 0 | 5 | 4 |
| PRD-003d | 10 | 0 | 0 | 0 | 4 | 6 |
| PRD-003e | 10 | 0 | 0 | 0 | 1 | 9 |
| **Total** | **56** | **0** | **0** | **0** | **16** | **40** |

## Close-out gates for this scoped run

- All 16 cli-kit-local rows are VERIFIED with durable local implementation/test/package evidence recorded in the QA report.
- The cli-kit package must retain zero runtime dependencies, side-effect-free imports, ESM/Node constraints, explicit exports, declaration maps, and packed-artifact documentation.
- The conformance harness must be usable by future product repositories without embedding product adapters or product-owned ASCII art in cli-kit.
- The 40 BLOCKED rows remain explicitly deferred; no claim of fleet adoption or PRD-003 completion is permitted until their recorded future proof exists.
