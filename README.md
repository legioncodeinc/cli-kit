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
| **json-output** | Canonical JSON output and explicit JSON/color bootstrap coupling. |
| **confirm** | Safe zero-dependency y/N confirmation gate. |
| **config-dir** | Home-anchored Apiary state resolution and one-shot legacy migration. |
| **package-version** | Total nearest-package version lookup for ESM consumers. |
| **branding** | Pure product banner, grouped help, exact credit, and human/JSON version rendering. |
| **reference-cli** | Side-effect-free golden harness for consumer conformance preparation. |

## Consumer usage

```ts
import {
  confirm,
  declined,
  emitJson,
  migrateLegacyConfig,
  readPackageVersion,
  resolveConfigDir,
  setColorEnabled,
  setJsonMode,
} from "@legioncodeinc/cli-kit";

const json = process.argv.includes("--json");
setColorEnabled();
if (json) setJsonMode();

// Run only from one-shot bootstrap; `run` is excluded by isOneShot internally.
migrateLegacyConfig({ argv: process.argv.slice(2) });
const stateDir = resolveConfigDir("honeycomb");
const version = readPackageVersion(import.meta.url) ?? "unknown";

if (!(await confirm("Continue?", { assumeYes: process.argv.includes("--yes") }))) {
  process.exitCode = declined("Aborted."); // intentional decline exits 0
} else if (json) {
  if (!emitJson({ version, stateDir })) process.exitCode = 1;
}
```

`APIARY_HOME` may relocate state only to an absolute path beneath the invoking user's home. Filesystem roots and known system/global directories are rejected with `ConfigDirError`.

The vendored contract documents are checked against the parent checkout with `node scripts/sync-vendored-docs.mjs`; use `--write` to refresh them.

PRD-003 consumers should follow the [adoption checklist](./library/notes/prd-003-adoption-checklist.md) and the [suite command matrix](./library/notes/prd-003-command-matrix.md). Reference art is test-fixture data; final art remains product-owned and must be reviewed in each product repository.

## References

- [CLI Contract](./library/notes/cli-contract.md) — the normative specification this kit implements.
- [CLI parity audit](./library/notes/cli-parity-audit.md) — the source-grounded adoption audit shipped with the kit.
- [PRD-001](./library/requirements/backlog/prd-001-cli-kit/prd-001-cli-kit-index.md) — the PRD scoping the first shipping version.

## License

[AGPL-3.0-or-later](./LICENSE.md)
