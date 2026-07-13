import { disableColor } from "./color.js";

export interface JsonOutputOptions {
  stream?: NodeJS.WritableStream;
  onError?: (error: Error) => void;
}

/** Enter machine-readable output mode. Call once during CLI bootstrap. */
export function setJsonMode(): void {
  disableColor();
}

/** Serialize one value as indented JSON followed by exactly one newline. */
export function emitJson(value: unknown, options: JsonOutputOptions = {}): boolean {
  try {
    const serialized = JSON.stringify(value, null, 2);
    if (serialized === undefined) {
      throw new TypeError("value is not JSON-serializable");
    }
    (options.stream ?? process.stdout).write(`${serialized}\n`);
    return true;
  } catch (cause: unknown) {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    try {
      options.onError?.(error);
    } catch {
      // Error reporting is advisory; serialization remains total even if the hook fails.
    }
    return false;
  }
}
