import { ExitCode } from "./exit-codes.js";

export const COMMAND_GROUPS = ["Service lifecycle", "Installation", "Fleet", "Diagnostics", "Product commands"] as const;
export type CommandGroup = typeof COMMAND_GROUPS[number];
export type Product = "doctor" | "hive" | "honeycomb" | "nectar";

export interface CommandSpec {
  readonly name: string;
  readonly group: CommandGroup;
  readonly summary: string;
  readonly destructive: boolean;
  readonly idempotent: boolean;
  readonly json: boolean;
  readonly doctorExempt?: boolean;
  readonly aliases?: readonly { readonly name: string; readonly deprecated: true }[];
}

const command = (name: string, group: CommandGroup, summary: string, destructive: boolean, idempotent: boolean, extra: Partial<CommandSpec> = {}): CommandSpec =>
  Object.freeze({ name, group, summary, destructive, idempotent, json: true, ...extra });

export const BASELINE_COMMANDS: readonly CommandSpec[] = Object.freeze([
  command("start", "Service lifecycle", "Start the installed service", false, true),
  command("stop", "Service lifecycle", "Stop the installed service", false, true),
  command("restart", "Service lifecycle", "Restart and verify the service", false, false),
  command("status", "Service lifecycle", "Show service status", false, true),
  command("logs", "Service lifecycle", "Tail product logs", false, true),
  command("install", "Installation", "Configure and onboard the product", false, true),
  command("uninstall", "Installation", "Remove the product", true, true),
  command("service-install", "Installation", "Install or reconcile the OS service", false, true, { aliases: [{ name: "install-service", deprecated: true }] }),
  command("service-uninstall", "Installation", "Remove only the OS service", true, true, { aliases: [{ name: "uninstall-service", deprecated: true }] }),
  command("update", "Installation", "Update through the approved release channel", false, false),
  command("register", "Fleet", "Upsert this product in Doctor's registry", false, true, { doctorExempt: true }),
  command("telemetry", "Diagnostics", "Inspect or configure telemetry", false, true),
]);

export interface ProductManifest { readonly product: Product; readonly commands: readonly CommandSpec[] }

export function composeProductManifest(product: Product, productCommands: readonly Omit<CommandSpec, "group">[] = []): ProductManifest {
  const baseline = BASELINE_COMMANDS.filter((entry) => !(product === "doctor" && entry.doctorExempt));
  return { product, commands: [...baseline, ...productCommands.map((entry) => ({ ...entry, group: "Product commands" as const }))] };
}

export type CommandResolution =
  | { ok: true; command: CommandSpec; canonicalName: string; deprecatedAlias?: string }
  | { ok: false; exitCode: ExitCode.Usage; message: string };

export function resolveCommand(manifest: ProductManifest, input: string): CommandResolution {
  const canonical = manifest.commands.find((entry) => entry.name === input);
  if (canonical) return { ok: true, command: canonical, canonicalName: canonical.name };
  for (const entry of manifest.commands) {
    if (entry.aliases?.some((alias) => alias.name === input)) {
      return { ok: true, command: entry, canonicalName: entry.name, deprecatedAlias: input };
    }
  }
  return { ok: false, exitCode: ExitCode.Usage, message: `unknown command: ${input}` };
}

export interface CommandResult<T extends Record<string, unknown> = Record<string, never>> {
  readonly product: Product;
  readonly command: string;
  readonly ok: boolean;
  readonly message: string;
  readonly details?: T;
}

export type Outcome = "success" | "idempotent" | "runtime-error" | "usage-error";
export function exitCodeFor(outcome: Outcome): ExitCode {
  return outcome === "usage-error" ? ExitCode.Usage : outcome === "runtime-error" ? ExitCode.Error : ExitCode.Ok;
}

export interface ConformanceIssue { readonly code: string; readonly message: string }
export function validateManifest(manifest: ProductManifest): readonly ConformanceIssue[] {
  const issues: ConformanceIssue[] = [];
  const names = new Set<string>();
  for (const entry of manifest.commands) {
    if (names.has(entry.name)) issues.push({ code: "duplicate-command", message: `duplicate canonical command: ${entry.name}` });
    names.add(entry.name);
    if (!entry.json) issues.push({ code: "json-required", message: `${entry.name} must support --json` });
  }
  const required = BASELINE_COMMANDS.filter((entry) => !(manifest.product === "doctor" && entry.doctorExempt));
  for (const entry of required) if (!names.has(entry.name)) issues.push({ code: "missing-command", message: `missing required command: ${entry.name}` });
  if (manifest.product === "doctor" && names.has("register")) issues.push({ code: "doctor-register", message: "Doctor must omit register" });
  if (manifest.product !== "doctor" && !names.has("register")) issues.push({ code: "register-required", message: `${manifest.product} must provide register` });
  let previous = -1;
  for (const entry of manifest.commands) {
    const order = COMMAND_GROUPS.indexOf(entry.group);
    if (order < previous) { issues.push({ code: "group-order", message: `${entry.name} is outside canonical group order` }); break; }
    previous = order;
  }
  return issues;
}
