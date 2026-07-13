import { describe, expect, it } from "vitest";
import { formatTelemetrySummary, telemetrySummaryToJson, type TelemetrySummary } from "../src/telemetry-summary.js";

describe("telemetry summary contract", () => {
  it.each(["enabled", "opted-out"] as const)("renders %s state without adding credentials", (state) => {
    const summary: TelemetrySummary = {
      state,
      controllingSetting: state === "enabled" ? "default" : "DO_NOT_TRACK",
      destination: state === "enabled" ? "hosted" : "disabled",
      queue: { pending: 2, capacity: 100 },
      lastSuccessfulSend: "2026-07-12T00:00:00Z",
      optOutInstruction: "Set DO_NOT_TRACK=1",
    };
    const output = formatTelemetrySummary(summary);
    expect(output).toContain(`Telemetry: ${state}`);
    expect(output).toContain("Queue: 2/100");
    expect(output).toContain("Opt out: Set DO_NOT_TRACK=1");
    expect(telemetrySummaryToJson(summary)).toEqual(summary);
  });
  it("removes terminal escape injection from adapter-provided values", () => {
    const output = formatTelemetrySummary({ state: "enabled", controllingSetting: "x\u001b[31mred", destination: "hosted", optOutInstruction: "Set X=0" });
    expect(output).toContain("Controlled by: xred");
    expect(output).not.toContain("\u001b");
  });
});
