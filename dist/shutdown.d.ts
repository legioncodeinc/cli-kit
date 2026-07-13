/**
 * Windows-safe teardown for one-shot commands.
 *
 * Gate calls with {@link isOneShot}; long-running commands own their lifecycle
 * and must not use this teardown path.
 */
/** Minimal dispatcher surface used during shutdown. */
interface ClosableDispatcher {
    close?: () => Promise<void> | void;
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
/**
 * Return whether an invocation is safe to finalize as a one-shot command.
 * Bare, help, unknown, and malformed invocations are treated as one-shot.
 */
export declare function isOneShot(argv: string[], options?: OneShotOptions): boolean;
/**
 * Close network state, release active handles, set the graceful exit code, and
 * arm an unref'd 2000 ms force-exit backstop. Use only when
 * `isOneShot(argv, options)` returns true.
 *
 * Every effect is best-effort: shutdown never turns an already-produced result
 * into a new failure.
 */
export declare function finalizeOneShot(code: number, deps?: FinalizeDeps): Promise<void>;
export {};
//# sourceMappingURL=shutdown.d.ts.map