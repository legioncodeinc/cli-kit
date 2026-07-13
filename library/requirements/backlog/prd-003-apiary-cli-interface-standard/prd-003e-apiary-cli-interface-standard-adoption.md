# PRD-003e: Per-product adoption and conformance

> **Parent:** [PRD-003](./prd-003-apiary-cli-interface-standard-index.md)
> **Status:** Backlog · **Priority:** P1 · **Effort:** XL

## Overview

The standard is complete only when all four independently versioned products adopt it. This sub-PRD records the repository-specific migration boundaries, requires packed-CLI verification, and prevents a shared library implementation from being mistaken for fleet-wide completion.

## Adoption inventory

### Honeycomb

- Preserve the existing ASCII honeycomb motif and grouped product commands.
- Map existing daemon/service handlers to the canonical lifecycle verbs.
- Add or normalize `restart`, `service-install`, `service-uninstall`, `register`, and `logs` where absent.
- Preserve existing auth, memory, asset, harness, settings, dashboard, and telemetry subcommands.

### Doctor

- Replace the collaboration-first banner with the shared product-first anatomy while retaining the required credit.
- Add the complete lifecycle/install/update/status/logs/telemetry surface.
- Omit `register`; continue validating and supervising registry entries written by other products.
- Preserve Doctor-specific diagnostic and repair commands under `Product commands`.

### Hive

- Replace the current narrow dispatcher/help line with the shared manifest and branded help.
- Add missing `restart`, `install`, `update`, `status`, `logs`, `telemetry`, `--help`, and `--version` behavior.
- Rename the primary `install-service` and `uninstall-service` spellings to `service-install` and `service-uninstall`, retaining temporary deprecated aliases.
- Preserve dashboard and Hive-specific commands under `Product commands`.

### Nectar

- Replace the monolithic hand-written usage block with shared operational groups plus Nectar product commands.
- Split onboarding `install`/full `uninstall` semantics from service-only operations.
- Add missing `restart`, `service-install`, `service-uninstall`, `update`, `register`, `logs`, `telemetry`, and `--version` behavior as required.
- Preserve brood, search, projects, brooding, prune, review, and projection commands.

## Migration discipline

- Each repository receives its own implementation PR and changelog entry.
- Historical aliases remain for at least one minor release when removing them would break documented usage.
- Help advertises only canonical commands after adoption.
- Each packed npm artifact is tested, not only its source-tree entrypoint.
- Cross-product tests run the four packed executables against fake service-manager, registry, updater, health, log, and telemetry seams where feasible; platform integration tests run on native CI runners.

## User stories

- As a fleet operator, I can move between products without consulting four separate lifecycle references.
- As a product maintainer, I have a bounded checklist that preserves specialized commands.
- As a release reviewer, I can prove the standard exists in shipped artifacts rather than only in cli-kit.

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-e1 | Honeycomb's packed CLI passes the full shared matrix and retains all pre-adoption product-specific commands. |
| AC-e2 | Doctor's packed CLI passes the matrix with only the documented `register` exemption and continues to validate non-Doctor registry entries. |
| AC-e3 | Hive's packed CLI passes the matrix; canonical service verbs are `service-install`/`service-uninstall`, with old spellings tested as deprecated aliases for the migration window. |
| AC-e4 | Nectar's packed CLI passes the matrix and retains its brood, search, projects, brooding, prune, review, and projection surfaces. |
| AC-e5 | Every repository has a changelog/migration note listing added commands, renamed aliases, changed semantics, and automation-impacting exit/output changes. |
| AC-e6 | Native CI verifies service adapter behavior on Windows, macOS, and Linux for every product. |
| AC-e7 | A suite-level conformance job installs the packed versions of all four products and verifies command presence, help structure, banners, credit, versions, JSON cleanliness, and log-source isolation. |
| AC-e8 | No product is marked adopted while any required command is a silent stub, exits success without doing the documented work, or delegates to the wrong product's service/state/log source. |
| AC-e9 | Documentation presents one suite-wide command matrix and links to product-specific command details without duplicating the normative semantics. |
| AC-e10 | All four releases containing the adoption are published before PRD-003 moves to completed. |

## Test plan

- Unit tests for each handler through injected adapters.
- Product golden tests for help, banner, version, status, logs, and telemetry.
- Shared contract tests over product command manifests.
- Packed-artifact subprocess tests for every required command's help/parse path.
- Native service-manager integration tests on Windows, macOS, and Linux using isolated per-user service names.
- Security review for service command construction, update execution, uninstall path ownership, registry writes, log redaction, and terminal escape injection.
- Quality review against every parent and sub-PRD acceptance criterion after all product releases exist.

## Risks

- **Semantic aliasing:** Existing `install` commands may already combine service installation and registration. Mitigation: extract phases and report them explicitly; do not hide service-only behavior behind aliases.
- **Destructive convergence:** A shared `uninstall` could delete product or shared state incorrectly. Mitigation: product-owned path allowlists, confirmation, dry-run where supported, and security review.
- **Platform drift:** A command may exist but behave differently across service managers. Mitigation: fixed cross-platform behavior contract plus native CI.
- **Help-only compliance:** A product may list a command without implementing it. Mitigation: packed executable tests and AC-e8.

## Open questions

- None.

## Related

- [PRD-003 parent](./prd-003-apiary-cli-interface-standard-index.md)
- [PRD-003a command contract](./prd-003a-apiary-cli-interface-standard-command-contract.md)
- [PRD-003b lifecycle semantics](./prd-003b-apiary-cli-interface-standard-lifecycle.md)
- [PRD-003c observability](./prd-003c-apiary-cli-interface-standard-observability.md)
- [PRD-003d branding and help](./prd-003d-apiary-cli-interface-standard-branding-help.md)
