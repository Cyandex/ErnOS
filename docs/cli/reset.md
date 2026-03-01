---
summary: "CLI reference for `ernos reset` (reset local state/config)"
read_when:
  - You want to wipe local state while keeping the CLI installed
  - You want a dry-run of what would be removed
title: "reset"
---

# `ernos reset`

Reset local config/state (keeps the CLI installed).

```bash
ernos reset
ernos reset --dry-run
ernos reset --scope config+creds+sessions --yes --non-interactive
```
