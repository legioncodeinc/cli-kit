# PRD-001d: cli-kit — Arg Parser

> **Parent:** [`prd-001-cli-kit-index.md`](./prd-001-cli-kit-index.md)
> **Status:** Draft
> **Canonical source:** `doctor/src/cli/arg-parse.ts:31-70` (cleanest single implementation)
> **Anti-pattern being collapsed:** Nectar's 5 bespoke parsers (`parseLoginFlags`, `parseBroodArgs`, `parseSearchArgs`, `parseBroodingArgs`, inline `args.includes(...)`)

---

## Overview

A single, shared argv parser that every Apiary CLI verb uses, replacing the current sprawl where each CLI — and in Nectar's case, each *verb* — re-implements its own `--flag value` / `--flag=value` scanner. The motivating bug: Nectar's `brood --limit` allows `0` (`brooding/cli.ts:66`) while `search --limit` requires `≥1` (`cli.ts:961`). Same flag name, different grammar, in the same binary, because there are five parsers and no shared contract.

The kit's parser is deliberately **not** a framework. It parses one verb's argv tail into a typed result; it does not dispatch, does not know about verb tables, and does not impose a command architecture on consumers.

---

## Goals

- One parser, one flag grammar, one validation vocabulary — so `--limit` means the same thing everywhere by construction.
- Supports both `--flag value` and `--flag=value` forms (both already used across the suite; the parser unifies them).
- Distinguishes boolean flags, string flags, integer flags, and positional collection — so per-verb validation (positive int, non-empty string, enum membership) is declarative, not hand-rolled.
- Returns a typed result that makes parse errors return `ExitCode.Usage` (`2`) via the exit-codes module, collapsing the "parse → on error print usage + return 2" boilerplate.

## Non-Goals

- **No command dispatch.** The parser does not route verbs. It parses the argv *tail* handed to it by the consumer's dispatcher (Honeycomb's `dispatch.ts`, Doctor's `route()`, etc.). Each CLI keeps its own verb resolution.
- **No global-flag-before-verb parsing.** Global flags like `--json`/`--dry-run` are parsed by each CLI's central layer (the contract defines them as "parsed before the verb"), not by this per-verb parser. This parser is for the *verb's own* flags and positionals.
- **No POSIX `--` separator semantics in v1.** If a consumer needs pass-through args (rare for this suite), it's a v2 addition.
- **No subcommand nesting.** A verb that has subcommands (e.g., `memory conflicts resolve`) calls the parser once per level with the sliced tail. The parser is flat.

---

## API

```ts
// @legioncodeinc/cli-kit/arg-parser

export type FlagSpec =
  | { name: string; kind: "boolean" }
  | { name: string; kind: "string" }
  | { name: string; kind: "int"; min?: number; max?: number };

export interface ParseOptions {
  /** Recognized flags for this verb. Unrecognized flags → usage error. */
  flags?: FlagSpec[];
  /** Max number of positional args to collect; excess → usage error. */
  maxPositionals?: number;
  /** Aliases: { verbose: "v" } makes -v an alias of --verbose. */
  aliases?: Record<string, string>;
}

export interface ParsedArgs {
  /** Boolean/string/int flag values, keyed by long name. */
  flags: Record<string, boolean | string | number>;
  /** Positional args in order. */
  positionals: string[];
}

export type ParseResult =
  | { ok: true; args: ParsedArgs }
  | { ok: false; error: string }; // human-readable, ready for parseError()

/**
 * Parse an argv tail (everything after the verb) against a flag spec.
 * Never throws — returns a ParseResult. On error, the caller passes
 * result.error to parseError() from the exit-codes module.
 */
export function parseArgs(argv: string[], options?: ParseOptions): ParseResult;
```

The `FlagSpec.kind: "int"` with `min`/`max` is what kills the `--limit` inconsistency: both `brood` and `search` declare `{ name: "limit", kind: "int", min: 1 }` (or `min: 0` — the *contract* decides once, not the verb).

---

## Behavior

1. **Flag forms.** `--flag`, `--flag value`, `--flag=value` all recognized. A boolean flag is `true` if present, absent if not (never requires a value); an explicit `--flag=false` / `--flag=true` is a **usage error** (booleans are presence-only in v1). A string/int flag requires a value (next token or `=value`); missing value → usage error.
2. **Aliases.** Short forms via `aliases`. `-v` → `--verbose` when `aliases: { verbose: "v" }`. Aliases are per-verb, not global — the contract reserves `-v`/`-V`/`-h` meanings, and verbs opt in.
3. **Unknown flags.** Any `--token` not in `flags` → usage error (returns `{ ok: false, error }`). This is stricter than today's behavior in some CLIs (Nectar's parsers reject unknown flags too; this codifies it suite-wide). A verb that wants permissive parsing MAY pass an explicit `allowUnknown: true` in `ParseOptions` (v1.1; not in v1).
4. **Int validation.** `kind: "int"` parses with `Number.parseInt` and validates against `min`/`max` if present. Non-numeric, out-of-range, or `NaN` → usage error with a message naming the flag and the constraint.
5. **Positionals.** Collected in order. If `maxPositionals` is set and exceeded → usage error.
6. **No mutation.** The parser is pure: takes `argv`, returns `ParseResult`, touches nothing else.

---

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-d1 | Given `["--limit", "5"]` and `flags: [{ name: "limit", kind: "int", min: 1 }]`, when parsed, then `result.args.flags.limit === 5` and `result.ok === true`. |
| AC-d2 | Given `["--limit=5"]` with the same spec, when parsed, then the result is identical to AC-d1 (the `=` form is equivalent). |
| AC-d3 | Given `["--limit", "0"]` and `min: 1`, when parsed, then `result.ok === false` and `result.error` names the constraint (`limit must be ≥ 1`). |
| AC-d4 | Given `["--limit", "abc"]`, when parsed, then `result.ok === false` and `result.error` names the flag as not-a-number. |
| AC-d5 | Given `["--unknown"]` with `flags` not listing it, when parsed, then `result.ok === false` and `result.error` names the unknown flag. |
| AC-d6 | Given `["-v"]` with `aliases: { verbose: "v" }` and `flags: [{ name: "verbose", kind: "boolean" }]`, when parsed, then `result.args.flags.verbose === true`. |
| AC-d7 | Given `["file.txt"]` with `maxPositionals: 1`, when parsed, then `result.args.positionals === ["file.txt"]`. Given `["a", "b"]` with `maxPositionals: 1`, then `result.ok === false`. |
| AC-d8 | Given a successful Nectar migration where both `brood` and `search` use this parser with identical `{ name: "limit", kind: "int", min: 1 }` specs, when `brood --limit 0` and `search --limit 0` are invoked, then both produce the same usage error — the pre-kit inconsistency is gone. |
| AC-d9 | The parser never throws; every malformed input yields `{ ok: false, error }`. Verified by fuzzing the parser with arbitrary string arrays in a test. |

---

## Resolved decisions

- **`--limit` standard: `min: 1`.** The suite-standard minimum for `--limit` flags is `1`. A limit of 0 is semantically "do nothing" and should be a different invocation, not a zero-valued limit. This retires Nectar's `brood`-vs-`search` split: both verbs declare `{ name: "limit", kind: "int", min: 1 }` post-adoption. This is also a contract-level ruling (contract §8), not just a kit decision.
- **Array flags: out of v1.** Repeated flags (`--tag a --tag b` → array) are not supported in v1. Consumers needing multi-value use comma-separated strings — Honeycomb's `--users a,b` already does. Array flags may land in v1.1 only if a concrete consumer need appears.
- **`--bool=false`: usage error.** Boolean flags are presence-only in v1. An explicit value on a boolean (`--verbose=false`) is rejected as a usage error. Simpler mental model; no current consumer needs the explicit form.

---

## Related

- Contract §8 (global flags — note this parser is for *per-verb* flags, not globals), §9 (parse errors → `2`).
- Canonical: `doctor/src/cli/arg-parse.ts` — the cleanest single-verb parser in the suite today.
- Anti-pattern: `nectar/src/cli.ts` and `nectar/src/brooding/cli.ts` — five bespoke parsers producing the `--limit` inconsistency this module retires.
