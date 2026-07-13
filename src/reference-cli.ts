import { composeProductManifest, resolveCommand, type Product } from "./command-contract.js";
import { REFERENCE_PRODUCT_BRANDS, renderProductBanner, renderVersion, renderVersionJson } from "./branding.js";

export interface ReferenceCliOptions { readonly product: Product; readonly version: string; readonly argv: readonly string[]; readonly width?: number }
export interface ReferenceCliResult { readonly stdout: string; readonly stderr: string; readonly exitCode: 0 | 1 | 2 }

/** Pure reference dispatcher used by consumers before wiring real side effects. */
export function runReferenceCli(options: ReferenceCliOptions): ReferenceCliResult {
  const { product, version, argv, width = 80 } = options;
  const manifest = composeProductManifest(product);
  const json = argv.includes("--json");
  const positional = argv.filter((arg) => !arg.startsWith("-"));
  if (argv.includes("--version")) return { stdout: json ? renderVersionJson(product, version) : renderVersion(product, version), stderr: "", exitCode: 0 };
  if (positional.length === 0 || argv.includes("--help") || argv.includes("-h") || positional[0] === "help") {
    return json ? { stdout: `${JSON.stringify({ product, command: "help", ok: true, message: "help" }, null, 2)}\n`, stderr: "", exitCode: 0 } : { stdout: `${renderProductBanner({ brand: REFERENCE_PRODUCT_BRANDS[product], version, manifest, width })}\n`, stderr: "", exitCode: 0 };
  }
  const resolution = resolveCommand(manifest, positional[0]);
  if (!resolution.ok) {
    const message = resolution.message;
    return json ? { stdout: `${JSON.stringify({ product, command: positional[0], ok: false, message }, null, 2)}\n`, stderr: "", exitCode: 2 } : { stdout: "", stderr: `${message}\n`, exitCode: 2 };
  }
  const failed = argv.includes("--simulate-failure");
  const payload = { product, command: resolution.canonicalName, ok: !failed, message: failed ? `${resolution.canonicalName} failed` : `${resolution.canonicalName} succeeded` };
  return json ? { stdout: `${JSON.stringify(payload, null, 2)}\n`, stderr: "", exitCode: failed ? 1 : 0 } : { stdout: failed ? "" : `${payload.message}\n`, stderr: failed ? `${payload.message}\n` : "", exitCode: failed ? 1 : 0 };
}
