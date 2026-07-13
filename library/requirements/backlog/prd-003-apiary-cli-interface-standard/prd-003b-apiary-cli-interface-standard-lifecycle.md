# PRD-003b: Lifecycle, installation, update, and registration

> **Parent:** [PRD-003](./prd-003-apiary-cli-interface-standard-index.md)
> **Status:** Backlog · **Priority:** P1 · **Effort:** XL

## Overview

Identical verb names are useful only when their boundaries are identical. This sub-PRD separates product installation from OS-service installation, makes lifecycle verbs idempotent, standardizes update behavior, and defines how non-Doctor products join Doctor's registry.

## Binding command semantics

| Command | Required behavior |
|---|---|
| `start` | Start the installed OS service. If no service is installed, return a clear failure directing the operator to `service-install`; do not silently create a detached process. |
| `stop` | Stop the installed OS service and wait for the product-specific bounded shutdown check. Already stopped is success. |
| `restart` | Perform the product adapter's stop-then-start transaction and verify the service reaches its running/healthy condition. |
| `install` | Perform product onboarding/configuration and required registration. It may invoke `service-install` explicitly as a documented step, but its output must report each phase separately. |
| `uninstall` | Confirm, stop, deregister when applicable, remove the OS service, and remove only product-owned state selected by the documented retention policy. Shared credentials and another product's state are never removed. |
| `service-install` | Install or reconcile only the OS service definition. It does not delete state, perform login, or register with Doctor. |
| `service-uninstall` | Stop and remove only the OS service definition. It does not delete product state, uninstall the npm package, or deregister the product. |
| `update` | Resolve the approved release, install it through the product's safe updater, preserve config/state, restart if required, verify health, and report from/to versions. |
| `register` | Hive, Honeycomb, and Nectar idempotently upsert their own Doctor registry entry and request/rely on Doctor's normal registry reload. Doctor omits the command. |

`install` is not an npm-global self-install command: the executable necessarily already exists. It is the product onboarding transaction. Package installation belongs to external installers or the product's `update` implementation.

## Cross-platform requirements

- macOS uses a per-user launchd service unless the product explicitly supports an elevated system scope.
- Linux uses a systemd user unit unless an explicit, documented system scope is selected.
- Windows uses the product's supported Scheduled Task or Windows Service adapter without shell-string interpolation.
- Service definitions pin the executable, working directory, Apiary home, required environment, and log destinations.
- All service-manager calls use fixed executable/argument arrays through injectable runners.

## User stories

- As an operator, I know whether I am configuring a product or only installing its OS service.
- As an operator, I can safely rerun lifecycle commands without producing duplicate services or registry entries.
- As a fleet administrator, I can register each supervised product with Doctor using the same command.

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-b1 | All four products implement the binding semantics for `start`, `stop`, `restart`, `install`, `uninstall`, `service-install`, `service-uninstall`, and `update`. |
| AC-b2 | Hive, Honeycomb, and Nectar implement `register`; Doctor rejects `doctor register` as an unknown command with exit `2` and does not list it in help. |
| AC-b3 | `start`, `stop`, `service-install`, `service-uninstall`, and `register` are idempotent and return `0` when the requested state already exists. |
| AC-b4 | `restart` does not report success until the restarted service passes its product-specific running or health check within a bounded timeout. |
| AC-b5 | `service-uninstall` leaves product state and Doctor registration intact; `uninstall` follows the full confirmed product-removal transaction. |
| AC-b6 | Uninstall never removes shared credentials, shared registry data belonging to other products, or another product's `~/.apiary/<name>` directory. |
| AC-b7 | `update` reports installed and target versions, preserves state, uses the approved product release channel, and rolls back or reports a hard failure when post-update health verification fails. |
| AC-b8 | OS service adapters are covered by fixed-argv unit tests for Windows, macOS, and Linux; no user-controlled value is interpolated into a shell command. |
| AC-b9 | Each service definition sends stdout and stderr to the authoritative product log destination consumed by `logs`. |
| AC-b10 | Migration notes identify every renamed command and temporary alias, including Hive's `install-service`/`uninstall-service` to `service-install`/`service-uninstall`. |

## Implementation notes

- Existing product service adapters should be wrapped, not replaced without evidence.
- The command layer should inject service, registry, updater, health, confirmation, and output seams for deterministic tests.
- Preserve Doctor's role: products own registry writes for themselves; Doctor owns validation, observation, and supervision.

## Open questions

- Each product must resolve its state-retention policy before implementation; the default is preserve state unless the user explicitly confirms removal.

## Related

- [PRD-003c observability](./prd-003c-apiary-cli-interface-standard-observability.md)
- Existing Doctor registry implementation: `doctor/src/registry.ts`
