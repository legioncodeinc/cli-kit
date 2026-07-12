<!-- library/requirements/backlog/prd-002-cli-kit-hardening/prd-002c-cli-kit-hardening-one-shot-guard.md -->

# PRD-002c: One-shot scope guard (`isOneShot`)

> **Parent:** [`prd-002-cli-kit-hardening`](./prd-002-cli-kit-hardening-index.md)
> **Status:** Backlog · **Priority:** P2 · **Effort:** S (1–3h) · **Band:** Adoption safety

---

## Overview

`finalizeOneShot`'s contract is "one-shot commands only — never call from a long-running `daemon`/`run`/`start` watchdog." In the kit this rule is enforced **only by a doc-comment**. If a long-running command calls it by mistake, the unref sweep + 2000ms backstop will force-exit a process that was supposed to stay alive — a silent, hard-to-trace failure.

Doctor enforces the same rule in **code**: a `WATCHDOG_COMMAND = "run"` constant and an `isOneShot(argv)` predicate gate the call. The extraction dropped that helper. This sub-PRD restores it to the kit so the guard ships as reusable code, not prose each consumer must re-verify by grep.

## Goals

- Ship a reusable predicate that tells a CLI whether the current invocation is a one-shot (safe to `finalizeOneShot`) or a long-running watchdog (must not).
- Make the one-shot rule mechanical and testable rather than convention-only.

## Non-Goals

- Auto-calling `finalizeOneShot` from inside the guard. The kit does not own dispatch; the consumer decides. The guard only *classifies*.
- Owning each CLI's verb table. The consumer passes in its own watchdog command name(s).

## User stories

- As a consumer, I call `if (isOneShot(argv, { watchdogCommands: ["run"] })) await finalizeOneShot(code);` and never accidentally force-exit my daemon.
- As a reviewer, I can unit-test the classification instead of trusting a comment.

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-c1 | `isOneShot(argv, options?)` returns `false` when the first command token matches a configured watchdog command, `true` otherwise (including bare/help/unknown invocations). |
| AC-c2 | Watchdog commands are configurable via `options.watchdogCommands: string[]` (default matches Doctor's precedent: `["run"]`). |
| AC-c3 | The predicate is pure, total, and never throws on pathological argv (empty, non-string elements). |
| AC-c4 | Unit tests cover: one-shot verb → true; watchdog verb → false; empty argv → true; custom watchdog list. |
| AC-c5 | Doc-comments in `shutdown.ts` are updated to point at `isOneShot` as the enforcement mechanism, replacing the "convention only" caveat. |

## Implementation notes

Small pure function, likely co-located with `shutdown.ts` (or a tiny `one-shot.ts`) and re-exported from the barrel. Signature:

```ts
export function isOneShot(
  argv: string[],
  options?: { watchdogCommands?: string[] },
): boolean;
```

Take the first token of `argv` (the command), compare against the watchdog set. This composes with `002i`'s no-throw discipline — guard input defensively.

## Open questions

- [ ] Should the default watchdog set be empty (force each consumer to declare) or `["run"]` (Doctor's precedent)? Leaning `["run"]` with the option to extend, since `run`/`start`/`daemon` recur across the suite.

## Related

- [`prd-002b-…-shutdown-testability`](./prd-002b-cli-kit-hardening-shutdown-testability.md) — sibling shutdown hardening.
- Reference: `doctor/src/cli/shutdown.ts` (`WATCHDOG_COMMAND` / `isOneShot`).
