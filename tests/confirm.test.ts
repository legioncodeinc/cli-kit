import { describe, expect, it, vi } from "vitest";
import { confirm } from "../src/confirm.js";

describe("confirm", () => {
  it("declines without reading from non-TTY input", async () => {
    const ask = vi.fn<() => Promise<string>>();
    await expect(confirm("Delete?", { input: { isTTY: false } as NodeJS.ReadableStream & { isTTY?: boolean } })).resolves.toBe(false);
    expect(ask).not.toHaveBeenCalled();
  });

  it("supports assumeYes without prompting", async () => {
    const ask = vi.fn(async () => "no");
    await expect(confirm("Delete?", { assumeYes: true, ask })).resolves.toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it.each([
    [false, "[y/N]", "", false],
    [true, "[Y/n]", "", true],
    [false, "[y/N]", "YES", true],
    [true, "[Y/n]", "n", false],
    [false, "[y/N]", "invalid", false],
  ])("renders the default and parses answers", async (defaultAnswer, suffix, answer, expected) => {
    const ask = vi.fn(async () => answer);
    await expect(confirm("Continue?", { default: defaultAnswer, ask })).resolves.toBe(expected);
    expect(ask).toHaveBeenCalledWith(expect.stringContaining(suffix));
  });

  it("never throws when the reader fails", async () => {
    await expect(confirm("Continue?", { default: true, ask: async () => { throw new Error("closed"); } })).resolves.toBe(true);
  });
});
