import { sanitizeTerminalText } from "./terminal-safety.js";

export type TelemetryDestination = "hosted" | "local" | "disabled" | "unknown";

export interface TelemetrySummary {
  state: "enabled" | "opted-out";
  controllingSetting: string;
  destination: TelemetryDestination;
  queue?: { pending: number; capacity?: number };
  lastSuccessfulSend?: string;
  lastError?: string;
  optOutInstruction: string;
}

export function telemetrySummaryToJson(summary: TelemetrySummary): TelemetrySummary {
  return structuredClone(summary);
}

export function formatTelemetrySummary(summary: TelemetrySummary): string {
  const lines = [
    `Telemetry: ${summary.state}`,
    `Controlled by: ${summary.controllingSetting}`,
    `Destination: ${summary.destination}`,
    `Queue: ${summary.queue ? `${summary.queue.pending}${summary.queue.capacity === undefined ? "" : `/${summary.queue.capacity}`}` : "not available"}`,
    `Last successful send: ${summary.lastSuccessfulSend ?? "not available"}`,
    `Last error: ${summary.lastError ?? "none"}`,
    `Opt out: ${summary.optOutInstruction}`,
  ];
  return `${lines.map(sanitizeTerminalText).join("\n")}\n`;
}
