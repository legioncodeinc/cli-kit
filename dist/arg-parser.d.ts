/**
 * @legioncodeinc/cli-kit/arg-parser — single shared argv parser (PRD-001d).
 *
 * One parser, one flag grammar, one validation vocabulary for every Apiary CLI
 * verb, replacing the sprawl where each CLI — and in Nectar's case each *verb* —
 * re-implemented its own `--flag value` / `--flag=value` scanner. The motivating
 * bug: Nectar's `brood --limit` allowed `0` while `search --limit` required `>=1`
 * — same flag name, different grammar, in the same binary. With this parser both
 * verbs declare the same {@link FlagSpec} and the inconsistency is gone by
 * construction.
 *
 * The parser is deliberately **not** a framework: it parses one verb's argv tail
 * into a typed result. It does not dispatch verbs, does not know about verb
 * tables, and does not impose a command architecture on consumers. Each CLI
 * keeps its own verb resolution and hands the parser the *tail*.
 *
 * Flag forms recognized:
 *   - `--flag`            boolean presence (true if present)
 *   - `--flag value`      string/int value as the next token
 *   - `--flag=value`      string/int value inline
 *   - `-v` / `-v value` / `-v=value`  short alias (only when declared in `aliases`)
 *
 * Boolean flags are presence-only in v1: an explicit `--verbose=false` or
 * `-v=true` is a usage error. Array/repeated flags (`--tag a --tag b`) are not
 * supported in v1.
 *
 * **Never throws.** Every malformed input yields `{ ok: false, error }`. The
 * caller feeds `result.error` to `parseError()` from `./exit-codes.js`, which
 * writes to stderr and returns `ExitCode.Usage` (`2`) — so parse failures
 * compose naturally into the contract's three-valued exit-code scheme.
 *
 * @see {@link ./exit-codes.js} `parseError` — the consumer-facing formatter.
 * @see {@link ../library/requirements/backlog/prd-001-cli-kit/prd-001d-cli-kit-arg-parser.md}
 * @see {@link ../library/notes/cli-contract.md} §9 (parse errors -> `2`).
 */
/** Specification for one recognized flag. */
export type FlagSpec = {
    name: string;
    kind: "boolean";
} | {
    name: string;
    kind: "string";
} | {
    name: string;
    kind: "int";
    min?: number;
    max?: number;
};
/** Per-verb parse options. All fields optional. */
export interface ParseOptions {
    /** Recognized flags for this verb. Unrecognized flags -> usage error. */
    flags?: FlagSpec[];
    /** Max number of positional args to collect; excess -> usage error. */
    maxPositionals?: number;
    /** Aliases: `{ verbose: "v" }` makes `-v` an alias of `--verbose`. */
    aliases?: Record<string, string>;
}
/** The parsed argv: flag values keyed by long name, plus ordered positionals. */
export interface ParsedArgs {
    /** Boolean/string/int flag values, keyed by long name. Absent flags are simply not present. */
    flags: Record<string, boolean | string | number>;
    /** Positional args in order. */
    positionals: string[];
}
/** Discriminated result: success carries args, failure carries a human-readable error. */
export type ParseResult = {
    ok: true;
    args: ParsedArgs;
} | {
    ok: false;
    error: string;
};
/**
 * Parse an argv tail (everything after the verb) against a flag spec.
 *
 * Pure and total: takes `argv`, returns a {@link ParseResult}, touches nothing
 * else, and **never throws**. On error the caller passes `result.error` to
 * `parseError()` from `./exit-codes.js` (which returns `ExitCode.Usage`, `2`).
 *
 * @param argv - The argv tail to parse (typically `process.argv.slice(offset)`).
 * @param options - Per-verb flag spec, positional cap, and short aliases.
 * @returns `{ ok: true, args }` on success, or `{ ok: false, error }` on any
 *   malformed input.
 */
export declare function parseArgs(argv: string[], options?: ParseOptions): ParseResult;
