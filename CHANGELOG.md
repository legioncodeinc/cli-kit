# Changelog

## Unreleased

## v0.3.0 — 2026-07-13

Adds the shared Apiary CLI interface foundation for Doctor, Hive, Honeycomb,
and Nectar: typed operational command manifests, canonical service command
aliases, lifecycle adapter contracts, product branding/help rendering, stable
human and JSON result envelopes, status and telemetry summaries, product-bound
log tailing with secret redaction, and a cross-product reference conformance
harness. Product repositories adopt these contracts in their own releases.

### Breaking behavior: declined actions exit 0

Doctor adopters must account for `declined()` returning `0`, replacing Doctor's
historical `EXIT_DECLINED = 2`. A repository audit found active Doctor source,
test, and operational-documentation dependencies on the old value. Remove
`EXIT_DECLINED`, route declines through `declined()`, and update assertions and
scripts that expect `2`. No compatibility alias is provided. See
[`docs/exit-code-migration.md`](docs/exit-code-migration.md) for before/after
code and the grep-backed findings.

## v0.2.0 — 2026-07-08

Initial release of @legioncodeinc/cli-kit, a zero-dependency ESM toolkit providing shared CLI mechanisms: color output, Windows-safe shutdown handling, exit codes, argument parsing, telemetry opt-out detection, and usage formatting.
