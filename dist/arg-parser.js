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
/** Strict integer matcher: optional sign, then one or more digits, nothing else. */
const INT_RE = /^[+-]?\d+$/;
/** Internal success constructor. */
const success = (args) => ({ ok: true, args });
/** Internal failure constructor. */
const failure = (error) => ({ ok: false, error });
/**
 * Build the human-readable constraint suffix for an int flag, e.g. `>= 1`,
 * `<= 100`, or `>= 1 and <= 100`. Empty string when neither bound is set.
 */
function intConstraint(spec) {
    const hasMin = spec.min !== undefined;
    const hasMax = spec.max !== undefined;
    if (hasMin && hasMax)
        return `>= ${spec.min} and <= ${spec.max}`;
    if (hasMin)
        return `>= ${spec.min}`;
    if (hasMax)
        return `<= ${spec.max}`;
    return "";
}
/**
 * Apply one resolved flag (long name already looked up) to the running `flags`
 * map. Handles the boolean presence rule, the required-value rule, and int
 * parsing + min/max validation. `inline` is the `=value` portion if present.
 * Returns the number of extra tokens to advance (1 when a value token was
 * consumed from `argv`), or a failure result.
 */
function applyFlag(spec, inline, argv, i, flags) {
    // Boolean: presence-only. An explicit `=value` (even `=true`) is a usage error.
    if (spec.kind === "boolean") {
        if (inline !== undefined) {
            return { ok: false, error: `--${spec.name} is a boolean flag and does not take a value` };
        }
        flags[spec.name] = true;
        return { ok: true, advance: 0 };
    }
    // string | int: a value is required (inline, or the next token).
    let value;
    let advance;
    if (inline !== undefined) {
        value = inline;
        advance = 0;
    }
    else {
        const next = argv[i + 1];
        if (next === undefined) {
            return { ok: false, error: `--${spec.name} requires a value` };
        }
        value = next;
        advance = 1;
    }
    if (spec.kind === "string") {
        flags[spec.name] = value;
        return { ok: true, advance };
    }
    // int: strict integer match first (rejects "5abc", "5.5", ""), then bounds.
    const constraint = intConstraint(spec);
    if (!INT_RE.test(value)) {
        const base = `--${spec.name} must be an integer`;
        return { ok: false, error: constraint ? `${base} ${constraint} (got "${value}")` : `${base} (got "${value}")` };
    }
    const num = Number.parseInt(value, 10);
    if (Number.isNaN(num)) {
        // Defensive: INT_RE guarantees parseability, but NaN is never an acceptable int.
        return { ok: false, error: `--${spec.name} must be an integer${constraint ? ` ${constraint}` : ""} (got "${value}")` };
    }
    if (spec.min !== undefined && num < spec.min) {
        return { ok: false, error: `--${spec.name} must be an integer >= ${spec.min} (got ${num})` };
    }
    if (spec.max !== undefined && num > spec.max) {
        return { ok: false, error: `--${spec.name} must be an integer <= ${spec.max} (got ${num})` };
    }
    flags[spec.name] = num;
    return { ok: true, advance };
}
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
export function parseArgs(argv, options) {
    // Never throw: even pathological input (non-strings, undefined) yields a ParseResult.
    try {
        const list = Array.isArray(argv) ? argv : [];
        // Index recognized flags by long name.
        const flagsByName = new Map();
        if (options?.flags) {
            for (const f of options.flags) {
                if (f && typeof f.name === "string")
                    flagsByName.set(f.name, f);
            }
        }
        // Reverse the aliases map: short char -> long name. { verbose: "v" } => "v" -> "verbose".
        const longByShort = new Map();
        if (options?.aliases) {
            for (const [longName, short] of Object.entries(options.aliases)) {
                if (typeof short === "string" && short.length > 0) {
                    longByShort.set(short, longName);
                }
            }
        }
        const maxPositionals = options?.maxPositionals;
        const flags = {};
        const positionals = [];
        for (let i = 0; i < list.length; i++) {
            const token = list[i];
            if (typeof token !== "string") {
                // Defensive: a non-string element can't be a flag or positional.
                return failure(`invalid argument at position ${i}`);
            }
            if (token.startsWith("--")) {
                // Long flag: `--name`, `--name=value`. (Bare `--` -> name "" -> unknown flag.)
                const body = token.slice(2);
                const eq = body.indexOf("=");
                const name = eq >= 0 ? body.slice(0, eq) : body;
                const inline = eq >= 0 ? body.slice(eq + 1) : undefined;
                const spec = flagsByName.get(name);
                if (!spec) {
                    return failure(`unknown flag: --${name}`);
                }
                const r = applyFlag(spec, inline, list, i, flags);
                if (!r.ok)
                    return r;
                i += r.advance;
            }
            else if (token.startsWith("-") && token.length > 1) {
                // Short alias: `-v`, `-v=value`, `-v value`. Recognized only if declared.
                const rest = token.slice(1);
                const eq = rest.indexOf("=");
                const aliasKey = eq >= 0 ? rest.slice(0, eq) : rest;
                const inline = eq >= 0 ? rest.slice(eq + 1) : undefined;
                const longName = longByShort.get(aliasKey);
                if (!longName) {
                    return failure(`unknown flag: -${aliasKey}`);
                }
                const spec = flagsByName.get(longName);
                if (!spec) {
                    // Alias points at a long name that isn't in the flag spec — treat as unknown.
                    return failure(`unknown flag: -${aliasKey}`);
                }
                const r = applyFlag(spec, inline, list, i, flags);
                if (!r.ok)
                    return r;
                i += r.advance;
            }
            else {
                // Positional. A bare `-` (length 1) is a positional by convention (stdin).
                positionals.push(token);
                if (maxPositionals !== undefined && positionals.length > maxPositionals) {
                    return failure(`too many positional arguments (max ${maxPositionals})`);
                }
            }
        }
        return success({ flags, positionals });
    }
    catch {
        // Absolute last-resort guard: the parser contract is "never throws".
        return failure("failed to parse arguments");
    }
}
