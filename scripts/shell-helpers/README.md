# ClawDock <!-- omit in toc -->

Stop typing `docker-compose` commands. Just type `ernosdock-start`.

Inspired by Simon Willison's [Running ErnOS in Docker](https://til.simonwillison.net/llms/ernos-docker).

- [Quickstart](#quickstart)
- [Available Commands](#available-commands)
  - [Basic Operations](#basic-operations)
  - [Container Access](#container-access)
  - [Web UI \& Devices](#web-ui--devices)
  - [Setup \& Configuration](#setup--configuration)
  - [Maintenance](#maintenance)
  - [Utilities](#utilities)
- [Common Workflows](#common-workflows)
  - [Check Status and Logs](#check-status-and-logs)
  - [Set Up WhatsApp Bot](#set-up-whatsapp-bot)
  - [Troubleshooting Device Pairing](#troubleshooting-device-pairing)
  - [Fix Token Mismatch Issues](#fix-token-mismatch-issues)
  - [Permission Denied](#permission-denied)
- [Requirements](#requirements)

## Quickstart

**Install:**

```bash
mkdir -p ~/.ernosdock && curl -sL https://raw.githubusercontent.com/ernos/ernos/main/scripts/shell-helpers/ernosdock-helpers.sh -o ~/.ernosdock/ernosdock-helpers.sh
```

```bash
echo 'source ~/.ernosdock/ernosdock-helpers.sh' >> ~/.zshrc && source ~/.zshrc
```

**See what you get:**

```bash
ernosdock-help
```

On first command, ClawDock auto-detects your ErnOS directory:

- Checks common paths (`~/ernos`, `~/workspace/ernos`, etc.)
- If found, asks you to confirm
- Saves to `~/.ernosdock/config`

**First time setup:**

```bash
ernosdock-start
```

```bash
ernosdock-fix-token
```

```bash
ernosdock-dashboard
```

If you see "pairing required":

```bash
ernosdock-devices
```

And approve the request for the specific device:

```bash
ernosdock-approve <request-id>
```

## Available Commands

### Basic Operations

| Command             | Description                     |
| ------------------- | ------------------------------- |
| `ernosdock-start`   | Start the gateway               |
| `ernosdock-stop`    | Stop the gateway                |
| `ernosdock-restart` | Restart the gateway             |
| `ernosdock-status`  | Check container status          |
| `ernosdock-logs`    | View live logs (follows output) |

### Container Access

| Command                    | Description                                    |
| -------------------------- | ---------------------------------------------- |
| `ernosdock-shell`          | Interactive shell inside the gateway container |
| `ernosdock-cli <command>`  | Run ErnOS CLI commands                         |
| `ernosdock-exec <command>` | Execute arbitrary commands in the container    |

### Web UI & Devices

| Command                  | Description                                |
| ------------------------ | ------------------------------------------ |
| `ernosdock-dashboard`    | Open web UI in browser with authentication |
| `ernosdock-devices`      | List device pairing requests               |
| `ernosdock-approve <id>` | Approve a device pairing request           |

### Setup & Configuration

| Command               | Description                                       |
| --------------------- | ------------------------------------------------- |
| `ernosdock-fix-token` | Configure gateway authentication token (run once) |

### Maintenance

| Command             | Description                                      |
| ------------------- | ------------------------------------------------ |
| `ernosdock-rebuild` | Rebuild the Docker image                         |
| `ernosdock-clean`   | Remove all containers and volumes (destructive!) |

### Utilities

| Command               | Description                               |
| --------------------- | ----------------------------------------- |
| `ernosdock-health`    | Run gateway health check                  |
| `ernosdock-token`     | Display the gateway authentication token  |
| `ernosdock-cd`        | Jump to the ErnOS project directory       |
| `ernosdock-config`    | Open the ErnOS config directory           |
| `ernosdock-workspace` | Open the workspace directory              |
| `ernosdock-help`      | Show all available commands with examples |

## Common Workflows

### Check Status and Logs

**Restart the gateway:**

```bash
ernosdock-restart
```

**Check container status:**

```bash
ernosdock-status
```

**View live logs:**

```bash
ernosdock-logs
```

### Set Up WhatsApp Bot

**Shell into the container:**

```bash
ernosdock-shell
```

**Inside the container, login to WhatsApp:**

```bash
ernos channels login --channel whatsapp --verbose
```

Scan the QR code with WhatsApp on your phone.

**Verify connection:**

```bash
ernos status
```

### Troubleshooting Device Pairing

**Check for pending pairing requests:**

```bash
ernosdock-devices
```

**Copy the Request ID from the "Pending" table, then approve:**

```bash
ernosdock-approve <request-id>
```

Then refresh your browser.

### Fix Token Mismatch Issues

If you see "gateway token mismatch" errors:

```bash
ernosdock-fix-token
```

This will:

1. Read the token from your `.env` file
2. Configure it in the ErnOS config
3. Restart the gateway
4. Verify the configuration

### Permission Denied

**Ensure Docker is running and you have permission:**

```bash
docker ps
```

## Requirements

- Docker and Docker Compose installed
- Bash or Zsh shell
- ErnOS project (from `docker-setup.sh`)

## Development

**Test with fresh config (mimics first-time install):**

```bash
unset CLAWDOCK_DIR && rm -f ~/.ernosdock/config && source scripts/shell-helpers/ernosdock-helpers.sh
```

Then run any command to trigger auto-detect:

```bash
ernosdock-start
```
