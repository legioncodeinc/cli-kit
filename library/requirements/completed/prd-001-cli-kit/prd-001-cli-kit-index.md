# PRD-001: @legioncodeinc/cli-kit

> **Status:** Backlog
> **Priority:** P1
> **Effort:** L (1–3d)
> **Schema changes:** None
> **Depends on:** [`the-apiary/library/notes/cli-contract.md`](../../../../library/notes/cli-contract.md) (normative contract), [`the-apiary/library/notes/cli-parity-audit.md`](../../../../library/notes/cli-parity-audit.md) (source-grounded audit)

---

## Overview

`@legioncodeinc/cli-kit` is a zero-runtime-dependency TypeScript library that consolidates the stable, cross-cutting CLI mechanisms currently re-implemented (and drifting) across the four Apiary CLIs — `honeycomb`, `doctor`, `hive`, `nectar`. It exists so that a bug fix to, e.g., the Windows-safe undici-exit handshake lands once and propagates to every consumer via a versioned npm dependency, rather than being hand-copied four times and diverging.

The kit is deliberately **narrow and stable**: it holds only the mechanisms that change rarely (color, shutdown, exit codes, arg parsing, usage rendering). It does **not** hold volatile, product-specific surface — banner text, telemetry keys, version constants, command tables, and verb definitions stay in each CLI. This narrowness is what makes the cross-repo coordination tax bearable: a kit that changes quarterly is cheap to depend on; a kit that changes weekly is not.

The canonical implementations are lifted from `doctor` (which has the best `colors.ts` and `shutdown.ts`) and `nectar` (whose exit-code `0`/`1`/`2` scheme is the contract baseline). The authoritative specification for behavior is the [CLI Contract](../../../../library/notes/cli-contract.md); this PRD exists to scope the first shipping version of the kit against that contract.

---

## Goals

- **Single source of truth** for the five stable CLI mechanisms (color, shutdown, exit codes, arg parsing, usage formatting) so that conformance to the CLI Contract is mechanical, not per-repo bespoke work.
- **Zero runtime dependencies** — the kit preserves the load-bearing "can't-crash watchdog" constraint that `doctor`, `hive`, and `nectar` rely on. The kit's own `dependencies` field in `package.json` MUST be empty.
- **Conformance-ready**: any CLI that adopts the kit satisfies MUST rules §9 (exit codes), §10 (Windows-safe exit), and §11.1 (color w/ env honors) of the CLI Contract by construction, without re-implementing them.
- **Mechanical parity**: the `--limit` class of bug (where Nectar's `brood --limit` allows 0 but `search --limit` requires ≥1) becomes impossible because there is one parser, not five.
- **Painless adoption**: each consumer adds one `dependencies` entry and migrates its duplicated modules incrementally — no flag-day rewrite.

## Non-Goals

- **Not a command framework.** The kit does NOT provide verb tables, dispatchers, subcommand routing, or a Commander/Yargs/CAC equivalent. Each CLI keeps its own dispatch architecture (Honeycomb's verb-table, Doctor's command-table, Hive's switch, Nectar's if/else chain). The kit only standardizes the *mechanisms* underneath, not the *shape* on top.
- **No product-specific surface.** Banner art, brand strings, telemetry PostHog keys, version constants, env-var names, and command definitions do NOT move into the kit. They stay per-CLI.
- **No behavior changes on adoption.** Migrating a CLI to the kit MUST be behavior-preserving (same stdout, same exit codes, same color decisions) modulo the explicit conformance fixes called out in the contract. This is not a rewrite; it is a consolidation.
- **Not a TUI / prompts library.** Interactive readline prompts (Doctor's `confirm`/`confirmToken`, Honeycomb's org picker, Nectar's review-matches) are out of scope for v1. Each CLI keeps its own. (A future PRD may add a shared prompt helper, but not now.)
- **No shell-completion generation in v1.** The contract flags shell completion as absent from all four CLIs, but generating completion scripts is a v2 concern — it requires knowing each CLI's verb table, which the kit deliberately does not own.
- **Does not touch `the-apiary`.** The kit is a standalone `legioncodeinc/cli-kit` repo published to npm. `the-apiary` pins it as a submodule for reference and docs only; consumer repos install it as a normal npm dependency.

---

## Sub-features

The kit decomposes into six modules. Five are discrete enough to warrant their own sub-PRD; the sixth (the usage-column formatter) is small enough to specify inline in the index (see §"Usage formatter" below).

| Sub-PRD | Scope | Status |
|---|---|---|
| [`prd-001a-cli-kit-color`](./prd-001a-cli-kit-color.md) | SGR color helpers with `NO_COLOR`/`FORCE_COLOR`/TTY honors | Draft |
| [`prd-001b-cli-kit-shutdown`](./prd-001b-cli-kit-shutdown.md) | Windows-safe process teardown for one-shot commands that used `fetch` | Draft |
| [`prd-001c-cli-kit-exit-codes`](./prd-001c-cli-kit-exit-codes.md) | The `0`/`1`/`2` exit-code enum and helpers | Draft |
| [`prd-001d-cli-kit-arg-parser`](./prd-001d-cli-kit-arg-parser.md) | A single shared argv parser (collapses Nectar's 5 bespoke parsers) | Draft |
| [`prd-001e-cli-kit-telemetry`](./prd-001e-cli-kit-telemetry.md) | `isTelemetryOptedOut(toolName)` resolver honoring the three env vars | Draft |

### Usage formatter (inline — no sub-PRD)

A small helper that renders a grouped usage table (verb column + summary column) from a declarative input array, padding the verb column to the widest entry. This is what Honeycomb's `usageText()` (`src/commands/dispatch.ts:104-123`) and Doctor's `COMMAND_MENU` (`src/cli/command-table.ts:49-73`) both hand-roll.

**Scope for v1:**
- Input: `{ groups: Array<{ title: string, verbs: Array<{ name: string, summary: string }> }> }`.
- Output: a single string, groups separated by blank lines, verbs padded to the widest name in *that group* (not globally — keeps narrow groups narrow).
- ASCII-only; no color in the formatter itself (color is the caller's job, via the color module — the formatter returns plain strings).
- The caller decides where the output goes (stdout for `--help`, stderr for unknown-command).

**Non-goal for v1:** no per-command help rendering (contract §4.4 is a convergence target, not a v1 deliverable); no wrap/terminal-width detection (verbs and summaries are expected to be short).

---

## Acceptance criteria

Module-wide criteria. Sub-PRD-level criteria live in their respective files.

| ID | Criterion |
|---|---|
| AC-1 | The package `@legioncodeinc/cli-kit` publishes to npm with `"dependencies": {}` in `package.json` (zero runtime deps), confirmed by `npm view @legioncodeinc/cli-kit dependencies`. |
| AC-2 | The package ships as ESM (`"type": "module"`), targets Node `>=22.5.0` (matching Honeycomb's floor, the suite's highest constraint), and exports a typed surface from a single `package.json` `exports` root (root-only — no per-module subpaths in v1). |
| AC-3 | Given any of the four consumer CLIs, when it replaces its hand-rolled color/shutdown/exit/arg-parse module with the kit's equivalent, then its observable behavior (stdout, exit codes, color decisions under `NO_COLOR`/`FORCE_COLOR`/non-TTY) is unchanged. |
| AC-4 | Given a one-shot command that has issued an `undici`/`fetch` request, when it calls the kit's `finalizeOneShot(code)` helper, then the process exits with `code` on Windows without tripping the libuv `UV_HANDLE_CLOSING` assertion (exit 127). Verified by a Windows CI job. |
| AC-5 | Given a CLI using the kit's arg parser, when a user passes an unknown flag, then the parser returns a parse-error result that the CLI surfaces as exit code `2` (not `1`), per contract §9. |
| AC-6 | Given `NO_COLOR` is set in the environment, when any color helper is invoked, then it returns the input string unmodified — verified by unit test. The inverse (`FORCE_COLOR` enables color even off-TTY) is also verified. |
| AC-7 | The kit's own test suite runs on the consumer CLIs' floor (Node `>=22`, no experimental flags) and passes on Windows, macOS, and Linux CI. |
| AC-8 | A single consumer migration (recommended: `hive`, the lowest-conformance CLI per the contract scorecard) is completed as the kit's proof-of-adoption, closing contract MUST rules §4.2, §9, §10, and §11.1 for that CLI. |

---

## Data model changes

None. The kit is a stateless library; it defines no tables, persists nothing, and introduces no schema.

---

## API changes

None at the system level. The kit exposes a new TypeScript module surface (detailed in each sub-PRD's "API" section), but it does not add HTTP endpoints, daemon routes, or IPC contracts. Consumer CLIs adopt the surface incrementally.

---

## Adoption plan (recommended sequence)

The kit ships, then consumers migrate one module at a time. The sequence is ordered by risk-to-reward and follows the contract's scorecard priorities.

1. **Ship `@legioncodeinc/cli-kit` v0.1.0** with color + exit-codes + shutdown + arg-parser + usage-formatter.
2. **`hive` adopts first** (it is the lowest-conformance CLI and has the least surface to migrate). This is AC-8 and closes the most contract MUSTs per unit of effort.
3. **`nectar` adopts the arg-parser** — this is where the kit pays off most visibly, since it collapses 5 bespoke parsers and kills the `--limit` inconsistency (`brooding/cli.ts:66` vs `cli.ts:961`).
4. **`doctor` donates and migrates** — Doctor's `colors.ts` and `shutdown.ts` are the canonical source; after extraction, Doctor deletes its local copies and imports from the kit.
5. **`honeycomb` adopts color** (it is the only flagship CLI with no color today) and the shutdown helper (replacing its inline `finalizeCliExit` variant at `src/cli/index.ts:70-88`).

Each adoption step is its own PR in the consumer repo and its own changeset. The kit's semver discipline (see §"Versioning") governs cross-repo propagation.

---

## Versioning

- **Semver.** The kit follows strict semver. A bug fix to a mechanism (e.g., the Windows-exit handshake) is a patch; a new helper in an existing module is a minor; a breaking change to a module's signature or the exit-code enum is a major.
- **Stability budget.** The kit SHOULD change at most quarterly for non-security reasons. If a proposed change would push the cadence faster, that is a signal the change belongs in the consumer, not the kit. The narrow scope (§Non-Goals) is what enforces this.
- **Renovate/Dependabot.** Each consumer repo enables automated dependency bumps for `@legioncodeinc/cli-kit` so that security and bug-fix patches propagate without manual coordination.
- **Provenance & SBOM.** On publish, the kit SHOULD emit npm provenance (`npm publish --provenance`) and a CycloneDX SBOM, matching the supply-chain posture expected of the suite.

---

## Resolved decisions

These were open questions during drafting; all resolved on 2026-07-08.

- **Node engine floor: `>=22.5.0`.** Matches Honeycomb's declared floor — the suite's highest constraint. Every consumer already satisfies it, so nothing is excluded.
- **Exports: root-only.** Single import path `@legioncodeinc/cli-kit` with no per-module subpaths in v1. The kit is tiny (~300–500 lines); tree-shaking is not a concern. Revisit only if the kit grows materially.
- **Telemetry resolver: shipped.** The kit includes `isTelemetryOptedOut(toolName)` (see sub-PRD `prd-001e`) honoring all three env vars (`DO_NOT_TRACK`, `<TOOL>_TELEMETRY`, `HONEYCOMB_TELEMETRY`). This kills drift on which env vars each CLI checks.
- **`CliContext` DI pattern: stays in Doctor.** It is a pattern, not a mechanism. v1 leaves it Doctor-side. Promote to the kit later only if a second consumer wants the same testability seam — not before.

---

## Related

- **[CLI Contract](../../../../library/notes/cli-contract.md)** — the normative specification this kit implements. Authoritative for all behavior questions.
- **[CLI Parity Audit](../../../../library/notes/cli-parity-audit.md)** — the source-grounded audit of the four CLIs that motivates both the contract and this kit. Cites the exact `file:line` references for each mechanism being consolidated.
- **Canonical sources** (in their respective repos, pre-extraction):
  - Color: `doctor/src/cli/colors.ts:44-50`
  - Shutdown: `doctor/src/cli/shutdown.ts:195-242`
  - Exit codes: `doctor/src/cli/dispatch.ts:32-34` (baseline) + `nectar/src/cli.ts` (the `2`-for-parse-errors convention)
  - Arg parsing: `doctor/src/cli/arg-parse.ts:31-70` (cleanest single implementation); Nectar's 5 bespoke parsers are the anti-pattern being collapsed.
  - Usage formatting: `honeycomb/src/commands/dispatch.ts:104-123` and `doctor/src/cli/command-table.ts:49-73`.
