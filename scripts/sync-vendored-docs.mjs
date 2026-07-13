import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const parentNotes = join(repoRoot, "..", "library", "notes");
const localNotes = join(repoRoot, "library", "notes");
const names = ["cli-contract.md", "cli-parity-audit.md"];
const write = process.argv.includes("--write");
let drift = false;
const normalize = (text) => `${text.replace(/\r\n/g, "\n").trimEnd()}\n`;

for (const name of names) {
  const canonicalPath = join(parentNotes, name);
  const vendoredPath = join(localNotes, name);
  let canonical;
  try {
    canonical = await readFile(canonicalPath, "utf8");
  } catch (error) {
    console.error(`Cannot read canonical ${canonicalPath}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
    continue;
  }
  const vendored = await readFile(vendoredPath, "utf8").catch(() => undefined);
  if (vendored !== undefined && normalize(vendored) === normalize(canonical)) continue;
  drift = true;
  if (write) {
    await writeFile(vendoredPath, canonical, "utf8");
    console.log(`Updated library/notes/${name}`);
  } else {
    console.error(`Vendored library/notes/${name} differs from ${canonicalPath}`);
  }
}

if (drift && !write && process.exitCode === undefined) process.exitCode = 1;
