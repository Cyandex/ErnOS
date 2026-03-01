---
summary: "CLI reference for `ernos config` (get/set/unset config values)"
read_when:
  - You want to read or edit config non-interactively
title: "config"
---

# `ernos config`

Config helpers: get/set/unset values by path. Run without a subcommand to open
the configure wizard (same as `ernos configure`).

## Examples

```bash
ernos config get browser.executablePath
ernos config set browser.executablePath "/usr/bin/google-chrome"
ernos config set agents.defaults.heartbeat.every "2h"
ernos config set agents.list[0].tools.exec.node "node-id-or-name"
ernos config unset tools.web.search.apiKey
```

## Paths

Paths use dot or bracket notation:

```bash
ernos config get agents.defaults.workspace
ernos config get agents.list[0].id
```

Use the agent list index to target a specific agent:

```bash
ernos config get agents.list
ernos config set agents.list[1].tools.exec.node "node-id-or-name"
```

## Values

Values are parsed as JSON5 when possible; otherwise they are treated as strings.
Use `--strict-json` to require JSON5 parsing. `--json` remains supported as a legacy alias.

```bash
ernos config set agents.defaults.heartbeat.every "0m"
ernos config set gateway.port 19001 --strict-json
ernos config set channels.whatsapp.groups '["*"]' --strict-json
```

Restart the gateway after edits.
