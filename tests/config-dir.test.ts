import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { apiaryHome, ConfigDirError, migrateLegacyConfig, resolveConfigDir } from "../src/config-dir.js";

describe("config directory resolution", () => {
  it.each([
    ["linux" as const, "/home/alice", "/home/alice/.apiary/honeycomb"],
    ["darwin" as const, "/Users/alice", "/Users/alice/.apiary/honeycomb"],
    ["win32" as const, "C:\\Users\\Alice", "C:\\Users\\Alice\\.apiary\\honeycomb"],
  ])("uses one home-anchored root on %s", (platform, home, expected) => {
    expect(resolveConfigDir("honeycomb", { platform, home, env: {} })).toBe(expected);
    expect(apiaryHome({ platform, home, env: {} })).not.toMatch(/\.(daemon|deeplake|honeycomb)$/);
  });

  it.each([
    ["linux" as const, "/home/alice", "/"],
    ["linux" as const, "/home/alice", "/etc"],
    ["linux" as const, "/home/alice", "/var"],
    ["linux" as const, "/home/alice", "/usr"],
    ["win32" as const, "C:\\Users\\Alice", "C:\\"],
    ["win32" as const, "C:\\Users\\Alice", "C:\\ProgramData"],
    ["win32" as const, "C:\\Users\\Alice", "C:\\Windows"],
  ])("rejects global APIARY_HOME on %s", (platform, home, override) => {
    expect(() => apiaryHome({ platform, home, env: { APIARY_HOME: override } })).toThrow(ConfigDirError);
  });

  it("allows an override inside the user's home and rejects traversal namespaces", () => {
    expect(apiaryHome({ platform: "linux", home: "/home/alice", env: { APIARY_HOME: "/home/alice/state/apiary" } }))
      .toBe("/home/alice/state/apiary");
    expect(() => resolveConfigDir("../escape", { platform: "linux", home: "/home/alice", env: {} })).toThrow(ConfigDirError);
  });
});

describe("legacy migration", () => {
  it("moves every legacy directory without loss and is rerunnable", () => {
    const home = mkdtempSync(join(tmpdir(), "cli-kit-home-"));
    for (const name of ["daemon", "deeplake", "honeycomb"]) {
      mkdirSync(join(home, `.${name}`), { recursive: true });
      writeFileSync(join(home, `.${name}`, "state.txt"), name);
    }
    const first = migrateLegacyConfig({ home, env: {}, argv: ["status"], oneShot: () => true });
    expect(first.migrated).toEqual(["daemon", "deeplake", "honeycomb"]);
    for (const name of first.migrated) {
      expect(readFileSync(join(home, ".apiary", name, "state.txt"), "utf8")).toBe(name);
    }
    const second = migrateLegacyConfig({ home, env: {}, argv: ["status"], oneShot: () => true });
    expect(second.migrated).toEqual([]);
  });

  it("does not inspect or create directories for watchdog invocations", () => {
    const home = join(tmpdir(), `cli-kit-watchdog-${Date.now()}`);
    const result = migrateLegacyConfig({ home, env: {}, argv: ["run"], oneShot: () => false });
    expect(result).toEqual({ skipped: true, migrated: [], linked: [] });
    expect(existsSync(home)).toBe(false);
  });

  it("preserves both files when legacy and destination names collide", () => {
    const home = mkdtempSync(join(tmpdir(), "cli-kit-collision-"));
    mkdirSync(join(home, ".honeycomb"), { recursive: true });
    mkdirSync(join(home, ".apiary", "honeycomb"), { recursive: true });
    writeFileSync(join(home, ".honeycomb", "state.json"), "legacy");
    writeFileSync(join(home, ".apiary", "honeycomb", "state.json"), "current");
    migrateLegacyConfig({ home, env: {}, argv: ["status"], oneShot: () => true });
    expect(readFileSync(join(home, ".apiary", "honeycomb", "state.json"), "utf8")).toBe("current");
    expect(readFileSync(join(home, ".apiary", "honeycomb", "state.json.legacy-1"), "utf8")).toBe("legacy");
  });

  it("refuses a legacy symlink without touching its target", () => {
    const home = mkdtempSync(join(tmpdir(), "cli-kit-link-home-"));
    const outside = mkdtempSync(join(tmpdir(), "cli-kit-link-target-"));
    writeFileSync(join(outside, "secret.txt"), "untouched");
    symlinkSync(outside, join(home, ".honeycomb"), process.platform === "win32" ? "junction" : "dir");

    expect(() => migrateLegacyConfig({ home, env: {}, argv: ["status"], oneShot: () => true }))
      .toThrow(ConfigDirError);
    expect(readFileSync(join(outside, "secret.txt"), "utf8")).toBe("untouched");
    expect(existsSync(join(home, ".apiary", "honeycomb"))).toBe(false);
  });

  it("rejects an APIARY_HOME symlink that resolves outside home", () => {
    const home = mkdtempSync(join(tmpdir(), "cli-kit-root-home-"));
    const outside = mkdtempSync(join(tmpdir(), "cli-kit-root-target-"));
    symlinkSync(outside, join(home, "redirect"), process.platform === "win32" ? "junction" : "dir");
    expect(() => apiaryHome({ home, env: { APIARY_HOME: join(home, "redirect") } })).toThrow(ConfigDirError);
  });
});
