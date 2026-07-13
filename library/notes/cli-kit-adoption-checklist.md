# CLI kit config-directory adoption checklist

PRD-002i makes `@legioncodeinc/cli-kit` the sole owner of Apiary home-path resolution. This checklist records the external consumer work; implementation in this repository does not by itself complete those sister-repository migrations.

## Every sister

- [ ] Depend on the cli-kit release containing `apiaryHome`, `resolveConfigDir`, and `migrateLegacyConfig`.
- [ ] Replace direct `os.homedir()`, `XDG_*`, `.daemon`, `.deeplake`, and `.honeycomb` home-state resolution with the kit helper.
- [ ] Call `migrateLegacyConfig({ argv })` only at one-shot bootstrap; never from `run`, daemon, watchdog, or service startup.
- [ ] Verify a fresh-install integration test creates only `~/.apiary/` at home top level.
- [ ] Retain legacy paths only in migration tests and compatibility documentation.

## honeycomb

- Audit anchors: `src/shared/fleet-root.ts`, `src/shared/fleet-detection.ts`, `src/daemon/runtime/state-migration/index.ts`, and credential/runtime stores beneath `src/daemon/runtime/`.
- [ ] Replace fleet-root and credentials/runtime path resolvers with `resolveConfigDir("honeycomb")` and `resolveConfigDir("deeplake")`.
- [ ] Remove top-level `~/.honeycomb` creation after migration completes.

## doctor

- Audit anchors: `src/apiary-root.ts`, `src/apiary-migration.ts`, `src/config.ts`, `src/registry.ts`, and `src/safe-path.ts`.
- [ ] Replace CLI/runtime home seams and registry paths with `resolveConfigDir("doctor")` or `resolveConfigDir("shared")` as ownership requires.
- [ ] Keep its `run` watchdog excluded from migration.

## hive

- Audit anchors: `src/shared/apiary-root.ts`, `src/shared/legacy-paths.ts`, and `src/service/{platform,templates}.ts`.
- [ ] Replace shared constants and home-derived state paths with kit resolution.
- [ ] Remove local APIARY_HOME/XDG precedence logic superseded by the kit.

## nectar

- Audit anchors: `src/apiary-root.ts`, `src/config.ts`, `src/doctor-registry.ts`, `src/fleet-detection.ts`, and `src/telemetry/db.ts`.
- [ ] Replace `src/apiary-root.ts` home resolution with kit calls while preserving product-specific subpaths.
- [ ] Consolidate credential, registry, runtime, and telemetry state beneath the appropriate `.apiary` namespaces.
