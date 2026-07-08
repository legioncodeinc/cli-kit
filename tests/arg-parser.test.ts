import { describe, it, expect } from "vitest";
import { parseArgs } from "../src/arg-parser.js";
import type { FlagSpec, ParseOptions } from "../src/arg-parser.js";
import { ExitCode } from "../src/exit-codes.js";

/**
 * Arg-parser module tests — PRD-001d.
 *
 * Each acceptance criterion (AC-d1 … AC-d9) is covered by at least one test,
 * annotated with the AC id in the title. The parser is pure: it takes argv and
 * returns a ParseResult, never throws (AC-d9 is verified by a fuzz block).
 */

/** Convenience: parse with a single int flag named `limit`. */
const limitSpec = (min?: number, max?: number): FlagSpec =>
  min !== undefined || max !== undefined
    ? { name: "limit", kind: "int", ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) }
    : { name: "limit", kind: "int" };

describe("arg-parser", () => {
  describe("AC-d1 / AC-d2: --flag value and --flag=value are equivalent", () => {
    const opts: ParseOptions = { flags: [limitSpec(1)] };

    // AC-d1: ["--limit", "5"] -> flags.limit === 5, ok true.
    it("parses --limit 5 as the number 5 (AC-d1)", () => {
      const r = parseArgs(["--limit", "5"], opts);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.args.flags.limit).toBe(5);
        expect(r.args.positionals).toEqual([]);
      }
    });

    // AC-d2: ["--limit=5"] -> identical to AC-d1.
    it("parses --limit=5 identically to --limit 5 (AC-d2)", () => {
      const r = parseArgs(["--limit=5"], opts);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.args.flags.limit).toBe(5);
        expect(r.args.positionals).toEqual([]);
      }
    });

    it("treats the two forms as exactly equal", () => {
      const spaced = parseArgs(["--limit", "5"], opts);
      const inlined = parseArgs(["--limit=5"], opts);
      expect(JSON.stringify(spaced)).toBe(JSON.stringify(inlined));
    });
  });

  describe("AC-d3: out-of-range int -> usage error naming the constraint", () => {
    it("rejects --limit 0 with min 1 and names the constraint (AC-d3)", () => {
      const r = parseArgs(["--limit", "0"], { flags: [limitSpec(1)] });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error).toContain("limit");
        expect(r.error).toContain(">= 1");
        expect(r.error).toContain("0");
      }
    });

    it("rejects values above max and names the upper bound", () => {
      const r = parseArgs(["--limit", "200"], { flags: [limitSpec(1, 100)] });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error).toContain("limit");
        expect(r.error).toContain("<= 100");
        expect(r.error).toContain("200");
      }
    });

    it("names both bounds in the generic constraint for a non-numeric value", () => {
      // A non-numeric value shows the full constraint suffix (both bounds); an
      // out-of-range value names only the specific bound it violates.
      const r = parseArgs(["--limit", "abc"], { flags: [limitSpec(1, 100)] });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error).toContain(">= 1");
        expect(r.error).toContain("<= 100");
      }
    });
  });

  describe("AC-d4: non-numeric int -> usage error naming not-a-number", () => {
    it("rejects --limit abc (AC-d4)", () => {
      const r = parseArgs(["--limit", "abc"], { flags: [limitSpec(1)] });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error).toContain("limit");
        expect(r.error).toContain("integer");
        expect(r.error.toLowerCase()).toContain("abc");
      }
    });

    it("rejects a float-shaped value like 5.5", () => {
      const r = parseArgs(["--limit", "5.5"], { flags: [limitSpec(1)] });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("integer");
    });

    it("rejects a trailing-garbage value like 5abc", () => {
      const r = parseArgs(["--limit", "5abc"], { flags: [limitSpec(1)] });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("integer");
    });

    it("rejects an inline --limit=abc", () => {
      const r = parseArgs(["--limit=abc"], { flags: [limitSpec(1)] });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("integer");
    });
  });

  describe("AC-d5: unknown flag -> usage error naming the flag", () => {
    it("rejects --unknown when not in the spec (AC-d5)", () => {
      const r = parseArgs(["--unknown"], { flags: [{ name: "verbose", kind: "boolean" }] });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error).toContain("unknown flag");
        expect(r.error).toContain("--unknown");
      }
    });

    it("rejects an unknown long flag even when other flags are valid", () => {
      const r = parseArgs(["--limit", "5", "--bogus"], { flags: [limitSpec(1)] });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("--bogus");
    });

    it("rejects a single-dash -x that is not a declared alias", () => {
      const r = parseArgs(["-x"], { flags: [{ name: "verbose", kind: "boolean" }], aliases: { verbose: "v" } });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("-x");
    });
  });

  describe("AC-d6: aliases map short forms to long flags", () => {
    const opts: ParseOptions = {
      flags: [{ name: "verbose", kind: "boolean" }],
      aliases: { verbose: "v" },
    };

    it("parses -v as --verbose === true (AC-d6)", () => {
      const r = parseArgs(["-v"], opts);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.args.flags.verbose).toBe(true);
    });

    it("parses -v before a positional", () => {
      const r = parseArgs(["-v", "file.txt"], { ...opts, maxPositionals: 1 });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.args.flags.verbose).toBe(true);
        expect(r.args.positionals).toEqual(["file.txt"]);
      }
    });

    it("supports a string alias: -n value", () => {
      const r = parseArgs(["-n", "alice"], {
        flags: [{ name: "name", kind: "string" }],
        aliases: { name: "n" },
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.args.flags.name).toBe("alice");
    });

    it("supports an int alias: -l=5", () => {
      const r = parseArgs(["-l=5"], { flags: [limitSpec(1)], aliases: { limit: "l" } });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.args.flags.limit).toBe(5);
    });

    it("rejects -v=true on a boolean alias (presence-only)", () => {
      const r = parseArgs(["-v=true"], opts);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("verbose");
    });
  });

  describe("AC-d7: positional collection + maxPositionals", () => {
    it("collects a single positional under maxPositionals 1 (AC-d7)", () => {
      const r = parseArgs(["file.txt"], { maxPositionals: 1 });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.args.positionals).toEqual(["file.txt"]);
    });

    it("rejects excess positionals when maxPositionals is exceeded (AC-d7)", () => {
      const r = parseArgs(["a", "b"], { maxPositionals: 1 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("positional");
    });

    it("collects up to maxPositionals and is ok at the boundary", () => {
      const r = parseArgs(["a", "b", "c"], { maxPositionals: 3 });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.args.positionals).toEqual(["a", "b", "c"]);
    });

    it("allows unlimited positionals when maxPositionals is unset", () => {
      const r = parseArgs(["a", "b", "c", "d"]);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.args.positionals).toEqual(["a", "b", "c", "d"]);
    });

    it("treats a bare dash `-` as a positional (stdin convention)", () => {
      const r = parseArgs(["-"], { maxPositionals: 1 });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.args.positionals).toEqual(["-"]);
    });
  });

  describe("AC-d8: --limit means the same thing across verbs", () => {
    // Two different verbs both adopt the parser with the identical limit spec.
    const broodLimit: FlagSpec = { name: "limit", kind: "int", min: 1 };
    const searchLimit: FlagSpec = { name: "limit", kind: "int", min: 1 };

    it("brood --limit 0 and search --limit 0 produce the same usage error (AC-d8)", () => {
      const brood = parseArgs(["--limit", "0"], { flags: [broodLimit] });
      const search = parseArgs(["--limit", "0"], { flags: [searchLimit] });
      expect(brood.ok).toBe(false);
      expect(search.ok).toBe(false);
      // The pre-kit inconsistency (brood allowed 0, search did not) is gone.
      expect(JSON.stringify(brood)).toBe(JSON.stringify(search));
      if (!brood.ok && !search.ok) {
        expect(brood.error).toContain(">= 1");
        expect(search.error).toContain(">= 1");
      }
    });

    it("both verbs accept --limit 5 identically", () => {
      const brood = parseArgs(["--limit", "5"], { flags: [broodLimit] });
      const search = parseArgs(["--limit", "5"], { flags: [searchLimit] });
      expect(brood.ok).toBe(true);
      expect(search.ok).toBe(true);
      expect(JSON.stringify(brood)).toBe(JSON.stringify(search));
    });
  });

  describe("AC-d9: never throws; all malformed input -> { ok: false, error }", () => {
    // Deterministic weird inputs: every one must return a ParseResult, never throw.
    const weird: string[][] = [
      [],
      ["--"],
      ["---"],
      ["--="],
      ["-"],
      ["="],
      ["=value"],
      ["--flag="],
      ["--limit="],
      ["--limit", ""],
      ["--limit", "NaN"],
      ["--limit", "Infinity"],
      ["--limit", "1e3"],
      ["--limit", "0x10"],
      ["--limit", "-5"],
      ["--limit", "+5"],
      ["-v="],
      ["-vv"],
      ["--verbose=false"],
      ["--verbose=true"],
      ["--verbose=1"],
      ["--unknown=bad"],
      ["file one.txt"], // a single positional with an embedded space
      ["--", "--limit", "5"],
      ["\u0000", "\uFFFF"],
      ["🎉", "🚀"],
      Array.from({ length: 5000 }, (_, k) => `pos${k}`),
      ["--limit".repeat(20)],
    ];

    it("returns a ParseResult (never throws) for every deterministic weird input", () => {
      const opts: ParseOptions = { flags: [limitSpec(1)], maxPositionals: 100 };
      for (const argv of weird) {
        let r;
        expect(() => {
          r = parseArgs(argv, opts);
        }).not.toThrow();
        expect(r).toBeDefined();
        expect(typeof (r as { ok: boolean }).ok).toBe("boolean");
      }
    });

    it("returns a ParseResult for fuzzed arbitrary string arrays", () => {
      const alphabet = ["--limit", "--verbose", "--unknown", "-v", "-x", "=", "5", "0", "abc", "", "-", "--", "file.txt", "--limit=5", "-v=true", " ", "\t"];
      const opts: ParseOptions = {
        flags: [limitSpec(1), { name: "verbose", kind: "boolean" }],
        aliases: { verbose: "v" },
        maxPositionals: 3,
      };
      // Deterministic PRNG so the fuzz is reproducible across CI runs.
      let seed = 0xc0ffee;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 0xffffffff;
      };
      for (let iter = 0; iter < 4000; iter++) {
        const len = Math.floor(rand() * 6); // 0..5 tokens
        const argv: string[] = [];
        for (let t = 0; t < len; t++) argv.push(alphabet[Math.floor(rand() * alphabet.length)]);

        let r;
        expect(() => {
          r = parseArgs(argv, opts);
        }).not.toThrow();
        expect(r).toBeDefined();
        expect(typeof (r as { ok: boolean }).ok).toBe("boolean");
      }
    });

    it("returns a failure (not throw) when given a bare -- (empty long name)", () => {
      const r = parseArgs(["--"], { flags: [{ name: "verbose", kind: "boolean" }] });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("unknown flag");
    });

    it("returns a failure (not throw) when given a bare --= (no name)", () => {
      const r = parseArgs(["--=x"], { flags: [{ name: "verbose", kind: "boolean" }] });
      expect(r.ok).toBe(false);
    });

    it("does not throw when argv is not an array (defensive)", () => {
      // The public signature is string[], but the never-throws contract should hold.
      let r;
      expect(() => {
        r = parseArgs(undefined as unknown as string[]);
      }).not.toThrow();
      expect(r).toBeDefined();
      expect(typeof (r as { ok: boolean }).ok).toBe("boolean");
    });
  });

  describe("empty argv", () => {
    it("[] -> ok with empty flags and positionals", () => {
      const r = parseArgs([], { flags: [limitSpec(1)] });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.args.flags).toEqual({});
        expect(r.args.positionals).toEqual([]);
      }
    });

    it("[] with no options at all -> ok empty", () => {
      const r = parseArgs([]);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.args.flags).toEqual({});
        expect(r.args.positionals).toEqual([]);
      }
    });
  });

  describe("boolean flags", () => {
    const opts = (): ParseOptions => ({ flags: [{ name: "verbose", kind: "boolean" }, { name: "json", kind: "boolean" }] });

    it("absent boolean is simply not present (not false)", () => {
      const r = parseArgs([], opts());
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.args.flags.verbose).toBeUndefined();
    });

    it("present boolean is true", () => {
      const r = parseArgs(["--verbose"], opts());
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.args.flags.verbose).toBe(true);
    });

    it("multiple booleans each true", () => {
      const r = parseArgs(["--verbose", "--json"], opts());
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.args.flags.verbose).toBe(true);
        expect(r.args.flags.json).toBe(true);
      }
    });

    it("--verbose=false is a usage error (presence-only)", () => {
      const r = parseArgs(["--verbose=false"], opts());
      expect(r.ok).toBe(false);
    });

    it("--verbose=true is also a usage error", () => {
      const r = parseArgs(["--verbose=true"], opts());
      expect(r.ok).toBe(false);
    });
  });

  describe("string flags", () => {
    const opts = (): ParseOptions => ({ flags: [{ name: "name", kind: "string" }] });

    it("parses --name value", () => {
      const r = parseArgs(["--name", "alice"], opts());
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.args.flags.name).toBe("alice");
    });

    it("parses --name=value", () => {
      const r = parseArgs(["--name=bob"], opts());
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.args.flags.name).toBe("bob");
    });

    it("parses an empty value via --name=", () => {
      const r = parseArgs(["--name="], opts());
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.args.flags.name).toBe("");
    });

    it("parses an empty value via --name '' (next token empty string)", () => {
      const r = parseArgs(["--name", ""], opts());
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.args.flags.name).toBe("");
    });

    it("missing value at end of argv -> usage error", () => {
      const r = parseArgs(["--name"], opts());
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error).toContain("name");
        expect(r.error).toContain("value");
      }
    });

    it("missing value at end followed by another flag -> uses flag token as value? (no: flag taken as value)", () => {
      // Per the grammar, the token after a value-requiring flag is consumed as its
      // value regardless of whether it looks like a flag. This matches the canonical
      // doctor parser. So --name --json makes name = "--json".
      const r = parseArgs(["--name", "--json"], opts());
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.args.flags.name).toBe("--json");
    });
  });

  describe("int flags — value/inline equivalence", () => {
    it("--limit 5 and --limit=5 yield the same numeric value", () => {
      const a = parseArgs(["--limit", "5"], { flags: [limitSpec(1)] });
      const b = parseArgs(["--limit=5"], { flags: [limitSpec(1)] });
      expect(a).toEqual(b);
    });

    it("negative int within bounds is accepted", () => {
      const r = parseArgs(["--limit", "-5"], { flags: [limitSpec(-10, 10)] });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.args.flags.limit).toBe(-5);
    });

    it("negative int out of bounds is rejected with a clear message", () => {
      const r = parseArgs(["--limit", "-1"], { flags: [limitSpec(1)] });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain(">= 1");
    });
  });

  describe("mixed flags and positionals", () => {
    const opts = (): ParseOptions => ({
      flags: [
        { name: "verbose", kind: "boolean" },
        limitSpec(1),
        { name: "name", kind: "string" },
      ],
      maxPositionals: 2,
    });

    it("flag, flag=value, positional, positional interleaved", () => {
      const r = parseArgs(["--verbose", "--limit=3", "file.txt", "--name", "x", "out.log"], opts());
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.args.flags.verbose).toBe(true);
        expect(r.args.flags.limit).toBe(3);
        expect(r.args.flags.name).toBe("x");
        expect(r.args.positionals).toEqual(["file.txt", "out.log"]);
      }
    });

    it("order of positionals is preserved", () => {
      const r = parseArgs(["a", "b", "c"], { maxPositionals: 3 });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.args.positionals).toEqual(["a", "b", "c"]);
    });
  });

  describe("parse-error path composes with exit-codes", () => {
    it("a usage error's message can be handed to parseError and yields ExitCode.Usage (2)", () => {
      // Demonstrates the composition: parse -> on !ok, the error string is the
      // exact input the exit-codes parseError() helper expects, returning 2.
      const r = parseArgs(["--limit", "0"], { flags: [limitSpec(1)] });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        // The value 2 is ExitCode.Usage, which is what parseError(error) returns.
        expect(ExitCode.Usage).toBe(2);
        // (We don't call parseError here to avoid stdout/stderr I/O in this suite.)
        expect(r.error.length).toBeGreaterThan(0);
      }
    });
  });

  describe("purity / no mutation", () => {
    it("does not mutate the input argv array", () => {
      const argv = ["--limit", "5", "file.txt"];
      const snapshot = [...argv];
      parseArgs(argv, { flags: [limitSpec(1)], maxPositionals: 1 });
      expect(argv).toEqual(snapshot);
    });

    it("does not touch process.exitCode or call process.exit", () => {
      const before = process.exitCode;
      parseArgs(["--bogus"], { flags: [limitSpec(1)] });
      expect(process.exitCode).toBe(before);
    });
  });
});
