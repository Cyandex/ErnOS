---
summary: "CLI reference for `ernos devices` (device pairing + token rotation/revocation)"
read_when:
  - You are approving device pairing requests
  - You need to rotate or revoke device tokens
title: "devices"
---

# `ernos devices`

Manage device pairing requests and device-scoped tokens.

## Commands

### `ernos devices list`

List pending pairing requests and paired devices.

```
ernos devices list
ernos devices list --json
```

### `ernos devices remove <deviceId>`

Remove one paired device entry.

```
ernos devices remove <deviceId>
ernos devices remove <deviceId> --json
```

### `ernos devices clear --yes [--pending]`

Clear paired devices in bulk.

```
ernos devices clear --yes
ernos devices clear --yes --pending
ernos devices clear --yes --pending --json
```

### `ernos devices approve [requestId] [--latest]`

Approve a pending device pairing request. If `requestId` is omitted, ErnOS
automatically approves the most recent pending request.

```
ernos devices approve
ernos devices approve <requestId>
ernos devices approve --latest
```

### `ernos devices reject <requestId>`

Reject a pending device pairing request.

```
ernos devices reject <requestId>
```

### `ernos devices rotate --device <id> --role <role> [--scope <scope...>]`

Rotate a device token for a specific role (optionally updating scopes).

```
ernos devices rotate --device <deviceId> --role operator --scope operator.read --scope operator.write
```

### `ernos devices revoke --device <id> --role <role>`

Revoke a device token for a specific role.

```
ernos devices revoke --device <deviceId> --role node
```

## Common options

- `--url <url>`: Gateway WebSocket URL (defaults to `gateway.remote.url` when configured).
- `--token <token>`: Gateway token (if required).
- `--password <password>`: Gateway password (password auth).
- `--timeout <ms>`: RPC timeout.
- `--json`: JSON output (recommended for scripting).

Note: when you set `--url`, the CLI does not fall back to config or environment credentials.
Pass `--token` or `--password` explicitly. Missing explicit credentials is an error.

## Notes

- Token rotation returns a new token (sensitive). Treat it like a secret.
- These commands require `operator.pairing` (or `operator.admin`) scope.
- `devices clear` is intentionally gated by `--yes`.
- If pairing scope is unavailable on local loopback (and no explicit `--url` is passed), list/approve can use a local pairing fallback.
