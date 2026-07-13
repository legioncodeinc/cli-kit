import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import {
  ExitCode,
  parseError,
  setColorEnabled,
  disableColor,
  isColorEnabled,
  bold,
  red,
  green,
  isTelemetryOptedOut,
  forceOptOut,
  resetOptOutOverride,
  parseArgs,
  formatUsage,
} from "../src/index.js";
import type { FlagSpec } from "../src/index.js";

/**
 * Wave 3 integration tests — cross-module composition.
 *
 * These tests do NOT re-test individual module behavior (that is covered by the
 * six per-module suites). They verify the modules COMPOSE correctly end-to-end
 * through the barrel, proving AC-3 (behavior preservation across modules) and
 * the specific composition paths the contract depends on:
 *
 *   1. Color + exit-codes: a CLI handler colors output and returns an ExitCode.
 *   2. Arg-parser + exit-codes (AC-5): unknown flag -> parseArgs error ->
 *      parseError() -> ExitCode.Usage (2) on stderr.
 *   3. Telemetry + color independence: the two modules share no state.
 *   4. Usage + color: formatUsage() returns plain ASCII the caller can colorize.
 *   5. Full barrel import (AC-2): every public name is reachable from the root.
 *
 * All imports come from the package root (../src/index.js) so these tests
 * exercise the actual public barrel surface, not the individual module files.
 */

const ESC = "\x1b";
const sgr = (code: string): string => `${ESC}[${code}m`;

/** A non-TTY stub stream for color resolution tests. */
function ttyStream(isTTY: boolean): NodeJS.WriteStream {
  return { isTTY } as unknown as NodeJS.WriteStream;
}

describe("integration — full barrel import (AC-2)", () => {
  // AC-2: root-only exports. Every public name from all six modules must be
  // importable from the package root (../src/index.js), proving the barrel
  // surfaces the complete typed surface from a single entry point. The top-level
  // imports above already prove this at module-load time; these assertions make
  // the contract explicit and surface-readable.
  it("imports all public names from the root export", () => {
    // exit-codes: a const enum compiles to a runtime object, so typeof is "object".
    expect(typeof ExitCode).toBe("object");
    expect(typeof parseError).toBe("function");
    // color
    expect(typeof setColorEnabled).toBe("function");
    expect(typeof disableColor).toBe("function");
    expect(typeof isColorEnabled).toBe("function");
    expect(typeof bold).toBe("function");
    expect(typeof green).toBe("function");
    // telemetry
    expect(typeof isTelemetryOptedOut).toBe("function");
    expect(typeof forceOptOut).toBe("function");
    expect(typeof resetOptOutOverride).toBe("function");
    // arg-parser
    expect(typeof parseArgs).toBe("function");
    // usage
    expect(typeof formatUsage).toBe("function");
  });

  it("ExitCode enum values are correct from the root", () => {
    expect(ExitCode.Ok).toBe(0);
    expect(ExitCode.Error).toBe(1);
    expect(ExitCode.Usage).toBe(2);
  });

  it("VERSION is exported from the root", async () => {
    const mod = await import("../src/index.js");
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };
    expect(mod.VERSION).toBe(packageJson.version);
  });

  it("the FlagSpec type is available as a type-only import", () => {
    // If FlagSpec weren't exported from the root, this file would fail to compile.
    const spec: FlagSpec = { name: "verbose", kind: "boolean" };
    expect(spec.name).toBe("verbose");
  });
});

describe("integration — color + exit-codes composition", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    disableColor();
  });

  // A simulated one-shot CLI failure handler: uses color to format its message
  // and returns an ExitCode for the caller to assign to process.exitCode. This
  // is the composition pattern every Apiary CLI handler follows.
  function runFailureHandler(colorOn: boolean): { output: string; code: number } {
    if (colorOn) {
      setColorEnabled(ttyStream(true));
    } else {
      disableColor();
    }
    const headline = bold(red("Error: ")) + "operation failed";
    const code = parseError(headline, "usage: mycli <verb> [options]");
    return { output: headline, code };
  }

  it("returns ExitCode.Usage (2) regardless of color state — taxonomy is value-stable", () => {
    // parseError always returns ExitCode.Usage (2). Color affects the string
    // bytes, not the exit-code taxonomy — the composition is value-stable.
    const off = runFailureHandler(false);
    const on = runFailureHandler(true);
    expect(off.code).toBe(ExitCode.Usage);
    expect(on.code).toBe(ExitCode.Usage);
    expect(off.code).toBe(2);
    expect(on.code).toBe(2);
  });

  it("when color is disabled, the formatted output is plain ASCII (no SGR)", () => {
    disableColor();
    const out = bold(red("Error: ")) + "failed";
    expect(out).toBe("Error: failed");
    expect(out.includes(ESC)).toBe(false);
  });

  it("when color is enabled, the formatted output carries nested SGR codes", () => {
    setColorEnabled(ttyStream(true));
    try {
      const out = bold(red("Error: "));
      // red wraps in 31..39, then bold wraps the whole thing in 1..22.
      expect(out.startsWith(sgr("1"))).toBe(true);
      expect(out.includes(sgr("31"))).toBe(true);
      expect(out.includes("Error: ")).toBe(true);
    } finally {
      disableColor();
    }
  });

  it("a success path uses color for emphasis and returns ExitCode.Ok (0)", () => {
    disableColor();
    const msg = green("ok");
    expect(msg).toBe("ok"); // identity when disabled
    expect(ExitCode.Ok).toBe(0);

    setColorEnabled(ttyStream(true));
    try {
      expect(green("ok")).toContain(sgr("32"));
    } finally {
      disableColor();
    }
  });

  it("parseError writes the colored headline to stderr when color is enabled", () => {
    setColorEnabled(ttyStream(true));
    try {
      const headline = bold(red("Error: ")) + "boom";
      const code = parseError(headline, "usage: x");
      expect(code).toBe(2);
      // The first stderr write carries the SGR-wrapped headline.
      const written = String(stderrSpy.mock.calls[0][0]);
      expect(written.includes(ESC)).toBe(true);
      expect(written).toContain("Error: ");
    } finally {
      disableColor();
    }
  });
});

describe("integration — arg-parser + exit-codes (AC-5: unknown flag -> exit 2)", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // AC-5: the end-to-end path that makes an unknown flag exit 2 (not 1) is a
  // two-module composition: parseArgs() returns { ok: false, error }, the caller
  // hands that error string to parseError(), which writes to stderr and returns
  // ExitCode.Usage (2). This test exercises the FULL path across modules.
  it("an unknown flag flows parseArgs -> parseError -> ExitCode.Usage (2) on stderr", () => {
    const result = parseArgs(["--bogus"], {
      flags: [{ name: "verbose", kind: "boolean" }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The exact composition the contract specifies: result.error -> parseError().
      const code = parseError(result.error, "usage: mycli [options]");
      expect(code).toBe(ExitCode.Usage);
      expect(code).toBe(2);

      // stderr received the parser's error message + the usage hint.
      expect(stderrSpy).toHaveBeenCalledTimes(2);
      expect(String(stderrSpy.mock.calls[0][0])).toContain("--bogus");
      expect(String(stderrSpy.mock.calls[1][0])).toContain("usage: mycli");
    }
  });

  it("a bad int value flows the same parseArgs -> parseError -> 2 path", () => {
    const result = parseArgs(["--limit", "0"], {
      flags: [{ name: "limit", kind: "int", min: 1 }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const code = parseError(result.error);
      expect(code).toBe(2);
      expect(String(stderrSpy.mock.calls[0][0])).toContain("limit");
    }
  });

  it("excess positionals flow the same parseArgs -> parseError -> 2 path", () => {
    const result = parseArgs(["a", "b", "c"], { maxPositionals: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const code = parseError(result.error);
      expect(code).toBe(ExitCode.Usage);
      expect(String(stderrSpy.mock.calls[0][0])).toContain("positional");
    }
  });

  it("a successful parse does NOT trigger the parseError path (stays Ok)", () => {
    const result = parseArgs(["--limit", "5"], {
      flags: [{ name: "limit", kind: "int", min: 1 }],
    });
    expect(result.ok).toBe(true);
    // On success the caller returns ExitCode.Ok, never calling parseError.
    expect(ExitCode.Ok).toBe(0);
    expect(stderrSpy).not.toHaveBeenCalled();
  });
});

describe("integration — telemetry + color independence", () => {
  // The two modules are stateful but independent: telemetry's opt-out override
  // lives in its own module scope; color's enabled flag lives in its own. A
  // mutation in one MUST NOT bleed into the other.
  let envBackup: NodeJS.ProcessEnv;

  beforeEach(() => {
    envBackup = { ...process.env };
    delete process.env.NO_COLOR;
    delete process.env.FORCE_COLOR;
    delete process.env.DO_NOT_TRACK;
    delete process.env.HONEYCOMB_TELEMETRY;
    delete process.env.NECTAR_TELEMETRY;
  });

  afterEach(() => {
    process.env = envBackup;
    disableColor();
    resetOptOutOverride();
  });

  it("forceOptOut() does not affect color enabled state", () => {
    setColorEnabled(ttyStream(true));
    expect(isColorEnabled()).toBe(true);

    forceOptOut();
    expect(isTelemetryOptedOut("nectar")).toBe(true);
    // Color state is untouched by the telemetry mutation.
    expect(isColorEnabled()).toBe(true);
  });

  it("disableColor() does not affect telemetry opt-out state", () => {
    // Telemetry defaults to NOT opted out (no env vars set).
    expect(isTelemetryOptedOut("nectar")).toBe(false);

    disableColor();
    expect(isColorEnabled()).toBe(false);
    // Telemetry state is untouched by the color mutation.
    expect(isTelemetryOptedOut("nectar")).toBe(false);
  });

  it("toggling color on/off repeatedly has no effect on telemetry", () => {
    for (let i = 0; i < 5; i++) {
      setColorEnabled(ttyStream(true));
      disableColor();
    }
    expect(isTelemetryOptedOut("nectar")).toBe(false);
  });

  it("toggling telemetry override on/off has no effect on color", () => {
    disableColor();
    const before = isColorEnabled();
    for (let i = 0; i < 5; i++) {
      forceOptOut();
      resetOptOutOverride();
    }
    expect(isColorEnabled()).toBe(before);
  });

  it("after resetOptOutOverride, telemetry reads env again (override fully clears)", () => {
    forceOptOut();
    expect(isTelemetryOptedOut("nectar")).toBe(true);
    resetOptOutOverride();
    expect(isTelemetryOptedOut("nectar")).toBe(false);
  });
});

describe("integration — usage + color composition", () => {
  afterEach(() => {
    disableColor();
  });

  // The usage formatter returns PLAIN ASCII (contract: "color is the caller's
  // job"). The caller may then wrap the whole string or individual lines with
  // color helpers. This proves formatUsage() output is color-safe: it round-trips
  // through color helpers cleanly whether color is on or off.
  it("formatUsage returns plain ASCII with no SGR codes", () => {
    const out = formatUsage({
      groups: [
        {
          title: "Commands",
          verbs: [
            { name: "heal", summary: "heal the hive" },
            { name: "rung", summary: "advance a rung" },
          ],
        },
      ],
    });
    expect(out.includes(ESC)).toBe(false);
    expect(out).toContain("Commands");
    expect(out).toContain("heal");
  });

  it("bold(formatUsage(...)) is identity-passthrough when color disabled", () => {
    disableColor();
    const plain = formatUsage({
      groups: [{ title: "T", verbs: [{ name: "a", summary: "s" }] }],
    });
    expect(bold(plain)).toBe(plain);
  });

  it("bold(formatUsage(...)) wraps the whole usage block in SGR when color enabled", () => {
    setColorEnabled(ttyStream(true));
    try {
      const plain = formatUsage({
        groups: [{ title: "T", verbs: [{ name: "a", summary: "s" }] }],
      });
      const wrapped = bold(plain);
      // bold opens with ESC[1m and closes with ESC[22m, original text in middle.
      expect(wrapped.startsWith(sgr("1"))).toBe(true);
      expect(wrapped.endsWith(sgr("22"))).toBe(true);
      expect(wrapped).toContain(plain);
    } finally {
      disableColor();
    }
  });

  it("a usage error can pass the formatted usage block as usageText to parseError", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const usage = formatUsage({
        groups: [{ title: "Verbs", verbs: [{ name: "heal", summary: "heal" }] }],
      });
      const code = parseError("unknown verb: frobnicate", usage);
      expect(code).toBe(ExitCode.Usage);
      // The formatted usage table lands on stderr as the second line.
      expect(String(stderrSpy.mock.calls[1][0])).toContain("Verbs");
      expect(String(stderrSpy.mock.calls[1][0])).toContain("heal");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("empty usage input renders to '' — bold('') is identity when disabled, SGR-pair when enabled", () => {
    // formatUsage on empty input is always the empty string (plain ASCII, no SGR).
    expect(formatUsage({ groups: [] })).toBe("");

    // When color is disabled, bold('') is the empty string (identity).
    disableColor();
    expect(bold(formatUsage({ groups: [] }))).toBe("");

    // When color is enabled, bold wraps even the empty string in its SGR pair
    // (open + close). This is the documented paint() behavior; the caller owns
    // guarding against coloring empty content if that matters for their output.
    setColorEnabled(ttyStream(true));
    const wrapped = bold(formatUsage({ groups: [] }));
    expect(wrapped).toBe(`${sgr("1")}${sgr("22")}`);
    disableColor();
  });
});
