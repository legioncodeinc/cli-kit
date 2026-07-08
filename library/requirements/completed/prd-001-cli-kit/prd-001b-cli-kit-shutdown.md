# PRD-001b: cli-kit — Shutdown

> **Parent:** [`prd-001-cli-kit-index.md`](./prd-001-cli-kit-index.md)
> **Status:** Draft
> **Canonical source:** `doctor/src/cli/shutdown.ts:195-242`

---

## Overview

A `finalizeOneShot(code)` helper that tears down a Node.js process safely after a one-shot CLI command has used `undici`/`fetch`. Without this, calling `process.exit(code)` on Windows trips a libuv `UV_HANDLE_CLOSING` assertion (process exits with code 127) because the abrupt exit races the keep-alive socket teardown and any detached daemon-spawn handle.

This is the most load-bearing mechanism in the kit: it is a *correctness* fix (silent exit-127 on Windows), not a cosmetic one. Today `doctor` has the most complete implementation, `honeycomb` has an inline variant, and `hive`/`nectar` appear to rely on node defaults and may be latently buggy on Windows.

---

## Goals

- One implementation of the Windows-safe teardown sequence, lifted from Doctor.
- Works identically on Windows, macOS, and Linux (the bug is Windows-specific, but the fix must be cross-platform-safe and not regress other platforms).
- Honors the one-shot vs long-running distinction (contract §10.2): long-running commands (`daemon`, `run`, `start` watchdogs) are exempt and MAY call `process.exit()` directly.

## Non-Goals

- No daemon lifecycle management. The kit does not start, stop, or supervise daemons; it only ensures the *parent* CLI process exits cleanly after orchestrating them.
- No signal-handler installation for SIGINT/SIGTERM. Each CLI owns its own signal handling for long-running commands. The kit's shutdown helper is for the *end* of a one-shot, not for signal response.
- No timeout configuration exposed in v1. The 2000 ms backstop is fixed (matches Doctor). Making it configurable is a v2 concern if a consumer needs it.

---

## API

```ts
// @legioncodeinc/cli-kit/shutdown

/**
 * Tear down the process safely and exit with `code`.
 *
 * For one-shot commands that have used undici/fetch: closes the global
 * dispatcher, unrefs active handles, sets process.exitCode, and lets the
 * event loop drain. An unref'd 2000 ms backstop force-exits if draining
 * stalls (defensive; should never fire in practice).
 *
 * MUST NOT be called from long-running commands (daemon/run/start) —
 * those own their lifecycle and call process.exit() directly.
 */
export function finalizeOneShot(code: number): Promise<void>;
```

The function returns a Promise that the caller `await`s at the end of `main()`, mirroring how Honeycomb already structures its exit (`src/cli/index.ts:70-88`). It does not call `process.exit()` itself for the one-shot path; it sets `process.exitCode` and lets the loop drain, which is the whole point.

---

## Behavior (contract §10)

The teardown sequence, in order:

1. **Close undici's global dispatcher.** Accessed via `Symbol.for("undici.globalDispatcher.1")` if present on the dispatcher. Wrapped in try/catch — never throws. This is what releases the keep-alive sockets cleanly.
2. **Unref all active handles.** Iterate `process._getActiveHandles()` (best-effort; the underscore API is undocumented but stable across Node 18–22) and call `.unref()` on each that supports it. This lets the loop drain without waiting on the handle. The call is wrapped in try/catch so an API change or absence never propagates.
3. **Set `process.exitCode = code`.** The loop then drains naturally.
4. **Backstop timer.** Schedule a 2000 ms `setTimeout(() => process.exit(code), 2000)` and immediately `.unref()` it. If the loop has not drained by then (a handle refused to unref, a detached spawn lingers), force-exit with the intended code. The timer is unref'd so it does not itself keep the loop alive.

The entire sequence is wrapped in a top-level try/catch that falls back to `process.exit(code)` if anything throws — shutdown MUST NOT fail.

---

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-b1 | Given a one-shot command that issued a `fetch` to a keep-alive endpoint, when `finalizeOneShot(0)` is called on Windows, then the process exits with code `0` (not 127). Verified by a Windows CI job that reproduces the pre-fix race. |
| AC-b2 | Given a clean one-shot command that issued no `fetch`, when `finalizeOneShot(0)` is called, then the process exits with code `0` on all platforms — the helper is a no-op-safe call when there's nothing to clean up. |
| AC-b3 | Given `finalizeOneShot(code)` is called, then `process.exitCode` is set to `code` before the function returns (so even if draining is instant, the code is correct). |
| AC-b4 | Given the backstop timer fires (simulated by a handle that never unrefs), then `process.exit(code)` is called with the original `code`, not `0` or `undefined`. |
| AC-b5 | Given any internal step throws (e.g., the global dispatcher symbol is absent), then `finalizeOneShot` catches it and still exits with `code`. No exception escapes. |
| AC-b6 | The long-running-command path (daemon/run/start) is documented as exempt and does NOT call `finalizeOneShot` — verified by grep in each adopting consumer that the watchdog entries call `process.exit` directly. |

---

## Resolved decisions

- **`process._getActiveHandles()`: keep, wrapped in try/catch.** Matches Doctor's proven implementation; the handle unref is what lets the loop drain. The undocumented API is stable across Node 18–22, and the try/catch guards against future change or absence. Dropping it (dispatcher-close + backstop only) was rejected — some handles may linger until the 2000 ms backstop force-exits, which is a worse failure mode.
- **Long-running guard: doc comment only.** The exemption is a convention; a runtime guard is overkill for v1. The `finalizeOneShot` JSDoc already states it MUST NOT be called from long-running commands; each consumer's watchdog entries call `process.exit` directly and are verified by grep at adoption time.

---

## Related

- Contract §10.1 (one-shot MUST NOT `process.exit` after fetch), §10.2 (long-running exempt).
- Canonical: `doctor/src/cli/shutdown.ts` — the reference implementation including the undici symbol close, the unref loop, and the backstop timer.
- Variant: `honeycomb/src/cli/index.ts:70-88` — Honeycomb's inline `finalizeCliExit()`; converges to this module post-adoption.
