<!-- library/requirements/backlog/prd-002-cli-kit-hardening/prd-002h-cli-kit-hardening-confirm-prompt.md -->

# PRD-002h: `confirm()` y/N gate

> **Parent:** [`prd-002-cli-kit-hardening`](./prd-002-cli-kit-hardening-index.md)
> **Status:** Backlog · **Priority:** P2 · **Effort:** M (3–8h) · **Band:** Coverage expansion

---

## Overview

Several sisters hand-roll interactive yes/no gates with `node:readline` (`honeycomb/src/cli/auth.ts`, Doctor's context/confirm, diagnostic paths). PRD-001 listed a shared prompt helper as a v1 non-goal but explicitly left the door open: *"A future PRD may add a shared prompt helper, but not now."* This is that PRD. Scope is deliberately narrow: exactly one `confirm()` gate — not a general prompts/TUI library.

The gate must be correct in the two places hand-rolled versions usually get wrong: **non-interactive contexts** (piped stdin, CI) and the **`--yes` bypass**, and it must compose with the exit-codes module so a decline maps to `declined()` → exit `0` (per CLI Contract §9 and `002d`).

## Goals

- One zero-dep `confirm()` that reads a y/N answer interactively.
- Correct, explicit behavior when there is no TTY or when the user pre-approved via a flag.
- Clean composition with `declined()` so "no" is a `0`-exit intentional outcome, not an error.

## Non-Goals

- A general prompt library (text input, multi-select, pickers). Honeycomb's org picker and Nectar's review-matches stay per-CLI.
- Owning the `--yes`/`--force` flag parsing — the consumer passes the resolved boolean in.

## User stories

- As a consumer, I call `await confirm("Delete all cached data?")` and get a robust y/N gate without re-implementing readline.
- As a script/CI user, a non-interactive invocation does not hang waiting for input — it takes the safe default (decline) unless `--yes` was passed.

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-h1 | `confirm(question, options?)` returns a `Promise<boolean>`; `true` = confirmed, `false` = declined. |
| AC-h2 | When stdin is not a TTY (piped/CI), `confirm` does **not** block: it returns the configured default (default `false`/decline) without reading. |
| AC-h3 | An `options.assumeYes` (wired by the consumer from `--yes`/`--force`) short-circuits to `true` without prompting. |
| AC-h4 | The prompt renders a clear `[y/N]` (or `[Y/n]` when the default is yes) suffix reflecting the default; empty input takes the default. |
| AC-h5 | Documentation shows the canonical compose: `if (!(await confirm(q))) return declined("Aborted.");` → exit `0`. |
| AC-h6 | Zero runtime deps (`node:readline`/`node:readline/promises` only); never throws out of the function. |

## Implementation notes

Use `node:readline/promises` over `process.stdin`/`process.stdout`. Gate on `process.stdin.isTTY` for AC-h2. Options shape:

```ts
interface ConfirmOptions {
  default?: boolean;      // taken on empty input and non-TTY; default false
  assumeYes?: boolean;    // consumer wires from --yes/--force
  stream?: NodeJS.WriteStream; // where the question renders; default stdout
}
```

Accept `y/yes/n/no` case-insensitively. Always close the readline interface. This pairs with `002d` — a decline is contract-`0`, so the docs must route it through `declined()`.

## Open questions

- [ ] Default answer policy — always default-decline unless the caller opts into default-yes? (Leaning yes: safe-by-default.)
- [ ] Should `confirm` read `assumeYes` from an env var too (e.g. `APIARY_YES`), or strictly from the passed option? Leaning option-only to avoid hidden global state.

## Related

- [`prd-001c-cli-kit-exit-codes`](../../completed/prd-001-cli-kit/prd-001c-cli-kit-exit-codes.md) — `declined()` composition.
- [`prd-002d-…-exit-code-migration`](./prd-002d-cli-kit-hardening-exit-code-migration.md) — decline = `0`.
- Duplication source: `honeycomb/src/cli/auth.ts`, `doctor/src/cli/context.ts`.
