# @legioncodeinc/cli-kit

Zero-dependency CLI mechanism kit for the Apiary CLI suite.

`cli-kit` consolidates the stable, cross-cutting mechanisms currently re-implemented (and drifting) across the four Apiary CLIs — `honeycomb`, `doctor`, `hive`, `nectar` — so that a bug fix to, e.g., the Windows-safe exit handshake lands once and propagates to every consumer via a versioned npm dependency. It is deliberately **narrow and stable**: it holds only the mechanisms that change rarely, not volatile product-specific surface (banner text, telemetry keys, version constants, command tables).

- **Zero runtime dependencies** (`"dependencies": {}`) — the suite's can't-crash-watchdog constraint is load-bearing.
- **ESM only**, targeting Node `>=22.5.0`.
- **Single import path** (`@legioncodeinc/cli-kit`), root-only exports.

## Modules

| Module | Scope |
|---|---|
| **color** | SGR color helpers honoring `NO_COLOR` / `FORCE_COLOR` / TTY. |
| **shutdown** | Windows-safe process teardown for one-shot commands that used `fetch`. |
| **exit-codes** | The `0` / `1` / `2` exit-code enum and helpers. |
| **arg-parser** | A single shared argv parser (collapses the duplicated bespoke parsers). |
| **telemetry** | `isTelemetryOptedOut(toolName)` resolver honoring the three env vars. |
| **usage** | Grouped usage-table formatter (verb column + summary column). |

## References

- [CLI Contract](./library/notes/cli-contract.md) — the normative specification this kit implements.
- [PRD-001](./library/requirements/backlog/prd-001-cli-kit/prd-001-cli-kit-index.md) — the PRD scoping the first shipping version.

## License

[AGPL-3.0-or-later](./LICENSE.md)
