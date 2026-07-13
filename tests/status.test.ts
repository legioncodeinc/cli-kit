import { describe, expect, it } from "vitest";
import { formatStatus, statusToJson, type ServiceStatus } from "../src/status.js";

const base = (state: ServiceStatus["process"]["state"]): ServiceStatus => ({
  product: "HONEYCOMB",
  version: "1.2.3",
  installation: state === "unknown" ? "not-installed" : "installed",
  process: state === "running" ? { state, pid: 42 } : { state },
  health: { state: state === "running" ? "healthy" : "unknown", endpoint: "http://localhost/health" },
  registration: "registered",
  update: { available: false },
  paths: { config: "/config", logs: "/logs" },
});

describe("status contract", () => {
  it.each(["running", "stopped", "unknown"] as const)("renders ordered %s status fields", (state) => {
    const output = formatStatus(base(state));
    const fields = ["Product:", "Service:", "Process:", "Health:", "Registration:", "Update:", "Config:", "Logs:"];
    for (let i = 1; i < fields.length; i++) expect(output.indexOf(fields[i])).toBeGreaterThan(output.indexOf(fields[i - 1]));
  });

  it("preserves product-specific details and returns a defensive JSON value", () => {
    const status = { ...base("running"), details: { workers: 3 } };
    expect(formatStatus(status)).toContain("  workers: 3");
    const json = statusToJson(status);
    expect(json).toEqual(status);
    expect(json).not.toBe(status);
  });

  it("renders unhealthy health results", () => {
    expect(formatStatus({ ...base("running"), health: { state: "unhealthy", result: "timeout" } })).toContain("Health: unhealthy - timeout");
  });

  it("removes terminal escape injection from runtime status values", () => {
    expect(formatStatus({ ...base("running"), paths: { config: "safe\u001b]8;;https://evil\u0007click\u001b]8;;\u0007", logs: "/logs" } })).toContain("Config: safeclick");
  });
});
