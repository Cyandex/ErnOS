---
summary: "CLI reference for `ernos logs` (tail gateway logs via RPC)"
read_when:
  - You need to tail Gateway logs remotely (without SSH)
  - You want JSON log lines for tooling
title: "logs"
---

# `ernos logs`

Tail Gateway file logs over RPC (works in remote mode).

Related:

- Logging overview: [Logging](/logging)

## Examples

```bash
ernos logs
ernos logs --follow
ernos logs --json
ernos logs --limit 500
ernos logs --local-time
ernos logs --follow --local-time
```

Use `--local-time` to render timestamps in your local timezone.
