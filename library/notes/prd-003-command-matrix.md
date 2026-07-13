# Apiary suite command matrix

Normative meanings live in PRD-003; product documentation should link here and document only specialized commands.

| Command | Doctor | Hive | Honeycomb | Nectar |
|---|---:|---:|---:|---:|
| `start`, `stop`, `restart`, `status`, `logs` | Yes | Yes | Yes | Yes |
| `install`, `uninstall` | Yes | Yes | Yes | Yes |
| `service-install`, `service-uninstall`, `update` | Yes | Yes | Yes | Yes |
| `register` | Exempt | Yes | Yes | Yes |
| `telemetry`, `--help`, `--version` | Yes | Yes | Yes | Yes |

The shared reference harness validates presentation and dispatch contracts. It does not replace real service, update, registration, logs, or telemetry adapters.
