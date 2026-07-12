<!-- library/requirements/backlog/prd-002-cli-kit-hardening/prd-002j-cli-kit-hardening-version-helper.md -->

# PRD-002j: `readPackageVersion()` helper for consumers

> **Parent:** [`prd-002-cli-kit-hardening`](./prd-002-cli-kit-hardening-index.md)
> **Status:** Backlog · **Priority:** P3 · **Effort:** S (1–3h) · **Band:** Coverage expansion

---

## Overview

`002a` fixes the kit's *own* stale `VERSION`. But the same drift lives in the sisters: each CLI keeps a version constant (`DOCTOR_VERSION`, `hive/src/shared/constants.ts`, etc.) that can fall out of sync with its `package.json`. This sub-PRD provides a shared, zero-dep helper so any consumer can single-source its version the same correct way, killing the whole class of drift the kit just demonstrated.

## Goals

- A reusable helper that reads a package's own `version` from its `package.json`, given the caller's module URL.
- One correct implementation of the "find my package.json and read version" dance, instead of each CLI re-deriving it.

## Non-Goals

- Hosting any CLI's version *value* in the kit (that would violate the "no product surface" rule). The helper *reads the caller's* package.json; it does not store versions.
- Replacing a build-time inject where a consumer prefers that (the helper is an option, not a mandate).

## User stories

- As a sister-CLI author, I call `readPackageVersion(import.meta.url)` and get my own version without hand-maintaining a constant.

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-j1 | `readPackageVersion(importMetaUrl)` locates the nearest ancestor `package.json` from the given module URL and returns its `version` string. |
| AC-j2 | On a missing/unreadable/invalid `package.json`, it returns a typed error or a documented fallback — it never throws out of the helper. |
| AC-j3 | Works under ESM on Node `>=22.5.0` with `import.meta.url`; documented usage example provided. |
| AC-j4 | Zero runtime deps (`node:fs`, `node:path`, `node:url` only). |
| AC-j5 | The kit's own `002a` fix MAY be implemented on top of this helper (if the runtime-read approach is chosen), demonstrating dogfooding. |

## Implementation notes

Resolve the file path from `import.meta.url` (`fileURLToPath`), walk up to the nearest `package.json`, `JSON.parse`, return `version`. Cache per-URL if called repeatedly. Keep it total (no throws). Note the interaction with `002a`: if `002a` picks build-time inject for the kit itself, this helper still ships for consumers; if `002a` picks runtime-read, it should reuse this helper.

## Open questions

- [ ] Return `string | undefined` vs a `{ ok, version } | { ok: false, error }` result? Leaning `string | undefined` for ergonomics, with a documented default.

## Related

- [`prd-002a-…-version-single-source`](./prd-002a-cli-kit-hardening-version-single-source.md) — the kit's own fix this generalizes.
- Duplication source: `doctor/src/version.ts` (`DOCTOR_VERSION`), `hive/src/shared/constants.ts`, `nectar/src/hive-graph/project-scope.ts`.
