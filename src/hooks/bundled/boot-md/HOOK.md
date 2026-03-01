---
name: boot-md
description: "Run BOOT.md on gateway startup"
homepage: https://docs.ernos.ai/automation/hooks#boot-md
metadata:
  {
    "ernos":
      {
        "emoji": "🚀",
        "events": ["gateway:startup"],
        "requires": { "config": ["workspace.dir"] },
        "install": [{ "id": "bundled", "kind": "bundled", "label": "Bundled with ErnOS" }],
      },
  }
---

# Boot Checklist Hook

Runs `BOOT.md` at gateway startup for each configured agent scope, if the file exists in that
agent's resolved workspace.
