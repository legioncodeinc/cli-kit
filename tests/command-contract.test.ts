import { describe, expect, it } from "vitest";
import { BASELINE_COMMANDS, composeProductManifest, exitCodeFor, resolveCommand, validateManifest } from "../src/command-contract.js";

describe("command contract", () => {
  it("contains the complete typed baseline with metadata", () => {
    expect(BASELINE_COMMANDS.map((entry) => entry.name)).toEqual(["start", "stop", "restart", "status", "logs", "install", "uninstall", "service-install", "service-uninstall", "update", "register", "telemetry"]);
    expect(BASELINE_COMMANDS.every((entry) => entry.summary && entry.json && typeof entry.destructive === "boolean" && typeof entry.idempotent === "boolean")).toBe(true);
  });
  it("omits register only for Doctor and validates every product", () => {
    for (const product of ["doctor", "hive", "honeycomb", "nectar"] as const) {
      const manifest = composeProductManifest(product);
      expect(manifest.commands.some((entry) => entry.name === "register")).toBe(product !== "doctor");
      expect(validateManifest(manifest)).toEqual([]);
    }
  });
  it("resolves canonical service verbs and deprecated aliases without advertising aliases", () => {
    const manifest = composeProductManifest("hive");
    expect(resolveCommand(manifest, "service-install")).toMatchObject({ ok: true, canonicalName: "service-install" });
    expect(resolveCommand(manifest, "install-service")).toMatchObject({ ok: true, canonicalName: "service-install", deprecatedAlias: "install-service" });
    expect(manifest.commands.map((entry) => entry.name)).not.toContain("install-service");
    expect(resolveCommand(manifest, "wat")).toMatchObject({ ok: false, exitCode: 2 });
  });
  it("composes product commands into their separate final group", () => {
    const manifest = composeProductManifest("nectar", [{ name: "brood", summary: "Inspect brood", destructive: false, idempotent: true, json: true }]);
    expect(manifest.commands.at(-1)).toMatchObject({ name: "brood", group: "Product commands" });
    expect(validateManifest(manifest)).toEqual([]);
  });
  it("maps usage, runtime, successful, and idempotent outcomes", () => {
    expect(exitCodeFor("usage-error")).toBe(2); expect(exitCodeFor("runtime-error")).toBe(1);
    expect(exitCodeFor("success")).toBe(0); expect(exitCodeFor("idempotent")).toBe(0);
  });
  it("detects duplicates, group drift, absent JSON, and Doctor register", () => {
    const valid = composeProductManifest("doctor");
    const broken = { product: "doctor" as const, commands: [...valid.commands, { ...valid.commands[0], json: false }, BASELINE_COMMANDS.find((entry) => entry.name === "register")!] };
    const codes = validateManifest(broken).map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining(["duplicate-command", "json-required", "doctor-register", "group-order"]));
  });
});
