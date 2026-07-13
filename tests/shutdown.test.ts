import { describe, expect, it, vi } from "vitest";
import { finalizeOneShot, isOneShot } from "../src/shutdown.js";
import type { FinalizeDeps } from "../src/shutdown.js";

function fakeDeps(overrides: Partial<FinalizeDeps> = {}): FinalizeDeps {
	return {
		getDispatcher: vi.fn(() => undefined),
		getActiveHandles: vi.fn(() => []),
		setExitCode: vi.fn(),
		scheduleBackstop: vi.fn(() => ({ unref: vi.fn() })),
		exit: vi.fn(),
		...overrides,
	};
}

describe("finalizeOneShot dependency seam", () => {
	it("closes the dispatcher, unrefs handles, sets the code, and arms an unref'd backstop", async () => {
		const close = vi.fn();
		const handleUnref = vi.fn();
		const timerUnref = vi.fn();
		let callback: (() => void) | undefined;
		const deps = fakeDeps({
			getDispatcher: vi.fn(() => ({ close })),
			getActiveHandles: vi.fn(() => [{ unref: handleUnref }, {}]),
			scheduleBackstop: vi.fn((fn, ms) => {
				expect(ms).toBe(2_000);
				callback = fn;
				return { unref: timerUnref };
			}),
		});

		await expect(finalizeOneShot(7, deps)).resolves.toBeUndefined();
		expect(close).toHaveBeenCalledOnce();
		expect(handleUnref).toHaveBeenCalledOnce();
		expect(deps.setExitCode).toHaveBeenCalledWith(7);
		expect(timerUnref).toHaveBeenCalledOnce();
		expect(deps.exit).not.toHaveBeenCalled();

		callback?.();
		expect(deps.exit).toHaveBeenCalledWith(7);
	});

	it("continues when every injected effect throws", async () => {
		const deps = fakeDeps({
			getDispatcher: () => ({ close: () => { throw new Error("close"); } }),
			getActiveHandles: () => [{ unref: () => { throw new Error("unref"); } }],
			setExitCode: () => { throw new Error("code"); },
			scheduleBackstop: () => { throw new Error("timer"); },
		});
		await expect(finalizeOneShot(1, deps)).resolves.toBeUndefined();
	});

	it("continues sweeping after one handle refuses to unref", async () => {
		const goodUnref = vi.fn();
		const deps = fakeDeps({
			getActiveHandles: () => [
				{ unref: () => { throw new Error("odd handle"); } },
				{ unref: goodUnref },
			],
		});
		await finalizeOneShot(0, deps);
		expect(goodUnref).toHaveBeenCalledOnce();
	});

	it("keeps the real-effects path optional and backward compatible", () => {
		expect(finalizeOneShot.length).toBe(1);
	});
});

describe("isOneShot", () => {
	it("classifies a one-shot verb", () => expect(isOneShot(["doctor"])).toBe(true));
	it("classifies the default run watchdog", () => expect(isOneShot(["run"])).toBe(false));
	it("treats an empty invocation as one-shot", () => expect(isOneShot([])).toBe(true));
	it("supports a custom watchdog list", () => {
		expect(isOneShot(["start"], { watchdogCommands: ["start", "daemon"] })).toBe(false);
		expect(isOneShot(["run"], { watchdogCommands: ["start"] })).toBe(true);
	});
	it("is total for pathological runtime input", () => {
		expect(isOneShot([42 as unknown as string])).toBe(true);
		expect(isOneShot(undefined as unknown as string[])).toBe(true);
		expect(isOneShot(["run"], { watchdogCommands: [42 as unknown as string] })).toBe(true);
	});
});
