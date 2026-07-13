# Security close-out: PRD-002 cli-kit hardening

**Audit date:** 2026-07-12  
**Auditor:** security-worker-bee  
**Scope:** all PRD-002 requirements; current source, tests, generated artifacts, package manifest/lockfile, scripts, and GitHub release workflows  
**Runtime:** Node `>=22.5.0`  
**Dependency audit:** 0 Critical, 0 High, 0 Moderate after remediation  

## Executive summary

Scope note: cli-kit is outside the Hivemind-specific portions of the Security Stinger. Universal filesystem, dependency, output, process, and release-supply-chain checks were applied at full depth; Deep Lake, captured-trace, credential-store, and pre-tool-use-gate controls are not present in this package.

The review found one Critical dependency-toolchain issue and two High filesystem trust-boundary issues. All three were remediated in-session and covered by passing tests. No credential, PII, SQL, network-client, or authentication surface exists in this zero-runtime-dependency library.

## Findings by severity

### Critical (fixed)

- [x] **Vulnerable test toolchain** `package.json:54-56`, `package-lock.json` — Vitest 2.1.9 resolved a Critical arbitrary-file-read/execution advisory (GHSA-5xrq-8626-4rwp), with a High Vite path-bypass advisory also in the tree. Upgraded `vitest` and `@vitest/coverage-v8` to 4.1.10; `npm audit --json --audit-level=high` now reports zero vulnerabilities and the full suite passes.

### High (fixed)

- [x] **APIARY_HOME symlink escape** `src/config-dir.ts:81-89` — lexical containment allowed a path inside the home directory to be a symlink/junction to an external or system location. Existing ancestors are now canonicalized with `realpathSync.native()` and rejected unless their real path remains under the real home. Regression evidence: `tests/config-dir.test.ts:83-88`.
- [x] **Migration link traversal and unverified deletion** `src/config-dir.ts:106-176` — migration followed directory links and deleted source files immediately after copy without verifying the destination, permitting out-of-root writes/reads and data loss. Source and destination trees are now preflighted with `lstatSync` to reject links before mutation, and copied file sizes are verified before source removal. Regression evidence: `tests/config-dir.test.ts:71-81`.

### Medium (follow-up)

- [ ] **Release-time packages are not lockfile-resolved** `.github/workflows/release.yaml:55-56,79-80,160-161` — npm, CycloneDX, and the Bedrock SDK are installed dynamically during the privileged release job. Versions are exact where specified, but integrity is not anchored in this repository's lockfile; `@aws-sdk/client-bedrock-runtime` is not version-pinned. Move release tools into a reviewed lockfile or a separately locked release-tool workspace and use `npm ci`.
- [ ] **Actions use mutable version tags** `.github/workflows/release.yaml:45,50,174` — GitHub Actions are version-tag pinned rather than commit-SHA pinned. Pin each third-party action to a reviewed full SHA and retain the version in a comment.

### Low

None detected.

## Surface review

| Surface | Result | Evidence |
|---|---|---|
| Config-dir / path traversal | Remediated | lexical checks plus real-path containment at `src/config-dir.ts:52-89` |
| Migration data integrity / links | Remediated | link preflight and copy verification at `src/config-dir.ts:106-176` |
| Confirm / readline | OK | non-TTY defaults safely; interface is closed in `finally`; no secret echo or persistent listener |
| JSON output | OK | serialization failures are contained; exactly one successful write; no log/credential surface |
| Build/codegen | OK | generated version is JSON-escaped and derived from repository-local `package.json`; output path is fixed |
| Vendored docs sync | OK | filenames and destinations are fixed constants; no user-controlled path segment |
| Runtime dependencies | OK | `dependencies` is absent/empty; production dependency count is zero |
| Provenance / SBOM | Attention | OIDC and provenance enabled; dynamic release tooling and mutable action tags remain Medium follow-ups |
| Hidden Unicode rules backdoor | OK | no forbidden zero-width/bidi characters detected in tracked agent/rules files |
| Credentials / PII / auth / SQL | Not applicable | no such surface exists in cli-kit |

## Verification

- `npm audit --json --audit-level=high` — clean, 0 vulnerabilities.
- `npm run typecheck` — passed.
- `npm test` — 11 files, 194 tests passed.
- `npm run build` — passed; generated declarations/artifacts refreshed.
- `npm pack --dry-run` — passed; 55 files, no SBOM or unintended secret/config files in the tarball.
- `git diff --check` — only pre-existing Markdown hard-break whitespace in the execution ledger was reported; no security-remediation whitespace error.

## Remediation files

| File | Change |
|---|---|
| `src/config-dir.ts` | Added canonical-path containment, link preflight, and copy verification. |
| `tests/config-dir.test.ts` | Added symlink/junction escape and migration-link regression tests. |
| `package.json` | Upgraded vulnerable Vitest toolchain. |
| `package-lock.json` | Locked remediated dependency graph. |

No ledger criteria were marked VERIFIED by this security review. Quality verification must run after these fixes.
