# QA Report: PRD-003 Doctor CLI adoption

**Plan documents:** `prd-003-apiary-cli-interface-standard-index.md` and `prd-003a` through `prd-003e`  
**Audit date:** 2026-07-13  
**Base branch:** `main` (`5489851`)  
**Head:** `legion/prd-003-doctor-cli-standard` (dirty working tree at audit time)  
**Auditor:** quality-worker-bee  
**Security ordering:** satisfied; `qa/prd-003-doctor-adoption-security.md` was completed first

## Summary

**Grade: F / BLOCKED (63% weighted acceptance completion).** Doctor has the shared manifest, real adapters, isolated logs, structured output, canonical aliases, a safe updater, and preserved product commands, but five confirmed implementation defects block adoption: malformed baseline options do not return usage exit `2`, service installation is not idempotent on launchd/sc, `stop` does not perform its required bounded stopped-state verification, the banner retains legacy attribution inside the art and therefore breaks the standard anatomy, and the packed test does not execute the required operational matrix. Native live service CI, the four-product packed job, and published adoption releases remain separate external close-out blockers.

Acceptance accounting: **26 Pass, 13 Partial, 13 Fail, 1 Not Applicable** across the 53 requested rows. The five Critical findings below are Doctor implementation blockers; the external blockers are called out separately in traceability so they are not mistaken for Doctor code defects.

## Scorecard

| Category | Status | Notes |
|---|---|---|
| Completeness | ❌ | Packed operational matrix and required golden/native/release evidence are incomplete |
| Correctness | ❌ | Usage exits, service-install idempotence, and stop semantics diverge from the PRD |
| Alignment | ❌ | Banner anatomy includes legacy attribution outside the one standard credit line |
| Gaps | ❌ | Packed and golden tests do not challenge the required failure/edge matrix |
| Detrimental | ❌ | A green test suite currently permits user-visible contract violations |

## Critical Issues (must fix)

- [x] **Malformed baseline options are silently accepted instead of returning usage exit 2 (AC-2, AC-a4)**, `src/cli/dispatch.ts:600-626`, `src/cli/dispatch.ts:513-515` — **RESOLVED in final re-grade; historical finding retained below.**

  The dispatcher parses arguments and validates only the command name; it does not reject flags or positionals unsupported by the resolved baseline command. Built-artifact evidence: `doctor start --bogus --json` and `doctor telemetry --bogus --json` both exited `0`; `doctor logs --lines 0 --no-follow --json` recognized malformed input but mapped it to runtime exit `1`, not usage exit `2`. Suggested: validate each command's complete option/positional schema before routing and preserve the usage/runtime distinction through the log adapter.

  ```ts
  let parsed = parseArgs(argv);
  const resolution = resolveCommandDetailed(parsed.command);
  const json = hasFlag(parsed, "json");
  // No resolved-command option/positional validation occurs before route().
  ```

  ```ts
  if (!result.ok) {
    ctx.io.err(redactLogSecrets(result.error));
    return EXIT_ERROR;
  }
  ```

- [x] **`service-install` is not idempotent on already-registered launchd and sc services (AC-b3)**, `src/service/index.ts:226-231`, `src/service/index.ts:270-281`, `src/service/argv.ts:63-98` — **RESOLVED in final re-grade; historical finding retained below.**

  Every install reruns the manager registration commands. launchd `bootstrap` and Windows `sc create` can report failure when the service already exists; `runAll` then makes the entire command fail even if `kickstart`/`start` succeeds. Unlike uninstall, install has no already-satisfied classification or reconciliation precheck. Suggested: detect the installed definition, reconcile it safely, and classify an already-correct/running service as idempotent success.

  ```ts
  const { allOk, firstFailure, firstFailureResult } = await runAll(
    runner, installCommands(planForArgv, uid),
  );
  if (!allOk) {
    return { ok: false, message: `Registered the Doctor unit but ... failed` };
  }
  ```

  ```ts
  { command: "launchctl", args: ["bootstrap", domain, plan.unitPath] }
  { command: "sc", args: ["create", WINDOWS_TASK_NAME, ...] }
  ```

- [x] **`stop` reports success without the required bounded stopped-state verification (AC-b1)**, `src/cli/dispatch.ts:293-322`, `src/service/argv.ts:157-172`, `src/service/templates.ts:95-100` — **RESOLVED in final re-grade; historical finding retained below.**

  `runStartStop` returns immediately when the service-manager command reports success; it never polls `serviceStatusAsync` until stopped. This is especially incorrect for launchd: the installed plist uses unconditional `KeepAlive=true`, while `stop` only sends `launchctl kill`, allowing launchd to restart Doctor. Suggested: implement a bounded stopped-state transaction per manager and ensure launchd can remain stopped while retaining an installed definition.

  ```ts
  const result = kind === "start"
    ? await deps.serviceLifecycle.start()
    : await deps.serviceLifecycle.stop();
  io.out(redactLogSecrets(result.message));
  return result.ok ? EXIT_OK : EXIT_ERROR;
  ```

  ```ts
  <key>KeepAlive</key>
  <true/>
  ```

- [x] **Banner embeds legacy partner attribution and violates the required one-credit anatomy (AC-3, AC-d2, AC-d10)**, `src/cli/banner.ts:8-22`, `src/cli/banner.ts:51-53` — **RESOLVED in final re-grade; historical finding retained below.**

  `brand.art` contains `LEGION CODE INC.`, `ACTIVELOOP`, a second collaboration sentence, and `powered by deeplake.ai`; the shared renderer then adds the exact standard credit again. Built help therefore has multiple attribution lines before and after `DOCTOR`, rather than product art followed by uppercase name, descriptor, version, and one exact credit line. Suggested: keep `art` strictly to the medical/watchdog mark and let the shared renderer own the sole credit line.

  ```ts
  "  LEGION CODE INC.                         ACTIVELOOP",
  "  A collaboration between Legion Code Inc. x Activeloop",
  "  powered by deeplake.ai",
  ```

- [x] **Packed verification is a help/version/register smoke test, not the required Doctor operational matrix (AC-6, AC-a9, AC-e2)**, `scripts/verify-packed-cli.mjs:18-32` — **RESOLVED in final re-grade; historical finding retained below.**

  The packed executable is installed correctly, but the script executes only `--help`, `--version`, and exempt `register`. It never drives start/stop/restart/install/uninstall/service lifecycle/update/status/logs/telemetry human and JSON success/failure paths, so a packed artifact can pass while commands are stubs or have incorrect semantics. Suggested: run the complete baseline through deterministic injected/fake adapters or an equivalent packed fixture and verify command-specific effects, exit classes, output envelopes, and log identity.

  ```js
  const help = execFileSync(process.execPath, [bin, "--help"], ...);
  const version = execFileSync(process.execPath, [bin, "--version"], ...);
  status = execFileSync(process.execPath, [bin, "register", "--json"], ...);
  ```

## Warnings (should fix)

- [x] **Golden coverage does not satisfy the required bare/help/version/status/telemetry matrix**, `tests/cli/standard-interface.test.ts:21-63`, `tests/cli/banner.test.ts:12-51` — **RESOLVED in final re-grade; historical finding retained below.**

  Assertions check selected substrings and a subset of JSON commands, but there are no stable goldens for 80 columns, narrow wrapping, bare/help equivalence, every required human/JSON success and failure, running/stopped/not-installed/unhealthy status, or telemetry enabled/opted-out. Suggested: add exact-output fixtures covering AC-a9, AC-c9, and AC-d9.

- [x] **Doctor log tests do not prove the complete required edge behavior**, `tests/cli/service-logs.test.ts:6-33` — **RESOLVED in final re-grade; historical finding retained below.**

  The two tests cover a small no-follow/redaction example and malformed `--lines`; they do not verify 100-line truncation, default follow, `--since`, Ctrl+C cleanup/exit `0`, missing/unreadable exit `1`, or adversarial Doctor-vs-Hive/Honeycomb/Nectar source rejection. Suggested: add the full AC-c2/c4/c6/c9 matrix.

- [x] **Primary documentation still advertises deprecated spelling and duplicates normative semantics without linking the suite matrix**, `README.md:126-131`, `README.md:160-183`, `src/service/index.ts:349-356` — **RESOLVED in final re-grade; historical finding retained below.**

  The standalone install instructions and runtime recovery guidance tell users to run `install-service`, while canonical documentation is required to advertise `service-install`. The product command table also restates suite semantics without linking the suite-wide matrix. Suggested: use canonical spelling everywhere outside an explicit migration/alias note and link the cli-kit suite matrix for normative behavior.

- [x] **Human status appends duplicate service/version/detail output after the ordered shared snapshot**, `src/cli/dispatch.ts:138-144` — **RESOLVED in final re-grade; historical finding retained below.**

  `formatStatus` already renders the common ordered fields and the details object, after which `runStatus` prints service, version, and every daemon detail again. The required facts are present, but the repeated block weakens the ordered common presentation. Suggested: render the shared status once and keep product-specific data only in its `Details` section.

  ```ts
  ctx.io.out(formatStatus(result.status).trimEnd());
  ctx.io.out(`Doctor service: ${result.status.process.state}`);
  ctx.io.out(`Doctor version: ${result.status.version}`);
  for (const detail of result.daemonDetails) ctx.io.out(detail);
  ```

## Suggestions (consider improving)

None.

## Plan Item Traceability

Legend: ✅ Pass, ⚠️ Partial, ❌ Fail, 🟦 Not Applicable. “External” means native/four-product/release proof, not a Doctor implementation defect.

| ID | Plan requirement | Status | Implementation / evidence | Notes |
|---|---|---:|---|---|
| AC-1 | Four products expose the matrix; Doctor alone omits register | ⚠️ | `src/cli/command-table.ts:8-53`; `tests/cli/standard-interface.test.ts:11-19` | Doctor surface passes; other products are external |
| AC-2 | Same meaning, success, exit class, help placement | ❌ | `src/cli/dispatch.ts:293-322,600-626` | Doctor option and stop semantics fail |
| AC-3 | Bare/help standard banner anatomy | ❌ | `src/cli/banner.ts:8-22` | Duplicate legacy attribution |
| AC-4 | Product-isolated logs | ⚠️ | `src/cli/service-logs.ts:36-49`; `tests/cli/service-logs.test.ts:6-33` | Doctor adapter is bound correctly; complete negative fleet proof missing |
| AC-5 | Non-Doctor registration observed by Doctor | ⚠️ | `src/cli/index.ts:127-164`; `src/cli/dispatch.ts:71-135` | Doctor continues reading registry entries; all producer integrations are external |
| AC-6 | Shared conformance over all four products | ❌ | `scripts/verify-packed-cli.mjs:18-32`; `library/ledger/EXECUTION_LEDGER.md:106` | Doctor packed test is shallow; suite job external |
| AC-7 | Product commands preserved separately | ⚠️ | `src/cli/command-table.ts:39-53`; `README.md:173-181` | Doctor passes; fleet completion external |
| AC-8 | Consistent human output; clean JSON | ⚠️ | `src/cli/dispatch.ts:655-706`; `src/cli/banner.ts:8-22` | JSON is clean; human banner anatomy fails |
| AC-a1 | Typed baseline manifest | ✅ | `node_modules/@legioncodeinc/cli-kit/src/command-contract.ts:7-34` | Shared source consumed by Doctor |
| AC-a2 | Help composed from baseline plus product manifest | ✅ | `src/cli/command-table.ts:39-53`; `src/cli/banner.ts:51-53` | No handwritten baseline command rows in primary renderer |
| AC-a3 | Canonical service verbs; deprecated aliases hidden | ✅ | `node_modules/@legioncodeinc/cli-kit/src/command-contract.ts:27-31`; `src/cli/command-table.ts:66-84` | Help shows canonical verbs |
| AC-a4 | Exit 0/1/2 classification | ❌ | `src/cli/dispatch.ts:600-626`; built probes | Malformed options exit 0 or 1 |
| AC-a5 | Every baseline command has stable JSON envelope | ✅ | `src/cli/dispatch.ts:658-706`; `tests/cli/standard-interface.test.ts:30-63` | Implementation envelope present; coverage warning remains |
| AC-a6 | JSON is one clean document | ✅ | `src/cli/dispatch.ts:681-706`; built probes | No banner/ANSI/prompt in observed JSON |
| AC-a7 | Product commands remain dispatchable/separate | ✅ | `src/cli/command-table.ts:39-53`; `src/cli/dispatch.ts:539-592` | Legacy functionality retained, fleet incidents moved to `incidents` |
| AC-a8 | Shared manifest conformance harness | ✅ | `tests/cli/standard-interface.test.ts:11-19`; cli-kit `validateManifest` | Doctor manifest validates |
| AC-a9 | Product golden matrix | ⚠️ | `tests/cli/standard-interface.test.ts:21-63`; `tests/cli/banner.test.ts:12-51` | Incomplete exact-output and failure goldens |
| AC-b1 | Binding lifecycle/install/update semantics | ❌ | `src/cli/dispatch.ts:293-358`; `src/service/index.ts:200-385` | Stop verification and install reconciliation fail |
| AC-b2 | Doctor register is unknown 2 and absent from help | ✅ | `src/cli/dispatch.ts:621-626`; `tests/cli/standard-interface.test.ts:30-37` | Built `register --json` exited 2 |
| AC-b3 | Idempotent start/stop/service install/uninstall/register | ❌ | `src/service/index.ts:226-281`; `src/service/argv.ts:63-98` | launchd/sc service-install can fail when already present |
| AC-b4 | Restart waits for running/health with timeout | ✅ | `src/cli/dispatch.ts:325-350` | 20 bounded status attempts |
| AC-b5 | Service-only uninstall preserves state; full uninstall removes owned state | ✅ | `src/cli/dispatch.ts:273-290,367-424`; `tests/cli/lifecycle-commands.test.ts:100-231` | Distinct transactions |
| AC-b6 | Uninstall preserves shared/other-product state | ✅ | `src/product-uninstall.ts:57-63,130-145`; security report | Ownership audited and remediated |
| AC-b7 | Safe update with versions, preserve, restart, verify, rollback | ✅ | `src/cli/self-update.ts:60-103`; `tests/cli/self-update.test.ts` | Strict release resolution and verified rollback |
| AC-b8 | Fixed argv tests on all OSes | ✅ | `src/service/argv.ts:63-211`; `tests/service/argv.test.ts` | Unit-level fixed arrays pass |
| AC-b9 | Service output aligns with authoritative logs | ✅ | `src/service/templates.ts:78-138,163-209`; `src/cli/service-logs.ts:66-97` | POSIX definitions and Windows process capture target `service.log` |
| AC-b10 | Migration notes identify aliases/renames | ✅ | `CHANGELOG.md:3-7`; `README.md:177-183` | Automation detail could be more explicit but migration is recorded |
| AC-c1 | Ordered human status and equivalent JSON | ⚠️ | `src/cli/dispatch.ts:123-144,658-667` | Structured fields exist; human mode appends duplicate service/version/details after formatted status |
| AC-c2 | Logs default 100/follow and support options | ✅ | `src/cli/service-logs.ts:36-49`; cli-kit `log-tail.ts:46-69` | Implementation passes; test coverage warning |
| AC-c3 | Logs hard-bound to Doctor identity/path | ✅ | `src/cli/service-logs.ts:40-49` | Fixed product, service, root, and path |
| AC-c4 | Cross-product negative log tests | ⚠️ | `tests/cli/service-logs.test.ts:7-23`; `tests/cli/dispatch.test.ts:308-326` | Fail-closed path exists; full adversarial matrix missing |
| AC-c5 | Log redaction | ✅ | `src/cli/service-logs.ts:41-49`; `tests/cli/service-logs.test.ts:7-23` | Bearer/API-key proof present |
| AC-c6 | Ctrl+C 0; missing/unreadable 1 | ⚠️ | `src/cli/dispatch.ts:508-520`; cli-kit `log-tail.ts:120-162` | Implementation paths exist; Doctor tests absent |
| AC-c7 | Read-only safe telemetry summary | ✅ | `src/cli/index.ts:366-379`; `src/cli/dispatch.ts:523-529,669-678` | No secret values emitted |
| AC-c8 | Status/logs/telemetry have no lifecycle side effect | ✅ | `src/cli/dispatch.ts:138-144,495-529` | Handlers do not start/restart service |
| AC-c9 | Observability golden matrix | ⚠️ | `tests/cli/standard-interface.test.ts:51-63`; `tests/cli/service-logs.test.ts:6-33` | Required states/modes incomplete |
| AC-d1 | Distinct ASCII Doctor art at 80 columns | ✅ | `src/cli/banner.ts:7-22`; built help width probe | Medical/watchdog mark ASCII and under 80 columns |
| AC-d2 | Complete standard banner anatomy | ❌ | `src/cli/banner.ts:8-22` | Legacy attribution is embedded in art |
| AC-d3 | Honeycomb retains reference motif | 🟦 | — | Honeycomb-specific, not Doctor-applicable |
| AC-d4 | Help rendering pure and side-effect-free | ✅ | `src/cli/banner.ts:25-53`; renderer unit tests | Renderer itself is pure; packed entrypoint coverage should be expanded |
| AC-d5 | NO_COLOR/non-TTY/no-color preserve plain text | ✅ | `src/cli/colors.ts`; `tests/cli/colors.test.ts`; `tests/cli/banner.test.ts:46-51` | Non-TTY built output had no ANSI |
| AC-d6 | JSON has no banner/attribution | ✅ | `src/cli/dispatch.ts:610-618,681-706`; built probes | Pass |
| AC-d7 | Exact package-derived version line | ✅ | `src/cli/dispatch.ts:605-607`; built `doctor v0.5.0\n` | Pass |
| AC-d8 | Version JSON standard envelope | ✅ | `src/cli/dispatch.ts:605-607` | Shared version renderer used |
| AC-d9 | Branding/version goldens incl narrow | ⚠️ | `tests/cli/banner.test.ts:12-51` | Narrow/80/exact-output goldens absent |
| AC-d10 | Exact credit in all products | ❌ | `src/cli/banner.ts:19-22`; built help | Doctor renders additional partner attribution around the exact line |
| AC-e2 | Packed Doctor passes full matrix and validates registry entries | ❌ | `scripts/verify-packed-cli.mjs:18-32` | Packed matrix is only help/version/register |
| AC-e5 | Every repo has migration/change note | ⚠️ | Doctor `CHANGELOG.md:3-7`; `library/ledger/EXECUTION_LEDGER.md:104` | Doctor portion present; Honeycomb/Nectar/release-wide proof external |
| AC-e6 | Native Windows/macOS/Linux service CI | ❌ | `.github/workflows/ci.yaml:9-23,47-93` | External blocker: matrix runs unit logic but explicitly does not install/control services |
| AC-e7 | Four packed products suite-level job | ❌ | `library/ledger/EXECUTION_LEDGER.md:106` | External blocker: job does not yet exist/pass |
| AC-e8 | No stubs/wrong-source/false success | ❌ | Critical findings above | Doctor cannot be marked adopted while semantics fail |
| AC-e9 | One suite matrix linked by product docs | ⚠️ | cli-kit `library/notes/prd-003-command-matrix.md:1-13`; Doctor `README.md:160-183` | Suite matrix exists; Doctor docs do not link it and duplicate semantics |
| AC-e10 | Four adoption releases published | ❌ | Doctor `CHANGELOG.md:3-9`; `package.json:2-3`; `library/ledger/EXECUTION_LEDGER.md:109` | External release blocker; Doctor changes remain Unreleased |

## Commands and Results

| Command | Result |
|---|---|
| `npm run ci` | PASS — typecheck plus 71 files / 852 tests |
| `npm run build` | PASS — bundled Doctor CLI v0.5.0 |
| `npm run test:packed-cli` | PASS — existing shallow packed smoke |
| `npm run pack:check` | PASS — 5 files, no forbidden patterns/source leak, bin present |
| `npm audit --json --audit-level=high` | PASS — 0 vulnerabilities |
| `git diff --check` | PASS — line-ending conversion warnings only |
| `node bundle/cli.js` vs `--help` | PASS — byte-equivalent text (1630 characters) |
| `node bundle/cli.js --version` | PASS — `doctor v0.5.0` |
| `node bundle/cli.js register --json` | PASS — one JSON error, exit 2 |
| `node bundle/cli.js start --bogus --json` | FAIL — accepted malformed option, exit 0 |
| `node bundle/cli.js telemetry --bogus --json` | FAIL — accepted malformed option, exit 0 |
| `node bundle/cli.js logs --lines 0 --no-follow --json` | FAIL — usage error mapped to exit 1 |

The Vitest run emitted only the repository's known experimental `node:sqlite` warnings.

## External Close-Out Blockers

1. **Native service CI (AC-e6):** the configured three-OS matrix tests templates/argv but explicitly excludes real install/start/stop/restart/uninstall integration.
2. **Four-product packed suite (AC-6, AC-e7):** no passing job installs and tests all four adopted artifacts together.
3. **Fleet adoption/release (parent AC-1/2/3/4/6/7/8, AC-e5/e10):** Honeycomb and Nectar adoption evidence and all required published adoption releases remain outstanding.

These do not excuse the five Doctor defects and should not be counted as Doctor implementation findings; they are gates to PRD-003 fleet completion after product QA passes.

## Files Changed

- `.github/workflows/ci.yaml` (M), adds packed CLI step to the three-OS unit matrix
- `CHANGELOG.md` (M), records Doctor CLI-standard migration
- `README.md` (M), documents standard and preserved Doctor commands
- `package-lock.json` (M), locks cli-kit adoption dependency
- `package.json` (M), adds cli-kit and packed test script
- `scripts/verify-packed-cli.mjs` (A), packed help/version/register smoke test; incomplete matrix blocker
- `src/cli/banner.ts` (M), shared renderer plus Doctor art; duplicate-attribution blocker
- `src/cli/command-table.ts` (M), shared baseline and Doctor product manifest
- `src/cli/context.ts` (M), service logs/status/telemetry adapter seams
- `src/cli/dispatch.ts` (M), standard command routing, JSON, lifecycle, status, logs, telemetry
- `src/cli/index.ts` (M), production adapter wiring
- `src/cli/self-update.ts` (M), approved Doctor update/rollback transaction
- `src/cli/service-logs.ts` (A), Doctor-authoritative log adapter/output capture
- `src/rungs/command-runner.ts` (M), Windows npm runner security remediation (worktree normalization produced no textual diff in final inventory)
- `src/service/index.ts` (M), lifecycle and registration probes; idempotence/stop blockers
- `src/service/templates.ts` (M), aligns POSIX logs with `service.log`
- `src/telemetry/sqlite-reader.ts` (M), telemetry reader adjustment
- `tests/cli/dispatch.test.ts` (M), dispatcher/security regressions
- `tests/cli/helpers/fake-cli.ts` (M), adds Doctor service-log seam
- `tests/cli/lifecycle-commands.test.ts` (M), lifecycle failure/ownership coverage
- `tests/cli/self-update.test.ts` (M), strict release/rollback regressions
- `tests/cli/service-logs.test.ts` (A), limited Doctor log/redaction tests
- `tests/cli/standard-interface.test.ts` (A), limited manifest/banner/JSON checks
- `tests/compose/registry-reload-reconcile.test.ts` (M), registry reconciliation fixture update
- `tests/config.test.ts` (M), config fixture update
- `tests/rungs/npm-spawn.test.ts` (M), npm runner regression (worktree normalization produced no textual diff in final inventory)
- `tests/service/templates.test.ts` (M), authoritative service-log template assertions

## Final Re-Grade — 2026-07-13

### Final Outcome

**Doctor implementation grade: A / PASS.** The current Doctor branch has **0 open Critical, 0 open Warning, and 0 open Suggestion findings**. All five former Critical findings and all four former Warnings are resolved and independently re-tested. Doctor's implementation accounting is **49 Pass, 3 External Proof, 1 Not Applicable** across the same 53 requested rows. The PRD as a four-product release remains open only on the external proof items listed below; those items are not Doctor implementation defects.

The final re-grade was performed after the second security remediation. The shipped CLI contains no `DOCTOR_PACKED_` or `TEST_MODE` marker, direct execution always constructs the production context, and the packed test imports the installed artifact's exported pure dispatcher with a fixture that exists outside the shipped bundle. An adversarial direct-bin probe with `DOCTOR_PACKED_TEST_MODE=1` still returned the real production status path, exposed no fixture marker, and rejected `start --bogus --json` with exit `2`.

### Prior Finding Disposition

| Prior severity | Finding | Final disposition | Current evidence |
|---|---|---|---|
| Critical | Malformed baseline options / wrong usage exits | Resolved | `src/cli/dispatch.ts:45-119,686-693`; `tests/cli/standard-interface.test.ts:88-101`; direct packed probe exit `2` |
| Critical | Non-idempotent launchd/sc service install | Resolved | `src/service/argv.ts:63-103`; `src/service/index.ts:159-201,287-303`; service argv/module tests |
| Critical | Stop lacked bounded stopped-state verification | Resolved | `src/cli/dispatch.ts:367-443`; `src/service/argv.ts:139-170`; `tests/cli/lifecycle-commands.test.ts` |
| Critical | Duplicate/legacy banner attribution | Resolved | `src/cli/banner.ts:8-20`; `tests/cli/banner.test.ts:13-20,53-57`; exact snapshots |
| Critical | Packed verifier was shallow | Resolved | `scripts/verify-packed-cli.mjs:125-236`; packed success/failure human/JSON matrix passes |
| Warning | Incomplete golden matrix | Resolved | `tests/cli/standard-interface.test.ts:43-145`; `tests/cli/__snapshots__`; `tests/cli/banner.test.ts:53-57` |
| Warning | Incomplete logs edge tests | Resolved | `tests/cli/service-logs.test.ts:29-108` |
| Warning | Deprecated docs / no suite-matrix link | Resolved | `README.md:130,164,177-183`; canonical runtime guidance in `src/service/index.ts` |
| Warning | Duplicate human status block | Resolved | `src/cli/dispatch.ts:215-219`; status goldens |

### Final Acceptance Matrix

Legend: **PASS** means Doctor's implementation satisfies the row. **EXTERNAL** means the row needs infrastructure, another product, or a published release and is not an open Doctor finding. **N/A** is not applicable to Doctor.

| ID | Final Doctor status | Evidence / external boundary |
|---|---:|---|
| AC-1 | PASS | Doctor exposes the complete applicable baseline; Doctor's `register` exemption is enforced. Other products remain fleet work. |
| AC-2 | PASS | Shared command semantics, stable human/JSON output, and exit `0/1/2` are exercised in unit and packed matrices. |
| AC-3 | PASS | Doctor-specific ASCII art, uppercase product name, package version, and exactly one required credit line. |
| AC-4 | PASS | Doctor-only authoritative log path, default tail/follow, options, redaction, and edge behavior are covered. |
| AC-5 | PASS | Doctor rejects `register`, omits it from help, and returns usage exit `2`. |
| AC-6 | PASS | Doctor packed artifact passes the full product matrix. Four-product aggregation is tracked by AC-e7. |
| AC-7 | PASS | Doctor documents canonical commands and retains deprecated aliases only as migration compatibility. |
| AC-8 | PASS | Doctor CI and local gates execute shared conformance, product goldens, packed verification, and pack scanning. |
| AC-a1 | PASS | Baseline manifest is sourced from cli-kit and product commands remain additive. |
| AC-a2 | PASS | Bare invocation is byte-equivalent to `--help`. |
| AC-a3 | PASS | Canonical service verbs are advertised; deprecated aliases remain hidden. |
| AC-a4 | PASS | Success/runtime/usage exit classes are verified, including malformed flags and values. |
| AC-a5 | PASS | All applicable baseline commands have stable JSON envelopes. |
| AC-a6 | PASS | JSON output is one clean document without banner, ANSI, or prompts. |
| AC-a7 | PASS | Doctor product commands remain separately dispatchable. |
| AC-a8 | PASS | Doctor's manifest passes shared conformance validation. |
| AC-a9 | PASS | Human/JSON success and failure goldens plus status, telemetry, and branding snapshots are present. |
| AC-b1 | PASS | Lifecycle and install/update meanings are binding; start/stop/restart perform bounded state verification. |
| AC-b2 | PASS | Doctor `register` is absent and unknown with exit `2`. |
| AC-b3 | PASS | Start/stop/service install/uninstall are idempotent, including recognized launchd/sc reconciliation. |
| AC-b4 | PASS | Restart verifies stopped, then running/healthy, within bounded retries. |
| AC-b5 | PASS | Service-only uninstall and full product uninstall are separate transactions. |
| AC-b6 | PASS | Doctor uninstall preserves shared and other-product state. |
| AC-b7 | PASS | Update reports versions, preserves state, restarts/verifies, and rolls back on failure. |
| AC-b8 | PASS | Fixed service-manager argv arrays are tested for launchd, systemd, schtasks, and sc. |
| AC-b9 | PASS | Service manager output and `logs` use Doctor's authoritative `service.log`. |
| AC-b10 | PASS | Migration notes identify aliases and canonical renames. |
| AC-c1 | PASS | Human status is ordered once and JSON carries equivalent structured facts. |
| AC-c2 | PASS | Logs default to the last 100 lines and follow; `--lines`, `--since`, and `--no-follow` work. |
| AC-c3 | PASS | Log identity and path are hard-bound to Doctor. |
| AC-c4 | PASS | Poison sibling-product logs cannot be surfaced. |
| AC-c5 | PASS | Bearer/API-key secrets are redacted in human and JSON paths. |
| AC-c6 | PASS | Ctrl+C exits `0`; missing/unreadable logs exit `1`; watcher/listener cleanup is tested. |
| AC-c7 | PASS | Telemetry is a read-only, secret-free local summary. |
| AC-c8 | PASS | Status, logs, and telemetry do not start or restart the service. |
| AC-c9 | PASS | Observability goldens cover running, stopped, not-installed, unhealthy, enabled, and opted-out states. |
| AC-d1 | PASS | Doctor has distinct product-owned ASCII art at 80 columns. |
| AC-d2 | PASS | Banner anatomy is art, `DOCTOR`, descriptor, version, then one exact credit. |
| AC-d3 | N/A | Honeycomb-specific reference motif. |
| AC-d4 | PASS | Help rendering is pure and side-effect-free. |
| AC-d5 | PASS | `NO_COLOR`, non-TTY, and no-color paths preserve plain text. |
| AC-d6 | PASS | JSON never contains banner or attribution. |
| AC-d7 | PASS | Human version is exactly `doctor v0.5.0` from package/build version truth. |
| AC-d8 | PASS | Version JSON uses the standard envelope. |
| AC-d9 | PASS | Exact 80-column, narrow, and no-color branding/version snapshots pass. |
| AC-d10 | PASS | Exactly one `Legion Code Inc. x Activeloop` credit is rendered. |
| AC-e2 | PASS | Packed Doctor executes complete applicable baseline success/failure matrices and registry exemption checks. |
| AC-e5 | PASS | Doctor migration/change notes are present; other repositories remain fleet close-out work. |
| AC-e6 | EXTERNAL | Three-OS CI runs full logic plus a clearly labeled in-memory adapter fixture; real native service installation/control and reboot survival require privileged reboot-capable hosts. |
| AC-e7 | EXTERNAL | A suite job must install and pass all four packed product artifacts together. |
| AC-e8 | PASS | No Doctor stubs, wrong-source success, or production test-mode bypass remain. |
| AC-e9 | PASS | Doctor documentation links the suite matrix and does not redefine normative semantics. |
| AC-e10 | EXTERNAL | Required adoption releases must be published after product/fleet close-out. |

### Final Verification Gates

| Gate | Final result |
|---|---|
| Focused Doctor regression set | PASS — 7 files / 119 tests |
| `npm run build` | PASS — TypeScript plus bundled Doctor CLI v0.5.0 |
| Direct built-bin hostile environment probe | PASS — zero shipped test markers; production status path; malformed start exit `2` |
| `npm run test:packed-cli` | PASS — installed tarball, direct-bin boundary, full fixture success/failure matrix, logs isolation/redaction |
| `npm run ci` | PASS — typecheck plus 72 files / 871 tests |
| `npm run pack:check` | PASS — 5 files, no forbidden patterns/source leak, bin present; fresh prepack build |
| `git diff --check` | PASS |

### Remaining External Proof Only

1. Run real install/start/stop/restart/uninstall and reboot-survival proof against native launchd, systemd, and Windows service managers on privileged, reboot-capable hosts (AC-e6).
2. Add and pass the suite-level job that installs and tests the packed Honeycomb, Hive, Nectar, and Doctor artifacts together (AC-6/AC-e7).
3. Complete remaining non-Doctor product adoption/migration evidence and publish the required adoption releases (fleet ACs, AC-e5/AC-e10).

These are the only remaining PRD-003 close-out blockers identified in the final Doctor re-grade.

---

## Live Device Dogfood Addendum — 2026-07-13

The feature branch was packed, installed globally on Windows, and exercised against the real `doctor` Scheduled Task and status port. Dogfood found two lifecycle defects after the original re-grade: Task Scheduler could orphan the Node child during stop/restart, and a termination signal arriving during asynchronous watchdog startup could be lost. Both were remediated and the full suite then passed.

### Native Windows Results

| Operation | Result |
|---|---|
| `stop` | PASS — removed the exact Doctor process, left the task registered/Ready, and released port 3852 |
| `start` | PASS — task Running with exactly one Doctor process and matching port owner |
| `restart` | PASS — PID changed from 11328 to 136200; exactly one process remained; no new `EADDRINUSE` |
| repeated `start` | PASS — returned idempotent success and retained one PID |
| `service-install` while running | PASS — reconciled PID 136200 to 121220 with one process/one port owner |
| `service-uninstall` | PASS — removed the task, process, and listener |
| `install` restore | PASS — recreated the task and restored one process (PID 140548) owning port 3852 |
| `status`, `logs`, `telemetry`, `update --check` | PASS — clean Doctor-owned JSON output; logs tailed `~/.apiary/doctor/service.log` |
| `register` exemption | PASS — clean JSON usage error and exit 2 |
| help/version/branding | PASS — Doctor art/uppercase identity, exactly one credit, standard globals, `doctor v0.5.0` |

### Addendum Grade

**A / PASS remains the final grade, with 0 open Critical, 0 open Warning, and 0 open Suggestion findings.** The dogfood findings are closed with native evidence and regressions. Final gates pass: typecheck, 72 files / 871 tests, build, packed CLI verification, pack-check, zero-vulnerability audit, and diff check. Doctor was left installed and running with exactly one service process.
