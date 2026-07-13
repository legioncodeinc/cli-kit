import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { readPackageVersion } from "../src/package-version.js";

describe("readPackageVersion", () => {
  it("finds the nearest ancestor package.json", () => {
    const root = mkdtempSync(join(tmpdir(), "cli-kit-version-"));
    const nested = join(root, "src", "deep");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(root, "package.json"), '{"version":"3.2.1"}');
    expect(readPackageVersion(pathToFileURL(join(nested, "module.js")).href)).toBe("3.2.1");
  });

  it("returns undefined for missing, invalid, or versionless manifests and invalid URLs", () => {
    const missing = mkdtempSync(join(tmpdir(), "cli-kit-version-missing-"));
    expect(readPackageVersion(pathToFileURL(join(missing, "module.js")).href)).toBeUndefined();
    const invalid = mkdtempSync(join(tmpdir(), "cli-kit-version-invalid-"));
    writeFileSync(join(invalid, "package.json"), "not json");
    expect(readPackageVersion(pathToFileURL(join(invalid, "module.js")).href)).toBeUndefined();
    expect(readPackageVersion("not a url")).toBeUndefined();
  });
});
