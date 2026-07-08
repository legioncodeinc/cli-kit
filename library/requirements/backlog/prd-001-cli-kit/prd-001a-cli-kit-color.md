# PRD-001a: cli-kit — Color

> **Parent:** [`prd-001-cli-kit-index.md`](./prd-001-cli-kit-index.md)
> **Status:** Draft
> **Canonical source:** `doctor/src/cli/colors.ts:44-50`

---

## Overview

A zero-dependency set of ANSI SGR string helpers (`bold`, `dim`, `red`, `green`, `yellow`, `cyan`, and a brand `amber` accent) that automatically disable themselves based on environment and TTY state. This is the module that lets every Apiary CLI honor CLI Contract §11.1 without each one re-implementing the env-detection logic.

Today only `doctor` emits color. `honeycomb`, `hive`, and `nectar` are monochrome. Adopting this module is the single cheapest way to lift those three to contract conformance on the color axis.

---

## Goals

- One implementation of the `NO_COLOR` / `FORCE_COLOR` / TTY-detection rule, lifted from Doctor.
- Identical SGR helper names across the suite so consumer code reads the same.
- Zero runtime dependencies; pure string concatenation.

## Non-Goals

- No 256-color / truecolor palette beyond the brand `amber` accent (code `38;5;214`). The kit ships the named helpers Doctor already uses; callers who need more can hand-roll SGR.
- No theme system, no token layer, no light/dark awareness. The kit returns strings; the caller decides context.
- No color stripping / `stripAnsi` helper in v1. (If a consumer needs to strip color for piped output, that's a separate concern — and the env-detection should already have disabled color in that case.)

---

## API

Module-level singleton: color enabled state is set once at CLI bootstrap (via `setColorEnabled` / `disableColor`), and the style helpers read that module state at call time. This matches the `picocolors`/`chalk` ergonomics and keeps call sites terse.

```ts
// @legioncodeinc/cli-kit/color

/**
 * Set once at CLI bootstrap. Resolves env + TTY at the moment of the call.
 * Default: enabled iff (no NO_COLOR) and (FORCE_COLOR set OR stdout.isTTY).
 * Pass an explicit stream to resolve against stderr vs stdout independently
 * (stderr may be a TTY when stdout is piped).
 */
export function setColorEnabled(stream?: NodeJS.WriteStream): void;

/** Hard-disable color. Called at bootstrap when the CLI is in --json mode. */
export function disableColor(): void;

/** True iff color is currently enabled. */
export function isColorEnabled(): boolean;

/** Text style helpers. Each returns the input unchanged when color is disabled. */
export const bold:  (s: string) => string;
export const dim:   (s: string) => string;
export const red:   (s: string) => string;
export const green: (s: string) => string;
export const yellow:(s: string) => string;
export const cyan:  (s: string) => string;
export const amber: (s: string) => string; // brand accent, SGR 38;5;214
```

The typical consumer bootstrap is `setColorEnabled()` (auto-resolve), or `setColorEnabled()` then `disableColor()` when the CLI detected `--json`.

---

## Behavior (contract §11.1)

The `shouldColor(stream)` predicate resolves in this precedence:

1. If `NO_COLOR` is set in the environment (any value, including empty) → **false**. (`NO_COLOR` spec: presence, not value.)
2. Else if `FORCE_COLOR` is set and truthy (`1`, `true`, non-empty) → **true**, regardless of TTY.
3. `--json` is not handled inside the color module. The color module is `--json`-agnostic; the caller (which parses `--json`) calls `disableColor()` at bootstrap when JSON output mode is active. This keeps the separation of concerns clean — the color module owns env+TTY detection, the CLI owns flag parsing.
4. Else → `stream.isTTY === true`.

When `shouldColor` returns false, every style helper MUST return its input string unmodified (identity function). This is the degradation contract.

---

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-a1 | Given `NO_COLOR` is set (even to empty string), when `shouldColor(stdout)` is called, then it returns `false`. |
| AC-a2 | Given `FORCE_COLOR=1` and stdout is a pipe (not TTY), when `shouldColor(stdout)` is called, then it returns `true`. |
| AC-a3 | Given neither env var is set and stdout `isTTY === true`, when `shouldColor(stdout)` is called, then it returns `true`. |
| AC-a4 | Given neither env var is set and stdout `isTTY === false`, when `shouldColor(stdout)` is called, then it returns `false`. |
| AC-a5 | Given color is disabled, when any style helper (`bold("x")`, `amber("y")`, …) is invoked, then it returns the input string unchanged (no SGR codes). |
| AC-a6 | Given color is enabled, when `amber("hi")` is invoked, then the returned string wraps `hi` in SGR `38;5;214` (foreground) + reset. |
| AC-a7 | The module imports cleanly with zero `dependencies` in `package.json`; verified by `npm pack --dry-run` showing no bundled deps. |

---

## Resolved decisions

- **API shape: module-level singleton.** `setColorEnabled()` set once at bootstrap; helpers read module state. Matches `picocolors`/`chalk` ergonomics; minimal call-site verbosity. A factory form was rejected as over-engineering for the kit's size.
- **`--json` awareness: caller-side.** The color module is `--json`-agnostic. The CLI (which parses `--json`) calls `disableColor()` at bootstrap when JSON output mode is active. Clean separation: color owns env+TTY, CLI owns flags.

---

## Related

- Contract §11.1 (color rules), §8.1 (`--json` implies no color).
- Canonical: `doctor/src/cli/colors.ts` — the full SGR code map and the env-detection predicate.
