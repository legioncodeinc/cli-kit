/**
 * @legioncodeinc/cli-kit/exit-codes — exit-code scheme and formatting helpers.
 *
 * Encodes the CLI Contract §9 three-valued exit-code scheme:
 *   `0` success, `1` runtime failure, `2` usage/parse error.
 *
 * Plus the contract ruling that **declined confirmations are `0`, not `2`**:
 * a user's deliberate "no" is intentional output, not failure. Doctor's
 * `EXIT_DECLINED=2` precedent is deliberately retired by this module —
 * `declined()` returns `EXIT_OK` and writes to stdout, and `EXIT_DECLINED`
 * is never defined here.
 *
 * These helpers **return** exit codes; they do NOT call `process.exit`.
 * Callers assign the return value to `process.exitCode` (or return it from a
 * dispatch function), matching Doctor's "handlers return numbers, the
 * dispatcher never calls process.exit" pattern.
 *
 * @see {@link ../library/notes/cli-contract.md} §9 — the normative contract.
 * @see {@link ../library/requirements/backlog/prd-001-cli-kit/prd-001c-cli-kit-exit-codes.md}
 */
/**
 * The three-valued exit-code scheme. Do not expand this taxonomy: a richer set
 * (e.g. `Network=3`, `Permission=4`) harms scriptability. If a future need
 * arises, it goes through a contract amendment, not a kit addition.
 */
export declare enum ExitCode {
    /** Success — command completed, or a read-only command found a healthy state. */
    Ok = 0,
    /** Runtime failure — daemon unreachable, network error, mutation rolled back. */
    Error = 1,
    /** Usage/parse error — unknown verb, bad flag, missing positional. Never reached the handler. */
    Usage = 2
}
/**
 * Backwards-compatible aliases matching Doctor's existing constant names
 * (`doctor/src/cli/dispatch.ts:32-34`), so consumers can adopt the kit with a
 * pure import-path change. Byte-identical in value (0, 1, 2).
 *
 * NOTE: `EXIT_DECLINED` is deliberately NOT defined. Doctor's
 * `EXIT_DECLINED=2` is the non-conformance this module retires; the
 * `declined()` helper encodes the corrected `0`-for-abort behavior.
 */
export declare const EXIT_OK = ExitCode.Ok;
export declare const EXIT_ERROR = ExitCode.Error;
export declare const EXIT_USAGE = ExitCode.Usage;
/**
 * Format a usage error: write the message (+ optional usage hint) to **stderr**
 * and return `EXIT_USAGE`. For parse errors, unknown verbs, bad flags, missing
 * positionals. Usage diagnostics go to stderr (not stdout) so command pipelines
 * stay clean.
 *
 * @param message - The human-readable error description.
 * @param usageText - Optional usage/flag reference appended on its own line.
 * @returns `ExitCode.Usage` (`2`), for the caller to assign to `process.exitCode`.
 */
export declare function parseError(message: string, usageText?: string): ExitCode;
/**
 * Format a user-declined confirmation: write the message to **stdout** and
 * return `EXIT_OK`. A user's deliberate "no" is intentional output (scripts
 * reading stdout see the decision), not an error — contract §9.
 *
 * @param message - The human-readable description of what was declined.
 * @returns `ExitCode.Ok` (`0`), for the caller to assign to `process.exitCode`.
 */
export declare function declined(message: string): ExitCode;
//# sourceMappingURL=exit-codes.d.ts.map