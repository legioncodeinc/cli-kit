# Execution Ledger — PRD-001: @legioncodeinc/cli-kit

> **Started:** 2026-07-08
> **Completed:** 2026-07-08
> **Source:** [`prd-001-cli-kit`](../requirements/completed/prd-001-cli-kit/) (moved to completed)
> **Orchestrator:** the-smoker
> **Status:** ✅ COMPLETE — 44/45 ACs VERIFIED, 1 PARKED (AC-8 cross-repo Hive adoption)

---

## AC Ledger

### Module-wide (from index)

| ID | Source | Criterion | Status | Owning Bee |
|---|---|---|---|---|
| AC-1 | index | Package `@legioncodeinc/cli-kit` publishes to npm with `"dependencies": {}` (zero runtime deps). | VERIFIED | typescript-node |
| AC-2 | index | Ships as ESM (`"type": "module"`), Node `>=22.5.0`, single `exports` root. | VERIFIED | typescript-node |
| AC-3 | index | Consumer replacing hand-rolled modules → observable behavior unchanged (stdout, exit codes, color decisions). | VERIFIED | typescript-node |
| AC-4 | index | `finalizeOneShot(code)` exits cleanly on Windows after `fetch` (no UV_HANDLE_CLOSING exit 127). | VERIFIED | typescript-node |
| AC-5 | index | Unknown flag via shared parser → exit code `2` (not `1`). | VERIFIED | typescript-node |
| AC-6 | index | `NO_COLOR` set → color helpers return input unmodified. `FORCE_COLOR` → enabled off-TTY. | VERIFIED | typescript-node |
| AC-7 | index | Test suite runs on Node `>=22`, no experimental flags, passes on Windows/macOS/Linux. | VERIFIED | typescript-node |
| AC-8 | index | Hive adoption as proof-of-concept, closing contract MUSTs §4.2, §9, §10, §11.1. | BLOCKED (see notes) | typescript-node |

> **AC-8 note:** Hive is a *separate* submodule/repo. The kit's proof-of-adoption requires a cross-repo PR to `legioncodeinc/hive`. This is parked as BLOCKED — the kit itself must be built and verified first; hive adoption is a follow-up PR after the kit ships. The kit's own completeness does not depend on it.

### Color (AC-a1 through AC-a7)

| ID | Source | Criterion | Status | Owning Bee |
|---|---|---|---|---|
| AC-a1 | color | `NO_COLOR` set (any value incl empty) → `isColorEnabled()` returns false. | VERIFIED | typescript-node |
| AC-a2 | color | `FORCE_COLOR=1` + piped stdout → `isColorEnabled()` returns true. | VERIFIED | typescript-node |
| AC-a3 | color | No env vars, stdout `isTTY === true` → enabled. | VERIFIED | typescript-node |
| AC-a4 | color | No env vars, stdout `isTTY === false` → disabled. | VERIFIED | typescript-node |
| AC-a5 | color | Color disabled → every helper returns input unchanged (no SGR). | VERIFIED | typescript-node |
| AC-a6 | color | Color enabled → `amber("hi")` wraps in SGR `38;5;214` + reset. | VERIFIED | typescript-node |
| AC-a7 | color | Module imports with zero `dependencies`; `npm pack --dry-run` shows no bundled deps. | VERIFIED | typescript-node |

### Shutdown (AC-b1 through AC-b6)

| ID | Source | Criterion | Status | Owning Bee |
|---|---|---|---|---|
| AC-b1 | shutdown | One-shot with `fetch` on Windows → exits `0` not 127. | VERIFIED | typescript-node |
| AC-b2 | shutdown | Clean one-shot (no fetch) → exits `0` (no-op-safe). | VERIFIED | typescript-node |
| AC-b3 | shutdown | `process.exitCode` set to `code` before function returns. | VERIFIED | typescript-node |
| AC-b4 | shutdown | Backstop timer fires → `process.exit(code)` with original code. | VERIFIED | typescript-node |
| AC-b5 | shutdown | Internal step throws → caught, still exits with `code`. | VERIFIED | typescript-node |
| AC-b6 | shutdown | Long-running path documented as exempt, does not call `finalizeOneShot`. | VERIFIED | typescript-node |

### Exit codes (AC-c1 through AC-c6)

| ID | Source | Criterion | Status | Owning Bee |
|---|---|---|---|---|
| AC-c1 | exit | Successful command → `process.exitCode` is `0`. | VERIFIED | typescript-node |
| AC-c2 | exit | Runtime failure → `process.exitCode` is `1`. | VERIFIED | typescript-node |
| AC-c3 | exit | `parseError(msg, usage)` → writes to stderr, returns `2`. | VERIFIED | typescript-node |
| AC-c4 | exit | `declined(msg)` → writes to stdout, returns `0`. | VERIFIED | typescript-node |
| AC-c5 | exit | Unknown verb → process exits `2` (not `1`). | VERIFIED | typescript-node |
| AC-c6 | exit | `EXIT_OK`/`EXIT_ERROR`/`EXIT_USAGE` aliases are byte-identical to Doctor's constants. | VERIFIED | typescript-node |

### Arg parser (AC-d1 through AC-d9)

| ID | Source | Criterion | Status | Owning Bee |
|---|---|---|---|---|
| AC-d1 | parser | `["--limit", "5"]` with `min: 1` → `flags.limit === 5`, ok. | VERIFIED | typescript-node |
| AC-d2 | parser | `["--limit=5"]` → same result as `--limit 5`. | VERIFIED | typescript-node |
| AC-d3 | parser | `["--limit", "0"]` with `min: 1` → `ok: false`, error names constraint. | VERIFIED | typescript-node |
| AC-d4 | parser | `["--limit", "abc"]` → `ok: false`, error names not-a-number. | VERIFIED | typescript-node |
| AC-d5 | parser | `["--unknown"]` → `ok: false`, error names unknown flag. | VERIFIED | typescript-node |
| AC-d6 | parser | `["-v"]` with alias → `flags.verbose === true`. | VERIFIED | typescript-node |
| AC-d7 | parser | Positionals collected in order; `maxPositionals` exceeded → error. | VERIFIED | typescript-node |
| AC-d8 | parser | `--limit` means same thing across all verbs (single parser). | VERIFIED | typescript-node |
| AC-d9 | parser | Parser never throws; all malformed input → `{ ok: false, error }`. | VERIFIED | typescript-node |

### Telemetry (AC-e1 through AC-e9)

| ID | Source | Criterion | Status | Owning Bee |
|---|---|---|---|---|
| AC-e1 | telemetry | `DO_NOT_TRACK=1` → `isTelemetryOptedOut("nectar")` returns true. | VERIFIED | typescript-node |
| AC-e2 | telemetry | `NECTAR_TELEMETRY=0` (no DNT) → returns true. | VERIFIED | typescript-node |
| AC-e3 | telemetry | `HONEYCOMB_TELEMETRY=off` only → returns true. | VERIFIED | typescript-node |
| AC-e4 | telemetry | None of three vars set → returns false. | VERIFIED | typescript-node |
| AC-e5 | telemetry | `NECTAR_TELEMETRY=true` → returns false (opt-OUT var, not opt-IN). | VERIFIED | typescript-node |
| AC-e6 | telemetry | `DO_NOT_TRACK=` (empty) → returns false (empty = unset). | VERIFIED | typescript-node |
| AC-e7 | telemetry | `forceOptOut()` called → returns true regardless of env. | VERIFIED | typescript-node |
| AC-e8 | telemetry | Pure: same `env` object → same result. | VERIFIED | typescript-node |
| AC-e9 | telemetry | Doctor composes state.json on top; kit stays stateless. | VERIFIED | typescript-node |

---

## Wave Plan

### Wave 1: Foundation (parallel — no inter-dependencies)

All four foundation modules are independent. They share only `package.json`/`tsconfig.json`/build config, which the typescript-node Bee scaffolds as part of the first task.

| Bee | Model | Task | Exit Criteria |
|---|---|---|---|
| typescript-node | sonnet | **1A: Scaffold** — package.json (ESM, Node >=22.5, zero deps), tsconfig.json, vitest config, src/index.ts barrel, .gitignore, npm publish files allowlist. | AC-1, AC-2, AC-7 (partial — infra) |
| typescript-node | sonnet | **1B: Exit codes** — `src/exit-codes.ts` + `tests/exit-codes.test.ts`. Smallest module, foundation for others. | AC-c1 through AC-c6 |
| typescript-node | sonnet | **1C: Color** — `src/color.ts` + `tests/color.test.ts`. Independent of other modules. | AC-a1 through AC-a7 |
| typescript-node | sonnet | **1D: Telemetry** — `src/telemetry.ts` + `tests/telemetry.test.ts`. Independent. | AC-e1 through AC-e9 |

### Wave 2: Depends on Wave 1

| Bee | Model | Task | Exit Criteria |
|---|---|---|---|
| typescript-node | sonnet | **2A: Arg parser** — `src/arg-parser.ts` + `tests/arg-parser.test.ts`. Imports exit codes for parseError integration. | AC-d1 through AC-d9 |
| typescript-node | sonnet | **2B: Shutdown** — `src/shutdown.ts` + `tests/shutdown.test.ts`. Standalone but needs the full barrel export. | AC-b1 through AC-b6 |
| typescript-node | sonnet | **2C: Usage formatter** — `src/usage.ts`. Inline spec from index PRD. Small. | (no numbered ACs — inline spec) |

### Wave 3: Integration & verification

| Bee | Model | Task | Exit Criteria |
|---|---|---|---|
| typescript-node | sonnet | **3A: Barrel + integration** — wire all modules through `src/index.ts`, cross-module integration tests, verify `npm pack` is clean. | AC-3, AC-5, AC-6 (cross-module), AC-7 (full suite), AC-a7 |

### Wave 4: Close-out

| Bee | Model | Task | Exit Criteria |
|---|---|---|---|
| security | sonnet | Security audit (PII, deps, publish surface). | Clean |
| quality | sonnet | QA against PRD-001. Verify every AC. | All VERIFIED |

### Wave 5: Ship

| Step | Action |
|---|---|
| 5A | Move PRD folder to `completed/`, commit, push, open PR. |

---

## Blockers

| ID | Blocker | Ask | Status |
|---|---|---|---|
| BLK-1 | AC-8 (Hive adoption) requires a cross-repo PR to `legioncodeinc/hive`, a separate submodule. The kit can build and verify independently. | Park AC-8 as a follow-up PR after the kit ships. Kit completeness is not gated on it. | PARKED |

---

## Model Selection Justification

- **typescript-node-worker-bee (sonnet):** All implementation is TypeScript/Node ESM library code with vitest tests. Sonnet is the right balance of code quality and speed for this — it's not architecturally novel (we have the PRDs with exact APIs), it's careful implementation + thorough testing. Opus would be overkill; Haiku would risk test coverage gaps.
- **security-worker-bee (sonnet):** Zero-dep library with no network surface — the audit is lightweight (PII scan, publish surface, dep check). Sonnet suffices.
- **quality-worker-bee (sonnet):** QA verification against 45 ACs from well-written PRDs. Sonnet handles structured verification well.
