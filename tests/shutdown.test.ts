import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { finalizeOneShot } from "../src/shutdown.js";
import * as shutdownModule from "../src/shutdown.js";
import { readFileSync } from "node:fs";

/**
 * Shutdown module tests — PRD-001b.
 *
 * `finalizeOneShot` touches process internals (undici global dispatcher,
 * `process._getActiveHandles`, `process.exit`, the event loop). These tests use
 * `vi.spyOn`, `vi.useFakeTimers`, and a stubbed global dispatcher to assert the
 * teardown sequence deterministically WITHOUT a real process teardown. Each
 * acceptance criterion (AC-b1 … AC-b6) is covered by at least one test,
 * annotated with the AC id in the test title.
 */
describe("shutdown — finalizeOneShot", () => {
	// Isolate the handle-unref step from vitest's own process: `finalizeOneShot`
	// unrefs EVERY active handle, and in a test worker that includes tinypool's
	// IPC child-process channel — unref'ing it corrupts the worker (EPIPE /
	// "Worker exited unexpectedly"). So by default we stub `_getActiveHandles`
	// to return a stable, isolated fake handle that we own. Tests that need to
	// assert the throw paths (AC-b5) replace this spy locally.
	let handleUnrefCalls = 0;
	beforeEach(() => {
		handleUnrefCalls = 0;
		// process.exitCode is module-global mutable state; snapshot and clear it so
		// each test starts from a known baseline, restored in afterEach.
		vi.stubGlobal("__exitCodeBefore", process.exitCode);
		process.exitCode = undefined;
		// Stub the underscore API to return a single fake handle we control, so
		// finalizeOneShot never touches vitest's real IPC handles.
		vi.spyOn(
			process as unknown as { _getActiveHandles: () => unknown[] },
			"_getActiveHandles",
		).mockReturnValue([{ unref: (): void => { handleUnrefCalls += 1; } }]);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		// Restore the captured exitCode.
		process.exitCode = globalThis.__exitCodeBefore as number | string | undefined;
	});

	describe("AC-b2: no-op-safe (clean one-shot, no fetch)", () => {
		it("completes without error when there is nothing to clean up (AC-b2)", async () => {
			// No global dispatcher symbol present, no active handles to unref.
			// process.exit is mocked so the backstop (if it ever fired) can't kill the runner.
			const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
				throw new Error("process.exit must not be called on the happy path");
			}) as never);

			// Should resolve without throwing.
			await expect(finalizeOneShot(0)).resolves.toBeUndefined();
			expect(exitSpy).not.toHaveBeenCalled();
		});

		it("resolves with a non-zero code too (no-op-safe for any code)", async () => {
			vi.spyOn(process, "exit").mockImplementation((() => {
				throw new Error("process.exit must not be called on the happy path");
			}) as never);

			await expect(finalizeOneShot(1)).resolves.toBeUndefined();
		});
	});

	describe("AC-b3: process.exitCode is set before the promise resolves", () => {
		it("sets process.exitCode to the passed code (AC-b3)", async () => {
			await finalizeOneShot(42);

			expect(process.exitCode).toBe(42);
		});

		it("sets process.exitCode to 0 for success", async () => {
			await finalizeOneShot(0);

			expect(process.exitCode).toBe(0);
		});

		it("sets process.exitCode to 2 for usage error", async () => {
			await finalizeOneShot(2);

			expect(process.exitCode).toBe(2);
		});
	});

	describe("AC-b1: undici global dispatcher close is attempted", () => {
		/**
		 * Save/restore the undici global-dispatcher symbol. Node registers it as a
		 * NON-configurable property on globalThis, so `delete` throws — we restore
		 * by reassigning the prior value instead. Returns a restore() callable.
		 */
		function withStubDispatcher(dispatcher: unknown): () => void {
			const sym = Symbol.for("undici.globalDispatcher.1");
			const store = globalThis as unknown as Record<symbol, unknown>;
			const prev = sym in store ? store[sym] : undefined;
			const wasSet = sym in store;
			store[sym] = dispatcher;
			return (): void => {
				if (wasSet) {
					store[sym] = prev;
				} else {
					// Best-effort removal; ignore if non-configurable (we overwrite above anyway).
					try {
						delete store[sym];
					} catch {
						store[sym] = prev;
					}
				}
			};
		}

		it("calls close() on the undici global dispatcher when present (AC-b1)", async () => {
			const close = vi.fn().mockResolvedValue(undefined);
			// Plant a stub dispatcher on the well-known undici global symbol so
			// finalizeOneShot finds it and calls close(). This proves the close
			// logic executes — the root-cause fix for the Windows exit-127 race.
			const restore = withStubDispatcher({ close });

			try {
				await finalizeOneShot(0);

				expect(close).toHaveBeenCalledTimes(1);
				expect(process.exitCode).toBe(0);
			} finally {
				restore();
			}
		});

		it("does not throw when the dispatcher is absent (no fetch ran)", async () => {
			// Ensure the symbol points to undefined so finalizeOneShot skips close.
			const restore = withStubDispatcher(undefined);

			try {
				await expect(finalizeOneShot(0)).resolves.toBeUndefined();
				expect(process.exitCode).toBe(0);
			} finally {
				restore();
			}
		});

		it("does not call close when dispatcher has no close() method", async () => {
			const restore = withStubDispatcher({}); // object without close()

			try {
				await expect(finalizeOneShot(0)).resolves.toBeUndefined();
				expect(process.exitCode).toBe(0);
			} finally {
				restore();
			}
		});

		it("swallows a rejecting dispatcher.close() and still sets the exit code (AC-b1 + AC-b5)", async () => {
			const restore = withStubDispatcher({
				close: vi.fn().mockRejectedValue(new Error("socket wedged")),
			});

			try {
				await expect(finalizeOneShot(7)).resolves.toBeUndefined();
				expect(process.exitCode).toBe(7);
			} finally {
				restore();
			}
		});
	});

	describe("AC-b5: internal step throws → caught, still exits with code", () => {
		it("does not throw when _getActiveHandles throws (AC-b5)", async () => {
			// Simulate the undocumented API changing/throwing. Override the
			// suite-level spy (restored by vi.restoreAllMocks in afterEach).
			const handlesSpy = vi.spyOn(
				process as unknown as { _getActiveHandles: () => unknown[] },
				"_getActiveHandles",
			);
			handlesSpy.mockImplementation((): unknown[] => {
				throw new Error("_getActiveHandles disappeared");
			});

			await expect(finalizeOneShot(3)).resolves.toBeUndefined();
			expect(process.exitCode).toBe(3);
		});

		it("does not throw when an individual handle.unref() throws (AC-b5)", async () => {
			const unrefSpy = vi.fn((): void => {
				throw new Error("unref refused");
			});
			const goodUnref = vi.fn((): void => undefined);
			const handlesSpy = vi.spyOn(
				process as unknown as { _getActiveHandles: () => unknown[] },
				"_getActiveHandles",
			);
			handlesSpy.mockReturnValue([
				{ unref: unrefSpy },
				{ unref: goodUnref },
				{}, // handle without unref — must be skipped
			]);

			await expect(finalizeOneShot(0)).resolves.toBeUndefined();
			expect(unrefSpy).toHaveBeenCalled();
			expect(goodUnref).toHaveBeenCalled();
			expect(process.exitCode).toBe(0);
		});
	});

	describe("AC-b4: backstop timer fires → process.exit(code)", () => {
		it("schedules a 2000ms backstop that calls process.exit(code) (AC-b4)", async () => {
			vi.useFakeTimers();
			const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
				// Record the call; do not actually exit.
			}) as never);

			await finalizeOneShot(5);

			// Not fired yet — happy path hasn't drained within the bound.
			expect(exitSpy).not.toHaveBeenCalled();

			// Advance to the backstop threshold.
			vi.advanceTimersByTime(2_000);

			expect(exitSpy).toHaveBeenCalledTimes(1);
			expect(exitSpy).toHaveBeenCalledWith(5);
		});

		it("does not call process.exit before 2000ms (happy path drains first)", async () => {
			vi.useFakeTimers();
			const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
				/* no-op */
			}) as never);

			await finalizeOneShot(0);

			vi.advanceTimersByTime(1_999);
			expect(exitSpy).not.toHaveBeenCalled();

			vi.advanceTimersByTime(1);
			expect(exitSpy).toHaveBeenCalledWith(0);
		});

		it("calls process.exit with the ORIGINAL code even when non-zero (AC-b4)", async () => {
			vi.useFakeTimers();
			const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
				/* no-op */
			}) as never);

			await finalizeOneShot(11);
			vi.advanceTimersByTime(2_000);

			// The force-exit uses the intended code, not 0 or undefined.
			expect(exitSpy).toHaveBeenCalledWith(11);
		});
	});

	describe("AC-b6: long-running path documented as exempt", () => {
		it("exports only finalizeOneShot (AC-b6)", () => {
			// The module surface is intentionally minimal: one function. Long-running
			// commands are exempt by convention and must not have a kit helper.
			const exported = Object.keys(shutdownModule);
			expect(exported).toEqual(["finalizeOneShot"]);
		});

		it("JSDoc documents the long-running/daemon exemption (AC-b6)", () => {
			const source = readFileSync(
				new URL("../src/shutdown.ts", import.meta.url),
				"utf8",
			);
			// The doc comment must clearly state the exemption and the long-running commands.
			expect(source).toMatch(/long-running/);
			expect(source).toMatch(/daemon/);
			expect(source).toMatch(/MUST NOT be called from long-running commands/);
			// And it must document that those commands call process.exit() directly.
			expect(source).toMatch(/call `process\.exit\(\)` directly/);
		});

		it("finalizeOneShot signature is (code: number) => Promise<void> (AC-b6: no long-running guard arg)", () => {
			// The exemption is doc-comment only — there is no runtime guard or extra arg.
			expect(finalizeOneShot.length).toBe(1);
		});
	});
});
