<!-- library/requirements/backlog/prd-002-cli-kit-hardening/prd-002b-cli-kit-hardening-shutdown-testability.md -->

# PRD-002b: Shutdown testability seam

> **Parent:** [`prd-002-cli-kit-hardening`](./prd-002-cli-kit-hardening-index.md)
> **Status:** Backlog · **Priority:** P1 · **Effort:** M (3–8h) · **Band:** Adoption safety

---

## Overview

`finalizeOneShot` was lifted from Doctor's `shutdown.ts`, but the extraction **dropped the dependency-injection seam** that made Doctor's version unit-testable. Doctor's doc explicitly states "every external effect (the close, the unref sweep, the exitCode set, the backstop exit, the timer) is injectable so the exit-path logic is unit-testable without a real `process.exit`." The kit's version instead reaches straight for `globalThis`, `process._getActiveHandles`, `process.exitCode`, and `setTimeout`.

The cost is visible in the kit's own [`tests/shutdown.test.ts`](../../../../cli-kit/tests/shutdown.test.ts): it must `vi.spyOn` the undocumented `process._getActiveHandles`, and it carries a comment explaining that unref'ing *every* handle corrupts the vitest worker's tinypool IPC channel (EPIPE / "Worker exited unexpectedly") unless stubbed. That is a regression, and it is inherited by every consumer that wants to test its own exit path.

PRD-001's "Resolved decisions" deferred this deliberately: *"CliContext DI pattern stays in Doctor… Promote to the kit later only if a second consumer wants the same testability seam."* With the kit now the shared home for this mechanism, that condition is met — this sub-PRD is the promotion.

## Goals

- `finalizeOneShot` is exercisable in a unit test without spying on Node internals or fighting the test runner's own handles.
- The injectable surface is opt-in and backward-compatible — existing callers pass nothing and get today's behavior.

## Non-Goals

- Changing the *teardown algorithm* (undici close → unref sweep → set exitCode → unref'd backstop). The behavior is correct and stays byte-for-byte; only the seam changes.
- Promoting a full `CliContext` DI container into the kit. Scope is limited to `finalizeOneShot`'s effects.

## User stories

- As a kit maintainer, I can assert the teardown sequence against fakes, so tests don't depend on `_getActiveHandles` or tinypool internals.
- As a consumer, I can inject a fake process surface to test my own one-shot exit path deterministically.

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-b1 | `finalizeOneShot(code, deps?)` accepts an **optional** injected-deps object covering: the dispatcher lookup/close, the active-handle enumeration + unref, the `exitCode` setter, and the backstop timer (`setTimeout` + `exit`). |
| AC-b2 | Called with no `deps`, behavior is identical to today (default deps bind to the real `globalThis`/`process`/`setTimeout`). |
| AC-b3 | The rewritten `tests/shutdown.test.ts` no longer spies on `process._getActiveHandles` and no longer needs the tinypool-IPC workaround; it injects fakes instead. |
| AC-b4 | All existing shutdown ACs from PRD-001b (`002`… the undici close, unref sweep, no `process.exit` on the happy path, unref'd backstop) still pass. |
| AC-b5 | Zero new runtime deps; the default-deps path imports nothing. |

## Implementation notes

Mirror Doctor's shape: define a `FinalizeDeps` interface with defaults, e.g.

```ts
interface FinalizeDeps {
  getDispatcher(): ClosableDispatcher | undefined;
  getActiveHandles(): UnreffableHandle[];
  setExitCode(code: number): void;
  scheduleBackstop(fn: () => void, ms: number): { unref?(): void };
}
```

`finalizeOneShot(code, deps = realDeps())` threads `deps` through `doFinalize`. The default factory reads the undici symbol, `process._getActiveHandles`, sets `process.exitCode`, and uses `setTimeout`. Keep the "never throws" guarantee: each injected call stays wrapped in try/catch exactly as today.

## Open questions

- [ ] Expose `FinalizeDeps` as a public type, or keep it internal and accept a `Partial<FinalizeDeps>`? (Leaning: export the type — consumers testing their own path will want it.)

## Related

- [`prd-001b-cli-kit-shutdown`](../../completed/prd-001-cli-kit/prd-001b-cli-kit-shutdown.md) — the shipped shutdown spec this refines.
- Reference implementation: `doctor/src/cli/shutdown.ts` (the injectable original).
