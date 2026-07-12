<!-- library/knowledge/private/architecture/ADR-001-apiary-single-home-root.md -->

# ADR-001: A single home-anchored `~/.apiary/` root for all suite state

> **Status:** Accepted
> **Date:** 2026-07-12
> **Deciders:** Mario Aldayuz
> **Owner mechanism:** `resolveConfigDir()` in `@legioncodeinc/cli-kit`
> **Drives:** [`prd-002i-cli-kit-hardening-config-dir`](../../../requirements/backlog/prd-002-cli-kit-hardening/prd-002i-cli-kit-hardening-config-dir.md)

---

## Context

The Apiary suite ships several CLIs and services (`honeycomb`, `doctor`, `hive`, `nectar`, plus a background daemon and a Deep Lake data layer). Today each resolves its own on-disk location independently, and the result is a set of **top-level dot-directories scattered across the user's home folder**, one per service, regardless of what is actually installed:

```
~/.apiary
~/.daemon
~/.deeplake
~/.honeycomb
```

This has three problems:

1. **User-visible clutter and no single owner.** The footprint grows with every service. There is no one place to back up, clear, or relocate "everything Apiary keeps on disk," and no single code path that decides where suite files live.
2. **Cross-platform path drift.** Each sister re-derives home paths with its own mix of `os.homedir()`, ad-hoc XDG lookups, and hard-coded names (`.deeplake`, etc.). This is exactly the mechanism-drift the `cli-kit` library exists to end (see [`prd-001-cli-kit`](../../../requirements/completed/prd-001-cli-kit/prd-001-cli-kit-index.md)).
3. **A latent trust-boundary risk.** With home-path resolution spread across services and sometimes driven by overridable env vars (XDG), nothing structurally prevents suite state from being written to a shared **system/global** location (`/etc`, `/var`, `C:\ProgramData`, a drive root). That is both a correctness and a security concern.

`cli-kit` is the natural — and only — correct home for this decision: it is the shared, zero-dependency, stable-mechanism library every sister already depends on (or will), and home-directory resolution is precisely the kind of rarely-changing, cross-cutting mechanism it was chartered to own.

## Decision

**All Apiary suite state lives under a single, home-anchored root: `~/.apiary/`.** The `cli-kit` library is the *single owner* of home-directory resolution via `resolveConfigDir()`; no service computes its own home path or creates its own top-level `~/.<service>` directory.

Specifically:

1. **One root.** Every service writes under `~/.apiary/`, namespaced per concern (`~/.apiary/daemon/`, `~/.apiary/deeplake/`, `~/.apiary/honeycomb/`, `~/.apiary/shared/`, …). A fresh install of *any single* CLI creates exactly one new directory in `$HOME`: `~/.apiary/`.
2. **Single owner.** `resolveConfigDir(toolName)` returns `~/.apiary/<toolName>/`; `apiaryHome()` returns the root. Sisters call these and delete their own home-resolution code.
3. **Home-anchored, never system (the core guarantee).** The base is always resolved from `os.homedir()` and **validated**: the resolver refuses — with a typed error, never a silent fallback — any base that is empty, a filesystem root, or a known system/global directory (`/etc`, `/var`, `/usr`, `/`, a Windows drive root, `C:\ProgramData`, `C:\Windows`). Suite state can never be written to a shared system location.
4. **`APIARY_HOME` override, still home-anchored.** An `APIARY_HOME` env var may relocate the root, but it is subject to the *same* refusal rule — an override that resolves to a system/global directory or a filesystem root is rejected. The override can move the root within user-owned space; it can never escape the guarantee.
5. **Migration: move + symlink fallback.** Existing installs consolidate their legacy `~/.daemon`, `~/.deeplake`, `~/.honeycomb` (and any flat `~/.apiary` content) into the new namespaces on next start. When a move is blocked (e.g. a running daemon holds open handles), the legacy path is symlinked to its new location with a logged deprecation warning, and the move completes on a later clean start. Migration is idempotent and verifies the destination before removing any source — **no data loss**.

The decision is scoped to *location*: the kit owns where files go, not their contents or format (credentials, datasets, logs remain each service's concern).

## Consequences

### Positive

- **One directory to reason about.** Users back up, clear, or relocate all Apiary state by acting on `~/.apiary/`. `$HOME` gains one entry, not one-per-service.
- **Drift eliminated at the source.** Home-path logic exists once, in one tested, cross-platform, zero-dependency function. Windows/macOS/Linux differences are handled in a single place.
- **A structural security property.** "Suite state is never written to a system directory" becomes an invariant enforced by code and asserted by tests, not a convention each service must remember.
- **Cleaner adoption story.** New services get correct, consolidated storage for free by calling one function.

### Negative / costs

- **A one-time migration** must run against real user machines, including the delicate case of a daemon holding open handles. The move + symlink-fallback strategy mitigates this but adds implementation complexity and a deprecation window during which symlinks may linger.
- **Coordination cost.** Every sister must delete its bespoke home-resolution code and adopt the resolver; until all do, the two conventions coexist.
- **A single blast radius.** A bug in `resolveConfigDir()` now affects every service. This is the accepted trade-off for having one owner — mitigated by the kit's test discipline and the home-anchoring validation.

### Neutral / follow-ups

- **Resolved (2026-07-12):** the subpath namespace map keeps today's legacy names as-is (`daemon/`, `deeplake/`, `honeycomb/` under `~/.apiary/`) — minimal renaming, simplest migration mapping.
- **Resolved (2026-07-12):** the "must a service stop first" concern is answered structurally, not case-by-case — the migration is gated by `isOneShot()` (PRD-002c) and never runs from a daemon/watchdog invocation, so it is never attempted while that same process's own directory might be in use.

Both are detailed in [`prd-002i`](../../../requirements/backlog/prd-002-cli-kit-hardening/prd-002i-cli-kit-hardening-config-dir.md)'s Resolved decisions.

## Alternatives considered

1. **Status quo — per-service `~/.<service>` directories.** Rejected: it is the problem. Clutter grows unbounded, drift persists, and there is no structural guard against system-directory writes.
2. **XDG Base Directory spec (`$XDG_CONFIG_HOME` / `$XDG_DATA_HOME`).** Rejected as the primary mechanism. XDG is override-driven, and an override pointing at a system path is exactly what the core guarantee forbids; honoring XDG faithfully would weaken the "never system directories" property. A *scoped* `APIARY_HOME` override that still enforces home-anchoring gives the useful part (relocatability) without the risk.
3. **Per-service roots that each service owns, coordinated only by convention.** Rejected: this is drift with extra steps. Convention is exactly what has failed across the four CLIs already; the whole point of `cli-kit` is to replace convention with a shared mechanism.
4. **A move-only migration (no symlink fallback).** Rejected: cleanest end state, but it fails when a daemon holds open handles, which is a realistic and hard-to-avoid condition. The symlink fallback trades a temporary bit of clutter for a safe migration under contention.

## Related

- [`prd-002i-cli-kit-hardening-config-dir`](../../../requirements/backlog/prd-002-cli-kit-hardening/prd-002i-cli-kit-hardening-config-dir.md) — the sub-PRD implementing this decision (headline acceptance criteria AC-i1…AC-i8).
- [`prd-002-cli-kit-hardening`](../../../requirements/backlog/prd-002-cli-kit-hardening/prd-002-cli-kit-hardening-index.md) — parent PRD; this is its P0 item.
- [`prd-001-cli-kit`](../../../requirements/completed/prd-001-cli-kit/prd-001-cli-kit-index.md) — the shared-mechanism library this decision extends.
- Security note: the home-anchoring / system-directory refusal is a trust-boundary property; flag for `security-worker-bee` review at implementation time.
