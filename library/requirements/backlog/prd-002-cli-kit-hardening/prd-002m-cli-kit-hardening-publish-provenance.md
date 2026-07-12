<!-- library/requirements/backlog/prd-002-cli-kit-hardening/prd-002m-cli-kit-hardening-publish-provenance.md -->

# PRD-002m: npm provenance + publish config + SBOM

> **Parent:** [`prd-002-cli-kit-hardening`](./prd-002-cli-kit-hardening-index.md)
> **Status:** Backlog · **Priority:** P3 · **Effort:** S (1–3h) · **Band:** Packaging polish

---

## Overview

PRD-001 flagged supply-chain hardening as a SHOULD in its Versioning section: *"On publish, the kit SHOULD emit npm provenance (`npm publish --provenance`) and a CycloneDX SBOM, matching the supply-chain posture expected of the suite."* It was not part of the v1 deliverable. This sub-PRD lands it. Given the kit is load-bearing infrastructure for five CLIs and is AGPL-licensed, verifiable provenance and an SBOM are worth the small setup cost.

## Goals

- Published releases carry npm provenance attestation.
- Each release ships (or generates) an SBOM.
- Publish configuration is explicit and correct for a public, scoped, AGPL package.

## Non-Goals

- A full org-wide supply-chain program — scope is this package's publish path.
- Changing the license or the `files` allowlist beyond what provenance/SBOM require.

## User stories

- As a consumer, I can verify the published package was built from the expected source/CI via npm provenance.
- As a security reviewer, I can read the SBOM to see exactly what the package contains (zero runtime deps → a trivially small SBOM, which is itself a selling point).

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-m1 | The release workflow publishes with `npm publish --provenance` (from a trusted CI with the required OIDC permissions). |
| AC-m2 | `publishConfig` in `package.json` is set appropriately (`"access": "public"`, `"provenance": true`) for the scoped public package. |
| AC-m3 | A CycloneDX SBOM is generated for each release and attached (release asset or tarball), reflecting the zero-runtime-dependency tree. |
| AC-m4 | The provenance/SBOM steps run in CI, not from a maintainer's laptop, so attestation is trustworthy. |
| AC-m5 | Documentation notes how a consumer verifies provenance (`npm audit signatures` / registry UI). |

## Implementation notes

Add `--provenance` to the publish step in the release workflow (requires `id-token: write` in the GitHub Actions job). Set `publishConfig.provenance` + `access` in `package.json`. Generate the SBOM with a CycloneDX tool in CI (e.g. `@cyclonedx/cyclonedx-npm`) and attach it. Because `dependencies` is empty, the SBOM is minimal — keep it that way as a supply-chain feature.

## Resolved decisions

- **SBOM location → GitHub release asset only** (2026-07-12). Keeps the npm tarball lean, which matters given the kit's zero-dependency selling point; anyone auditing supply chain finds the SBOM attached to the release. Not included in the npm tarball.

## Open questions

- None.

## Related

- [`prd-001-cli-kit`](../../completed/prd-001-cli-kit/prd-001-cli-kit-index.md) §Versioning — where provenance/SBOM was first flagged as a SHOULD.
- Source: [`cli-kit/package.json`](../../../../cli-kit/package.json), the release workflow under `.github/`.
