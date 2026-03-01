---
summary: "CLI reference for `ernos webhooks` (webhook helpers + Gmail Pub/Sub)"
read_when:
  - You want to wire Gmail Pub/Sub events into ErnOS
  - You want webhook helper commands
title: "webhooks"
---

# `ernos webhooks`

Webhook helpers and integrations (Gmail Pub/Sub, webhook helpers).

Related:

- Webhooks: [Webhook](/automation/webhook)
- Gmail Pub/Sub: [Gmail Pub/Sub](/automation/gmail-pubsub)

## Gmail

```bash
ernos webhooks gmail setup --account you@example.com
ernos webhooks gmail run
```

See [Gmail Pub/Sub documentation](/automation/gmail-pubsub) for details.
