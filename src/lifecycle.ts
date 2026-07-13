export type ServiceState = "absent" | "stopped" | "running";
export interface LifecycleResult { readonly ok: boolean; readonly changed: boolean; readonly message: string }
export interface ServiceAdapter {
  state(): Promise<ServiceState>;
  install(): Promise<void>;
  uninstall(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthy(): Promise<boolean>;
}
export interface RegistryAdapter { isRegistered(): Promise<boolean>; register(): Promise<void>; deregister(): Promise<void> }
export interface UpdateAdapter { installedVersion(): Promise<string>; approvedVersion(): Promise<string>; install(version: string): Promise<void>; rollback(version: string): Promise<void> }
export interface ProductStateAdapter { removeOwnedState(): Promise<void> }

const result = (ok: boolean, changed: boolean, message: string): LifecycleResult => ({ ok, changed, message });
export async function serviceInstall(service: ServiceAdapter): Promise<LifecycleResult> {
  if (await service.state() !== "absent") return result(true, false, "service already installed");
  await service.install(); return result(true, true, "service installed");
}
export async function start(service: ServiceAdapter): Promise<LifecycleResult> {
  const state = await service.state();
  if (state === "absent") return result(false, false, "service is not installed; run service-install");
  if (state === "running") return result(true, false, "service already running");
  await service.start(); return result(true, true, "service started");
}
export async function stop(service: ServiceAdapter): Promise<LifecycleResult> {
  const state = await service.state();
  if (state === "absent" || state === "stopped") return result(true, false, "service already stopped");
  await service.stop(); return result(true, true, "service stopped");
}
export async function restart(service: ServiceAdapter, options: { attempts: number } = { attempts: 10 }): Promise<LifecycleResult> {
  if (await service.state() === "absent") return result(false, false, "service is not installed; run service-install");
  await stop(service); await service.start();
  for (let attempt = 0; attempt < options.attempts; attempt++) if (await service.healthy()) return result(true, true, "service restarted and healthy");
  return result(false, true, "service restarted but failed its health check");
}
export async function serviceUninstall(service: ServiceAdapter): Promise<LifecycleResult> {
  if (await service.state() === "absent") return result(true, false, "service already uninstalled");
  await stop(service); await service.uninstall(); return result(true, true, "service uninstalled; product state and registration preserved");
}
export async function registerProduct(registry: RegistryAdapter): Promise<LifecycleResult> {
  if (await registry.isRegistered()) return result(true, false, "product already registered");
  await registry.register(); return result(true, true, "product registered");
}
export async function uninstallProduct(deps: { service: ServiceAdapter; registry?: RegistryAdapter; state: ProductStateAdapter; removeState: boolean }): Promise<LifecycleResult> {
  await serviceUninstall(deps.service);
  if (deps.registry && await deps.registry.isRegistered()) await deps.registry.deregister();
  if (deps.removeState) await deps.state.removeOwnedState();
  return result(true, true, deps.removeState ? "product uninstalled and owned state removed" : "product uninstalled; state preserved");
}
export async function updateProduct(deps: { updater: UpdateAdapter; service: ServiceAdapter; healthAttempts?: number }): Promise<LifecycleResult & { fromVersion: string; toVersion: string }> {
  const fromVersion = await deps.updater.installedVersion(); const toVersion = await deps.updater.approvedVersion();
  if (fromVersion === toVersion) return { ...result(true, false, "product already up to date"), fromVersion, toVersion };
  await deps.updater.install(toVersion);
  const restarted = await restart(deps.service, { attempts: deps.healthAttempts ?? 10 });
  if (!restarted.ok) { await deps.updater.rollback(fromVersion); return { ...result(false, true, "update failed health verification and was rolled back"), fromVersion, toVersion }; }
  return { ...result(true, true, `updated from ${fromVersion} to ${toVersion}`), fromVersion, toVersion };
}

export type ServicePlatform = "windows" | "linux" | "macos";
export interface ServiceDefinition { readonly executable: string; readonly args: readonly string[]; readonly cwd: string; readonly apiaryHome: string; readonly stdoutLog: string; readonly stderrLog: string }
export interface FixedArgvInvocation { readonly executable: string; readonly args: readonly string[] }
export function serviceInstallInvocation(platform: ServicePlatform, definition: ServiceDefinition): FixedArgvInvocation {
  const payload = JSON.stringify(definition);
  if (platform === "windows") return { executable: "schtasks.exe", args: ["/Create", "/TN", definition.executable, "/TR", payload, "/F"] };
  if (platform === "linux") return { executable: "systemctl", args: ["--user", "enable", "--now", definition.executable] };
  return { executable: "launchctl", args: ["bootstrap", `gui/${process.getuid?.() ?? 0}`, payload] };
}
