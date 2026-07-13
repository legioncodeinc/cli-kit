# PRD-003c: Status, service logs, and telemetry

> **Parent:** [PRD-003](./prd-003-apiary-cli-interface-standard-index.md)
> **Status:** Backlog · **Priority:** P1 · **Effort:** L

## Overview

Operators need the same diagnostic entry points for every service. This sub-PRD defines a bounded `status` snapshot, product-isolated `logs` tailing, and a telemetry command that explains collection state without exposing secrets.

## Command semantics

### `status`

Human output reports, in order:

1. Product name and installed version
2. Service installation state
3. Process state and PID when available
4. Health state and endpoint/result when applicable
5. Doctor registration state (`not applicable` for Doctor)
6. Update availability when already known without a slow network call
7. Paths for product config and logs

`status --json` returns the same facts as structured fields. A stopped but correctly installed service is a successful status query (`0`); inability to inspect required state is a runtime failure (`1`).

### `logs`

`logs` tails the invoking product's service logs. Defaults:

- Follow new entries until interrupted.
- Emit the last 100 lines before following.
- Merge or clearly label stdout and stderr.
- Accept `--lines <n>`, `--no-follow`, and `--since <duration-or-timestamp>`.
- Return a clear error when the product service has no configured log source.
- Redact known token, credential, and authorization fields before terminal output.

The implementation may use a product-owned file tailer or safe fixed-argv calls to the platform service manager. It must bind to the invoking product's validated service identifier and cannot accept an arbitrary unit, task, or file path through the default command.

### `telemetry`

`telemetry` reports:

- enabled or opted-out state and the controlling setting
- local queue/buffer state where applicable
- destination class (for example, hosted, disabled, or local) without credentials
- last successful send and last error when locally available
- the command or environment setting used to opt out

The command is read-only. Product-specific telemetry subcommands may remain, but the bare `telemetry` invocation always returns this common summary.

## User stories

- As an operator, I can diagnose any service using `status`, `logs`, and `telemetry` without learning product-specific verbs.
- As a support engineer, I can request one safe log command that cannot accidentally tail another service.
- As a privacy-conscious user, I can see whether telemetry is enabled and how to disable it.

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-c1 | Every product implements the ordered human status fields and an equivalent structured `status --json` response. |
| AC-c2 | `logs` defaults to the last 100 lines plus follow mode and supports `--lines`, `--no-follow`, and `--since`. |
| AC-c3 | Each `logs` adapter is hard-bound to the invoking product's validated service identifier and authoritative log destination. |
| AC-c4 | Tests prove Doctor cannot tail Hive/Honeycomb/Nectar logs and each non-Doctor product cannot tail another product's logs through its standard `logs` command. |
| AC-c5 | Log output redacts recognized bearer tokens, API keys, authorization headers, and credential values without modifying the stored log. |
| AC-c6 | Ctrl+C stops follow mode cleanly with exit `0`; missing/unreadable logs return a concise error and exit `1`. |
| AC-c7 | Bare `telemetry` is read-only and reports enabled/opted-out state, controlling setting, destination class, and available delivery health without printing secrets. |
| AC-c8 | `status`, bounded `logs --no-follow`, and `telemetry` never start or restart the service as a side effect. |
| AC-c9 | Golden tests cover running, stopped, not-installed, unhealthy, missing-log, telemetry-enabled, and telemetry-opted-out output in human and JSON modes. |

## Implementation notes

- Prefer an injectable shared log-tail primitive in cli-kit with product-owned source adapters.
- Do not normalize away valuable product-specific health fields; place extras under a clearly labeled details section/object.
- Avoid network calls in status unless bounded and essential to the product's health result.

## Open questions

- None.

## Related

- [PRD-003b lifecycle semantics](./prd-003b-apiary-cli-interface-standard-lifecycle.md)
- [PRD-003d branding and help](./prd-003d-apiary-cli-interface-standard-branding-help.md)
