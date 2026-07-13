# Release automation (AI changesets → gated bump → publish → Discord)

This repo automates the full release path. Humans write code; the version bump,
release notes, npm publish, and Discord announcement are automated, with a
single human gate on `minor` releases.

> Replicated from the pilot implementation on `doctor`/`hive`/`honeycomb`/`nectar`.

## The flow

```
PR opened ──▶ release-gate.yaml
                │  Claude Sonnet 5 (Bedrock) reads the diff, picks a bump,
                │  writes .changeset/ai-*.md
                ├─ patch ─▶ bump on the PR branch now ........ release-gate = success
                ├─ minor ─▶ hold ............................. release-gate = pending
                │            └─ @thenotoriousllama comments "Approved Release"
                │               ▶ bump on the PR branch ...... release-gate = success
                └─ major ─▶ blocked, label needs-manual-release release-gate = failure
                                     │
PR merges to main ───────────────────┘
   │  tag-on-merge.yaml sees the new package.json version and pushes vX.Y.Z
   │  (via RELEASE_PAT so the tag triggers the next workflow)
   ▼
release.yaml (publish core)
   │  full gate → npm publish (OIDC trusted publishing) → post-publish smoke
   ├─ ai-release-notes.mjs → RELEASE_NOTES.md (Sonnet 5, fail-soft)
   ├─ GitHub Release (body = RELEASE_NOTES.md)
   └─ discord-notify.mjs → Discord webhook
```

## Required secrets and variables

Before the first real release, configure these in the GitHub repo settings:

### Secrets
| Secret | Purpose |
|---|---|
| `AWS_BEDROCK_API_KEY` | Amazon Bedrock API key (bearer token for Claude Sonnet 5) |
| `RELEASE_PAT` | Fine-grained PAT with `contents:write` (tag push) + `pull-requests:write` (label/comment) |
| `DISCORD_WEBHOOK_URL` | Discord webhook for release announcements (optional — fail-soft) |

### Variables
| Variable | Example | Purpose |
|---|---|---|
| `AWS_REGION` | `us-east-1` | Bedrock region |
| `BEDROCK_MODEL_ID` | (Sonnet 5 inference-profile id) | The model the changeset/notes scripts call |

### npm trusted-publisher configuration
1. **Bootstrap publish** — the first `@legioncodeinc/cli-kit` publish is a one-time manual `npm publish` (2FA) to create the package on the registry.
2. **Configure trusted publisher** — on npmjs.com, under the package settings, add the trusted publisher: org `legioncodeinc`, repo `cli-kit`, workflow filename `release.yaml`.
3. After that, every CI publish from a `vX.Y.Z` tag is tokenless via OIDC.

## Verifying provenance and the SBOM

Releases are published by `.github/workflows/release.yaml` with npm trusted
publishing and `--provenance`; the workflow has the required `id-token: write`
permission. npm's package page displays the provenance badge and links the
attestation to this repository and workflow. A consumer can also install the
package into a clean project and run `npm audit signatures` to verify registry
signatures and provenance attestations supported by npm.

The same CI job generates a CycloneDX 1.6 JSON SBOM named
`cli-kit-vX.Y.Z.cdx.json` and attaches it to the matching GitHub Release. The
SBOM is intentionally a release asset rather than part of the npm tarball.
Development tools are omitted, so its component and dependency graph directly
reflects the package's zero-runtime-dependency contract.

## The `release-gate` required check

Add `release-gate` as a **required status check** on the `main` branch protection rule (Settings → Branches → main → Require status checks). This prevents merging a PR until the release gate is green.
