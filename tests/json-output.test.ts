import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isColorEnabled, setColorEnabled } from "../src/color.js";
import { emitJson, setJsonMode } from "../src/json-output.js";

describe("JSON output", () => {
  beforeEach(() => {
    process.env.FORCE_COLOR = "1";
    delete process.env.NO_COLOR;
    setColorEnabled();
  });

  it("writes canonical indented JSON with one newline", () => {
    const stream = new PassThrough();
    let output = "";
    stream.on("data", (chunk) => { output += chunk.toString(); });
    expect(emitJson({ b: 2, a: 1 }, { stream })).toBe(true);
    expect(output).toBe('{\n  "b": 2,\n  "a": 1\n}\n');
  });

  it("disables color only when JSON mode is explicitly selected", () => {
    expect(isColorEnabled()).toBe(true);
    setJsonMode();
    expect(isColorEnabled()).toBe(false);
  });

  it("contains circular and BigInt serialization errors", () => {
    const errors: Error[] = [];
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(emitJson(circular, { onError: (error) => errors.push(error) })).toBe(false);
    expect(emitJson(1n, { onError: (error) => errors.push(error) })).toBe(false);
    expect(errors).toHaveLength(2);
  });
});
