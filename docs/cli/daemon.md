---
summary: "CLI reference for `ernos daemon` (legacy alias for gateway service management)"
read_when:
  - You still use `ernos daemon ...` in scripts
  - You need service lifecycle commands (install/start/stop/restart/status)
title: "daemon"
---

# `ernos daemon`

Legacy alias for Gateway service management commands.

`ernos daemon ...` maps to the same service control surface as `ernos gateway ...` service commands.

## Usage

```bash
ernos daemon status
ernos daemon install
ernos daemon start
ernos daemon stop
ernos daemon restart
ernos daemon uninstall
```

## Subcommands

- `status`: show service install state and probe Gateway health
- `install`: install service (`launchd`/`systemd`/`schtasks`)
- `uninstall`: remove service
- `start`: start service
- `stop`: stop service
- `restart`: restart service

## Common options

- `status`: `--url`, `--token`, `--password`, `--timeout`, `--no-probe`, `--deep`, `--json`
- `install`: `--port`, `--runtime <node|bun>`, `--token`, `--force`, `--json`
- lifecycle (`uninstall|start|stop|restart`): `--json`

## Prefer

Use [`ernos gateway`](/cli/gateway) for current docs and examples.
