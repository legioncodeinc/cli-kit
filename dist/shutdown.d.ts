/**
 * @legioncodeinc/cli-kit/shutdown — Windows-safe one-shot process teardown.
 *
 * A `finalizeOneShot(code)` helper a one-shot CLI command awaits at the end of
 * `main()` so it exits cleanly after doing network work through the Node global
 * `fetch` (undici) and `node:child_process`.
 *
 * ── The bug this fixes (Windows `UV_HANDLE_CLOSING`) ───────────────────────────
 * Calling `process.exit(code)` on Windows trips a libuv assertion when it races
 * the keep-alive socket teardown and any detached daemon-spawn handle:
 *
 *     Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c
 *
 * The output is already correct and non-mutating — this is purely a
 * dangling-async-handle problem at process exit. Two contributors:
 *   1. undici's global dispatcher keeps a keep-alive connection pool + an
 *      internal async/timer handle alive AFTER a `fetch` resolves.
 *   2. A bare `process.exit()` synchronously tears libuv down. When it runs in
 *      the same tick a handle is mid-close, libuv asserts — so `process.exit()`
 *      itself is the trigger.
 *
 * ── The fix (root cause + graceful drain + bounded backstop) ─────────────────
 * {@link finalizeOneShot}:
 *   1. ROOT CAUSE: close undici's global dispatcher so the keep-alive sockets +
 *      pool timer are torn down.
 *   2. Release the loop: `unref()` every remaining active handle so nothing (a
 *      lingering fetch socket, an inherited stdin pipe) keeps the process alive.
 *   3. GRACEFUL EXIT: set `process.exitCode` and RETURN, letting Node exit
 *      naturally once the loop drains. NO `process.exit()` on the happy path —
 *      that synchronous teardown is what trips the assertion.
 *   4. BOUNDED BACKSTOP: arm a single `unref`'d 2000 ms timer that force-calls
 *      `process.exit(code)` ONLY if the loop refuses to drain within the bound.
 *      The timer is `unref`'d so it never itself keeps the process alive; on the
 *      happy path the process exits before it fires.
 *
 * Every step is wrapped in try/catch — shutdown MUST NOT fail. A best-effort
 * teardown must never turn a correct, already-printed result into a crash.
 *
 * ── Scope: ONE-SHOT ONLY ──────────────────────────────────────────────────────
 * MUST NOT be called from long-running commands (`daemon`/`run`/`start`
 * watchdogs) — those own their lifecycle and call `process.exit()` directly.
 * The long-running exemption is convention (doc-comment only), not a runtime
 * guard; each consumer's watchdog entries are verified by grep at adoption time.
 *
 * Built-ins only (zero runtime deps): no undici import, just the global
 * dispatcher symbol + the process surface.
 *
 * @see {@link ../library/requirements/backlog/prd-001-cli-kit/prd-001b-cli-kit-shutdown.md}
 * @see {@link ../library/notes/cli-contract.md} §10 (one-shot vs long-running)
 */
/**
 * Tear down the process safely and exit with `code`.
 *
 * For one-shot commands that have used undici/fetch: closes the global
 * dispatcher, unrefs active handles, sets `process.exitCode`, and lets the
 * event loop drain. An unref'd 2000 ms backstop force-exits if draining stalls.
 *
 * The teardown sequence, in order, every step wrapped in try/catch:
 *   1. Close undici's global dispatcher (releases keep-alive sockets cleanly).
 *   2. Unref every active handle so the loop can drain.
 *   3. Set `process.exitCode = code` (the loop then drains naturally).
 *   4. Arm an unref'd 2000 ms backstop that force-exits only if draining stalls.
 *
 * The happy path does NOT call `process.exit()` — that synchronous teardown is
 * the Windows assertion trigger. Only the backstop timer calls it, and only if
 * a handle refused to unref.
 *
 * MUST NOT be called from long-running commands (daemon/run/start) — those own
 * their lifecycle and call `process.exit()` directly. This exemption is
 * convention (doc-comment only), not a runtime guard.
 *
 * @param code - The exit code the one-shot resolved with (0 success, 1 error, 2 usage).
 * @returns A Promise the caller `await`s at the end of `main()`. Resolves once
 *   the exit code is set and the backstop is armed; the process then drains.
 */
export declare function finalizeOneShot(code: number): Promise<void>;
