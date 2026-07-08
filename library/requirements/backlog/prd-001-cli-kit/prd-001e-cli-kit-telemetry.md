# PRD-001e: cli-kit — Telemetry Opt-Out Resolver

> **Parent:** [`prd-001-cli-kit-index.md`](./prd-001-cli-kit-index.md)
> **Status:** Draft
> **Canonical sources:** `doctor/src/cli/opt-out.ts:73-105`, `nectar/src/telemetry/emit.ts:47-58`, `hive/src/telemetry/emit.ts:73-86`

---

## Overview

A single `isTelemetryOptedOut(toolName)` predicate that every Apiary CLI calls before emitting telemetry, honoring all three env vars mandated by CLI Contract §7.1: `DO_NOT_TRACK`, `<TOOL>_TELEMETRY`, and `HONEYCOMB_TELEMETRY`. Today each CLI has its own resolver that checks *some* of these vars in *some* order, with subtle differences in how truthiness is parsed (`0`/`false`/`off`/`no` vs. just `0`). The kit collapses them into one.

This module is the discovery-and-correctness fix for telemetry opt-out: one chokepoint, one truthiness rule, one precedence order, callable from every consumer.

---

## Goals

- One predicate, one env-var precedence, one truthiness rule — so a user who sets `DO_NOT_TRACK=1` is opted out of *every* Apiary CLI, not just the ones that happen to check that var.
- Parameterized by `toolName` so each CLI's own `<TOOL>_TELEMETRY` var is honored (e.g. `NECTAR_TELEMETRY`, `HONEYCOMB_TELEMETRY`) without hardcoding.
- Zero runtime dependencies; reads `process.env` only.

## Non-Goals

- **No telemetry emission.** The kit does not POST to PostHog, does not build payloads, does not mint `distinct_id`s. Each CLI keeps its own emit path; this module only answers "should I emit?".
- **No persisted opt-out state.** Doctor's resolver also reads a `state.json` layer (PRD-064b) and a pin. That persistence is Doctor-specific and stays in Doctor; the kit's resolver is purely env-based. (Doctor MAY layer its own `state.json`/pin check *on top of* the kit's env result — see §"Composition" below.)
- **No opt-out flag parsing.** The kit does not parse a `--no-telemetry` CLI flag; env vars are the source of truth per contract §7.3. A CLI that wants flag-based opt-out reads the flag itself and calls a setter (see API).
- **No telemetry-glass-box verb.** `honeycomb telemetry --show` (contract §7.2) is Honeycomb's product surface, not a kit concern.

---

## API

```ts
// @legioncodeinc/cli-kit/telemetry

/**
 * Resolve whether telemetry should be emitted for the given tool.
 * Honors, in precedence order (first truthy opt-out wins):
 *   1. DO_NOT_TRACK       (any truthy value: 1, true, yes, on — non-empty)
 *   2. <TOOL>_TELEMETRY   (toolName.toUpperCase() + "_TELEMETRY"; accepts 0/false/off/no)
 *   3. HONEYCOMB_TELEMETRY (shared alias; accepts 0/false/off/no)
 * Returns true if the user has opted out (caller MUST NOT emit).
 */
export function isTelemetryOptedOut(toolName: string, env?: NodeJS.ProcessEnv): boolean;

/**
 * Hard-disable override. A CLI MAY call this at bootstrap to force opt-out
 * regardless of env (e.g. when a --no-telemetry flag was parsed, or when
 * the PostHog key is empty in a dev/source build). Idempotent.
 */
export function forceOptOut(): void;

/** Reset the hard-disable override (primarily for tests). */
export function resetOptOutOverride(): void;
```

The `env` parameter is optional (defaults to `process.env`) so the predicate is pure and unit-testable without mutating global state.

---

## Behavior (contract §7.1)

### Env-var precedence

`isTelemetryOptedOut(toolName)` evaluates in this order; the first layer that resolves to "opted out" short-circuits and returns `true`:

1. **`DO_NOT_TRACK`** — any non-empty value opts out (the cross-industry convention). Note: some specs require `=1` specifically; the kit follows the looser "non-empty" rule to match `DO_NOT_TRACK`'s real-world usage across CLIs.
2. **`<TOOL>_TELEMETRY`** — the tool's own var, uppercased from `toolName` (e.g. `isTelemetryOptedOut("nectar")` checks `NECTAR_TELEMETRY`). A value of `0`, `false`, `off`, or `no` (case-insensitive) opts out. Empty/unset does NOT opt out.
3. **`HONEYCOMB_TELEMETRY`** — the shared alias accepted across the suite for historical reasons. Same truthiness rule as `<TOOL>_TELEMETRY`.

If none of the three resolves to opt-out, returns `false` (telemetry MAY proceed, subject to the CLI's own key/payload logic).

### Truthiness rule

For `<TOOL>_TELEMETRY` and `HONEYCOMB_TELEMETRY`, the accepted opt-out values are `0`, `false`, `off`, `no` (case-insensitive). Any other non-empty value (e.g. `1`, `true`) is treated as *not opting out* — i.e. these vars are opt-OUT vars, not opt-IN vars. This matches Nectar's existing behavior (`nectar/src/telemetry/emit.ts:47-58`).

`DO_NOT_TRACK` is stricter: any non-empty value opts out (the convention is presence-based, not value-based).

### Composition with Doctor's persisted state

Doctor's resolver has two extra layers beyond env: a `state.json` opt-out and a pin (`opt-out.ts:73-105`). The kit's resolver does not replace those; Doctor calls `isTelemetryOptedOut("doctor")` for the env layers, then ORs in its own persisted-state check:

```ts
// In doctor's adopter code (illustrative):
const envOptOut = isTelemetryOptedOut("doctor");
const stateOptOut = readStateJsonOptOut(); // doctor-local
return envOptOut || stateOptOut;
```

This keeps the kit stateless while letting Doctor preserve its richer opt-out surface.

---

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-e1 | Given `DO_NOT_TRACK=1` is set, when `isTelemetryOptedOut("nectar")` is called, then it returns `true`, regardless of the other two vars. |
| AC-e2 | Given `DO_NOT_TRACK` is unset but `NECTAR_TELEMETRY=0` is set, when `isTelemetryOptedOut("nectar")` is called, then it returns `true`. |
| AC-e3 | Given only `HONEYCOMB_TELEMETRY=off` is set, when `isTelemetryOptedOut("nectar")` is called, then it returns `true` (shared alias honored). |
| AC-e4 | Given none of the three vars is set, when `isTelemetryOptedOut("nectar")` is called, then it returns `false` (telemetry MAY proceed). |
| AC-e5 | Given `NECTAR_TELEMETRY=true` (a non-opt-out value), when `isTelemetryOptedOut("nectar")` is called, then it returns `false` — the var is opt-OUT, not opt-IN, so `true` does not opt out. |
| AC-e6 | Given `DO_NOT_TRACK=` (empty string), when `isTelemetryOptedOut("nectar")` is called, then it returns `false` — empty is treated as unset for `DO_NOT_TRACK`. *(Edge case: confirm the spec; `DO_NOT_TRACK` convention is presence-based but empty-value is ambiguous. Kit treats empty as unset.)* |
| AC-e7 | Given `forceOptOut()` was called at bootstrap, when `isTelemetryOptedOut("nectar")` is called, then it returns `true` regardless of env. |
| AC-e8 | The predicate is pure: given the same `env` object, it returns the same result across calls. Verified by unit tests passing a frozen `env` literal. |
| AC-e9 | After Doctor adopts this resolver + layers its own `state.json` check, Doctor's `status` command still reports *which layer* disabled telemetry (contract §7 — status reports opt-out provenance). The kit's predicate does not need to report provenance; Doctor preserves its own reporting by checking each layer itself before/after the kit call. |

---

## Resolved decisions

- **Ship the resolver.** Honoring three env vars in one place kills the drift where each CLI checks a different subset. Decided on 2026-07-08.
- **`toolName` parameter, uppercased.** Each CLI passes its own name (`"nectar"`, `"doctor"`, `"hive"`, `"honeycomb"`); the resolver constructs `<TOOL>_TELEMETRY` via `toolName.toUpperCase() + "_TELEMETRY"`. No hardcoding.
- **`DO_NOT_TRACK` is presence-based (non-empty), the others are value-based.** Matches real-world `DO_NOT_TRACK` usage and Nectar's existing `<TOOL>_TELEMETRY` truthiness rule.
- **Persisted state stays in Doctor.** The kit is stateless env-only. Doctor composes its own `state.json`/pin check on top. This preserves Doctor's richer opt-out surface without bloating the kit.

---

## Related

- Contract §7.1 (opt-out env vars — the three-var mandate this module implements), §7.2 (`telemetry --show` — product surface, not kit), §7.3 (env is source of truth, not flags).
- Canonical sources: `doctor/src/cli/opt-out.ts` (richest resolver — env + state + pin), `nectar/src/telemetry/emit.ts:47-58` (env-only, the cleanest env rule), `hive/src/telemetry/emit.ts:73-86` (env-only subset).
