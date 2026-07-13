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
export { declined, EXIT_ERROR, EXIT_OK, EXIT_USAGE, ExitCode, parseError } from "./exit-codes.js";
export { amber, bold, cyan, dim, disableColor, green, isColorEnabled, red, setColorEnabled, yellow } from "./color.js";
export { forceOptOut, isTelemetryOptedOut, resetOptOutOverride } from "./telemetry.js";
export { parseArgs } from "./arg-parser.js";
export { finalizeOneShot, isOneShot } from "./shutdown.js";
export { formatUsage } from "./usage.js";
export { VERSION } from "./generated/version.js";
export { emitJson, setJsonMode } from "./json-output.js";
export { confirm } from "./confirm.js";
export { apiaryHome, ConfigDirError, migrateLegacyConfig, resolveConfigDir } from "./config-dir.js";
export { readPackageVersion } from "./package-version.js";
