/**
 * @legioncodeinc/cli-kit/color — ANSI SGR string helpers (PRD-001a).
 *
 * Zero-dependency color module for the Apiary CLI suite. A small set of named
 * text-style helpers (`bold`, `dim`, `red`, `green`, `yellow`, `cyan`, plus the
 * brand `amber` accent) that wrap strings in ANSI SGR escape codes when color is
 * enabled, and degrade to identity functions when it is not.
 *
 * Color enabled/disabled is resolved ONCE at CLI bootstrap via
 * {@link setColorEnabled} (env + TTY) or hard-forced off via {@link disableColor}
 * (e.g. when the CLI parsed `--json`). The style helpers read that module state at
 * call time, matching `picocolors`/`chalk` ergonomics with no per-call verbosity.
 *
 * Resolution order (contract §11.1):
 *   1. `NO_COLOR` present in env (ANY value, including the empty string) → disabled.
 *      Presence-based per the no-color.org spec.
 *   2. `FORCE_COLOR` present and non-empty → enabled, regardless of TTY.
 *   3. Otherwise → `stream.isTTY === true` (default stream is `process.stdout`).
 *
 * `--json` is intentionally NOT handled here: the caller parses flags and calls
 * `disableColor()` when JSON output mode is active. The color module owns env + TTY;
 * the CLI owns flag parsing.
 *
 * The exact SGR resets are per-style (not a blunt `\x1b[0m`): intensity styles
 * (bold/dim) reset with `22`, foreground colors reset with `39`. This preserves
 * surrounding intensity when only color is toggled and vice versa.
 *
 * @see {@link ../library/requirements/backlog/prd-001-cli-kit/prd-001a-cli-kit-color.md}
 * @see {@link ../library/notes/cli-contract.md} §11.1
 */
/** Escape introducer (CSI). */
const ESC = "\x1b";
/** SGR sequence: `ESC [ <params> m`. */
const sgr = (code) => `${ESC}[${code}m`;
/** Internal color-enabled flag. Defaults to false (safe: no color until bootstrap). */
let enabled = false;
/**
 * Resolve whether color should be enabled for `stream`, given the current
 * `process.env`. Implements the contract §11.1 precedence.
 *
 * @param stream - Target stream; defaults to `process.stdout`. Callers may pass
 *   `process.stderr` to resolve stderr independently (it may be a TTY when stdout
 *   is piped).
 */
function resolveEnabled(stream) {
    const env = process.env;
    // 1. NO_COLOR — presence (any value, including empty string) disables.
    if (env.NO_COLOR !== undefined)
        return false;
    // 2. FORCE_COLOR — present and non-empty forces color on, regardless of TTY.
    const force = env.FORCE_COLOR;
    if (force !== undefined && force !== "")
        return true;
    // 3. Otherwise: enabled iff the target stream is a TTY.
    const target = stream ?? process.stdout;
    return target.isTTY === true;
}
/**
 * Set color state at CLI bootstrap. Resolves env (`NO_COLOR` / `FORCE_COLOR`) and
 * the supplied (or default `process.stdout`) stream's TTY status.
 *
 * @param stream - Stream to resolve TTY against; defaults to `process.stdout`.
 */
export function setColorEnabled(stream) {
    enabled = resolveEnabled(stream);
}
/**
 * Hard-disable color, regardless of env or TTY. Idempotent. Called at bootstrap
 * when the CLI is in `--json` mode (or any other context that must be monochrome).
 */
export function disableColor() {
    enabled = false;
}
/** True iff color is currently enabled. */
export function isColorEnabled() {
    return enabled;
}
/**
 * Wrap `s` in an SGR open/close pair when color is enabled; return `s` unchanged
 * otherwise. Reads the live module flag at call time so bootstrap mutations apply.
 */
function paint(s, open, close) {
    return enabled ? `${open}${s}${close}` : s;
}
/** Bold intensity. Identity when color is disabled. */
export const bold = (s) => paint(s, sgr("1"), sgr("22"));
/** Dim/faint intensity. Identity when color is disabled. */
export const dim = (s) => paint(s, sgr("2"), sgr("22"));
/** Red foreground. Identity when color is disabled. */
export const red = (s) => paint(s, sgr("31"), sgr("39"));
/** Green foreground. Identity when color is disabled. */
export const green = (s) => paint(s, sgr("32"), sgr("39"));
/** Yellow foreground. Identity when color is disabled. */
export const yellow = (s) => paint(s, sgr("33"), sgr("39"));
/** Cyan foreground. Identity when color is disabled. */
export const cyan = (s) => paint(s, sgr("36"), sgr("39"));
/** Honeycomb amber — the brand accent (256-color foreground `38;5;214`). Identity when color is disabled. */
export const amber = (s) => paint(s, sgr("38;5;214"), sgr("39"));
