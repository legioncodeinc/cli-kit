import { describe, expect, it, vi } from "vitest";
import { registerProduct, restart, serviceInstall, serviceInstallInvocation, serviceUninstall, start, stop, uninstallProduct, updateProduct } from "../src/lifecycle.js";
import type { ServiceAdapter, ServiceDefinition } from "../src/lifecycle.js";

function service(initial: "absent" | "stopped" | "running", health: boolean[] = [true]) {
  let state = initial; let check = 0;
  const adapter: ServiceAdapter = {
    state: vi.fn(async () => state), install: vi.fn(async () => { state = "stopped"; }), uninstall: vi.fn(async () => { state = "absent"; }),
    start: vi.fn(async () => { state = "running"; }), stop: vi.fn(async () => { state = "stopped"; }), healthy: vi.fn(async () => health[Math.min(check++, health.length - 1)] ?? false),
  };
  return adapter;
}

describe("lifecycle reference helpers", () => {
  it("keeps install/start/stop/service-uninstall idempotent", async () => {
    const absent = service("absent"); expect((await serviceInstall(absent)).changed).toBe(true); expect((await serviceInstall(absent)).changed).toBe(false);
    expect((await start(absent)).changed).toBe(true); expect((await start(absent)).changed).toBe(false);
    expect((await stop(absent)).changed).toBe(true); expect((await stop(absent)).changed).toBe(false);
    expect((await serviceUninstall(absent)).changed).toBe(true); expect((await serviceUninstall(absent)).changed).toBe(false);
  });
  it("fails start safely when no service exists", async () => expect(await start(service("absent"))).toMatchObject({ ok: false, message: expect.stringContaining("service-install") }));
  it("health-gates restart within a bounded attempt count", async () => {
    const delayed = service("running", [false, false, true]); expect(await restart(delayed, { attempts: 3 })).toMatchObject({ ok: true });
    const unhealthy = service("running", [false]); expect(await restart(unhealthy, { attempts: 2 })).toMatchObject({ ok: false });
    expect(unhealthy.healthy).toHaveBeenCalledTimes(2);
  });
  it("registers idempotently", async () => {
    let registered = false; const registry = { isRegistered: vi.fn(async () => registered), register: vi.fn(async () => { registered = true; }), deregister: vi.fn() };
    expect((await registerProduct(registry)).changed).toBe(true); expect((await registerProduct(registry)).changed).toBe(false); expect(registry.register).toHaveBeenCalledTimes(1);
  });
  it("service-uninstall preserves state and registration; full uninstall touches only injected owned state", async () => {
    const svc = service("running"); let registered = true;
    const registry = { isRegistered: vi.fn(async () => registered), register: vi.fn(), deregister: vi.fn(async () => { registered = false; }) };
    const state = { removeOwnedState: vi.fn() };
    await serviceUninstall(svc); expect(registry.deregister).not.toHaveBeenCalled(); expect(state.removeOwnedState).not.toHaveBeenCalled();
    await uninstallProduct({ service: service("running"), registry, state, removeState: false }); expect(registry.deregister).toHaveBeenCalled(); expect(state.removeOwnedState).not.toHaveBeenCalled();
  });
  it("updates via approved version and rolls back failed post-update health", async () => {
    const updater = { installedVersion: vi.fn(async () => "1.0.0"), approvedVersion: vi.fn(async () => "1.1.0"), install: vi.fn(), rollback: vi.fn() };
    const outcome = await updateProduct({ updater, service: service("running", [false]), healthAttempts: 2 });
    expect(outcome).toMatchObject({ ok: false, fromVersion: "1.0.0", toVersion: "1.1.0" }); expect(updater.install).toHaveBeenCalledWith("1.1.0"); expect(updater.rollback).toHaveBeenCalledWith("1.0.0");
  });
  it("builds fixed executable/argument arrays for all supported platforms", () => {
    const definition: ServiceDefinition = { executable: "C:/Apiary/bin.exe", args: ["--home", "value with spaces;$(bad)"], cwd: "C:/Apiary", apiaryHome: "C:/Apiary/home", stdoutLog: "out.log", stderrLog: "err.log" };
    for (const platform of ["windows", "linux", "macos"] as const) {
      const invocation = serviceInstallInvocation(platform, definition); expect(typeof invocation.executable).toBe("string"); expect(Array.isArray(invocation.args)).toBe(true);
    }
  });
});
