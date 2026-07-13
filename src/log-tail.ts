import { isAbsolute, relative, resolve } from "node:path";

export interface LogTailOptions {
  lines: number;
  follow: boolean;
  since?: Date;
}

export type LogTailOptionsResult =
  | { ok: true; options: LogTailOptions }
  | { ok: false; error: string };

export interface ProductLogSource {
  productId: string;
  serviceId: string;
  root: string;
  path: string;
}

export type LogSourceResult =
  | { ok: true; source: ProductLogSource }
  | { ok: false; error: string };

export interface LogFileSystem {
  readFile(path: string): Promise<string>;
  watch(path: string, onChange: () => void): { close(): void };
  realpath(path: string): Promise<string>;
}

export interface LogTailRequest {
  productId: string;
  serviceId: string;
  source: ProductLogSource | undefined;
  options: LogTailOptions;
  fs: LogFileSystem;
  write(line: string): void;
  signal?: AbortSignal;
}

export type LogTailResult = { ok: true } | { ok: false; error: string };

const DURATION = /^(\d+)(ms|s|m|h|d)$/;
const MAX_LINES = 10_000;
const MAX_LOG_BYTES = 16 * 1024 * 1024;

export function parseLogTailOptions(argv: readonly string[], now = new Date()): LogTailOptionsResult {
  let lines = 100;
  let follow = true;
  let since: Date | undefined;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--no-follow") {
      follow = false;
      continue;
    }
    const [name, inline] = splitOption(token);
    if (name !== "--lines" && name !== "--since") return { ok: false, error: `unknown logs option: ${token}` };
    const value = inline ?? argv[++i];
    if (!value) return { ok: false, error: `${name} requires a value` };
    if (name === "--lines") {
      if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > MAX_LINES) return { ok: false, error: `--lines must be an integer between 1 and ${MAX_LINES}` };
      lines = Number(value);
    } else {
      since = parseSince(value, now);
      if (!since) return { ok: false, error: "--since must be a duration (for example 30m) or timestamp" };
    }
  }
  return { ok: true, options: { lines, follow, ...(since ? { since } : {}) } };
}

function splitOption(token: string): [string, string | undefined] {
  const at = token.indexOf("=");
  return at < 0 ? [token, undefined] : [token.slice(0, at), token.slice(at + 1)];
}

export function parseSince(value: string, now = new Date()): Date | undefined {
  const match = DURATION.exec(value);
  if (match) {
    const amount = Number(match[1]);
    const factors: Record<string, number> = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return new Date(now.getTime() - amount * factors[match[2]]);
  }
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? undefined : timestamp;
}

export function validateProductLogSource(
  productId: string,
  serviceId: string,
  source: ProductLogSource | undefined,
): LogSourceResult {
  if (!source) return { ok: false, error: `No log source is configured for ${productId}.` };
  if (source.productId !== productId || source.serviceId !== serviceId) {
    return { ok: false, error: `The configured log source does not belong to ${productId}.` };
  }
  if (!source.path || !source.root || !isPathWithin(source.root, source.path)) {
    return { ok: false, error: `The configured log source for ${productId} is outside its owned log directory.` };
  }
  return { ok: true, source };
}

const AUTHORIZATION = /(authorization["']?\s*[:=]\s*)Bearer\s+[^\s,;}]+/gi;
const SECRET_ASSIGNMENT = /(["']?\b(?:api[-_]?key|access[-_]?token|refresh[-_]?token|password|passwd|credential|secret)\b["']?)(\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;}]+)/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const URL_CREDENTIALS = /([a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:)[^\s@/]+@/gi;
const TERMINAL_CONTROLS = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\)?)|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/gu;

export function redactLogSecrets(value: string): string {
  return value
    .replace(AUTHORIZATION, "$1[REDACTED]")
    .replace(BEARER, "Bearer [REDACTED]")
    .replace(SECRET_ASSIGNMENT, (_match, key: string, separator: string, secret: string) => {
      const quote = secret.startsWith('"') ? '"' : secret.startsWith("'") ? "'" : "";
      return `${key}${separator}${quote}[REDACTED]${quote}`;
    })
    .replace(URL_CREDENTIALS, "$1[REDACTED]@")
    .replace(TERMINAL_CONTROLS, "");
}

export async function tailProductLog(request: LogTailRequest): Promise<LogTailResult> {
  const valid = validateProductLogSource(request.productId, request.serviceId, request.source);
  if (!valid.ok) return valid;
  try {
    const [root, path] = await Promise.all([request.fs.realpath(valid.source.root), request.fs.realpath(valid.source.path)]);
    if (!isPathWithin(root, path)) return { ok: false, error: `The configured log source for ${request.productId} is outside its owned log directory.` };
  } catch {
    return { ok: false, error: `Unable to resolve ${request.productId} log source.` };
  }
  let emitted = 0;
  const emitNew = async (initial: boolean): Promise<LogTailResult> => {
    let content: string;
    try {
      content = await request.fs.readFile(valid.source.path);
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return { ok: false, error: `Unable to read ${request.productId} logs: ${message}` };
    }
    if (Buffer.byteLength(content, "utf8") > MAX_LOG_BYTES) return { ok: false, error: `${request.productId} log exceeds the ${MAX_LOG_BYTES}-byte safety limit.` };
    const all = content.split(/\r?\n/).filter((line, index, values) => line.length > 0 || index < values.length - 1);
    const eligible = request.options.since ? all.filter((line) => lineIsSince(line, request.options.since as Date)) : all;
    const start = initial ? Math.max(0, eligible.length - request.options.lines) : emitted;
    for (const line of eligible.slice(start)) request.write(`${redactLogSecrets(line)}\n`);
    emitted = eligible.length;
    return { ok: true };
  };
  const first = await emitNew(true);
  if (!first.ok || !request.options.follow || request.signal?.aborted) return first;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: LogTailResult): void => {
      if (settled) return;
      settled = true;
      watcher.close();
      request.signal?.removeEventListener("abort", stop);
      resolve(result);
    };
    const stop = (): void => finish({ ok: true });
    const watcher = request.fs.watch(valid.source.path, () => {
      void emitNew(false).then((result) => { if (!result.ok) finish(result); });
    });
    request.signal?.addEventListener("abort", stop, { once: true });
  });
}

function isPathWithin(root: string, candidate: string): boolean {
  if (!isAbsolute(root) || !isAbsolute(candidate)) return false;
  const rel = relative(resolve(root), resolve(candidate));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function lineIsSince(line: string, since: Date): boolean {
  const match = line.match(/^\[?([^\]\s]+)\]?/);
  if (!match) return true;
  const timestamp = new Date(match[1]);
  return Number.isNaN(timestamp.getTime()) || timestamp >= since;
}
