---
summary: "CLI reference for `ernos tui` (terminal UI connected to the Gateway)"
read_when:
  - You want a terminal UI for the Gateway (remote-friendly)
  - You want to pass url/token/session from scripts
title: "tui"
---

# `ernos tui`

Open the terminal UI connected to the Gateway.

Related:

- TUI guide: [TUI](/web/tui)

## Examples

```bash
ernos tui
ernos tui --url ws://127.0.0.1:18789 --token <token>
ernos tui --session main --deliver
```
