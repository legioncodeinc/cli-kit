/**
 * Telemetry opt-out resolver for the Apiary CLI suite.
 *
 * Implements CLI Contract §7.1: a single `isTelemetryOptedOut(toolName)`
 * predicate that every Apiary CLI calls before emitting telemetry. Honors
 * three env vars in a fixed precedence order (first truthy opt-out wins):
 *
 *   1. `DO_NOT_TRACK`         — presence-based: any non-empty value opts out.
 *   2. `<TOOL>_TELEMETRY`     — value-based: `0`/`false`/`off`/`no` opts out.
 *   3. `HONEYCOMB_TELEMETRY`  — shared alias; same value-based rule as #2.
 *
 * The `<TOOL>_TELEMETRY` and `HONEYCOMB_TELEMETRY` vars are opt-OUT vars, not
 * opt-IN: `1`/`true`/`on`/`yes` do NOT opt out. Only the explicit disable
 * values (`0`/`false`/`off`/`no`, case-insensitive) opt out.
 *
 * The module is stateless and env-only: it reads no files and persists nothing.
 * `forceOptOut()`/`resetOptOutOverride()` provide an in-memory hard-disable
 * override for CLI bootstrap (e.g. a parsed `--no-telemetry` flag, or a
 * missing PostHog key in a dev build). Consumers that need richer opt-out
 * surfaces (Doctor's `state.json` + pin) layer their own check on top.
 *
 * @see {@link ../library/requirements/backlog/prd-001-cli-kit/prd-001e-cli-kit-telemetry.md}
 */
/**
 * Resolve whether telemetry should be emitted for the given tool.
 *
 * Evaluation order (first opt-out layer short-circuits and returns `true`):
 *
 *   1. `DO_NOT_TRACK` — any **non-empty** value opts out (presence-based).
 *   2. `<TOOL>_TELEMETRY` — `toolName.toUpperCase() + "_TELEMETRY"`; a value of
 *      `0`/`false`/`off`/`no` (case-insensitive) opts out.
 *   3. `HONEYCOMB_TELEMETRY` — shared alias; same rule as #2.
 *
 * If none of the three resolves to opt-out, returns `false` (telemetry MAY
 * proceed, subject to the caller's own key/payload logic).
 *
 * The `env` parameter is optional (defaults to `process.env`) so the predicate
 * is pure and unit-testable without mutating global state.
 *
 * @param toolName  Tool name (e.g. `"nectar"`); uppercased to build `<TOOL>_TELEMETRY`.
 * @param env       Optional env dict; defaults to `process.env`.
 * @returns `true` if the user has opted out (caller MUST NOT emit).
 */
export declare function isTelemetryOptedOut(toolName: string, env?: NodeJS.ProcessEnv): boolean;
/**
 * Hard-disable override. Forces `isTelemetryOptedOut` to return `true`
 * regardless of env. A CLI MAY call this at bootstrap to force opt-out
 * (e.g. when a `--no-telemetry` flag was parsed, or when the PostHog key is
 * empty in a dev/source build). Idempotent.
 */
export declare function forceOptOut(): void;
/**
 * Reset the hard-disable override (primarily for tests). After this call,
 * `isTelemetryOptedOut` reverts to reading env only.
 */
export declare function resetOptOutOverride(): void;
