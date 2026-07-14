# Security Audit Report: PRD-003 Honeycomb CLI adoption

**Audit date:** 2026-07-13  
**Auditor:** security-worker-bee subagent  
**Branch:** `legion/prd-003-honeycomb-cli-standard`  
**Scope:** The complete Honeycomb PRD-003 adoption diff and adjacent service lifecycle, process cleanup, update/rollback, uninstall, registration, log/output, referral telemetry, packed-CLI, and SQL-safety surfaces.  
**Node version audited:** `>=22.5.0`  
**`npm audit` result:** 0 vulnerabilities across 624 dependencies (112 production, 437 development, 138 optional)  
**OpenClaw bundle scan:** clean  
**CVE watchlist last refreshed:** 2026-04-24 (within 120 days)

---

## Executive Summary

Seven High findings were confirmed and fixed. The adoption could terminate an unrelated Windows Node process, inject systemd directives through environment-derived paths, leave a partially updated global installation while reporting weak rollback state, expose credentials or terminal-control bytes in human/JSON output, emit unvalidated referral PII, swallow `--dry-run` before mutating commands, and continue destructive uninstall work after a prerequisite failed. No Critical findings were detected and no Critical or High findings remain open.

Every remediation has regression coverage. The final complete CI gate passes with 477 test files and 5,165 tests, and the packed artifact, dependency, OpenClaw, and native Honeycomb SQL audits are clean.

Scope note: Honeycomb is outside the Hivemind-specific portions of the Security Stinger catalog. Universal controls and every PRD-003 attack surface were audited at full depth. The generic scan's Hivemind SQL path did not apply, so Honeycomb's native `audit:sql` gate was run instead and scanned 318 source files successfully.

Security ran before Quality for this adoption cycle.

---

## Scorecard

| Category | Status | Findings |
|---|---|---:|
| Credential / PII / Terminal Safety | FAIL - fixed | 2 High |
| Service Manager / Process Isolation | FAIL - fixed | 2 High |
| Update Channel / Rollback Integrity | FAIL - fixed | 1 High |
| Mutation Safety / Dry-run Semantics | FAIL - fixed | 1 High |
| Uninstall Ownership / Fail-closed Behavior | FAIL - fixed | 1 High |
| Dependency / Supply Chain | OK | 0 |
| SQL Construction | OK | 0 |
| Packed Artifact Integrity | OK | 0 |

Legend: **OK** = zero findings; **FAIL - fixed** = Critical/High finding remediated in this audit.

---

## Critical Findings

None detected.

---

## High Findings (fixed in this session)

- [x] **Unrelated Windows process termination** `src/cli/daemon-service.ts:84-121` - The stale-process cleanup matched the Node executable plus a substring occurrence of the entry path. Another process using the same Node binary could be terminated if its command line merely contained that path. Cleanup now transports Node path, Node flags, and entry path as UTF-16 base64 fixed arguments and applies an anchored exact-command-line pattern. User-derived values are not interpolated into the PowerShell program. Regression coverage: `tests/cli/daemon-service.test.ts`, `tests/cli/daemon-service-pinning.test.ts`.
- [x] **systemd directive, specifier, and variable injection** `src/cli/daemon-service.ts:362-381` - Workspace, fleet-root, executable, entry, and new append-log paths were emitted raw or weakly quoted into a unit file. A newline, `%` specifier, `$` expansion, quote, or control byte in an environment-derived path could alter the service definition. Every variable token is now quoted and escaped; control bytes, `%`, and `$` are rejected. Regression coverage: `tests/cli/daemon-service.test.ts`.
- [x] **Unverified partial update and false rollback recovery** `src/cli/standard-ops.ts:61-151` - The update path did not prove that the requested global package version was installed and could mutate before knowing restart verification was available. Rollback state was also not verified end to end. The updater now preflights restart capability, uses fixed npm argv, verifies the exact globally installed version, restarts and health-checks, and applies the same exact-version/restart/health proof to rollback. Any unverifiable rollback is a hard failure requiring manual recovery. Regression coverage: `tests/cli/standard-ops.test.ts`.
- [x] **Credential and terminal-control output exposure** `src/commands/standard-interface.ts:46-58`, `src/commands/dispatch.ts:235-254`, `src/commands/dispatch.ts:451-484`, `src/commands/telemetry.ts:104` - Dynamic lifecycle, exception, usage, unknown-option, telemetry, stdout, and stderr text could reach human or JSON output without a common redaction boundary. All such output now passes through `redactLogSecrets`, which also strips control/ANSI sequences, and fixed JSON envelope keys cannot be overridden by result details. The JSON wrapper captures and sanitizes both stdout and stderr. Regression coverage: `tests/commands/standard-interface.test.ts`, `tests/commands/dispatch.test.ts`.
- [x] **Referral PII/control-character egress** `src/commands/dispatch.ts:260-276`, `src/daemon/runtime/telemetry/emit.ts:274-276` - `install --ref` accepted arbitrary values, including email addresses and terminal controls, and persisted values could flow to telemetry. New CLI values must match a bounded opaque referral-token grammar. The telemetry boundary also normalizes legacy or externally written invalid values to `unknown`, preventing stored historical state from bypassing validation. Regression coverage: `tests/commands/dispatch.test.ts`, `tests/daemon/runtime/telemetry/emit.test.ts`.
- [x] **Safety flag swallowed before mutation** `src/commands/dispatch.ts:64-84`, `src/commands/dispatch.ts:421-423` - Global parsing consumed `--dry-run` wherever it appeared, so `update --dry-run` could execute a real update and other mutating baseline commands could proceed without rejecting the unsupported safety request. Command-tail `--dry-run` is now preserved; update maps it to the non-mutating `--check` path, while unsupported mutating handlers reject it before doing work. Regression coverage: `tests/commands/dispatch.test.ts`, `tests/commands/lifecycle-verbs.test.ts`.
- [x] **Fail-open destructive uninstall** `src/commands/local-handlers.ts:176-229`, `src/cli/runtime.ts:613-653` - Stop, service-removal, registry, and filesystem errors were caught and uninstall continued into later destructive phases. JSON mode could also avoid an interactive prompt without requiring explicit approval. Uninstall now fails closed at each prerequisite, preserves later state after a failure, propagates service inspection/removal and registry errors, treats only `ENOENT` as an absent state directory, and requires `--yes` for non-interactive JSON uninstall. Regression coverage: `tests/commands/lifecycle-verbs.test.ts`.

---

## Medium and Low Findings

No additional Medium or Low findings were confirmed in the PRD-003 adoption diff after remediation.

---

## Security Invariants Verified

- Service managers and npm are invoked through fixed executables and argv; no user-controlled shell command construction was added.
- Windows cleanup is pinned to the complete expected Honeycomb command line.
- systemd values cannot create new directives, expand variables, or introduce specifiers.
- Update success and rollback success both require exact-version, restart, and health proof.
- `--dry-run` cannot silently become a real mutation.
- Full uninstall requires confirmation, follows stop -> service -> registry -> state ordering, and stops on prerequisite failure.
- State removal uses Honeycomb's resolved absolute state path, never a glob, and does not follow a symlinked directory.
- Referral telemetry is bounded to an opaque non-PII token at both ingress and egress.
- Human and JSON output share a credential/control-character redaction boundary.
- The packed-CLI conformance harness executes the real packed CLI under an isolated temporary `APIARY_HOME`; no production test toggle or synthetic success path was introduced.
- Honeycomb's SQL interpolation audit and OpenClaw bundle audit are clean.

---

## Verification Evidence

| Gate | Result |
|---|---|
| `npm run ci` | PASS - typecheck, duplicate scan, 477 test files, 5,165 passed, 13 skipped, SQL-safety audit clean |
| `npm run build` | PASS - daemon, hooks, OpenClaw, MCP, SDK, CLI, and embed-daemon bundles built |
| `npm run test:packed-cli` | PASS - `packed-cli-conformance OK` |
| `npm run pack:check` | PASS - 70 packed files; forbidden patterns absent; required runtime present |
| `npm run audit:sql` | PASS - 318 files scanned; all interpolation routed through escaping helpers |
| `npm run audit:openclaw` | PASS - one bundle scanned; no findings |
| `npm audit --audit-level=high` | PASS - 0 vulnerabilities |
| Deterministic Security Stinger scan | PASS for dependency, OpenClaw, hidden-Unicode, and universal grep checks; generic Hivemind SQL path replaced by native Honeycomb audit |
| `git diff --check` | PASS - no whitespace errors |

---

## Residual Operational Notes

- This security gate intentionally did not mutate the workstation's live Honeycomb service. Native install/start/stop/restart/uninstall behavior remains for the requested dogfood phase after Quality.
- Already transmitted telemetry cannot be retroactively corrected. The new egress normalization prevents invalid persisted referral values from being sent in future events.
- The Security Stinger CVE watchlist is current for this audit but should be refreshed by approximately 2026-08-22 to remain inside its 120-day freshness window.

---

## Gate Decision

**PASS.** No Critical or High security findings remain open. Honeycomb is cleared to proceed to Quality and then live dogfood validation.

---

## Post-Quality Remediation Re-audit - 2026-07-13

### Decision

**PASS. Quality is cleared to rerun.** The entire current Honeycomb adoption diff was re-audited after Quality's four Critical and three Warning remediations. One new High security finding was confirmed and fixed; no new Critical findings were found. All seven High findings from the initial security audit remain remediated. Open counts are 0 Critical and 0 High.

### New High Finding (fixed)

- [x] **Packed conformance artifact exposed test fakes and broad mutation internals** `esbuild.config.mjs:369-380`, `src/commands/packed-conformance.ts:1-9`, `scripts/fixtures/packed-cli-driver.mjs:7-14`, `scripts/packed-cli-conformance.mjs:98-108` - `bundle/cli-core.js` was initially built from the broad `src/commands/index.ts` barrel. The published tarball therefore exported `createFakeDaemonClient`, individual mutation handlers, daemon helpers, and dozens of unrelated internals despite the stated external-fixture boundary. This was not reachable through the production `honeycomb` binary and no environment-triggered test mode existed, but it unnecessarily shipped a production-adjacent fake/mutation surface. The bundle now builds from a dedicated narrow entry exporting only `VERB_TABLE` and `createDispatcher`. The external driver asserts that exact two-export surface, and the packed verifier rejects fake-client and fixture-only markers in the installed artifact. The fixture remains outside `package.json`'s publish allowlist.

### Quality Remediation Security Review

- **Packed 12-command matrix:** The verifier installs the real tarball into an isolated prefix, executes the shipped CLI and narrow dispatcher core, and supplies mutation adapters only from the repository-external fixture. No environment variable changes production dispatch behavior; no synthetic success implementation is packed.
- **Installed-service-only lifecycle and update:** `src/cli/standard-ops.ts:176-229` selects the platform adapter independently of the legacy spawn preference and requires exact installed-service inspection before canonical start, stop, restart, or update. Inspection errors propagate to the common redacted failure boundary. Update retains fixed npm argv, exact-version verification, service restart, health verification, and verified rollback (`src/cli/standard-ops.ts:92-151`).
- **Service removal independent of spawn preference:** Full uninstall selects `serviceManagerForPlatform` directly (`src/cli/runtime.ts:627-643`), so `HONEYCOMB_DAEMON_SERVICE=spawn` cannot hide an already installed service from removal. Unknown manager, inspection, unregister, and registry errors fail closed before later destructive state deletion.
- **Install transaction boundary:** Required onboarding persistence and Doctor registration now fail closed before ready output and installed telemetry (`src/commands/install.ts:524-538`). Injected seams are explicitly forwarded by dispatch (`src/commands/dispatch.ts:187-203`) and production defaults remain the real stores.
- **Uninstall transaction boundary:** A failed stop, service removal, registry update, state removal, or connector reversal suppresses success telemetry. The event is emitted only after the complete transaction succeeds (`src/commands/local-handlers.ts:132-162`). Its dedupe ledger is the intentionally preserved shared `~/.deeplake` onboarding store, not Honeycomb's removed `~/.apiary/honeycomb` product directory.
- **Registration and observability:** Registry parse/read errors are no longer presented as an unregistered success state (`src/cli/standard-ops.ts:156-160`). Human and JSON snapshots exercise the required status/log/telemetry state matrix without adding mutation paths.
- **Prior security fixes:** Exact Windows process identity, systemd token rejection/escaping, output/JSON redaction, referral validation and egress normalization, dry-run preservation, and fail-closed uninstall ordering remain present and covered.

### Re-audit Verification

| Gate | Result |
|---|---|
| Focused lifecycle/security regression set | PASS - 7 files, 145 tests |
| `npm run ci` final rerun | PASS - 477 files, 5,185 passed, 13 skipped; SQL-safety clean |
| `tests/daemon/runtime/secrets/exec.test.ts` exact rerun | PASS - 16 tests; confirms the first CI failure was the known partial-output timing flake |
| `npm run build` | PASS - all production bundles, including narrowed `bundle/cli-core.js` |
| Built core export inspection | PASS - exactly `VERB_TABLE` and `createDispatcher`; no fake/fixture markers |
| `npm run test:packed-cli` | PASS - full 12-command human/JSON success, runtime-failure, and usage matrix |
| `npm run pack:check` | PASS - 71 files; forbidden patterns absent; required runtime present |
| `npm run audit:openclaw` | PASS - one bundle, no findings |
| `npm audit --audit-level=high` | PASS - 0 vulnerabilities across 624 dependencies |
| `npm run audit:sql` | PASS - 318 files; escaping-helper invariant intact |
| Deterministic Security Stinger scan | PASS for dependency, OpenClaw, hidden-Unicode, and reviewed universal-pattern checks; native Honeycomb SQL audit used |
| `git diff --check` | PASS - line-ending conversion warnings only |

The first complete CI attempt had one non-diff timing failure in `tests/daemon/runtime/secrets/exec.test.ts`: its timeout child was killed before emitting the expected partial-output marker. The exact test immediately passed, and the subsequent complete CI rerun passed all 5,185 tests. This is recorded as test flakiness, not an adoption security finding.

### Re-audit Counts

- New Critical: **0**
- New High: **1 fixed, 0 open**
- Initial High regression: **0**
- Total open Critical/High: **0**

---

## Final Security Ordering Confirmation - 2026-07-13

The final Quality warning cleanup in `src/commands/contracts.ts`, `src/commands/dispatch.ts`, `src/commands/local-handlers.ts`, `src/cli/runtime.ts`, and `README.md` was inspected after the cleared re-audit. The follow-up changes are command metadata, explanatory comments, and operator documentation only; they introduce no new executable path, mutation adapter, credential flow, service-manager invocation, filesystem target, network destination, or packed test mode.

All eight previously fixed High findings remain intact: exact Windows process identity, systemd value hardening, verified update/rollback, credential/control-output redaction, referral validation, dry-run preservation, fail-closed uninstall, and the narrow two-export packed conformance core. `npm run typecheck` passes; the expanded focused security/lifecycle set passes 9 files and 183 tests; the built core still exports only `VERB_TABLE` and `createDispatcher`; and `git diff --check` reports no whitespace errors.

**Final decision: PASS.** Open counts remain 0 Critical and 0 High. Security ordering is satisfied and Quality is cleared to run its final gate.

**Documentation correction confirmation (2026-07-13):** The subsequent `local-handlers.ts` comment and README start/stop wording corrections contain no executable change; typecheck and diff-check remain clean, all eight High remediations remain intact, and Quality remains cleared.

---

## Final Live-Dogfood Security Gate - 2026-07-13

### Decision and cumulative counts

**PASS.** The complete current Honeycomb diff was re-audited after the live Windows service and global-package dogfood fixes. Two new High findings were confirmed and fixed. No Critical finding was detected. Cumulative adoption-cycle counts are **0 Critical, 10 High fixed, 0 Critical/High open**. All eight earlier High remediations remain intact.

### New High findings fixed

- [x] **Non-injective Windows process-identity normalization** `src/cli/daemon-service.ts:80-151` - The dogfood fix removed every quote and collapsed whitespace before comparing WMI command lines. A deliberately different argv layout could therefore collapse to the same display string and cause an unrelated same-executable process to match cleanup. The shared PowerShell 5 decoder now validates every JSON flag as a string and constructs an anchored per-token regex. Each token permits only its conventional quoted form or Windows' observed WMI quote-fragmented form; extra, missing, reordered, differently quoted, or differently partitioned arguments fail. The JavaScript mirror uses the same anchored token posture. Adversarial regression coverage includes a distinct argv layout that the previous quote-deleting comparator accepted, plus the real PowerShell 5 probe (`tests/cli/daemon-service.test.ts:468-527`).
- [x] **Service-install could accept an unowned health responder** `src/cli/standard-ops.ts:186-194`, `src/cli/daemon-service.ts:156-165`, `src/cli/daemon-service.ts:1006-1024` - A missing controller `isRunning` seam was treated as success, and Windows checked only Scheduled Task state. A detached or unrelated responder on the Honeycomb port could therefore make installation appear healthy without proving that the installed service owned it. Missing identity/state inspection now fails closed. On Windows, success requires both the exact Scheduled Task in `Running` state and exactly one Node process matching the shared executable + flags + entry identity; only then may the health probe complete installation. Regression coverage: `tests/cli/standard-ops.test.ts:237-286`, `tests/cli/daemon-service.test.ts:565-580`.

### Reviewed dogfood changes

- PowerShell 5 `ConvertFrom-Json` scalar/array flattening is explicit; null becomes an empty flag list and every decoded item must be a string before it can enter an identity pattern.
- Windows cleanup, stop, restart, register replacement, service-install, and service-uninstall fail closed when exact descendant termination or ownership cannot be verified. Task deletion does not proceed after failed cleanup.
- Hive npm detection uses fixed `cmd.exe /d /s /c` argv with the constant `npm.cmd ls -g @legioncodeinc/hive --depth 0` command (`src/shared/fleet-detection.ts:47,187-193`).
- Cursor-agent health uses fixed `cmd.exe /d /s /c` argv with the constant `cursor-agent status` command (`src/cli/health-probes.ts:63,92-108`).
- Both Windows shim paths explicitly retain `shell:false`; a production-source scan found no `shell:true` under `src/cli`, `src/shared`, or `src/commands`. Real Windows warning probes emitted no DEP0190 warning.
- The packed conformance core remains restricted to `VERB_TABLE` and `createDispatcher`, external fixtures remain outside the tarball, and the packed test exercises the full 12-command human/JSON success/failure/usage matrix.

### Final verification

| Gate | Result |
|---|---|
| Focused adversarial/service/security set | PASS - 12 files, 231 tests |
| Real PowerShell 5 synthetic identity probe | PASS - valid fragmented WMI identity accepted; extra/reordered/ambiguous tokenization rejected |
| Real Windows npm/cursor shim warning probes | PASS - no DEP0190 warning; constant command with `shell:false` |
| Production `shell:true` scan | PASS - no matches in `src/cli`, `src/shared`, or `src/commands` |
| `npm run ci` | PASS - 477 files, 5,196 passed, 13 skipped; SQL-safety clean |
| `npm run build` | PASS - all bundles built at v0.21.0 |
| `npm run test:packed-cli` | PASS - full 12-command matrix |
| `npm run pack:check` | PASS - 71 files; forbidden patterns absent; required runtime present |
| `npm run audit:openclaw` | PASS - one bundle, no findings |
| `npm audit --audit-level=high` | PASS - 0 vulnerabilities across 624 dependencies |
| `npm run audit:sql` | PASS - 318 files; escaping-helper invariant intact |
| Deterministic Security Stinger scan | PASS - dependency, OpenClaw, hidden-Unicode, and reviewed universal-pattern checks; native Honeycomb SQL audit used |
| `git diff --check` | PASS - line-ending conversion warnings only |
| Read-only global dogfood status | PASS - v0.21.0; installed, running, healthy, registered; `schtasks`; clean JSON help/status |

No live service mutation was performed by this final Security gate. The existing global installation was inspected read-only.

**Dead-export removal confirmation (2026-07-13):** Removing the unconsumed `normalizeWindowsProcessCommandLine` export is security-neutral; runtime cleanup and ownership checks still use the anchored token-pattern scripts/probes, typecheck and 92 focused tests pass, diff-check is clean, and cumulative open Critical/High remains 0.
