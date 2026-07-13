import { sanitizeTerminalText } from "./terminal-safety.js";

export type InstallationState = "installed" | "not-installed" | "unknown";
export type ProcessState = "running" | "stopped" | "unknown";
export type HealthState = "healthy" | "unhealthy" | "unknown" | "not-applicable";
export type RegistrationState = "registered" | "unregistered" | "unknown" | "not-applicable";

export interface ServiceStatus {
  product: string;
  version: string;
  installation: InstallationState;
  process: { state: ProcessState; pid?: number };
  health: { state: HealthState; endpoint?: string; result?: string };
  registration: RegistrationState;
  update?: { available: boolean; version?: string };
  paths: { config: string; logs: string };
  details?: Readonly<Record<string, unknown>>;
}

export function statusToJson(status: ServiceStatus): ServiceStatus {
  return structuredClone(status);
}

export function formatStatus(status: ServiceStatus): string {
  const process = status.process.pid === undefined
    ? status.process.state
    : `${status.process.state} (PID ${status.process.pid})`;
  const healthParts = [status.health.state, status.health.endpoint, status.health.result].filter(Boolean);
  const lines = [
    `Product: ${status.product} ${status.version}`,
    `Service: ${status.installation}`,
    `Process: ${process}`,
    `Health: ${healthParts.join(" - ")}`,
    `Registration: ${status.registration}`,
    `Update: ${formatUpdate(status.update)}`,
    `Config: ${status.paths.config}`,
    `Logs: ${status.paths.logs}`,
  ];
  if (status.details && Object.keys(status.details).length > 0) {
    lines.push("Details:", ...Object.entries(status.details).map(([key, value]) => `  ${key}: ${String(value)}`));
  }
  return `${lines.map(sanitizeTerminalText).join("\n")}\n`;
}

function formatUpdate(update: ServiceStatus["update"]): string {
  if (!update) return "unknown";
  if (!update.available) return "up-to-date";
  return update.version ? `available (${update.version})` : "available";
}
