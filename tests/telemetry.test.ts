import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  forceOptOut,
  isTelemetryOptedOut,
  resetOptOutOverride,
} from "../src/telemetry.js";

/**
 * Tests for the telemetry opt-out resolver (PRD-001e).
 *
 * Purity rule (AC-e8): every call passes an explicit `env` literal; we never
 * mutate `process.env`. The override (forceOptOut/resetOptOutOverride) is the
 * only module-level state, and it is reset in afterEach.
 */

// A minimal empty env, used as the base for most assertions.
const EMPTY_ENV: NodeJS.ProcessEnv = {};

afterEach(() => {
  resetOptOutOverride();
});

describe("isTelemetryOptedOut — acceptance criteria", () => {
  it("AC-e1: DO_NOT_TRACK=1 opts out regardless of other vars", () => {
    expect(isTelemetryOptedOut("nectar", { DO_NOT_TRACK: "1" })).toBe(true);
    // Even when the tool var says "on", DO_NOT_TRACK wins.
    expect(
      isTelemetryOptedOut("nectar", { DO_NOT_TRACK: "1", NECTAR_TELEMETRY: "true" }),
    ).toBe(true);
  });

  it("AC-e2: DO_NOT_TRACK unset, NECTAR_TELEMETRY=0 opts out", () => {
    expect(isTelemetryOptedOut("nectar", { NECTAR_TELEMETRY: "0" })).toBe(true);
  });

  it("AC-e3: only HONEYCOMB_TELEMETRY=off opts out (shared alias)", () => {
    expect(isTelemetryOptedOut("nectar", { HONEYCOMB_TELEMETRY: "off" })).toBe(true);
  });

  it("AC-e4: none of the three vars set returns false (telemetry may proceed)", () => {
    expect(isTelemetryOptedOut("nectar", EMPTY_ENV)).toBe(false);
    expect(isTelemetryOptedOut("nectar", {})).toBe(false);
  });

  it("AC-e5: NECTAR_TELEMETRY=true does NOT opt out (opt-OUT var, not opt-IN)", () => {
    expect(isTelemetryOptedOut("nectar", { NECTAR_TELEMETRY: "true" })).toBe(false);
    expect(isTelemetryOptedOut("nectar", { NECTAR_TELEMETRY: "1" })).toBe(false);
    expect(isTelemetryOptedOut("nectar", { NECTAR_TELEMETRY: "on" })).toBe(false);
    expect(isTelemetryOptedOut("nectar", { NECTAR_TELEMETRY: "yes" })).toBe(false);
  });

  it("AC-e6: DO_NOT_TRACK= (empty string) is treated as unset", () => {
    expect(isTelemetryOptedOut("nectar", { DO_NOT_TRACK: "" })).toBe(false);
    // Empty DO_NOT_TRACK does not suppress a tool-var opt-out.
    expect(
      isTelemetryOptedOut("nectar", { DO_NOT_TRACK: "", NECTAR_TELEMETRY: "0" }),
    ).toBe(true);
  });

  it("AC-e7: forceOptOut() forces true regardless of env", () => {
    forceOptOut();
    // Even with an empty env, opt-out is forced.
    expect(isTelemetryOptedOut("nectar", EMPTY_ENV)).toBe(true);
    // And even if env explicitly has no opt-out values.
    expect(
      isTelemetryOptedOut("nectar", { NECTAR_TELEMETRY: "true", HONEYCOMB_TELEMETRY: "on" }),
    ).toBe(true);
  });

  it("AC-e7: forceOptOut() is idempotent", () => {
    forceOptOut();
    forceOptOut();
    forceOptOut();
    expect(isTelemetryOptedOut("nectar", EMPTY_ENV)).toBe(true);
  });

  it("AC-e8: pure — same env object yields the same result across calls", () => {
    const frozenEnv: NodeJS.ProcessEnv = Object.freeze({
      NECTAR_TELEMETRY: "0",
    });
    const first = isTelemetryOptedOut("nectar", frozenEnv);
    const second = isTelemetryOptedOut("nectar", frozenEnv);
    const third = isTelemetryOptedOut("nectar", frozenEnv);
    expect(first).toBe(true);
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("AC-e9: module is stateless — does not import fs or read files", async () => {
    // The resolver must be env-only. Import the module source as text and
    // assert it has no filesystem reads (no `fs`, no `readFile`, no `node:fs`).
    const src = await import("node:fs/promises").then((f) =>
      f.readFile(new URL("../src/telemetry.ts", import.meta.url), "utf8"),
    );
    expect(src).not.toMatch(/require\(|from\s+["']node:fs|from\s+["']fs["']|readFileSync|readFile\b|existsSync/);
    // And it only reads the `env` parameter + the override flag — confirm the
    // env parameter is the data path, not process.env-global, in the signature.
    expect(src).toMatch(/env.*=\s*process\.env/);
  });
});

describe("isTelemetryOptedOut — DO_NOT_TRACK truthiness", () => {
  it("any non-empty value opts out (presence-based)", () => {
    for (const v of ["1", "true", "yes", "on", "0", "false", "off", "no", "anything"]) {
      expect(isTelemetryOptedOut("nectar", { DO_NOT_TRACK: v })).toBe(true);
    }
  });

  it("unset returns false", () => {
    expect(isTelemetryOptedOut("nectar", EMPTY_ENV)).toBe(false);
  });
});

describe("isTelemetryOptedOut — <TOOL>_TELEMETRY truthiness", () => {
  it("opt-out values are case-insensitive", () => {
    expect(isTelemetryOptedOut("nectar", { NECTAR_TELEMETRY: "OFF" })).toBe(true);
    expect(isTelemetryOptedOut("nectar", { NECTAR_TELEMETRY: "Off" })).toBe(true);
    expect(isTelemetryOptedOut("nectar", { NECTAR_TELEMETRY: "No" })).toBe(true);
    expect(isTelemetryOptedOut("nectar", { NECTAR_TELEMETRY: "FALSE" })).toBe(true);
    expect(isTelemetryOptedOut("nectar", { NECTAR_TELEMETRY: "0" })).toBe(true);
  });

  it("non-opt-out values do NOT opt out", () => {
    expect(isTelemetryOptedOut("nectar", { NECTAR_TELEMETRY: "1" })).toBe(false);
    expect(isTelemetryOptedOut("nectar", { NECTAR_TELEMETRY: "TRUE" })).toBe(false);
    expect(isTelemetryOptedOut("nectar", { NECTAR_TELEMETRY: "ON" })).toBe(false);
    expect(isTelemetryOptedOut("nectar", { NECTAR_TELEMETRY: "YES" })).toBe(false);
    expect(isTelemetryOptedOut("nectar", { NECTAR_TELEMETRY: "enabled" })).toBe(false);
  });

  it("empty value does NOT opt out", () => {
    expect(isTelemetryOptedOut("nectar", { NECTAR_TELEMETRY: "" })).toBe(false);
  });
});

describe("isTelemetryOptedOut — HONEYCOMB_TELEMETRY truthiness", () => {
  it("opt-out values are case-insensitive", () => {
    expect(isTelemetryOptedOut("nectar", { HONEYCOMB_TELEMETRY: "OFF" })).toBe(true);
    expect(isTelemetryOptedOut("nectar", { HONEYCOMB_TELEMETRY: "false" })).toBe(true);
    expect(isTelemetryOptedOut("nectar", { HONEYCOMB_TELEMETRY: "No" })).toBe(true);
    expect(isTelemetryOptedOut("nectar", { HONEYCOMB_TELEMETRY: "0" })).toBe(true);
  });

  it("non-opt-out values do NOT opt out", () => {
    expect(isTelemetryOptedOut("nectar", { HONEYCOMB_TELEMETRY: "1" })).toBe(false);
    expect(isTelemetryOptedOut("nectar", { HONEYCOMB_TELEMETRY: "true" })).toBe(false);
    expect(isTelemetryOptedOut("nectar", { HONEYCOMB_TELEMETRY: "on" })).toBe(false);
  });
});

describe("isTelemetryOptedOut — toolName casing", () => {
  it("lowercase toolName builds uppercase var", () => {
    expect(isTelemetryOptedOut("nectar", { NECTAR_TELEMETRY: "off" })).toBe(true);
  });

  it("mixed-case toolName is uppercased (Nectar -> NECTAR_TELEMETRY)", () => {
    expect(isTelemetryOptedOut("Nectar", { NECTAR_TELEMETRY: "off" })).toBe(true);
    expect(isTelemetryOptedOut("NECTAR", { NECTAR_TELEMETRY: "off" })).toBe(true);
  });

  it("different tool names map to their own var", () => {
    // doctor's own var does not affect nectar, and vice versa.
    expect(isTelemetryOptedOut("doctor", { NECTAR_TELEMETRY: "off" })).toBe(false);
    expect(isTelemetryOptedOut("doctor", { DOCTOR_TELEMETRY: "off" })).toBe(true);
    expect(isTelemetryOptedOut("honeycomb", { HONEYCOMB_TELEMETRY: "off" })).toBe(true);
  });
});

describe("isTelemetryOptedOut — precedence order", () => {
  it("DO_NOT_TRACK beats <TOOL>_TELEMETRY (both opt out -> still true, short-circuit at DNT)", () => {
    expect(
      isTelemetryOptedOut("nectar", { DO_NOT_TRACK: "1", NECTAR_TELEMETRY: "0" }),
    ).toBe(true);
  });

  it("<TOOL>_TELEMETRY=0 beats HONEYCOMB_TELEMETRY=on (HONEYCOMB opt-in ignored)", () => {
    expect(
      isTelemetryOptedOut("nectar", { NECTAR_TELEMETRY: "0", HONEYCOMB_TELEMETRY: "on" }),
    ).toBe(true);
  });

  it("DO_NOT_TRACK empty falls through to <TOOL>_TELEMETRY", () => {
    expect(
      isTelemetryOptedOut("nectar", { DO_NOT_TRACK: "", NECTAR_TELEMETRY: "0" }),
    ).toBe(true);
  });

  it("all three unset returns false", () => {
    expect(isTelemetryOptedOut("nectar", { DO_NOT_TRACK: "", NECTAR_TELEMETRY: "", HONEYCOMB_TELEMETRY: "" })).toBe(
      false,
    );
  });
});

describe("resetOptOutOverride", () => {
  beforeEach(() => {
    forceOptOut();
  });

  it("clears the hard-disable so env is consulted again", () => {
    resetOptOutOverride();
    expect(isTelemetryOptedOut("nectar", EMPTY_ENV)).toBe(false);
    expect(isTelemetryOptedOut("nectar", { NECTAR_TELEMETRY: "0" })).toBe(true);
  });

  it("is safe to call when override is not set", () => {
    resetOptOutOverride();
    resetOptOutOverride();
    expect(isTelemetryOptedOut("nectar", EMPTY_ENV)).toBe(false);
  });
});
