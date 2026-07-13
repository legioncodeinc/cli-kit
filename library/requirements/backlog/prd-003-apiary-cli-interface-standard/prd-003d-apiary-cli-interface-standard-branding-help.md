# PRD-003d: Product branding, help, and version

> **Parent:** [PRD-003](./prd-003-apiary-cli-interface-standard-index.md)
> **Status:** Backlog · **Priority:** P1 · **Effort:** M

## Overview

Honeycomb's current help surface establishes the intended direction: small product-specific ASCII art, a prominent uppercase product identity, version, and grouped commands. This sub-PRD turns that direction into a shared frame while requiring unique art for Doctor, Hive, Honeycomb, and Nectar.

## Required banner anatomy

Bare invocation and `--help` render:

1. Product-specific ASCII art
2. The unspaced uppercase product name: `DOCTOR`, `HIVE`, `HONEYCOMB`, or `NECTAR`
3. A short, product-owned descriptor
4. `v<package-version>`
5. The exact credit line `Legion Code Inc. x Activeloop`
6. Usage and grouped commands from the shared manifest

Honeycomb's hexagonal art is the behavioral reference, not an asset to copy into every product. Each product supplies its own compact ASCII-only mark:

- Doctor: medical/watchdog motif
- Hive: hive/colony motif distinct from Honeycomb's cell grid
- Honeycomb: retain or refine the existing honeycomb motif
- Nectar: droplet/flower/nectar motif

The art must remain readable at 80 columns, use ASCII characters only, and contain no terminal escape sequence in its source string. Color is applied through cli-kit and degrades under `NO_COLOR`, non-TTY output, and JSON mode.

## Help behavior

- Bare invocation and `--help` are equivalent and return `0`.
- `help` and `-h` may remain aliases.
- `--help` must not inspect, start, stop, register, update, or contact a service.
- Standard operational groups precede product-specific commands.
- Command summaries are one line and begin with an imperative verb.
- Global flags appear once at the bottom.
- Terminal width below 80 columns may wrap descriptions but never corrupt the command name column or art.

## Version behavior

- `--version` prints exactly `<product> v<version>` and one newline, with the lowercase executable name.
- It emits no art, credit, ANSI, update check, or other prose.
- The value comes from the product's package manifest/build-time source of truth.
- `--version --json` returns the standard JSON envelope plus `version`.

## User stories

- As a user, I immediately know which Apiary product I invoked.
- As a user, the four CLIs feel related without losing their individual identities.
- As a script author, `--version` remains compact and parseable.

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-d1 | Doctor, Hive, Honeycomb, and Nectar each ship distinct ASCII-only product art reviewed for recognizability and width at 80 columns. |
| AC-d2 | Bare invocation and `--help` show the art, unspaced uppercase product name, descriptor, package-derived version, exact `Legion Code Inc. x Activeloop` credit, usage, and grouped commands. |
| AC-d3 | Honeycomb retains its recognizable honeycomb motif and becomes the structural reference without forcing the other products to copy its art. |
| AC-d4 | Help rendering is pure and side-effect-free; tests prove it performs no filesystem write, service-manager call, network request, registry mutation, or daemon startup. |
| AC-d5 | `NO_COLOR`, non-TTY output, and `--no-color` contain no ANSI while preserving identical text content. |
| AC-d6 | JSON mode contains no banner or attribution prose. |
| AC-d7 | `--version` prints exactly `<product> v<package-version>\n`; the version is single-sourced and tested against the product package manifest. |
| AC-d8 | `--version --json` emits the standard JSON envelope with a `version` field and no additional output. |
| AC-d9 | Snapshot/golden tests cover each product at 80 columns, narrow terminal wrapping, color disabled, bare invocation, `--help`, and `--version`. |
| AC-d10 | The rendered credit uses the exact capitalization and punctuation `Legion Code Inc. x Activeloop` in all four products. |

## Implementation notes

- Add shared `renderProductBanner` and grouped-help primitives to cli-kit; pass product art, name, descriptor, version, and manifests as data.
- Keep art definitions in product repositories so visual identity remains product-owned.
- Do not place brand image binaries in `library/`.

## Open questions

- Final ASCII art requires maintainer review during each product's implementation PR; the acceptance criteria define constraints, not the final drawing.

## Related

- Honeycomb reference: `honeycomb/src/commands/dispatch.ts`
- Doctor existing attribution: `doctor/src/cli/banner.ts`
