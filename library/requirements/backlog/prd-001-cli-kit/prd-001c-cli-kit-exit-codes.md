# PRD-001c: cli-kit — Exit Codes

> **Parent:** [`prd-001-cli-kit-index.md`](./prd-001-cli-kit-index.md)
> **Status:** Draft
> **Canonical sources:** `doctor/src/cli/dispatch.ts:32-34` (named-constant precedent), `nectar/src/cli.ts` (the `2`-for-parse-errors convention)

---

## Overview

A small enum and helper set encoding the CLI Contract §9 exit-code scheme: `0` success, `1` runtime failure, `2` usage/parse error. Plus one contract-level ruling: **declined confirmations are `0`, not `2`** — a deliberate deviation from Doctor's current `EXIT_DECLINED=2`, because surfacing a user-abort as a parse error misleads CI.

This module is tiny but load-bearing for scripting. Today the four CLIs use exit codes inconsistently (Doctor has three named constants including a `2`-for-declined; Nectar uses `2` for parse errors but `1` for unknown commands; Honeycomb and Hive are loosely `0`/`1`). The kit makes the contract scheme mechanical.

---

## Goals

- One named enum (`EXIT_OK`, `EXIT_ERROR`, `EXIT_USAGE`) that every consumer imports, so magic numbers disappear from CLI source.
- A `parseError(message)` helper that formats a usage error to stderr and returns `EXIT_USAGE`, collapsing the repeated "print usage + return 2" boilerplate.
- A `declined(message)` helper that returns `EXIT_OK` — making the "declined is not failure" ruling impossible to violate by accident.

## Non-Goals

- No process-exit enforcement. The helpers *return* codes; the caller assigns them to `process.exitCode` or returns them from its dispatch function (matching Doctor's "handlers return numbers, dispatcher never calls process.exit" pattern, `dispatch.ts:11-13`). The kit does not call `process.exit` from this module.
- No richer exit-code taxonomy (e.g., `EXIT_NETWORK=3`, `EXIT_PERMISSION=4`). The contract is deliberately three-valued; expanding it harms scriptability. If a future need arises, it goes through a contract amendment, not a kit addition.
- No mapping from old codes to new. Migration is the consumer's job; the kit ships the target scheme only.

---

## API

```ts
// @legioncodeinc/cli-kit/exit-codes

export enum ExitCode {
  Ok = 0,       // Success — command completed, or read-only command found healthy state.
  Error = 1,    // Runtime failure — daemon unreachable, network error, mutation rolled back.
  Usage = 2,    // Usage/parse error — unknown verb, bad flag, missing positional. Never reached the handler.
}

// Backwards-compatible aliases (match Doctor's existing names) so consumers
// can adopt the kit with a pure import-path change:
export const EXIT_OK     = ExitCode.Ok;
export const EXIT_ERROR  = ExitCode.Error;
export const EXIT_USAGE  = ExitCode.Usage;   // NOTE: deliberately NOT EXIT_DECLINED.

/**
 * Format a usage error: write the message + a usage hint to stderr,
 * return EXIT_USAGE. For parse errors, unknown verbs, bad flags.
 */
export function parseError(message: string, usageText?: string): ExitCode;

/**
 * Format a user-declined confirmation: write the message to stdout,
 * return EXIT_OK. Declined is not failure (contract §9).
 */
export function declined(message: string): ExitCode;
```

---

## Behavior (contract §9)

| Code | Constant | When |
|:---:|---|---|
| `0` | `ExitCode.Ok` | Command succeeded; OR a read-only command found a healthy/normal state; OR a user declined a gated confirmation (the action did not fail — the user chose not to proceed). |
| `1` | `ExitCode.Error` | Command ran but failed: daemon unreachable, network error, permission denied, mutation rolled back, OR a read-only command found a broken state. |
| `2` | `ExitCode.Usage` | The invocation was malformed and the command never reached its handler: unknown verb, bad flag, missing required positional, wrong flag value type. |

The `declined()` helper encodes the ruling that **aborted confirmations are `0`**. Doctor's current `EXIT_DECLINED=2` (`dispatch.ts:34`) is the one non-conformance this module exists to retire: when Doctor adopts the kit, `runHeal`/`runRung`/`runPurge`'s "user said no" paths return `EXIT_OK` via `declined()`, and `EXIT_DECLINED` is deleted.

---

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-c1 | Given a successful command, when the handler returns, then `process.exitCode` is `0`. |
| AC-c2 | Given a runtime failure (e.g., daemon unreachable), when the handler returns, then `process.exitCode` is `1`. |
| AC-c3 | Given a malformed invocation (unknown verb, bad flag), when `parseError(...)` is called, then the message + usage hint are written to **stderr** and the function returns `2`. |
| AC-c4 | Given a user aborts a gated confirmation, when `declined(...)` is called, then the message is written to stdout and the function returns `0` (not `2`). |
| AC-c5 | Given an unknown verb is passed to any adopting CLI, when the dispatcher handles it, then the process exits with `2` (not `1`). This is the reclassification the contract mandates; Nectar's current `1`-for-unknown-command is the non-conformance being fixed. |
| AC-c6 | The `EXIT_OK`/`EXIT_ERROR`/`EXIT_USAGE` aliases are byte-identical in value to Doctor's existing constants, so `doctor`'s adoption is a pure import-path swap with no behavioral diff (except the `EXIT_DECLINED` → `declined()` migration, which is AC-c4). |

---

## Resolved decisions

- **`declined()` writes to stdout.** A user's deliberate "no" is intentional output, not an error. Scripts reading stdout see the decision. Doc-noted so consumers understand the choice.
- **`EXIT_DECLINED` is omitted entirely.** The kit never defines it; `declined()` returns `EXIT_OK`. Doctor deletes `EXIT_DECLINED` on adoption (no other consumer relies on the `2`-for-declined semantics). A deprecated-alias interim was rejected as shipping dead surface.

---

## Related

- Contract §9 (exit codes; the declined=`0` ruling).
- Canonical precedent: `doctor/src/cli/dispatch.ts:32-34`.
- Canonical parse-error convention: `nectar/src/cli.ts` (parse errors return `2`).
