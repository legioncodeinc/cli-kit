/**
 * @legioncodeinc/cli-kit — barrel export (the single public surface).
 *
 * Zero-dependency CLI mechanism kit for the Apiary CLI suite. Every module is
 * re-exported from here so consumers import from the package root only:
 *
 *   import { parseArgs, parseError, bold, formatUsage } from "@legioncodeinc/cli-kit";
 *
 * AC-2 (root-only exports, typed surface): this barrel is the canonical import
 * path, and the emitted `dist/index.d.ts` carries the full typed surface. The
 * `exports` map in package.json points `.` at `dist/index.js` / `dist/index.d.ts`
 * so deep imports into individual modules are not part of the public contract.
 *
 * The six modules (exit-codes, color, telemetry, arg-parser, shutdown, usage)
 * were verified at wiring time to have NO export-name collisions, so a flat
 * `export *` is safe here — no namespacing or renaming is required.
 *
 * @see {@link ../library/notes/cli-contract.md} for the normative contract.
 * @see {@link ../library/requirements/backlog/prd-001-cli-kit/prd-001-cli-kit-index.md} for scope.
 */

export * from "./exit-codes.js";
export * from "./color.js";
export * from "./telemetry.js";
export * from "./arg-parser.js";
export * from "./shutdown.js";
export * from "./usage.js";

/**
 * Semantic version of the kit. Single-sourced from package.json at release time
 * (the publish flow rewrites this via npm-version or a release script); kept as
 * a literal here so the value is available at runtime without a JSON parse.
 */
export const VERSION = "0.1.0";
