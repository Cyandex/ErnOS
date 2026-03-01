---
summary: "CLI reference for `ernos setup` (initialize config + workspace)"
read_when:
  - You’re doing first-run setup without the full onboarding wizard
  - You want to set the default workspace path
title: "setup"
---

# `ernos setup`

Initialize `~/.ernos/ernos.json` and the agent workspace.

Related:

- Getting started: [Getting started](/start/getting-started)
- Wizard: [Onboarding](/start/onboarding)

## Examples

```bash
ernos setup
ernos setup --workspace ~/.ernos/workspace
```

To run the wizard via setup:

```bash
ernos setup --wizard
```
