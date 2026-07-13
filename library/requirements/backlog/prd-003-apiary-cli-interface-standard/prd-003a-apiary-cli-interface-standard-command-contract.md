# PRD-003a: Shared command and dispatch contract

> **Parent:** [PRD-003](./prd-003-apiary-cli-interface-standard-index.md)
> **Status:** Backlog · **Priority:** P1 · **Effort:** L

## Overview

The four CLIs need one machine-checkable definition of their minimum operational surface. This sub-PRD defines command names, global flags, output modes, help grouping, exit codes, and the shared conformance harness. Product repositories retain their own implementation adapters; the contract standardizes what an operator observes.

## Goals

- Publish one typed command manifest from cli-kit for all baseline commands.
- Prevent aliases and historical spellings from replacing the canonical verbs.
- Give every product the same parser, help grouping, and output-mode rules.

## Non-Goals

- Centralizing product-specific command handlers inside cli-kit.
- Requiring every product to use the same internal dispatcher architecture.
- Removing backward-compatible aliases immediately.

## Command groups

The help surface uses these groups in this order:

1. **Service lifecycle:** `start`, `stop`, `restart`, `status`, `logs`
2. **Installation:** `install`, `uninstall`, `service-install`, `service-uninstall`, `update`
3. **Fleet:** `register` for Hive, Honeycomb, and Nectar; omitted for Doctor
4. **Diagnostics:** `telemetry`
5. **Product commands:** all additional product-owned verbs
6. **Global options:** `--help`, `--version`, `--json`, `--no-color`

Canonical command names use the noun-last spellings `service-install` and `service-uninstall`. Existing spellings such as Hive's `install-service` may remain temporarily as deprecated aliases, but help and documentation advertise only the canonical spelling.

## Output and exit-code contract

- Successful informational or idempotent operations return `0`.
- Runtime or service-manager failures return `1`.
- Unknown commands, malformed options, and missing required arguments return `2` and print concise usage guidance to stderr.
- Human output goes to stdout for successful operations and stderr for failures.
- Every operational verb supports `--json`; the result is a stable object containing at least `product`, `command`, `ok`, and `message`, plus command-specific fields.
- JSON mode disables color and emits exactly one JSON document with one trailing newline.
- Commands never print a banner, credit line, spinner, or prompt in JSON mode.
- Destructive operations may prompt only in human TTY mode; `--yes` short-circuits confirmation and non-TTY invocation fails safely unless an explicit non-interactive confirmation flag is supplied.

## User stories

- As an operator, I can use the same verb and global flags against every product.
- As an automation author, I can consume stable JSON and exit codes without parsing prose.
- As a maintainer, I can add product-specific commands without drifting the shared baseline.

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-a1 | cli-kit exports a typed baseline command manifest containing every required verb, its group, summary, destructive/idempotent metadata, and whether Doctor is exempt. |
| AC-a2 | Every product builds help from the manifest plus its product-specific manifest; required commands are not duplicated as hand-written help rows. |
| AC-a3 | Canonical parsing recognizes `service-install` and `service-uninstall`; historical aliases may dispatch but are marked deprecated and are absent from the primary command list. |
| AC-a4 | Unknown commands and usage errors return `2`; runtime failures return `1`; successful and already-satisfied idempotent operations return `0`. |
| AC-a5 | Every baseline operational command accepts `--json` and emits a stable object containing `product`, `command`, `ok`, and `message`. |
| AC-a6 | JSON mode emits no ANSI, banner, credit, prompt, or extra prose and ends with one newline. |
| AC-a7 | Product-specific commands remain dispatchable and render under a separate `Product commands` help group. |
| AC-a8 | A shared conformance harness loads each product manifest and fails on missing verbs, incorrect Doctor exemption, duplicate canonical names, wrong group order, or absent JSON support. |
| AC-a9 | Golden tests cover bare invocation, `--help`, `--version`, unknown command, human success/failure, and JSON success/failure for each product. |

## Implementation notes

- Extend cli-kit rather than copying a new command table into four repositories.
- Keep the manifest data-only and side-effect-free so products can tree-shake unused rendering utilities.
- Use cli-kit's existing parser, exit codes, `emitJson`, `setJsonMode`, color helpers, and version helpers.
- Store product adapters in the product repositories; the shared harness may execute packed CLIs as subprocesses.

## Open questions

- None.

## Related

- [PRD-003b lifecycle semantics](./prd-003b-apiary-cli-interface-standard-lifecycle.md)
- [PRD-003d branding and help](./prd-003d-apiary-cli-interface-standard-branding-help.md)
