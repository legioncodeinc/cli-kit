# Security Audit Report: PRD-003 Apiary CLI Interface Standard

**Audit date:** 2026-07-12  
**Auditor:** security-worker-bee  
**Scope:** PRD-003 documents and ledger; `src/branding.ts`, `src/command-contract.ts`, `src/lifecycle.ts`, `src/log-tail.ts`, `src/reference-cli.ts`, `src/status.ts`, `src/telemetry-summary.ts`; associated tests and package metadata  
**Node requirement:** >=22.5.0 (verification runtime: 25.2.1)  
**`npm audit` result:** 0 vulnerabilities  
**OpenClaw bundle scan:** Not applicable; this zero-production-dependency package has no OpenClaw bundle or audit script  
**Catalog freshness:** Security Stinger CVE catalog refreshed 2026-04-25 (current)

## Executive Summary

Scope note: cli-kit is outside the Hivemind-specific Deep Lake and capture catalog, so the audit applied its universal command-execution, filesystem, credential, terminal, denial-of-service, and supply-chain controls. Three High findings were remediated: product log paths could escape their owned root through traversal or symlinks, terminal control sequences could reach human output, and log-tail inputs/content had no hard resource limits. No Critical, Medium, or Low findings remain in the preparation layer; deployment adapters still require repository-specific security review.

## Scorecard

| Category | Status | Findings |
|---|---|---:|
| Credential / token exposure | OK | 0 |
| Registry and product-state isolation | OK | 0 |
| Command / argv construction | OK | 0 |
| Log binding, traversal, and symlinks | FAIL (fixed) | 1 High |
| Secret redaction and terminal integrity | FAIL (fixed) | 1 High |
| Follow-mode cleanup and denial of service | FAIL (fixed) | 1 High |
| Dependency and package supply chain | OK | 0 |

## Critical Findings

None detected.

## High Findings (fixed)

- [x] **Log path escape** `src/log-tail.ts:89-99,121-130` - Matching only product/service identifiers did not prove the file belonged to the product. Sources now require an absolute product-owned root, lexical containment, and mandatory canonical `realpath` containment, blocking traversal and symlink escapes.
- [x] **Terminal escape injection** `src/log-tail.ts:101-118`, `src/status.ts:22-42`, `src/telemetry-summary.ts:19-29`, `src/branding.ts:62-65` - Log, status, telemetry, and help adapter values could contain ANSI/OSC control sequences. Human output now strips terminal controls, while branding/help rejects non-ASCII source data. JSON remains produced only by `JSON.stringify`.
- [x] **Log-tail resource exhaustion** `src/log-tail.ts:41-61,132-139` - Unbounded `--lines` and whole-file reads allowed excessive allocation/processing. Requests are capped at 10,000 lines and content at 16 MiB with deterministic errors.

## Medium Findings

None detected.

## Low Findings

None detected.

## Reviewed Security Boundaries

- Lifecycle helpers accept injected adapters and do not invoke a shell. Service-manager representations use executable/argument arrays; product deployments must preserve this property and validate their fixed service identifiers.
- Full uninstall can remove state only through the injected product-owned state adapter; service-only uninstall does not deregister or remove state. Product adapters must retain path allowlists and confirmation at adoption.
- Registration is adapter-bound and exposes no arbitrary product/registry selector in the shared command surface.
- Update versions come from the approved-release adapter, preserve state by contract, and invoke rollback on failed health verification. Each product updater must authenticate release provenance and verify rollback health during adoption.
- Log options reject arbitrary `--path`, sources must match both product and service, secrets are redacted before writes, canonical paths remain inside the owned root, and abort closes the watcher.
- Help is pure data rendering; banner, version, command names, and summaries reject terminal-control-bearing content. JSON modes emit no banner/credit and serialize through `JSON.stringify`.
- Package metadata declares no production dependencies. `npm audit --audit-level=high` reported zero vulnerabilities; packaging verification confirmed the declared runtime/type surface.
- Rules-file hidden-Unicode scan and tracked `.env` check found no relevant files or secrets.

## Verification Evidence

| Gate | Result |
|---|---|
| `npm test` | PASS - 18 files, 261 tests (prior full run); security-focused rerun PASS - 18 log-tail tests |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npm run qa:packaging` | PASS - export, duplicate-symbol, declaration-map, and source-resolution checks |
| `npm audit --audit-level=high` | PASS - 0 vulnerabilities |

## Files Changed by Security Review

| File | Change |
|---|---|
| `src/log-tail.ts` | Added owned-root/canonical-path binding, symlink/traversal rejection, ANSI stripping, and resource limits. |
| `src/terminal-safety.ts` | Added reusable human-terminal control-sequence sanitizer. |
| `src/status.ts` | Sanitized runtime values before human rendering. |
| `src/telemetry-summary.ts` | Sanitized adapter values before human rendering. |
| `src/branding.ts` | Extended ASCII-only validation to versions and help manifest text. |
| `tests/log-tail.test.ts` | Added traversal, symlink, ANSI, and line-limit regression coverage. |
| `tests/status.test.ts` | Added OSC terminal-injection regression coverage. |
| `tests/telemetry-summary.test.ts` | Added ANSI terminal-injection regression coverage. |

## Deployment Follow-Up

This report does not mark any ledger criterion VERIFIED. During each product adoption, re-audit native service-manager argv construction, approved-release signature/integrity verification, rollback restart/health verification, uninstall allowlists, registry file permissions/locking, and the concrete filesystem adapter's canonical-path behavior. Run native platform and packed-artifact tests before release.
