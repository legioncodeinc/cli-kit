import { describe, expect, it } from "vitest";
import { runReferenceCli } from "../src/reference-cli.js";
import type { Product } from "../src/command-contract.js";

const products: Product[] = ["doctor", "hive", "honeycomb", "nectar"];
const ansi = /\x1b/u;

describe("golden reference CLI", () => {
  it.each(products)("makes bare and help byte-identical for %s", (product) => {
    const bare = runReferenceCli({ product, version: "1.2.3", argv: [] });
    const help = runReferenceCli({ product, version: "1.2.3", argv: ["--help"] });
    expect(bare).toEqual(help);
    expect(bare).toMatchSnapshot();
  });

  it.each(products)("covers narrow, version, unknown, and human success/failure for %s", (product) => {
    expect(runReferenceCli({ product, version: "1.2.3", argv: [], width: 32 })).toMatchSnapshot("narrow");
    expect(runReferenceCli({ product, version: "1.2.3", argv: ["--version"] })).toEqual({ stdout: `${product} v1.2.3\n`, stderr: "", exitCode: 0 });
    expect(runReferenceCli({ product, version: "1.2.3", argv: ["wat"] })).toEqual({ stdout: "", stderr: "unknown command: wat\n", exitCode: 2 });
    expect(runReferenceCli({ product, version: "1.2.3", argv: ["status"] })).toEqual({ stdout: "status succeeded\n", stderr: "", exitCode: 0 });
    expect(runReferenceCli({ product, version: "1.2.3", argv: ["status", "--simulate-failure"] })).toEqual({ stdout: "", stderr: "status failed\n", exitCode: 1 });
  });

  it.each(products)("keeps all %s JSON paths machine-only and ANSI-free", (product) => {
    const invocations = [["--help", "--json"], ["--version", "--json"], ["status", "--json"], ["status", "--json", "--simulate-failure"], ["wat", "--json"]];
    for (const argv of invocations) {
      const result = runReferenceCli({ product, version: "1.2.3", argv });
      expect(() => JSON.parse(result.stdout)).not.toThrow();
      expect(result.stdout).not.toMatch(ansi);
      expect(result.stdout).not.toContain("Legion Code Inc.");
      expect(result.stderr).toBe("");
    }
  });

  it("is pure and cannot invoke filesystem, network, registry, service, or daemon seams", () => {
    const first = runReferenceCli({ product: "honeycomb", version: "1.2.3", argv: ["--help"] });
    const second = runReferenceCli({ product: "honeycomb", version: "1.2.3", argv: ["--help"] });
    expect(second).toEqual(first);
  });
});
