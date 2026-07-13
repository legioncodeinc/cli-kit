import { describe, expect, it, vi } from "vitest";
import {
  parseLogTailOptions,
  redactLogSecrets,
  tailProductLog,
  validateProductLogSource,
  type LogFileSystem,
  type ProductLogSource,
} from "../src/log-tail.js";

const source: ProductLogSource = { productId: "honeycomb", serviceId: "honeycomb-service", root: "/logs", path: "/logs/honeycomb.log" };

function fakeFs(initial: string): { fs: LogFileSystem; change(content: string): void; closed: () => boolean } {
  let content = initial;
  let listener = (): void => undefined;
  let isClosed = false;
  return {
    fs: {
      readFile: vi.fn(async () => content),
      realpath: vi.fn(async (path) => path),
      watch: vi.fn((_path, onChange) => {
        listener = onChange;
        return { close: () => { isClosed = true; } };
      }),
    },
    change(next) { content = next; listener(); },
    closed: () => isClosed,
  };
}

describe("log option contract", () => {
  it("defaults to 100 lines and follow", () => {
    expect(parseLogTailOptions([])).toEqual({ ok: true, options: { lines: 100, follow: true } });
  });

  it("parses lines, no-follow, duration, and timestamp forms", () => {
    const now = new Date("2026-07-12T12:00:00Z");
    const duration = parseLogTailOptions(["--lines=25", "--no-follow", "--since", "30m"], now);
    expect(duration).toEqual({ ok: true, options: { lines: 25, follow: false, since: new Date("2026-07-12T11:30:00Z") } });
    expect(parseLogTailOptions(["--since=2026-07-01T00:00:00Z"], now).ok).toBe(true);
  });

  it("rejects invalid and arbitrary options", () => {
    expect(parseLogTailOptions(["--lines", "0"]).ok).toBe(false);
    expect(parseLogTailOptions(["--path", "/other/service.log"]).ok).toBe(false);
    expect(parseLogTailOptions(["--lines", "10001"]).ok).toBe(false);
  });
});

describe("product log isolation", () => {
  it.each([
    ["doctor", "doctor-service"],
    ["hive", "hive-service"],
    ["nectar", "nectar-service"],
  ])("prevents %s from using the Honeycomb source", (productId, serviceId) => {
    expect(validateProductLogSource(productId, serviceId, source).ok).toBe(false);
  });

  it("accepts only the matching product and service", () => {
    expect(validateProductLogSource("honeycomb", "honeycomb-service", source)).toEqual({ ok: true, source });
  });

  it("rejects traversal and symlink escapes from the product-owned log root", async () => {
    expect(validateProductLogSource("honeycomb", "honeycomb-service", { ...source, path: "/logs/../other.log" }).ok).toBe(false);
    const fs: LogFileSystem = { readFile: async () => "secret", watch: () => ({ close() {} }), realpath: async (path) => path === "/logs/honeycomb.log" ? "/other/secret.log" : path };
    await expect(tailProductLog({ productId: "honeycomb", serviceId: "honeycomb-service", source, options: { lines: 1, follow: false }, fs, write() {} })).resolves.toMatchObject({ ok: false });
  });

  it("returns a concise missing-source error", () => {
    expect(validateProductLogSource("honeycomb", "honeycomb-service", undefined)).toEqual({
      ok: false,
      error: "No log source is configured for honeycomb.",
    });
  });
});

describe("secret redaction", () => {
  it.each([
    ["Authorization: Bearer abc.def-123", "Authorization: [REDACTED]"],
    ["api_key=super-secret", "api_key=[REDACTED]"],
    ['{"password":"hunter2","access_token":"abc"}', '{"password":"[REDACTED]","access_token":"[REDACTED]"}'],
    ["https://alice:password@example.com/path", "https://alice:[REDACTED]@example.com/path"],
    ["safe\u001b]8;;https://evil.example\u0007click\u001b]8;;\u0007", "safeclick"],
  ])("redacts %s", (input, expected) => expect(redactLogSecrets(input)).toBe(expected));
});

describe("safe file tail", () => {
  it("emits only the bounded final lines without following", async () => {
    const fixture = fakeFs("one\ntwo\nthree\n");
    const writes: string[] = [];
    const result = await tailProductLog({ productId: "honeycomb", serviceId: "honeycomb-service", source, options: { lines: 2, follow: false }, fs: fixture.fs, write: (line) => writes.push(line) });
    expect(result).toEqual({ ok: true });
    expect(writes).toEqual(["two\n", "three\n"]);
    expect(fixture.fs.watch).not.toHaveBeenCalled();
  });

  it("filters timestamped lines with since", async () => {
    const fixture = fakeFs("2026-07-01T00:00:00Z old\n2026-07-12T00:00:00Z new\n");
    const writes: string[] = [];
    await tailProductLog({ productId: "honeycomb", serviceId: "honeycomb-service", source, options: { lines: 100, follow: false, since: new Date("2026-07-10T00:00:00Z") }, fs: fixture.fs, write: (line) => writes.push(line) });
    expect(writes).toEqual(["2026-07-12T00:00:00Z new\n"]);
  });

  it("follows appended entries and Ctrl+C abort closes cleanly", async () => {
    const fixture = fakeFs("one\n");
    const writes: string[] = [];
    const controller = new AbortController();
    const pending = tailProductLog({ productId: "honeycomb", serviceId: "honeycomb-service", source, options: { lines: 100, follow: true }, fs: fixture.fs, write: (line) => writes.push(line), signal: controller.signal });
    await vi.waitFor(() => expect(fixture.fs.watch).toHaveBeenCalled());
    fixture.change("one\ntwo apiKey=secret\n");
    await vi.waitFor(() => expect(writes).toContain("two apiKey=[REDACTED]\n"));
    controller.abort();
    await expect(pending).resolves.toEqual({ ok: true });
    expect(fixture.closed()).toBe(true);
  });

  it("returns an unreadable-log result", async () => {
    const fs: LogFileSystem = { readFile: async () => { throw new Error("access denied"); }, realpath: async (path) => path, watch: () => ({ close() {} }) };
    await expect(tailProductLog({ productId: "honeycomb", serviceId: "honeycomb-service", source, options: { lines: 100, follow: false }, fs, write() {} })).resolves.toEqual({ ok: false, error: "Unable to read honeycomb logs: access denied" });
  });
});
