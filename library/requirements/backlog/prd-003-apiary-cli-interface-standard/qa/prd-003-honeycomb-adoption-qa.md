# QA Report: PRD-003 Honeycomb CLI adoption

**Plan document:** `library/requirements/backlog/prd-003-apiary-cli-interface-standard/` (`index` plus PRD-003a through PRD-003e)  
**Audit date:** 2026-07-13  
**Base branch:** `main`  
**Head:** `legion/prd-003-honeycomb-cli-standard` (dirty working tree; implementation and security remediations are uncommitted)  
**Auditor:** quality-worker-bee

## Summary

**Grade: D / BLOCKED.** Honeycomb exposes the full visible command surface, preserves all 37 pre-adoption product commands, passes focused/full tests and packaging gates, and cleared the preceding security audit, but four Critical implementation/proof gaps block acceptance: standard lifecycle verbs still auto-register or detached-spawn instead of controlling an already-installed service, `install` reports success after required onboarding/registration failures, spawn-mode service removal can leave a registered service behind while deleting its state, and the packed verifier does not execute the full baseline matrix. Three Warnings cover false `unregistered` status on registry-inspection failure, premature uninstall telemetry, and incomplete observability goldens; the three native/suite/release proof rows remain external close-out work rather than Honeycomb defects.

Acceptance accounting over the 53 parent and Honeycomb-applicable rows is **39 Pass, 9 Fail, 2 Partial, and 3 External Proof**. Finding accounting is **4 Critical, 3 Warning, 0 Suggestion**.

## Scorecard

| Category | Status | Notes |
|---|---|---|
| Completeness | ❌ | Binding lifecycle/install semantics and the full packed matrix are incomplete |
| Correctness | ❌ | Missing-service lifecycle, install failure, registry inspection, and spawn-mode removal can report the wrong state/result |
| Alignment | ❌ | Baseline service verbs reuse Honeycomb's legacy service-preferred/spawn-fallback daemon lifecycle instead of the PRD-003 service-only boundary |
| Gaps | ⚠️ | Unhealthy and complete human/JSON observability goldens are absent |
| Detrimental | ⚠️ | Failed full uninstall can still emit the one-time `honeycomb_uninstalled` event |

## Critical Issues (must fix)

- [ ] **Baseline lifecycle and update bypass the installed-service boundary (AC-2, AC-b1, AC-b3, AC-b4, AC-b7)**, `src/commands/standard-interface.ts:63-106`, `src/cli/runtime.ts:387-410`, `src/cli/runtime.ts:468-485`

  `start`, `stop`, and `restart` call the legacy `DaemonLifecycle` without first requiring an installed OS service. That lifecycle registers a service as part of `start`, falls back to a detached process when no manager is available, and makes `restart` detached-spawn after a service-manager failure; `updateHoneycomb` accepts any `restarted: true` result and can therefore report a healthy update even when the installed service failed and supervision was lost. PRD-003b requires `start` to fail with guidance to `service-install`, lifecycle verbs to control the installed service, and service-manager/runtime failures to exit `1` rather than silently change execution mode.

  Suggested: add a service-only lifecycle adapter for baseline verbs that probes installation, never registers or spawns, and fails closed on manager errors; retain the legacy `daemon` product command for explicit detached compatibility. Require update restart verification to prove the service-backed path when a service is installed.

  ```ts
  if (command === "start") {
    const result = await lifecycle.start();
    return result.started || result.alreadyRunning
      ? { ok: true, changed: result.started, message: /* ... */ }
      : { ok: false, message: /* ... */ };
  }
  ```

- [ ] **`install` reports ready and exits `0` when required onboarding or Doctor registration fails (AC-b1, AC-e8)**, `src/commands/install.ts:523-529`, `src/commands/install.ts:565-607`, `tests/commands/install.test.ts:570-587`

  The onboarding marker and Doctor registry entry are required phases of the PRD-003 `install` transaction, but both writers are deliberately fail-soft and their results are ignored. The implementation prints `Honeycomb is ready`, emits the installed event, and returns `0` even when registration cannot be written; the regression test explicitly locks in that non-conformant success. This breaks the required registration boundary and leaves Doctor unable to supervise an installation that automation was told succeeded.

  Suggested: make required phase failures return runtime exit `1` with phase-specific human/JSON results, do not emit `honeycomb_installed`, and preserve enough state for an idempotent retry. Optional dashboard/harness conveniences may remain fail-soft.

  ```ts
  const wrote = writeInstalledMarker(ref, deps.dir, out);
  if (wrote) out(`✓ onboarding marked installed (ref: ${ref}).`);
  writeDoctorRegistryEntry(deps.dir, out);
  // ... later: "✓ Honeycomb is ready." and exitCode: 0
  ```

- [ ] **Spawn-mode detection can skip a real service and continue destructive uninstall (AC-b3, AC-b5, AC-e8)**, `src/cli/daemon-service.ts:137-145`, `src/cli/standard-ops.ts:196-208`, `src/cli/runtime.ts:618-635`

  `detectServiceManager()` returns `null` whenever `HONEYCOMB_DAEMON_SERVICE=spawn`. `service-uninstall` then claims the service is already absent, while full uninstall treats the service-removal phase as a successful no-op and proceeds to delete Doctor registration and product state. An existing Scheduled Task/LaunchAgent/unit can survive and later restart against deleted state; on Linux, a session without the positive user-bus heuristic has the same false-absence behavior.

  Suggested: separate runtime launch preference from platform service-manager selection. Explicit service operations and destructive uninstall should select the platform adapter independently, inspect the known Honeycomb identity, and fail closed when inspection/removal is unavailable.

  ```ts
  const manager = detectServiceManager();
  if (manager === null) return { removed: false };
  // full uninstall treats this as "no OS service unit to remove" and continues
  ```

- [ ] **Packed CLI conformance is help/version/status-only, not the full shared matrix (AC-6, AC-e1)**, `scripts/packed-cli-conformance.mjs:33-73`

  The installed tarball is real, but the verifier executes only `--help`, `--version`, JSON help, and JSON status. The remaining baseline verbs are merely searched as substrings in help, so a dead or misrouted `start`, `stop`, `restart`, `install`, `uninstall`, service operation, `update`, `register`, `logs`, or `telemetry` handler can ship while `packed-cli-conformance OK` remains green. The two lifecycle Criticals above demonstrate why help presence is not execution proof.

  Suggested: run the installed artifact through the shared manifest validator and a hermetic external fixture covering every baseline command's success, failure, malformed-usage, JSON, and source-isolation paths; include a pre/post product-command inventory.

  ```js
  const status = JSON.parse(run(["status", "--json"]));
  if (status.product !== "honeycomb" || status.command !== "status" || status.ok !== true)
    throw new Error("packed JSON status contract failed");
  console.log("packed-cli-conformance OK");
  ```

## Warnings (should fix)

- [ ] **Registry inspection failures are reported as a successful `unregistered` state (AC-c1)**, `src/cli/standard-ops.ts:154-162`, `src/commands/standard-interface.ts:109-133`

  `registrationExists()` converts malformed JSON, permission errors, and other read failures into `false`. `status` then exits `0` and reports `unregistered` instead of `unknown` or runtime exit `1`, even though the required registry state could not be inspected. Suggested: return a tri-state result or propagate inspection errors so status can distinguish absence from inability to inspect.

  ```ts
  try {
    const parsed = registrySchema.parse(JSON.parse(readFileSync(path, "utf8")));
    return parsed.daemons.some((entry) => entry.name === HONEYCOMB_REGISTRY_NAME);
  } catch {
    return false;
  }
  ```

- [ ] **Full uninstall emits `honeycomb_uninstalled` before the fail-closed transaction succeeds**, `src/commands/local-handlers.ts:123-154`

  The one-time uninstall event is fired before stop, service removal, registry deletion, state removal, and connector reversal. Any prerequisite failure returns exit `1` after telemetry has already recorded a successful uninstall, so the glass-box/dedupe ledger can permanently disagree with device state. Suggested: emit only after all required phases return success; keep emission fire-and-forget after that commit point.

  ```ts
  if (isFullUninstall) {
    void emitTelemetry("honeycomb_uninstalled", { ref, tier: "tier1" }, /* ... */);
  }
  // lifecycle failure below returns exit 1
  ```

- [ ] **Observability goldens do not cover the required state/output matrix (AC-c9)**, `tests/commands/standard-interface.test.ts:251-320`

  The new suite covers healthy human status, one stopped/not-installed JSON case, missing-log JSON, and enabled/opted-out telemetry JSON. It does not cover unhealthy status or every named state in both human and JSON modes, and it contains no exact golden/snapshot for those outputs. Suggested: add deterministic human and JSON goldens for running, stopped, not-installed, unhealthy, missing-log, telemetry-enabled, and telemetry-opted-out cases.

  ```ts
  expect(JSON.parse(base.lines[0] ?? "")).toMatchObject({
    installation: "not-installed",
    process: { state: "stopped" },
    health: { state: "unknown" },
  });
  ```

## Suggestions (consider improving)

None.

## Plan Item Traceability

Legend: ✅ Pass; ❌ Fail (Honeycomb defect); ⚠️ Partial (Honeycomb test/correctness warning); 🟦 External Proof (native/suite/release evidence outside this implementation).

| # | Plan Requirement | Status | Implementation Location | Notes |
|---|---|---:|---|---|
| AC-1 | Honeycomb exposes every required command | ✅ | `src/commands/contracts.ts:204-237`; `src/commands/dispatch.ts:378-424` | 12 operational verbs present; 37 prior product verbs retained |
| AC-2 | Same operator meaning, success, exit class, and placement | ❌ | `src/commands/standard-interface.ts:63-106`; `src/cli/runtime.ts:387-410` | Standard lifecycle can register/spawn instead of requiring installed service |
| AC-3 | Bare/help banner anatomy and exact credit | ✅ | `src/commands/dispatch.ts:98-153,448-469` | Product art, uppercase name, descriptor, version, credit, groups |
| AC-4 | Logs tail only invoking product | ✅ | `src/commands/standard-interface.ts:136-174` | Fixed Honeycomb service/log identity; path selector rejected |
| AC-5 | Honeycomb registers with Doctor | ✅ | `src/cli/standard-ops.ts:210-221`; `src/commands/install.ts:527-529` | Explicit register is idempotent; install failure handling is separately failed under AC-b1 |
| AC-6 | Minimum matrix conformance | ❌ | `scripts/packed-cli-conformance.mjs:33-73` | Installed artifact verifier executes only help/version/status |
| AC-7 | Existing product commands remain separate | ✅ | `src/commands/dispatch.ts:127-153`; `src/commands/contracts.ts:104-237` | Pre/post inventory: 37 -> 42, zero removed |
| AC-8 | Consistent human output and clean JSON | ✅ | `src/commands/dispatch.ts:215-254,436-499`; `src/commands/standard-interface.ts:39-60` | Common redaction/envelope boundary; focused tests pass |
| AC-a1 | Typed shared baseline manifest | ✅ | cli-kit `src/command-contract.ts:21-37`; Honeycomb `package.json:125-134` | Shared prerequisite consumed from `@legioncodeinc/cli-kit` |
| AC-a2 | Help composed from shared plus product manifest | ✅ | `src/commands/dispatch.ts:126-153` | Baseline supplied by cli-kit; product rows derived from `VERB_TABLE` |
| AC-a3 | Canonical service spellings | ✅ | `src/commands/contracts.ts:217-218`; `src/commands/dispatch.ts:401-404` | Honeycomb had no renamed historical service aliases |
| AC-a4 | Exit `0/1/2` contract | ✅ | `src/commands/dispatch.ts:247-254,482-495`; `src/commands/standard-interface.ts:184-256` | Focused usage/runtime/idempotence tests pass |
| AC-a5 | Stable JSON envelope for baseline commands | ✅ | `src/commands/standard-interface.ts:39-60`; `src/commands/dispatch.ts:215-254` | Product/command/ok/message protected from detail override |
| AC-a6 | Exactly one clean JSON document | ✅ | `src/commands/dispatch.ts:215-254`; `tests/commands/standard-interface.test.ts:143-177` | Captures/sanitizes handler output; no banner/ANSI/prompt |
| AC-a7 | Product commands remain dispatchable and separately grouped | ✅ | `src/commands/dispatch.ts:141-153,472-499` | No prior command removed |
| AC-a8 | Shared manifest conformance validator | ✅ | cli-kit `src/command-contract.ts:74-96`; cli-kit `tests/command-contract.test.ts:1-39` | Shared prerequisite validated with deliberate drift fixtures |
| AC-a9 | Core invocation/output golden coverage | ✅ | `tests/commands/dispatch.test.ts:41-288`; `tests/commands/standard-interface.test.ts:85-249` | Bare/help/version/unknown plus human/JSON success/failure represented; c9-specific matrix remains partial |
| AC-b1 | Binding lifecycle/install/update semantics | ❌ | `src/commands/standard-interface.ts:63-106`; `src/commands/install.ts:523-529` | Lifecycle bypass and fail-soft required install phases |
| AC-b2 | Honeycomb implements register | ✅ | `src/commands/standard-interface.ts:214-223`; `src/cli/standard-ops.ts:210-221` | Doctor exemption is outside Honeycomb adapter |
| AC-b3 | Idempotent start/stop/service/register | ❌ | `src/cli/runtime.ts:387-410`; `src/cli/standard-ops.ts:196-208` | Repeated calls are generally idempotent, but missing-service/spawn-mode semantics are wrong |
| AC-b4 | Restart waits for running/healthy | ❌ | `src/cli/runtime.ts:468-485`; `src/commands/standard-interface.ts:97-106` | Bounded health exists but manager failure silently changes to detached mode |
| AC-b5 | Service-only and full uninstall boundaries | ❌ | `src/cli/standard-ops.ts:196-208`; `src/cli/runtime.ts:618-653` | Spawn-mode can skip the service and full uninstall continues destructively |
| AC-b6 | Never remove shared/other-product state | ✅ | `src/cli/runtime.ts:637-653`; `src/daemon/runtime/telemetry/fleet-registry.ts` | Honeycomb entry/path only; symlink and ENOENT behavior covered |
| AC-b7 | Safe update with versions/health/rollback | ❌ | `src/cli/standard-ops.ts:84-151` | Version and rollback proof exist, but restart may silently use detached fallback |
| AC-b8 | Fixed argv service adapters on three OSes | ✅ | `src/cli/daemon-service.ts:154-904`; `tests/cli/daemon-service.test.ts:1-415` | Security-remediated fixed argv and rendering tests pass |
| AC-b9 | Service stdout/stderr use authoritative log | ✅ | `src/cli/runtime.ts:246-261`; `src/cli/daemon-service.ts:350-381,530-570` | One Honeycomb service log consumed by `logs` |
| AC-b10 | Migration notes for renamed aliases | ✅ | `CHANGELOG.md:3-12`; `README.md:161-190` | Explicitly states no Honeycomb rename and preserves `daemon` compatibility |
| AC-c1 | Ordered status and equivalent JSON | ⚠️ | `src/commands/standard-interface.ts:109-133,235-250`; `src/cli/standard-ops.ts:154-162` | Field order passes; registry inspection failure is misreported as absent |
| AC-c2 | Logs defaults/options | ✅ | `src/commands/standard-interface.ts:136-174`; `tests/commands/standard-interface.test.ts:166-234` | Last 100 + follow, lines/no-follow/since |
| AC-c3 | Product-bound service/log identity | ✅ | `src/commands/standard-interface.ts:143-159` | Constants are `honeycomb`; source cannot be overridden |
| AC-c4 | Cross-product log isolation tests | ✅ | `tests/commands/standard-interface.test.ts:210-218` | Sibling path selector rejected with usage exit 2 |
| AC-c5 | Log credential redaction | ✅ | `src/commands/standard-interface.ts:160-169`; `tests/commands/standard-interface.test.ts:166-177` | Stored file unchanged; emitted content redacted |
| AC-c6 | Ctrl+C and log errors | ✅ | `src/commands/standard-interface.ts:149-173`; `tests/commands/standard-interface.test.ts:191-226` | Abort exits 0; missing source exits 1 |
| AC-c7 | Read-only telemetry summary | ✅ | `src/commands/telemetry.ts:56-107` | State, setting, destination, queue, last send, opt-out; no network/service mutation |
| AC-c8 | Status/logs/telemetry have no lifecycle side effect | ✅ | `src/commands/standard-interface.ts:109-174`; `src/commands/telemetry.ts:56-107` | Status test records zero starts |
| AC-c9 | Human/JSON observability goldens for all states | ⚠️ | `tests/commands/standard-interface.test.ts:251-320` | Unhealthy and complete dual-mode matrix absent |
| AC-d1 | Distinct Honeycomb ASCII art at 80 columns | ✅ | `src/commands/dispatch.ts:98-117`; `tests/commands/dispatch.test.ts:244-256` | ASCII-only honeycomb motif retained |
| AC-d2 | Complete bare/help anatomy | ✅ | `src/commands/dispatch.ts:126-153,448-469` | All required elements and groups present |
| AC-d3 | Honeycomb motif retained as reference | ✅ | `src/commands/dispatch.ts:104-117` | Recognizable cell motif |
| AC-d4 | Pure side-effect-free help | ✅ | `src/commands/dispatch.ts:126-153,448-469`; `tests/commands/dispatch.test.ts:233-242` | Runs with no operational adapters |
| AC-d5 | No ANSI under no-color/non-TTY | ✅ | `src/commands/dispatch.ts:448`; `tests/commands/dispatch.test.ts:244-249` | Plain content preserved |
| AC-d6 | No banner/credit in JSON | ✅ | `src/commands/dispatch.ts:464-468`; `tests/commands/standard-interface.test.ts:153-163` | Clean envelope only |
| AC-d7 | Exact package-derived human version | ✅ | `src/commands/dispatch.ts:440-446`; `src/shared/constants.ts`; `scripts/packed-cli-conformance.mjs:62-63` | `honeycomb v0.21.0\n` |
| AC-d8 | Version JSON envelope | ✅ | `src/commands/dispatch.ts:440-446`; `scripts/packed-cli-conformance.mjs:64-66` | Product/version/ok validated from packed artifact |
| AC-d9 | Banner/help/version width and color goldens | ✅ | `tests/commands/dispatch.test.ts:233-288`; `scripts/packed-cli-conformance.mjs:38-69` | Bare/help equivalence, narrow rendering, art, group and packed version checks |
| AC-d10 | Exact credit | ✅ | `src/commands/dispatch.ts:112-117`; `tests/commands/dispatch.test.ts:244-248` | Exact `Legion Code Inc. x Activeloop` |
| AC-e1 | Packed Honeycomb full matrix and retained inventory | ❌ | `scripts/packed-cli-conformance.mjs:33-73`; `src/commands/contracts.ts:104-237` | Inventory passes; installed-artifact execution matrix is shallow |
| AC-e5 | Repository changelog/migration note | ✅ | `CHANGELOG.md:3-12`; `README.md:161-190` | Added commands, semantics, automation exits/output documented |
| AC-e6 | Native service CI on Windows/macOS/Linux | 🟦 | `.github/workflows/ci.yaml:91-199` | Jobs run unit/fake adapter coverage; privileged native install/control/reboot proof remains external |
| AC-e7 | Four-product packed suite job | 🟦 | cli-kit `library/ledger/EXECUTION_LEDGER.md:106` | Requires all four independently packed adopted products |
| AC-e8 | No stubs/wrong-source/silent success | ❌ | `src/commands/install.ts:523-607`; `src/cli/runtime.ts:387-410,618-635` | Required install/service work can be skipped while reporting success |
| AC-e9 | Suite matrix link plus product details | ✅ | `README.md:182-190` | Links normative cli-kit matrix and keeps Honeycomb notes local |
| AC-e10 | All four adoption releases published | 🟦 | cli-kit `library/ledger/EXECUTION_LEDGER.md:106,183` | Release evidence is fleet close-out work |

## Verification Evidence

| Command | Result |
|---|---|
| Security report ordering check | PASS — preceding report cleared 7 fixed High findings and no open Critical/High |
| `npm run ci` (first independent run) | FAIL — 5,163 passed; two unrelated timing-sensitive tests failed (`assemble.test.ts` timeout and `secrets/exec.test.ts` partial-output timing) |
| `npm test -- --run tests/daemon/runtime/assemble.test.ts tests/daemon/runtime/secrets/exec.test.ts` | PASS — 2 files / 58 tests |
| `npm run test` (full rerun) | PASS — 477 files / 5,165 tests, 13 skipped |
| Focused PRD-003/security regression set | PASS — 10 files / 171 tests |
| `npm run build` | PASS — daemon, 5 hooks, OpenClaw, 2 MCP, 4 SDK, CLI, and embed daemon bundles at 0.21.0 |
| `npm run test:packed-cli` | PASS for its implemented scope — installed tarball reported `packed-cli-conformance OK`; scope is a Critical gap |
| `npm run pack:check` | PASS — 70 files, no forbidden patterns, required runtime/plugin components present |
| `npm run audit:sql` | PASS — 318 source files; all interpolation through escaping helpers |
| `npm run audit:openclaw` | PASS — one bundle, no findings |
| `npm audit --audit-level=high` | PASS — 0 vulnerabilities |
| `git diff --check` | PASS — line-ending conversion warnings only |
| Pre/post command inventory | PASS — 37 prior verbs, 42 current verbs, 0 removed; five additions are `logs`, `register`, `restart`, `service-install`, `service-uninstall` |

The isolated full-suite failures did not reproduce in either the exact rerun or the subsequent full run and do not map to this adoption diff. They are recorded for reproducibility but are not classified as implementation findings.

## External Close-Out Blockers

1. **AC-e6:** run privileged native install/start/stop/restart/service-uninstall and reboot-survival proof on Windows, macOS, and Linux. The configured jobs currently exercise fixed-argv/unit paths, not real per-user service mutation and reboot persistence.
2. **AC-e7:** install and exercise all four packed products together for command/help/banner/version/JSON/log-source isolation.
3. **AC-e10:** publish the adoption releases after all product and suite gates pass.

These are not included in the 4 Critical / 3 Warning Honeycomb finding count.

## Files Changed

- `.github/workflows/ci.yaml` (M), adds packed CLI checks and a macOS service-adapter job
- `CHANGELOG.md` (M), records Honeycomb's PRD-003 command and automation migration
- `README.md` (M), documents the canonical Honeycomb operational surface and suite-matrix link
- `package-lock.json` (M), locks the cli-kit dependency/update
- `package.json` (M), adds cli-kit and the packed conformance script
- `scripts/packed-cli-conformance.mjs` (A), packs/installs Honeycomb and checks help/version/status; contains the incomplete matrix Critical
- `src/cli/daemon-service.ts` (M), adds authoritative log routing and security-hardened service/process rendering
- `src/cli/runtime.ts` (M), assembles standard operations and full uninstall steps; contains lifecycle/removal findings
- `src/cli/standard-ops.ts` (A), implements service, registry, update, status probes and rollback
- `src/commands/contracts.ts` (M), adds five missing canonical verbs and the no-color flag
- `src/commands/dispatch.ts` (M), adopts shared branding/manifests, strict parsing, JSON capture, and standard routing
- `src/commands/index.ts` (M), adjusts command exports for the adoption
- `src/commands/local-handlers.ts` (M), makes full uninstall fail closed; contains premature uninstall telemetry
- `src/commands/standard-interface.ts` (A), implements lifecycle/status/logs/service/register/update adapters and envelopes
- `src/commands/telemetry.ts` (M), adds the common read-only telemetry summary and strict usage handling
- `src/daemon/runtime/telemetry/emit.ts` (M), validates persisted referral values before telemetry egress
- `tests/cli/daemon-service-pinning.test.ts` (M), updates Windows exact-process pinning coverage
- `tests/cli/daemon-service.test.ts` (M), adds service log/escaping/process cleanup regression coverage
- `tests/cli/standard-ops.test.ts` (A), tests fixed npm resolution and update verification/rollback
- `tests/commands/dispatch.test.ts` (M), adds branding, strict parser, referral, and product-command preservation checks
- `tests/commands/lifecycle-verbs.test.ts` (M), adds fail-closed full-uninstall coverage
- `tests/commands/standard-interface.test.ts` (A), tests baseline JSON, logs, status, telemetry, and usage behavior; contains the c9 matrix gap
- `tests/daemon/runtime/telemetry/emit.test.ts` (M), adds invalid persisted-referral egress coverage

---

# Final Re-Grade — 2026-07-13

**Grade: A- / PASS WITH WARNING.** All seven functional findings from the initial audit are closed. Honeycomb now satisfies every one of the 50 locally provable parent and Honeycomb-applicable PRD-003 rows. The remaining three rows are true fleet/release external proof obligations, not Honeycomb implementation defects. One non-runtime Warning remains because changed command metadata and comments still describe the superseded daemon-alias/best-effort behavior.

Final acceptance accounting over all **53** applicable rows is **50 Pass, 0 Fail, 0 Partial, and 3 External Proof**. Final finding accounting is **0 Critical, 1 Warning, 0 Suggestion**. The post-remediation Security re-audit reports **0 open Critical/High**.

## Final Scorecard

| Category | Status | Notes |
|---|---|---|
| Completeness | PASS | All 12 baseline commands, all 37 retained product commands, and all 14 AC-c9 goldens are present |
| Correctness | PASS | Service-only lifecycle, fail-closed transactions, registry error propagation, telemetry commit ordering, update verification, and packed execution all pass |
| Alignment | WARNING | Runtime behavior matches PRD-003, but three legacy metadata/comment statements still describe the old behavior |
| Gaps | PASS | No local implementation or test-proof gap remains |
| Detrimental | PASS | No stub, wrong-source, silent-success, or broad packed-core export defect remains |

## Remaining Warning

- [ ] **Changed command metadata/comments contradict the remediated lifecycle and uninstall contract**, `src/commands/contracts.ts:213-214`, `src/commands/dispatch.ts:412-414`, `src/commands/local-handlers.ts:132-135`

  The implementation correctly makes canonical `start`/`stop` service-only and full uninstall fail closed, but `VERB_TABLE` still calls the two verbs aliases of `daemon start`/`daemon stop`, the dispatcher comment says they front the same `DaemonLifecycle` paths, and the uninstall comment says each phase is best-effort. These statements are no longer user-facing runtime defects, but they are misleading maintenance guidance on exactly the boundaries that previously caused Critical findings. Update them to describe installed-service-only canonical verbs, retained explicit `daemon` compatibility, and ordered fail-closed uninstall phases.

## Prior Finding Disposition

| Initial Finding | Final Status | Re-grade Evidence |
|---|---:|---|
| Critical: lifecycle/update bypass installed-service boundary | CLOSED | `src/cli/standard-ops.ts` requires an installed service; missing-service tests prove no registration or detached fallback; restart/update are service-backed and health-gated |
| Critical: install succeeds after required onboarding/Doctor failure | CLOSED | `src/commands/install.ts` returns `1` before ready/telemetry; injected persistence and Doctor-registration failure tests pass |
| Critical: spawn preference skips real service removal | CLOSED | explicit service/full-uninstall paths select the platform manager independently; spawn-mode and unavailable-manager fail-closed tests pass |
| Critical: packed verifier is shallow | CLOSED | installed tarball executes every baseline verb in human/JSON success, runtime-failure, and malformed-usage modes |
| Warning: registry parse/read errors become `unregistered` | CLOSED | absence alone returns false; malformed registry state propagates as runtime failure |
| Warning: uninstall telemetry emits before commit | CLOSED | telemetry runs only after required lifecycle and connector phases succeed; failure-order tests pass |
| Warning: AC-c9 observability goldens incomplete | CLOSED | 14 exact snapshots cover four status states, missing logs, and both telemetry states in human and JSON modes |

## Final Acceptance Matrix

Legend: PASS = locally satisfied and verified; EXTERNAL = real fleet/release proof outside this Honeycomb working tree.

| # | Requirement | Final | Evidence |
|---|---|---:|---|
| AC-1 | Required command surface | PASS | 12 baseline verbs exposed; packed inventory also retains all 37 prior product commands |
| AC-2 | Common operator meaning and exits | PASS | service-only standard adapter plus packed human/JSON success/failure/usage matrix |
| AC-3 | Banner anatomy and credit | PASS | product art, uppercase HONEYCOMB, version, descriptor, groups, exact credit |
| AC-4 | Product-bound log tailing | PASS | fixed Honeycomb log identity; selector override rejected |
| AC-5 | Doctor registration | PASS | explicit idempotent registration and fail-closed install phase |
| AC-6 | Minimum conformance matrix | PASS | full installed-artifact 12-command matrix |
| AC-7 | Existing commands remain separate | PASS | verifier asserts all 37 retained product commands |
| AC-8 | Human/JSON output consistency | PASS | stable envelope, sanitization, and focused golden coverage |
| AC-a1 | Typed shared baseline manifest | PASS | cli-kit manifest consumed by Honeycomb |
| AC-a2 | Shared plus product help composition | PASS | baseline shared; product rows retained and grouped |
| AC-a3 | Canonical service spellings | PASS | canonical service-install/service-uninstall routed |
| AC-a4 | Exit 0/1/2 contract | PASS | packed success/runtime/usage matrix for all 12 verbs |
| AC-a5 | Stable JSON envelope | PASS | product/command/ok/message protected from detail override |
| AC-a6 | One clean JSON document | PASS | no banner, ANSI, prompt, or stray handler output |
| AC-a7 | Product commands dispatch separately | PASS | 37-command packed inventory retained |
| AC-a8 | Shared manifest validator | PASS | cli-kit conformance validation remains green |
| AC-a9 | Invocation/output goldens | PASS | core tests plus 14 AC-c9 snapshots |
| AC-b1 | Binding lifecycle/install/update semantics | PASS | service-only lifecycle, required install phases, verified update/rollback |
| AC-b2 | Register implementation | PASS | idempotent Honeycomb-to-Doctor registration |
| AC-b3 | Idempotent service operations | PASS | installed/absent tests and no fallback mutation |
| AC-b4 | Restart waits for running/healthy | PASS | service restart plus bounded health verification |
| AC-b5 | Service-only/full uninstall boundary | PASS | service-only removal is scoped; full uninstall is ordered and fail closed |
| AC-b6 | Preserve shared/other-product state | PASS | Honeycomb-scoped service, registry entry, and state only |
| AC-b7 | Safe update/rollback | PASS | exact target/version checks, service requirement, health proof, verified rollback |
| AC-b8 | Fixed-argv OS adapters | PASS | platform rendering/security regression suite passes |
| AC-b9 | Authoritative service log | PASS | service output and `logs` use Honeycomb's authoritative source |
| AC-b10 | Migration notes | PASS | README/CHANGELOG document canonical and retained compatibility surfaces |
| AC-c1 | Ordered status and equivalent JSON | PASS | registry errors propagate; running/stopped/not-installed/unhealthy goldens |
| AC-c2 | Log defaults/options | PASS | tail 100/follow plus lines/no-follow/since |
| AC-c3 | Product-bound service/log identity | PASS | fixed Honeycomb constants |
| AC-c4 | Cross-product log isolation | PASS | sibling selector rejected with usage exit 2 |
| AC-c5 | Credential redaction | PASS | emitted log text redacted without mutating stored file |
| AC-c6 | Ctrl+C and log errors | PASS | abort exits 0; missing source exits 1 in both modes |
| AC-c7 | Read-only telemetry summary | PASS | state, setting, destination, queue, last-send, opt-out |
| AC-c8 | Observability has no lifecycle side effect | PASS | status/logs/telemetry tests record no lifecycle mutation |
| AC-c9 | Complete observability goldens | PASS | 14/14 exact human/JSON snapshots |
| AC-d1 | Distinct ASCII art | PASS | Honeycomb motif within width constraint |
| AC-d2 | Complete bare/help anatomy | PASS | all required elements/groups present |
| AC-d3 | Honeycomb reference motif | PASS | recognizable cell motif retained |
| AC-d4 | Pure help | PASS | help works without operational adapters |
| AC-d5 | No ANSI in no-color/non-TTY | PASS | plain rendering goldens pass |
| AC-d6 | No banner/credit in JSON | PASS | clean JSON envelope only |
| AC-d7 | Package-derived human version | PASS | packed `honeycomb v0.21.0` verified |
| AC-d8 | Version JSON envelope | PASS | packed product/version/ok verified |
| AC-d9 | Width/color/version goldens | PASS | focused rendering and packed checks pass |
| AC-d10 | Exact credit | PASS | `Legion Code Inc. x Activeloop` |
| AC-e1 | Packed full matrix and inventory | PASS | external fixture, exact narrow core exports, 12-command matrix, 37 retained commands |
| AC-e5 | Changelog/migration note | PASS | repository documentation updated |
| AC-e6 | Privileged native service/reboot proof | EXTERNAL | requires real Windows/macOS/Linux service mutation and reboot-survival environments |
| AC-e7 | Four-product packed suite | EXTERNAL | requires Doctor, Nectar, Hive, and Honeycomb packed together |
| AC-e8 | No stubs/wrong-source/silent success | PASS | fail-closed seams and packed marker/export checks pass |
| AC-e9 | Suite matrix link and product detail | PASS | README links normative matrix and preserves Honeycomb details |
| AC-e10 | Four adoption releases published | EXTERNAL | fleet release close-out occurs after all product/suite gates |

## Final Verification Evidence

| Gate | Final Result |
|---|---|
| Post-remediation Security re-audit | PASS — 0 open Critical/High; additional broad packed-core export High fixed |
| Focused PRD-003/remediation suite | PASS — 10 files / 191 tests |
| `npm run ci` | PASS — typecheck, duplicate scan, 477 test files / 5,185 passed / 13 skipped, SQL audit |
| `npm run build` | PASS — daemon, 5 hooks, OpenClaw, 2 MCP, 4 SDK, CLI, embed-daemon bundles at 0.21.0 |
| Packed core export inspection | PASS — exactly `VERB_TABLE,createDispatcher` |
| `npm run test:packed-cli` | PASS — full 12-command human/JSON success/runtime-failure/malformed-usage matrix |
| Packed product inventory | PASS — all 37 retained commands asserted; no conformance test-mode markers in shipped bundle |
| `npm run pack:check` | PASS — 71 files; no forbidden patterns; required runtime/plugin files present |
| AC-c9 snapshot audit | PASS — exactly 14 named goldens |
| `npm run audit:openclaw` | PASS — no findings |
| `npm audit --audit-level=high` | PASS — 0 vulnerabilities |
| `git diff --check` | PASS — line-ending conversion notices only |

## True External Close-Out Blockers

1. **AC-e6:** privileged native install/start/stop/restart/service-uninstall and reboot-survival proof on Windows, macOS, and Linux.
2. **AC-e7:** one installed packed-suite run containing Doctor, Nectar, Hive, and Honeycomb, including cross-product command/help/banner/version/JSON/log isolation.
3. **AC-e10:** publication of all four adoption releases after the product and suite gates pass.

No other external blocker or unresolved functional Honeycomb defect was found in the final re-grade.

---

# Clean Final Gate — 2026-07-13

**Grade: A / PASS.** The sole Warning from the preceding final re-grade is closed. Final finding accounting is **0 Critical, 0 Warning, 0 Suggestion**. Acceptance accounting remains **50 Pass, 0 Fail, 0 Partial, 3 External Proof** across all **53** Honeycomb-applicable PRD-003 rows.

## Warning Closure

| Prior Warning Location | Final Status | Evidence |
|---|---:|---|
| `src/commands/contracts.ts:213-214` | CLOSED | Metadata now defines canonical `start`/`stop` as installed-OS-service operations |
| `src/commands/dispatch.ts:412-417` | CLOSED | Comment now separates installed-service-only canonical verbs from legacy process-level `daemon` compatibility |
| `src/commands/local-handlers.ts:133-136` | CLOSED | Comment now describes the ordered, fail-closed transaction and limits best-effort behavior to supplemental legacy-label cleanup |
| `README.md:162-171` | CLOSED | Operator documentation explicitly distinguishes installed-service lifecycle from legacy process-level commands |

The stale-marker sweep found none of the superseded `bare alias`, `SAME DaemonLifecycle`, `best-effort and reported`, or bare-daemon README descriptions in the reviewed lifecycle/uninstall surfaces. The unrelated `harness-status.ts` degraded-build seam comment remains accurate for that optional read-only harness seam and is not a finding.

## Clean-Gate Verification

| Gate | Result |
|---|---|
| Current metadata/comment/README inspection | PASS — installed-service-only lifecycle and fail-closed uninstall text agree with implementation |
| Focused remediation suite | PASS — 10 files / 191 tests |
| `npm run typecheck` | PASS |
| `git diff --check` after final text remediation | PASS — line-ending conversion notices only |
| Post-remediation Security confirmation | PASS — 8 remediated High findings intact; 0 open Critical/High |

## Final Acceptance and External Proof

All **50 locally provable** rows remain PASS. The only outstanding rows are unchanged true external close-out obligations:

1. **AC-e6:** privileged native Windows/macOS/Linux service and reboot-survival proof.
2. **AC-e7:** the combined four-product packed-suite run.
3. **AC-e10:** publication of all four adoption releases after product and suite gates pass.

There is no remaining Honeycomb implementation, test-proof, security, documentation-alignment, or maintainability finding in this final Quality gate.

---

# Superseding Final Dogfood Quality Gate — 2026-07-13

**Final grade: A / PASS.** The complete post-dogfood Honeycomb diff, final Security report, packed artifacts, automated acceptance matrix, and live Windows service evidence are accepted. Final open finding counts are **0 Critical, 0 Warning, 0 Suggestion**. Acceptance accounting is unchanged at **50 Pass, 0 Fail, 0 Partial, 3 External Proof** across all **53** Honeycomb-applicable PRD-003 rows.

Security ordering is satisfied: the final Security gate reports **0 Critical, 10 High fixed, 0 Critical/High open**. Quality found one dead/misleading helper export during this gate and removed it before completion; Security re-reviewed that deletion as security-neutral and reconfirmed the cumulative counts.

## Final Dogfood Evidence

| Scenario | Result |
|---|---|
| Packed/global installation | PASS — the hardened packed artifact is globally installed as Honeycomb v0.21.0 |
| `service-install` | PASS — exits `0`; exact Scheduled Task reaches `Running`; exactly one Node descendant matches the full Honeycomb executable/flags/entry identity |
| `service-uninstall` boundary | PASS — exits `0`; task, exact process, and port-3850 listener are absent; Honeycomb product state remains preserved |
| Reinstall/restoration | PASS — restores exactly one task and one matching service process listening on port 3850 |
| `install --json` | PASS — clean JSON behavior with no Node DEP0190 warning |
| Read-only/operator surface | PASS — help, status, logs, register, telemetry, and update-check execute from the installed package |
| Usage/runtime exits | PASS — malformed usage and runtime failures return the contract exit classes; JSON remains one clean document |
| Final installed state | PASS — v0.21.0 installed, service running and healthy, Doctor registration present |

This native evidence materially strengthens AC-b1, AC-b3, AC-b4, AC-b5, AC-b8, AC-b9, AC-c1, AC-c2, AC-e1, and AC-e8. AC-e6 remains External because its full requirement still includes privileged macOS/Linux execution and reboot-survival proof in addition to the completed Windows service lifecycle.

## Quality Finding Closed During This Gate

- [x] **Dead/misleading Windows identity helper export**, formerly in `src/cli/daemon-service.ts`

  The newly added `normalizeWindowsProcessCommandLine` export had no consumer and only trimmed input while its comment described quote removal and whitespace normalization that the hardened implementation intentionally replaced with anchored token matching. The dead helper and inaccurate comment were removed. The actual JavaScript matcher and PowerShell 5 comparator remain exact-token, fail-closed implementations. Post-fix source search confirms the helper is absent.

Final accounting treats this as **one Suggestion found and fixed, zero open**; it did not invalidate any acceptance row or live dogfood result.

## Superseding Verification Matrix

| Gate | Final Result |
|---|---|
| Complete `npm run ci` on the post-dogfood tree | PASS — typecheck, duplicate scan, 477 files / 5,196 passed / 13 skipped, SQL-safety audit |
| Full production build | PASS — all bundles built at v0.21.0 |
| `npm run test:packed-cli` | PASS — all 12 baseline commands in human/JSON success, runtime-failure, and malformed-usage modes |
| Packed retained-command inventory | PASS — all 37 prior product commands retained |
| Packed core boundary | PASS — exactly `VERB_TABLE` and `createDispatcher` exported |
| `npm run pack:check` | PASS — 71 files; forbidden patterns absent; required runtime/plugin components present |
| `npm run audit:openclaw` | PASS — no findings |
| `npm audit --audit-level=high` | PASS — 0 vulnerabilities |
| `git diff --check` | PASS — line-ending conversion notices only |
| Post-fix affected regression set | PASS — 5 files / 100 tests, including real PowerShell 5 identity and Windows DEP0190 probes |
| Post-fix `npm run typecheck` | PASS |
| Post-fix build and packed-core export inspection | PASS |
| Final Security ordering confirmation | PASS — deletion is security-neutral; 0 Critical, 10 High fixed, 0 open |

## Final Acceptance Accounting

- **50 PASS:** every locally provable parent and Honeycomb-specific PRD-003 row.
- **0 FAIL / 0 PARTIAL:** no unresolved implementation, behavior, package, proof, documentation, security, or maintainability gap.
- **3 EXTERNAL:** AC-e6 (remaining macOS/Linux and reboot-survival proof), AC-e7 (combined four-product packed suite), and AC-e10 (publication of all four adoption releases).

This section supersedes every earlier interim grade and finding count in this report. Honeycomb is Quality-cleared with no open finding.
