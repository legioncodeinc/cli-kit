import { describe, expect, it } from "vitest";
import { APIARY_CREDIT, REFERENCE_PRODUCT_BRANDS, renderProductBanner, renderVersion, renderVersionJson } from "../src/branding.js";
import { composeProductManifest, type Product } from "../src/command-contract.js";

const products = Object.keys(REFERENCE_PRODUCT_BRANDS) as Product[];

describe("product branding and help", () => {
  it.each(products)("renders complete ASCII-only %s help at 80 columns", (product) => {
    const brand = REFERENCE_PRODUCT_BRANDS[product];
    const output = renderProductBanner({ brand, version: "1.2.3", manifest: composeProductManifest(product), width: 80 });
    expect(output).toContain(brand.art);
    expect(output).toContain(`\n${brand.name}\n`);
    expect(output).toContain(APIARY_CREDIT);
    expect(output).toContain(`Usage: ${product} <command> [options]`);
    expect(output).not.toMatch(/\x1b/u);
    expect([...output].every((character) => (character.codePointAt(0) ?? 128) <= 127)).toBe(true);
    expect(Math.max(...output.split("\n").map((line) => line.length))).toBeLessThanOrEqual(80);
  });

  it("ships four distinct marks and a recognizable Honeycomb cell motif", () => {
    expect(new Set(products.map((product) => REFERENCE_PRODUCT_BRANDS[product].art)).size).toBe(4);
    expect(REFERENCE_PRODUCT_BRANDS.honeycomb.art).toMatch(/__.*__/u);
    expect(REFERENCE_PRODUCT_BRANDS.honeycomb.art).toMatch(/\\__\//u);
  });

  it.each(products)("wraps %s summaries without corrupting command names at narrow width", (product) => {
    const output = renderProductBanner({ brand: REFERENCE_PRODUCT_BRANDS[product], version: "1.2.3", manifest: composeProductManifest(product), width: 32 });
    for (const command of composeProductManifest(product).commands) expect(output).toMatch(new RegExp(`^  ${command.name}(?: |$)`, "mu"));
    // The mandated 33-character credit is the sole allowed overflow at width 32.
    expect(Math.max(...output.split("\n").filter((line) => line !== APIARY_CREDIT).map((line) => line.length))).toBeLessThanOrEqual(32);
  });

  it.each(products)("renders exact parseable %s version formats", (product) => {
    expect(renderVersion(product, "1.2.3")).toBe(`${product} v1.2.3\n`);
    const parsed = JSON.parse(renderVersionJson(product, "1.2.3")) as Record<string, unknown>;
    expect(parsed).toEqual({ product, command: "version", ok: true, message: "version", version: "1.2.3" });
  });

  it("rejects escape sequences and non-ASCII product-owned branding", () => {
    expect(() => renderProductBanner({ brand: { ...REFERENCE_PRODUCT_BRANDS.hive, art: "\x1b[31mHIVE" }, version: "1", manifest: composeProductManifest("hive") })).toThrow("ASCII-only");
    expect(() => renderProductBanner({ brand: { ...REFERENCE_PRODUCT_BRANDS.hive, descriptor: "colony \u2022 service" }, version: "1", manifest: composeProductManifest("hive") })).toThrow("ASCII-only");
  });
});
