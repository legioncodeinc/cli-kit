# PRD-003: Apiary CLI interface standard

> **Status:** Backlog
> **Priority:** P1
> **Effort:** XL

## Overview

Doctor, Hive, Honeycomb, and Nectar expose related service-management capabilities through visibly and behaviorally different command-line interfaces. Honeycomb has the strongest product-specific ASCII identity and grouped help surface, Doctor has a separate collaboration banner, Hive has a narrow unbranded dispatcher, and Nectar mixes service operations into a large product-specific usage string. Operators should not have to relearn lifecycle verbs, output conventions, or help structure when moving between Apiary products.

This PRD establishes one mandatory CLI contract for every Apiary service while preserving each product's specialized commands. Each product receives the same baseline service verbs, predictable semantics, product-specific ASCII art, an uppercase product name, and the credit line `Legion Code Inc. x Activeloop`.

The in-scope services are:

- `doctor`
- `hive`
- `honeycomb`
- `nectar`

Doctor is exempt from exposing `register` because Doctor reads and checks the shared service registry; it does not register itself as a supervised service.

## Goals

- Make the minimum operational command surface identical and discoverable across every Apiary service.
- Give each CLI a recognizable but structurally consistent product banner and attribution.
- Make lifecycle, installation, registration, update, status, logs, and telemetry semantics unambiguous.
- Preserve specialized product commands while placing them beneath the same help hierarchy.
- Enforce convergence with shared contract tests and per-product golden-output tests.

## Non-Goals

- Removing product-specific commands such as Honeycomb memory verbs or Nectar brooding verbs.
- Making every product's ASCII art identical; the frame is shared, but the art must identify the product.
- Giving Doctor a `register` command.
- Building a general-purpose terminal UI framework or interactive full-screen interface.
- Changing daemon protocols, storage engines, or product-specific business behavior unrelated to the listed commands.
- Treating `install` and `service-install`, or `uninstall` and `service-uninstall`, as undocumented aliases.

## Required command matrix

| Command | Doctor | Hive | Honeycomb | Nectar |
|---|---:|---:|---:|---:|
| `start` | Required | Required | Required | Required |
| `stop` | Required | Required | Required | Required |
| `restart` | Required | Required | Required | Required |
| `install` | Required | Required | Required | Required |
| `uninstall` | Required | Required | Required | Required |
| `service-install` | Required | Required | Required | Required |
| `service-uninstall` | Required | Required | Required | Required |
| `update` | Required | Required | Required | Required |
| `status` | Required | Required | Required | Required |
| `register` | Exempt | Required | Required | Required |
| `logs` | Required | Required | Required | Required |
| `telemetry` | Required | Required | Required | Required |
| `--help` | Required | Required | Required | Required |
| `--version` | Required | Required | Required | Required |

## Features

| Sub-PRD | Feature | Status |
|---|---|---|
| [PRD-003a](./prd-003a-apiary-cli-interface-standard-command-contract.md) | Shared command and dispatch contract | Draft |
| [PRD-003b](./prd-003b-apiary-cli-interface-standard-lifecycle.md) | Lifecycle, installation, update, and registration semantics | Draft |
| [PRD-003c](./prd-003c-apiary-cli-interface-standard-observability.md) | Status, service logs, and telemetry | Draft |
| [PRD-003d](./prd-003d-apiary-cli-interface-standard-branding-help.md) | Product ASCII art, uppercase identity, attribution, help, and version | Draft |
| [PRD-003e](./prd-003e-apiary-cli-interface-standard-adoption.md) | Per-product migration and conformance verification | Draft |

## Dependencies

- `@legioncodeinc/cli-kit` provides shared color, parser, exit-code, JSON, confirmation, version, and config-directory mechanisms.
- Every product must have an OS-service adapter for Windows, macOS, and Linux or explicitly return a documented unsupported-platform error.
- The shared Doctor registry contract remains the authority for supervised-service registration.
- Each product must identify its own authoritative log source and update mechanism before its adoption subtask is marked complete.

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-1 | Doctor, Hive, Honeycomb, and Nectar expose every required command in the matrix; Doctor alone is exempt from `register`. |
| AC-2 | The same command has the same operator-level meaning, success behavior, exit-code class, and help placement in every product. |
| AC-3 | Bare invocation and `--help` render product-specific ASCII art, the product name in uppercase, version, usage, grouped commands, and the exact credit `Legion Code Inc. x Activeloop`. |
| AC-4 | Each product's `logs` command tails only that product's service logs and cannot silently fall through to another product's log source. |
| AC-5 | Each non-Doctor product can register itself with Doctor, and Doctor status reflects the resulting registry entry without requiring a Doctor `register` command. |
| AC-6 | Shared conformance tests execute the minimum command matrix against all four products and fail when a required verb, help row, banner element, exit-code rule, or JSON contract drifts. |
| AC-7 | Existing product-specific commands remain available and are listed separately from the standard operational commands. |
| AC-8 | Human-readable output is visually consistent across the suite, while `--json` output contains no banner, ANSI sequence, prose credit, or prompt. |

## Delivery order

1. Land the shared contract, rendering primitives, fixtures, and conformance harness.
2. Adopt Honeycomb as the reference implementation without regressing its existing product-specific surface.
3. Adopt Doctor, preserving its registry-checking role and omitting `register`.
4. Adopt Hive.
5. Adopt Nectar.
6. Run cross-product golden tests on Windows, macOS, and Linux and publish migration notes for command aliases or changed semantics.

## Related

- [`PRD-002: cli-kit hardening`](../prd-002-cli-kit-hardening/prd-002-cli-kit-hardening-index.md)
- [`CLI contract`](../../../notes/cli-contract.md)
- Honeycomb reference surface: `honeycomb/src/commands/dispatch.ts`
- Doctor banner: `doctor/src/cli/banner.ts`
- Hive dispatcher: `hive/src/cli.ts`
- Nectar dispatcher: `nectar/src/cli.ts`
