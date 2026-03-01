---
summary: "CLI reference for `ernos voicecall` (voice-call plugin command surface)"
read_when:
  - You use the voice-call plugin and want the CLI entry points
  - You want quick examples for `voicecall call|continue|status|tail|expose`
title: "voicecall"
---

# `ernos voicecall`

`voicecall` is a plugin-provided command. It only appears if the voice-call plugin is installed and enabled.

Primary doc:

- Voice-call plugin: [Voice Call](/plugins/voice-call)

## Common commands

```bash
ernos voicecall status --call-id <id>
ernos voicecall call --to "+15555550123" --message "Hello" --mode notify
ernos voicecall continue --call-id <id> --message "Any questions?"
ernos voicecall end --call-id <id>
```

## Exposing webhooks (Tailscale)

```bash
ernos voicecall expose --mode serve
ernos voicecall expose --mode funnel
ernos voicecall expose --mode off
```

Security note: only expose the webhook endpoint to networks you trust. Prefer Tailscale Serve over Funnel when possible.
