/**
 * Windows-safe teardown for one-shot commands.
 *
 * Gate calls with {@link isOneShot}; long-running commands own their lifecycle
 * and must not use this teardown path.
 */

const UNDICI_GLOBAL_DISPATCHER = Symbol.for("undici.globalDispatcher.1");
const BACKSTOP_MS = 2_000;

/** Minimal dispatcher surface used during shutdown. */
interface ClosableDispatcher {
	close?: () => Promise<void> | void;
}

/** Minimal active-handle surface used during shutdown. */
interface UnreffableHandle {
	unref?: () => void;
}

/** Minimal timer surface used to keep the backstop from holding the loop open. */
interface UnreffableTimer {
	unref?: () => void;
}

/** Injectable effects for deterministic one-shot shutdown tests. */
export interface FinalizeDeps {
	getDispatcher(): ClosableDispatcher | undefined;
	getActiveHandles(): unknown[];
	setExitCode(code: number): void;
	scheduleBackstop(callback: () => void, ms: number): UnreffableTimer;
	exit(code: number): void;
}

/** Options for classifying long-running watchdog commands. */
export interface OneShotOptions {
	watchdogCommands?: string[];
}

function realDeps(): FinalizeDeps {
	return {
		getDispatcher: () =>
			(globalThis as unknown as Record<symbol, unknown>)[UNDICI_GLOBAL_DISPATCHER] as
				| ClosableDispatcher
				| undefined,
		getActiveHandles: () => {
			const getHandles = (process as unknown as { _getActiveHandles?: () => unknown[] })
				._getActiveHandles;
			return typeof getHandles === "function" ? getHandles.call(process) : [];
		},
		setExitCode: (code) => {
			process.exitCode = code;
		},
		scheduleBackstop: (callback, ms) => setTimeout(callback, ms),
		exit: (code) => process.exit(code),
	};
}

/**
 * Return whether an invocation is safe to finalize as a one-shot command.
 * Bare, help, unknown, and malformed invocations are treated as one-shot.
 */
export function isOneShot(argv: string[], options?: OneShotOptions): boolean {
	const command: unknown = Array.isArray(argv) ? argv[0] : undefined;
	if (typeof command !== "string") return true;

	const configured: unknown = options?.watchdogCommands;
	const watchdogCommands = Array.isArray(configured)
		? configured.filter((value): value is string => typeof value === "string")
		: ["run"];
	return !watchdogCommands.includes(command);
}

/**
 * Close network state, release active handles, set the graceful exit code, and
 * arm an unref'd 2000 ms force-exit backstop. Use only when
 * `isOneShot(argv, options)` returns true.
 *
 * Every effect is best-effort: shutdown never turns an already-produced result
 * into a new failure.
 */
export async function finalizeOneShot(code: number, deps: FinalizeDeps = realDeps()): Promise<void> {
	try {
		const dispatcher = deps.getDispatcher();
		if (typeof dispatcher?.close === "function") await dispatcher.close();
	} catch {
		// Best-effort dispatcher cleanup must not replace the command result.
	}

	try {
		for (const handle of deps.getActiveHandles()) {
			try {
				const candidate = handle as UnreffableHandle;
				if (typeof candidate.unref === "function") candidate.unref();
			} catch {
				// One malformed handle must not prevent the remaining sweep.
			}
		}
	} catch {
		// Active-handle enumeration is an undocumented, best-effort Node seam.
	}

	try {
		deps.setExitCode(code);
	} catch {
		// Injected/process exit-code setters are best-effort during teardown.
	}

	try {
		const backstop = deps.scheduleBackstop(() => {
			try {
				deps.exit(code);
			} catch {
				// A test double or host exit implementation may throw; never leak it.
			}
		}, BACKSTOP_MS);
		try {
			backstop.unref?.();
		} catch {
			// An unusual timer handle may reject unref; shutdown remains best-effort.
		}
	} catch {
		// Failure to schedule the last-resort backstop must not reject shutdown.
	}
}
