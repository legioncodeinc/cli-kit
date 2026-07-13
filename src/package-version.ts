import { readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";

const cache = new Map<string, string | undefined>();

/** Read the nearest ancestor package.json version for an ESM module URL. */
export function readPackageVersion(importMetaUrl: string): string | undefined {
  if (cache.has(importMetaUrl)) return cache.get(importMetaUrl);
  let result: string | undefined;
  try {
    let directory = dirname(fileURLToPath(importMetaUrl));
    const root = parse(directory).root;
    while (true) {
      try {
        const parsed: unknown = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
        if (typeof parsed === "object" && parsed !== null && "version" in parsed) {
          const version = (parsed as { version?: unknown }).version;
          if (typeof version === "string" && version.trim() !== "") {
            result = version;
            break;
          }
        }
      } catch (error: unknown) {
        const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
        if (code !== "ENOENT" && code !== "ENOTDIR") break;
      }
      if (directory === root) break;
      directory = dirname(directory);
    }
  } catch {
    result = undefined;
  }
  cache.set(importMetaUrl, result);
  return result;
}
