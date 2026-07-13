# PRD-003 consumer adoption checklist

This is the deployment gate for Doctor, Hive, Honeycomb, and Nectar. cli-kit preparation does not mark a product adopted.

## Per-product checklist

- [ ] Install the released cli-kit version and compose the product command manifest.
- [ ] Supply package-derived version, product-owned descriptor, and reviewed ASCII-only art.
- [ ] Route bare invocation, `help`, `-h`, and `--help` through the pure banner renderer.
- [ ] Route `--version` and `--version --json` through the shared version renderers.
- [ ] Wire every baseline command to a real product-owned adapter; Doctor alone omits `register`.
- [ ] Preserve specialized commands under `Product commands` and preserve documented aliases for one minor release.
- [ ] Run golden cases at 80 and narrow columns with `NO_COLOR`, non-TTY, `--no-color`, and JSON modes.
- [ ] Prove `logs` resolves only the product's authoritative service log source.
- [ ] Test the packed executable, not only its source entry point.
- [ ] Add a changelog entry covering commands, aliases, semantics, exits, and output changes.
- [ ] Run native Windows, macOS, and Linux service-adapter CI.

## Suite conformance job

Install all four packed artifacts in an isolated directory. For each executable run bare, help, version, unknown-command, and human/JSON success and failure fixtures. Compare command presence, group order, brand anatomy, exact credit, version source, JSON cleanliness, and log-source identity. A displayed command without a functioning injected adapter is a failure.

## Remaining deployment evidence

PRD-003e AC-e1 through AC-e8 require evidence from sibling product repositories and their native CI. AC-e10 requires four published releases. Those gaps intentionally remain open while cli-kit is being prepared.
