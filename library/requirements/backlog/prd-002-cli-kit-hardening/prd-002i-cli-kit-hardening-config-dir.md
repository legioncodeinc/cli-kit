<!-- library/requirements/backlog/prd-002-cli-kit-hardening/prd-002i-cli-kit-hardening-config-dir.md -->

# PRD-002i: `resolveConfigDir()` — one home-anchored `~/.apiary/` root for the whole suite

> **Parent:** [`prd-002-cli-kit-hardening`](./prd-002-cli-kit-hardening-index.md)
> **Status:** Backlog · **Priority:** P0 (highest-value item in this PRD) · **Effort:** L (1–3d)
> **Schema changes:** On-disk directory contract + one-time user-home migration (no DB schema)

---

## Overview

Today an Apiary install scatters **top-level dot-directories across the user's home folder**, one per service, regardless of what's actually installed:

```
~/.apiary
~/.daemon
~/.deeplake
~/.honeycomb
```

Each sister resolves its own home path independently (`os.homedir()`, ad-hoc XDG lookups, `.deeplake`, etc. — see `honeycomb/src/cli/*`), so the footprint grows with every service and there is no single owner of "where does Apiary keep its files." That is drift in its most user-visible form: clutter in `$HOME`, inconsistent conventions, and no single place to back up, clear, or relocate.

This sub-PRD makes the kit the **single owner of home-directory resolution** for the entire suite. Everything the suite writes lives under **one** root — `~/.apiary/` — regardless of which service(s) are installed. The resolver is **explicitly anchored to the user's home directory and must never resolve to a system or global directory**.

This is the most impactful item in PRD-002: it is user-facing, it eliminates an entire class of cross-platform path bugs, and — being a stable, zero-dependency mechanism — it is a perfect fit for the kit's charter.

## Goals

- **One root.** All suite state lives under `~/.apiary/`. No service creates its own top-level `~/.<service>` directory.
- **Single owner.** `resolveConfigDir()` in the kit is the *only* code that decides where suite files go; sisters call it and never compute home paths themselves.
- **Home-anchored, never system.** The resolved base is always within the invoking user's home directory. The resolver **refuses** to return a system/global path (`/etc`, `/var`, `/usr`, `C:\ProgramData`, `C:\Windows`, a drive root, or `/`).
- **Consolidation.** Today's `~/.daemon`, `~/.deeplake`, `~/.honeycomb` (and any existing `~/.apiary` usage) collapse into namespaced subpaths under the single root.
- **Safe migration.** Existing installs move to the new layout with no data loss.

## Non-Goals

- Owning the *contents/format* of any service's files (credentials, datasets, logs). The kit owns **location**, not payload.
- A general XDG Base Directory implementation. The suite's decision is deliberately **home-anchored**, not `$XDG_CONFIG_HOME`-driven — an XDG override that points at a system path is exactly what the "never system directories" rule forbids. A scoped `APIARY_HOME` override **is** supported (see Resolved decisions), but it obeys the same refusal rule.
- Migrating data *between machines* or cloud sync.

## User stories

- As a user, after installing any Apiary CLI, my home folder gains exactly one new directory — `~/.apiary/` — not one per service.
- As a user, I can back up, clear, or relocate all Apiary state by acting on a single directory.
- As a sister-CLI author, I ask the kit for my directory (`resolveConfigDir("honeycomb")`) and get a correct, home-anchored path on Windows, macOS, and Linux without writing platform logic.
- As a security reviewer, I can assert that suite files can never be written to a shared system location.

## Proposed on-disk layout

A single root with per-concern namespaces. Exact subpaths to be finalized in review, but the shape:

```
~/.apiary/                     # THE root — the only top-level dir the suite creates
├── daemon/                    # was ~/.daemon
├── deeplake/                  # was ~/.deeplake
├── honeycomb/                 # was ~/.honeycomb
├── doctor/                    # per-service state
├── hive/
├── nectar/
└── shared/                    # cross-service state that isn't owned by one CLI
```

`resolveConfigDir(toolName)` returns `~/.apiary/<toolName>/`; `apiaryHome()` returns `~/.apiary/` itself for shared/root use.

## Home-anchoring & system-directory refusal (the core guarantee)

- Base = the invoking user's home directory, resolved from `os.homedir()` (which honors `%USERPROFILE%`/`HOME` per platform).
- The resolver **validates** the result and throws (or returns a typed error) if the base is empty, is a filesystem root, or is any known system/global directory. It must never silently fall back to a system path.
- No writes ever target a system/global directory. This is asserted by the cross-platform test in AC-5.
- **`APIARY_HOME` override (resolved: in scope):** when set, `APIARY_HOME` relocates the root, but it is subject to the *same* refusal rule — an override that resolves to a system/global directory (or a filesystem root) is rejected with the same typed error. The override can move the root within user-owned space; it can never escape the home-anchored guarantee.

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-i1 | `resolveConfigDir(toolName?)` returns a path under `~/.apiary/`; with a `toolName` it returns `~/.apiary/<toolName>/`, without one it returns the root (`apiaryHome()`). |
| AC-i2 | The resolved base is always within `os.homedir()`; the resolver **refuses** (typed error, never a silent fallback) any system/global directory: `/etc`, `/var`, `/usr`, `/`, a Windows drive root, `C:\ProgramData`, `C:\Windows`. |
| AC-i3 | After adoption, a fresh install of any single Apiary CLI creates **only** `~/.apiary/` in `$HOME` — no `~/.daemon`, `~/.deeplake`, or `~/.honeycomb` top-level directories. |
| AC-i4 | Works correctly on Windows (`%USERPROFILE%`), macOS, and Linux — one cross-platform test suite covers all three path shapes. |
| AC-i5 | Existing installs are migrated: legacy `~/.daemon`, `~/.deeplake`, `~/.honeycomb` (and pre-existing `~/.apiary` content) are moved (or transparently redirected) under the new root with **no data loss**, and the migration is idempotent/re-runnable. |
| AC-i6 | The resolver is the single source of home-path truth: sisters delete their own home-resolution code and call the kit (tracked as a per-sister adoption checklist). |
| AC-i7 | Zero runtime deps (`node:os`, `node:path`, `node:fs` only). |
| AC-i8 | An `APIARY_HOME` env var, when set, relocates the root; when it resolves to a system/global directory or a filesystem root it is **rejected** with the same typed error as AC-i2 (the override cannot escape the home-anchored guarantee). Covered by test. |

## Migration plan

1. **Detect** legacy top-level dirs (`~/.daemon`, `~/.deeplake`, `~/.honeycomb`, plus any flat `~/.apiary` files) at first run after adoption.
2. **Consolidate** each into its namespace under `~/.apiary/<service>/`.
3. **Strategy (resolved: move + symlink fallback):** move legacy dirs into `~/.apiary/<service>/` on next start. When a move is blocked (e.g. a daemon holds open handles), leave a legacy → new **symlink** so the running process keeps working, log a deprecation warning, and complete the move on a later clean start.
4. **Idempotent & re-runnable**: a second run is a no-op; a partially-migrated state completes cleanly.
5. **No data loss** is the hard constraint — migration verifies the destination before removing the source, and aborts safely (leaving the source intact) on any error.

## Resolved decisions

- **Migration strategy → move + symlink fallback** (2026-07-12). Move on next start; symlink legacy → new when a move is blocked by open handles, with a logged deprecation warning; complete on a later clean start. See migration plan step 3 / AC-i5.
- **`APIARY_HOME` override → in scope, still home-anchored** (2026-07-12). Supported, but subject to the same system-directory refusal as AC-i2. See AC-i8.

## Open questions

- [ ] Do any services need to run *before* the daemon can be safely stopped, complicating a move while handles are open? Determines exactly which invocations trigger the move vs. defer-to-clean-start.
- [ ] Final subpath names (`daemon/` vs `runtime/daemon/`, `deeplake/` vs `data/deeplake/`) — settle the namespace map with each service owner.

## Related

- [`ADR-001: single home-anchored ~/.apiary root`](../../../knowledge/private/architecture/ADR-001-apiary-single-home-root.md) — the architecture decision this sub-PRD implements.
- [`prd-002-cli-kit-hardening`](./prd-002-cli-kit-hardening-index.md) — parent (AC-4/5/6 are this sub-PRD's headline outcomes).
- Duplication source: home-path resolution across `honeycomb/src/cli/*` (`os.homedir()`, `.deeplake`, XDG lookups).
- Security relevance: the "never system directories" rule is a trust-boundary property — flag for `security-worker-bee` review at implementation time.
