import * as fs from "node:fs";
import { homedir } from "node:os";
import { posix, win32, type PlatformPath } from "node:path";
import { isOneShot } from "./shutdown.js";

const LEGACY_NAMES = ["daemon", "deeplake", "honeycomb"] as const;

export class ConfigDirError extends Error {
  readonly code = "ERR_APIARY_CONFIG_DIR";
  constructor(message: string) {
    super(message);
    this.name = "ConfigDirError";
  }
}

export interface ConfigDirOptions {
  env?: NodeJS.ProcessEnv;
  home?: string;
  platform?: NodeJS.Platform;
}

export interface MigrationFileSystem {
  existsSync(path: string): boolean;
  mkdirSync(path: string, options: { recursive: true }): unknown;
  renameSync(source: string, destination: string): void;
  rmSync(path: string, options: { recursive: true; force: true }): void;
  symlinkSync(target: string, path: string, type: "dir" | "junction"): void;
  readdirSync(path: string): string[];
  statSync(path: string): { isDirectory(): boolean; size: number };
  lstatSync(path: string): { isDirectory(): boolean; isSymbolicLink(): boolean };
  copyFileSync(source: string, destination: string): void;
}

export interface MigrateConfigOptions extends ConfigDirOptions {
  argv?: string[];
  watchdogCommands?: string[];
  fileSystem?: MigrationFileSystem;
  oneShot?: (argv: string[], options?: { watchdogCommands?: string[] }) => boolean;
  warn?: (message: string) => void;
}

export interface ConfigMigrationResult {
  skipped: boolean;
  migrated: string[];
  linked: string[];
}

function pathApi(platform: NodeJS.Platform): PlatformPath {
  return platform === "win32" ? win32 : posix;
}

function isInside(parent: string, child: string, path: PlatformPath): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function validateHome(value: string, path: PlatformPath): string {
  const resolved = path.resolve(value.trim());
  const root = path.parse(resolved).root;
  const normalized = resolved.toLowerCase().replace(/[\\/]+$/, "");
  const forbidden = new Set(
    path === win32
      ? ["c:\\programdata", "c:\\windows"]
      : ["/etc", "/var", "/usr"],
  );
  if (value.trim() === "" || resolved === root || forbidden.has(normalized)) {
    throw new ConfigDirError(`refusing system or filesystem-root config directory: ${resolved}`);
  }
  return resolved;
}

function resolveParts(options: ConfigDirOptions = {}): { home: string; root: string; path: PlatformPath } {
  const platform = options.platform ?? process.platform;
  const path = pathApi(platform);
  const home = validateHome(options.home ?? homedir(), path);
  const override = (options.env ?? process.env).APIARY_HOME?.trim();
  const root = override ? validateHome(override, path) : path.join(home, ".apiary");
  if (!isInside(home, root, path)) {
    throw new ConfigDirError(`APIARY_HOME must remain inside the invoking user's home: ${root}`);
  }
  if (platform === process.platform && fs.existsSync(home)) {
    const realHome = fs.realpathSync.native(home);
    let existing = root;
    while (!fs.existsSync(existing) && existing !== path.dirname(existing)) existing = path.dirname(existing);
    const realExisting = fs.realpathSync.native(existing);
    if (!isInside(realHome, realExisting, path)) {
      throw new ConfigDirError(`APIARY_HOME resolves outside the invoking user's home: ${root}`);
    }
  }
  return { home, root, path };
}

export function apiaryHome(options: ConfigDirOptions = {}): string {
  return resolveParts(options).root;
}

export function resolveConfigDir(toolName?: string, options: ConfigDirOptions = {}): string {
  const { root, path } = resolveParts(options);
  if (toolName === undefined) return root;
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(toolName)) {
    throw new ConfigDirError(`invalid config namespace: ${toolName}`);
  }
  return path.join(root, toolName);
}

function mergeWithoutLoss(source: string, destination: string, fileSystem: MigrationFileSystem, path: PlatformPath): void {
  for (const name of fileSystem.readdirSync(source)) {
    const from = path.join(source, name);
    let to = path.join(destination, name);
    if (!fileSystem.existsSync(to)) {
      try {
        fileSystem.renameSync(from, to);
      } catch {
        if (fileSystem.statSync(from).isDirectory()) {
          fileSystem.mkdirSync(to, { recursive: true });
          mergeWithoutLoss(from, to, fileSystem, path);
        } else {
          fileSystem.copyFileSync(from, to);
          if (fileSystem.statSync(from).size !== fileSystem.statSync(to).size) {
            throw new ConfigDirError(`migration copy verification failed: ${from}`);
          }
        }
        fileSystem.rmSync(from, { recursive: true, force: true });
      }
      continue;
    }
    if (fileSystem.statSync(from).isDirectory() && fileSystem.statSync(to).isDirectory()) {
      mergeWithoutLoss(from, to, fileSystem, path);
      fileSystem.rmSync(from, { recursive: true, force: true });
      continue;
    }
    let suffix = 1;
    while (fileSystem.existsSync(to)) {
      to = path.join(destination, `${name}.legacy-${suffix++}`);
    }
    try {
      fileSystem.renameSync(from, to);
    } catch {
      fileSystem.copyFileSync(from, to);
      if (fileSystem.statSync(from).size !== fileSystem.statSync(to).size) {
        throw new ConfigDirError(`migration copy verification failed: ${from}`);
      }
      fileSystem.rmSync(from, { recursive: true, force: true });
    }
  }
}

function rejectLinks(root: string, fileSystem: MigrationFileSystem, path: PlatformPath): void {
  if (!fileSystem.existsSync(root)) return;
  const entry = fileSystem.lstatSync(root);
  if (entry.isSymbolicLink()) throw new ConfigDirError(`refusing to migrate symbolic link: ${root}`);
  if (!entry.isDirectory()) return;
  for (const name of fileSystem.readdirSync(root)) rejectLinks(path.join(root, name), fileSystem, path);
}

function migrateOne(source: string, destination: string, fileSystem: MigrationFileSystem, platform: NodeJS.Platform): boolean {
  const path = platform === "win32" ? win32 : posix;
  if (!fileSystem.existsSync(source)) return false;
  // Preflight both trees before any mutation. Following a link here could copy
  // or overwrite data outside the user-owned migration roots.
  rejectLinks(source, fileSystem, path);
  rejectLinks(destination, fileSystem, path);
  fileSystem.mkdirSync(path.dirname(destination), { recursive: true });
  if (!fileSystem.existsSync(destination)) {
    try {
      fileSystem.renameSync(source, destination);
      return false;
    } catch {
      // Cross-device and open-handle failures use a verified copy before source removal.
    }
  }
  fileSystem.mkdirSync(destination, { recursive: true });
  mergeWithoutLoss(source, destination, fileSystem, path);
  fileSystem.rmSync(source, { recursive: true, force: true });
  try {
    fileSystem.symlinkSync(destination, source, platform === "win32" ? "junction" : "dir");
    return true;
  } catch {
    // The destination already contains the complete copy; a compatibility link is best effort.
    return false;
  }
}

/** Consolidate legacy top-level directories during one-shot invocations only. */
export function migrateLegacyConfig(options: MigrateConfigOptions = {}): ConfigMigrationResult {
  const classify = options.oneShot ?? isOneShot;
  if (!classify(options.argv ?? process.argv.slice(2), { watchdogCommands: options.watchdogCommands })) {
    return { skipped: true, migrated: [], linked: [] };
  }
  const { home, root, path } = resolveParts(options);
  const fileSystem = options.fileSystem ?? fs;
  const migrated: string[] = [];
  const linked: string[] = [];
  fileSystem.mkdirSync(root, { recursive: true });
  for (const name of LEGACY_NAMES) {
    const source = path.join(home, `.${name}`);
    const destination = path.join(root, name);
    if (!fileSystem.existsSync(source)) continue;
    const didLink = migrateOne(source, destination, fileSystem, options.platform ?? process.platform);
    migrated.push(name);
    if (didLink) {
      linked.push(name);
      options.warn?.(`Deprecated ${source}; use ${destination}.`);
    }
  }
  return { skipped: false, migrated, linked };
}
