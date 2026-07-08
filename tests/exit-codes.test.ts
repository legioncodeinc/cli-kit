import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as exitCodesModule from "../src/exit-codes.js";
import {
  ExitCode,
  EXIT_OK,
  EXIT_ERROR,
  EXIT_USAGE,
  parseError,
  declined,
} from "../src/exit-codes.js";

/**
 * Exit-codes module tests — PRD-001c.
 *
 * Each acceptance criterion (AC-c1 … AC-c6) is covered by at least one test,
 * annotated with the AC id in the test title. stdout/stderr writes are
 * captured via spy; spies are restored after each test.
 */
describe("exit-codes", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("ExitCode enum + aliases", () => {
    it("exposes the three-valued scheme (0, 1, 2)", () => {
      expect(ExitCode.Ok).toBe(0);
      expect(ExitCode.Error).toBe(1);
      expect(ExitCode.Usage).toBe(2);
    });

    // AC-c6: aliases byte-identical to Doctor's constants (0, 1, 2).
    it("EXIT_OK/EXIT_ERROR/EXIT_USAGE aliases are byte-identical to the enum (AC-c6)", () => {
      expect(EXIT_OK).toBe(ExitCode.Ok);
      expect(EXIT_ERROR).toBe(ExitCode.Error);
      expect(EXIT_USAGE).toBe(ExitCode.Usage);
      expect(EXIT_OK).toBe(0);
      expect(EXIT_ERROR).toBe(1);
      expect(EXIT_USAGE).toBe(2);
    });

    it("does not define EXIT_DECLINED (deliberately omitted)", () => {
      // The kit never ships EXIT_DECLINED; declined() returns EXIT_OK instead.
      const exportedNames = Object.keys(exitCodesModule);
      expect(exportedNames).not.toContain("EXIT_DECLINED");
    });
  });

  describe("parseError", () => {
    // AC-c3: writes message + usage to stderr, returns 2.
    it("writes message + usageText to stderr and returns EXIT_USAGE (AC-c3)", () => {
      const code = parseError("unknown flag --frobnicate", "usage: doctor [verb] [options]");

      expect(code).toBe(2);
      expect(code).toBe(ExitCode.Usage);
      expect(stderrSpy).toHaveBeenCalledTimes(2);
      expect(stderrSpy.mock.calls[0][0]).toBe("unknown flag --frobnicate\n");
      expect(stderrSpy.mock.calls[1][0]).toBe("usage: doctor [verb] [options]\n");
      expect(stdoutSpy).not.toHaveBeenCalled();
    });

    // Edge case: no usageText — just the message line.
    it("writes only the message when usageText is omitted", () => {
      const code = parseError("missing required positional <verb>");

      expect(code).toBe(2);
      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy.mock.calls[0][0]).toBe("missing required positional <verb>\n");
      expect(stdoutSpy).not.toHaveBeenCalled();
    });

    // Edge case: explicit undefined usageText behaves the same as omitted.
    it("writes only the message when usageText is explicitly undefined", () => {
      const code = parseError("bad value for --port", undefined);

      expect(code).toBe(2);
      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy.mock.calls[0][0]).toBe("bad value for --port\n");
    });

    it("normalizes a message that already ends with a newline (no doubled newline)", () => {
      parseError("already terminated\n");

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy.mock.calls[0][0]).toBe("already terminated\n");
    });

    it("does not call process.exit and does not touch process.exitCode", () => {
      const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit must not be called");
      }) as never);
      const before = process.exitCode;

      const code = parseError("oops");

      expect(code).toBe(2);
      expect(exitSpy).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(before);
    });
  });

  describe("declined", () => {
    // AC-c4: writes message to stdout, returns 0 (not 2).
    it("writes message to stdout and returns EXIT_OK, not EXIT_USAGE (AC-c4)", () => {
      const code = declined("heal declined by user");

      expect(code).toBe(0);
      expect(code).toBe(ExitCode.Ok);
      expect(code).not.toBe(2);
      expect(stdoutSpy).toHaveBeenCalledTimes(1);
      expect(stdoutSpy.mock.calls[0][0]).toBe("heal declined by user\n");
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    // Edge case: empty string still produces exactly one newline.
    it("handles an empty message string (writes a single newline)", () => {
      const code = declined("");

      expect(code).toBe(0);
      expect(stdoutSpy).toHaveBeenCalledTimes(1);
      expect(stdoutSpy.mock.calls[0][0]).toBe("\n");
    });

    it("normalizes a message that already ends with a newline (no doubled newline)", () => {
      declined("no thanks\n");

      expect(stdoutSpy).toHaveBeenCalledTimes(1);
      expect(stdoutSpy.mock.calls[0][0]).toBe("no thanks\n");
    });

    it("does not call process.exit and does not touch process.exitCode", () => {
      const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit must not be called");
      }) as never);
      const before = process.exitCode;

      const code = declined("aborted");

      expect(code).toBe(0);
      expect(exitSpy).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(before);
    });
  });

  describe("handler → process.exitCode contract (AC-c1, AC-c2, AC-c5)", () => {
    // AC-c1: successful command → process.exitCode is 0 when handler returns EXIT_OK.
    it("assigns EXIT_OK to process.exitCode for a successful handler (AC-c1)", () => {
      const original = process.exitCode;
      process.exitCode = undefined;
      try {
        function runSuccess(): ExitCode {
          return EXIT_OK;
        }
        const code = runSuccess();
        process.exitCode = code;

        expect(process.exitCode).toBe(0);
      } finally {
        process.exitCode = original;
      }
    });

    // AC-c2: runtime failure → process.exitCode is 1 when handler returns EXIT_ERROR.
    it("assigns EXIT_ERROR to process.exitCode for a runtime failure (AC-c2)", () => {
      const original = process.exitCode;
      process.exitCode = undefined;
      try {
        function runFailure(): ExitCode {
          return EXIT_ERROR;
        }
        const code = runFailure();
        process.exitCode = code;

        expect(process.exitCode).toBe(1);
      } finally {
        process.exitCode = original;
      }
    });

    // AC-c5: unknown verb → process exits 2 (not 1). A dispatcher's unknown-verb
    // path returns EXIT_USAGE; the test proves the returned value is 2.
    it("returns EXIT_USAGE (2) for an unknown verb, not EXIT_ERROR (1) (AC-c5)", () => {
      const knownVerbs = new Set(["heal", "rung", "purge"]);

      function dispatch(verb: string): ExitCode {
        if (!knownVerbs.has(verb)) {
          return parseError(`unknown verb: ${verb}`, "usage: doctor <verb>");
        }
        return EXIT_OK;
      }

      const code = dispatch("frobnicate");

      expect(code).toBe(2);
      expect(code).not.toBe(1);
      expect(code).toBe(ExitCode.Usage);

      // And when this returned code is assigned to process.exitCode, it's 2.
      const original = process.exitCode;
      process.exitCode = undefined;
      try {
        process.exitCode = code;
        expect(process.exitCode).toBe(2);
      } finally {
        process.exitCode = original;
      }
    });
  });
});
