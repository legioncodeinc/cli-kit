# Security Audit Report: PRD-003 Doctor CLI adoption

**Audit date:** 2026-07-13  
**Auditor:** security-worker-bee subagent  
**Branch:** `legion/prd-003-doctor-cli-standard`  
**Scope:** Every changed Doctor file plus adjacent `src/cli/service-logs.ts`, `src/rungs/command-runner.ts`, `src/service/{argv,index,platform,templates}.ts`, `src/product-uninstall.ts`, `src/safe-path.ts`, updater/version code, telemetry output, and their focused tests. Compared with PRD-003 and Hive's hardened CLI update/log patterns.  
**Node version audited:** `>=22.5.0`  
**`npm audit` result:** 0 total; 0 Critical, 0 High, 0 Moderate, 0 Low  
**OpenClaw bundle scan:** Not applicable; Doctor has no OpenClaw bundle or `audit:openclaw` script  
**CVE watchlist last refreshed:** 2026-04-24 (within 120 days)

---

## Executive Summary

Six High findings were confirmed and fixed: canonical logs could fall through to fleet incident data, canonical restart could delegate to the supervised daemon, required lifecycle commands could silently succeed without adapters, registry release metadata was not exact-semver validated, rollback could claim recovery without verifying it, and dynamic operational output could reach terminals without secret/control-character sanitization. No Critical findings were detected. All focused tests and the complete Doctor CI gate pass after remediation.

Scope note: Doctor is outside the Hivemind-specific portions of the Security Stinger catalog. Universal CLI/service risks were audited at full depth; Deep Lake SQL, captured-trace tables, Hivemind pre-tool-use gates, and OpenClaw bundle checks are not applicable.

No Doctor-cycle quality report existed before this audit, so security-before-quality ordering was preserved.

---

## Scorecard

| Category | Status | Findings |
|---|---|---:|
| Credential / Token Exposure | FAIL - fixed | 1 High |
| Cross-product Service / Log Isolation | FAIL - fixed | 2 High |
| Required-command Fail-Closed Behavior | FAIL - fixed | 1 High |
| Update Channel / Rollback Integrity | FAIL - fixed | 2 High |
| Uninstall Ownership / Confirmation | OK | 0 |
| Service Command Injection / Identity | OK | 0 |
| Dependency / Supply Chain | OK | 0 |
| Telemetry Secret Exposure | OK | 0 |

Legend: **OK** = zero findings; **ATTN** = Medium/Low finding; **FAIL - fixed** = Critical/High finding remediated in this audit.

---

## Critical Findings (fixed in this session)

None detected.

---

## High Findings (fixed in this session)

- [x] **Cross-product log disclosure / fail-open fallback** `src/cli/dispatch.ts:496-499` - When the Doctor service-log adapter was absent, canonical `doctor logs` called the fleet incident reader and could emit Hive/Honeycomb/Nectar incident data. It now fails closed with exit 1 and explicitly confirms that no other product log was read. Regression evidence: `tests/cli/dispatch.test.ts:308-326`.
- [x] **Wrong-service lifecycle delegation** `src/cli/dispatch.ts:328-331` - When Doctor lifecycle adapters were absent, canonical `doctor restart` invoked remediation rung 1, whose domain is supervised-daemon repair rather than the canonical Doctor OS service transaction. It now refuses with exit 1 and never calls the rung. Regression evidence: `tests/cli/dispatch.test.ts:298-306`.
- [x] **Silent success without required work** `src/cli/dispatch.ts:275-278`, `src/cli/dispatch.ts:296-299`, `src/cli/dispatch.ts:369-372` - Missing service, lifecycle, or full-uninstall adapters printed a stub but returned success, violating PRD-003e AC-e8 and allowing automation to believe install/start/stop/uninstall work had completed. All required adapter-missing paths now write an error and return exit 1. Regression evidence: `tests/cli/dispatch.test.ts:280-287`, `tests/cli/lifecycle-commands.test.ts:32-37`, `tests/cli/lifecycle-commands.test.ts:57-62`, `tests/cli/lifecycle-commands.test.ts:286-291`.
- [x] **Untrusted updater target construction** `src/cli/self-update.ts:41-74`, `src/cli/index.ts:288-290` - Registry metadata previously accepted any non-empty string before constructing `@legioncodeinc/doctor@<target>`. Fixed argv reduced direct injection risk, but the Windows npm fallback can use a command shell and arbitrary package-spec syntax could still redirect the approved target. Both update and check paths now accept only strict exact SemVer metadata; invalid tags/metadata fail before install. Regression evidence: `tests/cli/self-update.test.ts:84-108`, `tests/cli/self-update.test.ts:134-138`.
- [x] **False rollback recovery claim** `src/cli/self-update.ts:86-95` - A successful rollback package install was reported as rolled back after merely requesting a restart; restart success and restored health were not verified. Rollback is now reported successful only after both restart and health verification; every other outcome reports hard failure and manual repair. Regression evidence: `tests/cli/self-update.test.ts:55-82`, `tests/cli/self-update.test.ts:110-132`.
- [x] **Credential and terminal-control output exposure** `src/cli/dispatch.ts:141-143`, `src/cli/dispatch.ts:198-215`, `src/cli/dispatch.ts:235-258`, `src/cli/dispatch.ts:285-340`, `src/cli/dispatch.ts:408-514`, `src/cli/dispatch.ts:650-704` - Dynamic daemon, updater, service-manager, incident, purge, log-error, and exception strings could reach the terminal without the CLI-kit redactor. These paths now pass through `redactLogSecrets`, removing recognized credentials and ANSI/OSC/control sequences before human or JSON-envelope messages are emitted. Regression evidence: `tests/cli/dispatch.test.ts:338-344`; canonical log redaction remains covered by `tests/cli/service-logs.test.ts:7-28`.

---

## Medium Findings (follow-up required)

- [ ] **Windows npm fallback retains `shell:true`** `src/rungs/command-runner.ts:175-181` - The preferred Windows path is fixed `node npm-cli.js` argv, but the last-resort `npm.cmd` fallback invokes a shell. Exact-semver validation now prevents registry metadata from introducing shell metacharacters and all remaining updater tokens are fixed. Replace the fallback with a no-shell npm launcher in a dedicated cross-platform change.
- [ ] **Release provenance is registry trust, not artifact attestation** `src/cli/self-update.ts:68-80` - The updater resolves the approved npm channel and pins an exact SemVer, but does not independently verify an artifact signature or provenance statement. Consider npm provenance/signature verification before install as a supply-chain hardening follow-up.

---

## Low Findings

None detected.

---

## Dependency Audit

```text
Production dependencies: 2
Total dependencies: 172
Critical: 0
High: 0
Moderate: 0
Low: 0
Total advisories: 0
```

The deterministic scan scratch directory was removed after review.

---

## Surface Integrity Check

| Check | Observed | Status |
|---|---|---|
| Service manager argv | Fixed executable/argument arrays for launchd, systemd, schtasks, and sc in `src/service/argv.ts:62-211`; no dynamic arbitrary unit/task argument | OK |
| Service identity | Fixed `com.legioncode.doctor`, `doctor.service`, and `doctor` task identities; no CLI selector | OK |
| Authoritative logs | `src/cli/service-logs.ts:35-51` binds product/service IDs and `<Doctor workspace>/service.log`; cli-kit validates lexical and realpath containment, redacts secrets, and closes watchers on abort | OK |
| Cross-product log isolation | Missing adapter now fails; no fallback to `tailIncidents` | OK |
| Ctrl+C cleanup | `src/cli/dispatch.ts:508-520` installs one SIGINT listener and removes it in `finally`; abort resolves follow mode successfully | OK |
| Uninstall confirmation | `src/cli/dispatch.ts:633-645` refuses non-interactive/JSON removal without `--yes` and prompts interactively | OK |
| Uninstall ownership | `src/product-uninstall.ts:57-63`, `src/product-uninstall.ts:130-145` resolves fixed `doctor` under APIARY root, rejects catastrophic wipe targets, and removes only Doctor's registry entry | OK |
| Update target | Approved registry response must parse as exact SemVer before package-spec construction | OK |
| Update rollback | Rollback package install, restart, and restored service health must all succeed before recovery is claimed | OK |
| Telemetry output | Bare telemetry reports opt-out key names/destination class only; no key values, tokens, or credentials | OK |
| Hidden Unicode | Deterministic scan clean | OK |
| Deep Lake SQL / captured trace / prompt injection | Surface absent from Doctor | N/A |
| OpenClaw bundle | Surface absent from Doctor | N/A |

---

## Files Changed by Security Remediation

| File | Change Summary |
|---|---|
| `src/cli/dispatch.ts` | Fail-closed service/log/restart/uninstall behavior; removed cross-product fallbacks; sanitized dynamic operational output |
| `src/cli/self-update.ts` | Strict exact-semver release parsing and verified rollback recovery |
| `src/cli/index.ts` | Applied the same exact-semver gate to update-check registry output |
| `tests/cli/dispatch.test.ts` | Added wrong-service, log-isolation, adapter-failure, secret-redaction, and terminal-control regressions |
| `tests/cli/lifecycle-commands.test.ts` | Updated required lifecycle adapter-missing expectations to exit 1/stderr |
| `tests/cli/self-update.test.ts` | Added malicious/non-semver metadata and rollback recovery verification regressions |
| `tests/cli/helpers/fake-cli.ts` | Added injectable Doctor-only service-log test seam |

`git diff --check` passed. The full working diff was reviewed; unrelated/pre-existing PRD-003 adoption work was preserved.

---

## Verification

```text
npm test -- --run tests/cli/dispatch.test.ts tests/cli/lifecycle-commands.test.ts tests/cli/self-update.test.ts tests/cli/service-logs.test.ts tests/cli/standard-interface.test.ts
PASS: 5 files, 70 tests

npm run ci
PASS: tsc --noEmit
PASS: 71 files, 852 tests

npm audit --json --audit-level=high
PASS: 0 vulnerabilities

git diff --check
PASS
```

The Node test run emitted only the repository's known experimental `node:sqlite` warnings; they did not affect results.

---

## Residual Risks / Blockers

- Native Windows, macOS, and Linux service-manager integration was not executed locally. Unit tests cover exact per-platform argv/templates, but PRD-003e AC-e6 still requires native CI evidence.
- Packed-artifact and suite-level four-product conformance remain outside this Doctor-only security pass.
- Quality-worker-bee must run after these security fixes; no quality acceptance criterion is marked verified by this report.
- The Windows `npm.cmd` shell fallback and independent package provenance verification are the two documented follow-ups above; exact-semver validation closes the release-metadata injection path audited here.

---

## 2026-07-13 Post-QA Remediation Re-audit

Security was rerun after the post-QA Doctor changes and before QA was rerun. This preserves the required security-before-quality ordering for the new remediation cycle.

### Current Counts

```text
Critical open: 0
High open: 0
Medium open: 2 (unchanged follow-ups)
Low open: 0
High fixed in this re-audit: 1
High fixed across the Doctor security audits: 7
```

### High Finding Fixed

- [x] **Unauthenticated shipped packed-test mode bypassed real work** `src/cli/index.ts`, `src/cli/bin.ts`, `scripts/verify-packed-cli.mjs` - The post-QA implementation shipped an environment-selected `DOCTOR_PACKED_TEST_MODE` context that returned synthetic success for install, uninstall, service lifecycle, update, status, logs, and telemetry, and also prevented `doctor run` from starting the real watchdog. Any caller able to set the process environment could make the installed CLI report success without doing the required work or could suppress supervision. The production context selector and watchdog bypass were removed completely. The packed executable now always routes direct invocation through production assembly. Packed conformance imports the installed bundle's exported pure dispatcher and supplies a hermetic external fixture explicitly; no environment variable can select that fixture. The verifier also rejects any packed bundle containing a `DOCTOR_PACKED_` control token.

### Re-audited Post-QA Surfaces

| Surface | Result | Evidence |
|---|---|---|
| Argument schemas and output | OK | Validation runs before command routing and rejects positional arguments, unknown flags, values on boolean flags, missing values, and invalid log/incident line counts with usage exit 2. Dynamic handler and JSON error output remains redacted. |
| Service reconciliation | OK | Install reconciliation tolerates only fixed, recognized already-absent/already-present manager results. Start/stop/restart still require Doctor-specific adapters and confirm the resulting state; failures remain non-zero. |
| launchd lifecycle | OK | Install uses fixed-label `bootout` then `bootstrap` and `kickstart`; stop uses fixed-label `bootout`; start bootstraps the retained Doctor plist then kickstarts it. No caller-controlled service identity reaches argv. |
| Packed verifier | OK | Spawned executable probes are limited to non-mutating help/version/usage and Doctor-owned log reads. Mutation success/failure matrices call the dispatcher from the installed tarball with an in-process fixture. |
| Native adapter fixture | OK | `tests/service/native-adapter.integration.test.ts` injects a recording command runner and in-memory filesystem on every path. It never constructs or invokes the production runner and cannot call host service managers. |
| Prior six High remediations | OK | Canonical log isolation, restart domain isolation, adapter fail-closed behavior, exact-SemVer update targets, verified rollback recovery, and output secret/control-character redaction all remain present and covered. |

### Re-audit Verification

```text
security-stinger deterministic scan
PASS: npm audit 0 vulnerabilities; Unicode clean; no applicable OpenClaw or SQL surface

npx vitest run tests/cli/standard-interface.test.ts tests/cli/dispatch.test.ts tests/service/argv.test.ts tests/service/service-module.test.ts tests/service/native-adapter.integration.test.ts
PASS: 5 files, 109 tests

npm run test:packed-cli
PASS: fresh build, tarball install, packed direct-boundary probes, hermetic mutation success/failure matrices

npm run pack:check
PASS: 5 files, no forbidden patterns, no source leak, bin present

npm run ci
PASS: tsc --noEmit
PASS: 72 files, 871 tests

git diff --check
PASS
```

The two previously documented Medium follow-ups are unchanged. No new Critical, Medium, or Low findings were introduced by the post-QA remediation changes.

---

## 2026-07-13 Live Device Dogfood Re-audit

Live installation and native Windows Scheduled Task lifecycle execution found and remediated two additional High-severity availability defects before handoff.

### Dogfood Findings Fixed

- [x] **Scheduled Task stop/restart orphaned Doctor's Node child** - `schtasks /End` stopped the `conhost --headless` wrapper but left the Doctor Node process alive. A restart then launched a second process, which failed with `EADDRINUSE` because the orphan still owned port 3852. Windows install, start, stop, and uninstall now invoke a fixed PowerShell command through `execFile` that matches the normalized Node executable, exact base64-transported Doctor bundle path, and `run` verb before terminating only that process. The CLI no longer treats Task Scheduler's `Ready` state as proof that cleanup is unnecessary.
- [x] **Termination signal could be lost during asynchronous watchdog startup** - SIGTERM/SIGINT handlers were attached only after migrations, dynamic composition import, and `doctor.start()`. A stop arriving during startup was lost and the watchdog remained alive. The signal promise is now armed before the first asynchronous startup step and listeners are removed deterministically.

### Live Security Evidence

```text
stop: PID 68108 -> no Doctor process; task Ready; port 3852 unowned
start: no process -> PID 11328; task Running; port 3852 owned by PID 11328
restart: PID 11328 -> PID 136200; exactly one process; port owner PID 136200
service-install reconciliation: PID 136200 -> PID 121220; exactly one process
service-uninstall: PID 121220 -> no process; task absent; port unowned
install restore: no process -> PID 140548; task Running; port owner PID 140548
```

The cleanup command contains no caller-controlled script interpolation, uses fixed executable/argv boundaries, and transports paths as UTF-16LE/base64 values. Live matching terminated only the exact installed Doctor `node .../doctor/bundle/cli.js run` process.

### Final Dogfood Gate State

```text
Critical open: 0
High open: 0
High fixed in live dogfood: 2
High fixed across Doctor security and dogfood cycles: 9
npm run ci: PASS - 72 files, 871 tests
npm run build: PASS
npm run test:packed-cli: PASS
npm run pack:check: PASS - 5 files, no forbidden patterns/source leak
npm audit --audit-level=high: PASS - 0 vulnerabilities
git diff --check: PASS
```

The two previously documented Medium follow-ups remain unchanged.
