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
/**
 * Set color state at CLI bootstrap. Resolves env (`NO_COLOR` / `FORCE_COLOR`) and
 * the supplied (or default `process.stdout`) stream's TTY status.
 *
 * @param stream - Stream to resolve TTY against; defaults to `process.stdout`.
 */
export declare function setColorEnabled(stream?: NodeJS.WriteStream): void;
/**
 * Hard-disable color, regardless of env or TTY. Idempotent. Called at bootstrap
 * when the CLI is in `--json` mode (or any other context that must be monochrome).
 */
export declare function disableColor(): void;
/** True iff color is currently enabled. */
export declare function isColorEnabled(): boolean;
/** Bold intensity. Identity when color is disabled. */
export declare const bold: (s: string) => string;
/** Dim/faint intensity. Identity when color is disabled. */
export declare const dim: (s: string) => string;
/** Red foreground. Identity when color is disabled. */
export declare const red: (s: string) => string;
/** Green foreground. Identity when color is disabled. */
export declare const green: (s: string) => string;
/** Yellow foreground. Identity when color is disabled. */
export declare const yellow: (s: string) => string;
/** Cyan foreground. Identity when color is disabled. */
export declare const cyan: (s: string) => string;
/** Honeycomb amber — the brand accent (256-color foreground `38;5;214`). Identity when color is disabled. */
export declare const amber: (s: string) => string;
