import type { Product, ProductManifest } from "./command-contract.js";

export const APIARY_CREDIT = "Legion Code Inc. x Activeloop" as const;

export interface ProductBrand {
  readonly executable: Product;
  readonly name: "DOCTOR" | "HIVE" | "HONEYCOMB" | "NECTAR";
  readonly descriptor: string;
  readonly art: string;
}

/** Reference fixtures for consumer golden tests; products may refine their art. */
export const REFERENCE_PRODUCT_BRANDS: Readonly<Record<Product, ProductBrand>> = Object.freeze({
  doctor: Object.freeze({ executable: "doctor", name: "DOCTOR", descriptor: "Apiary service health and diagnostics", art: "  .---.\n  | + |\n  '---'" }),
  hive: Object.freeze({ executable: "hive", name: "HIVE", descriptor: "Apiary colony service coordinator", art: "  /\\_/\\\n /_/ \\_\\\n \\ \\_/ /\n  \\___/" }),
  honeycomb: Object.freeze({ executable: "honeycomb", name: "HONEYCOMB", descriptor: "Apiary shared memory service", art: "   __    __\n  /  \\__/  \\\n  \\__/  \\__/\n  /  \\__/  \\\n  \\__/  \\__/" }),
  nectar: Object.freeze({ executable: "nectar", name: "NECTAR", descriptor: "Apiary knowledge cultivation service", art: "    .\n   / \\\n  /   \\\n  \\   /\n   \\_/" }),
});

export interface BannerOptions {
  readonly brand: ProductBrand;
  readonly version: string;
  readonly manifest: ProductManifest;
  readonly width?: number;
}

const ASCII_ONLY = /^[\x20-\x7e\n]*$/u;

function wrapWords(text: string, width: number): readonly string[] {
  if (text.length <= width) return [text];
  const words = text.split(/\s+/u);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line.length === 0) line = word;
    else if (line.length + word.length + 1 <= width) line += ` ${word}`;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

export function renderGroupedHelp(manifest: ProductManifest, width = 80): string {
  const safeWidth = Math.max(24, Math.floor(width));
  const groups = new Map<string, typeof manifest.commands>();
  for (const command of manifest.commands) groups.set(command.group, [...(groups.get(command.group) ?? []), command]);
  const blocks: string[] = [];
  for (const [title, commands] of groups) {
    const column = Math.min(Math.max(...commands.map(({ name }) => name.length)), safeWidth - 8);
    const lines = [title];
    for (const command of commands) {
      const prefix = `  ${command.name.padEnd(column)}  `;
      const summaries = wrapWords(command.summary, Math.max(12, safeWidth - prefix.length));
      lines.push(`${prefix}${summaries[0]}`);
      for (const continuation of summaries.slice(1)) lines.push(`${" ".repeat(prefix.length)}${continuation}`);
    }
    blocks.push(lines.join("\n"));
  }
  return blocks.join("\n\n");
}

export function renderProductBanner(options: BannerOptions): string {
  const { brand, version, manifest, width = 80 } = options;
  if (!ASCII_ONLY.test(`${brand.art}${brand.name}${brand.descriptor}${version}${manifest.commands.map(({ name, summary }) => `${name}${summary}`).join("")}`)) throw new TypeError("product branding and help must be ASCII-only");
  const safeWidth = Math.max(24, Math.floor(width));
  const usage = `Usage: ${brand.executable} <command> [options]`;
  const globalFlags = [
    { name: "--help, -h", summary: "Show help" },
    { name: "--version", summary: "Show version" },
    { name: "--json", summary: "Emit machine-readable output" },
    { name: "--no-color", summary: "Disable color" },
  ];
  const flagManifest: ProductManifest = { product: brand.executable, commands: globalFlags.map((flag) => ({ ...flag, group: "Product commands", destructive: false, idempotent: true, json: true })) };
  const flags = renderGroupedHelp(flagManifest, safeWidth).replace(/^Product commands/mu, "Global flags");
  return [brand.art, brand.name, ...wrapWords(brand.descriptor, safeWidth), `v${version}`, APIARY_CREDIT, "", ...wrapWords(usage, safeWidth), "", renderGroupedHelp(manifest, safeWidth), "", flags].join("\n");
}

export function renderVersion(product: Product, version: string): string {
  return `${product} v${version}\n`;
}

export function renderVersionJson(product: Product, version: string): string {
  return `${JSON.stringify({ product, command: "version", ok: true, message: "version", version }, null, 2)}\n`;
}
