---
summary: "Uninstall ErnOS completely (CLI, service, state, workspace)"
read_when:
  - You want to remove ErnOS from a machine
  - The gateway service is still running after uninstall
title: "Uninstall"
---

# Uninstall

Two paths:

- **Easy path** if `ernos` is still installed.
- **Manual service removal** if the CLI is gone but the service is still running.

## Easy path (CLI still installed)

Recommended: use the built-in uninstaller:

```bash
ernos uninstall
```

Non-interactive (automation / npx):

```bash
ernos uninstall --all --yes --non-interactive
npx -y ernos uninstall --all --yes --non-interactive
```

Manual steps (same result):

1. Stop the gateway service:

```bash
ernos gateway stop
```

2. Uninstall the gateway service (launchd/systemd/schtasks):

```bash
ernos gateway uninstall
```

3. Delete state + config:

```bash
rm -rf "${ERNOS_STATE_DIR:-$HOME/.ernos}"
```

If you set `ERNOS_CONFIG_PATH` to a custom location outside the state dir, delete that file too.

4. Delete your workspace (optional, removes agent files):

```bash
rm -rf ~/.ernos/workspace
```

5. Remove the CLI install (pick the one you used):

```bash
npm rm -g ernos
pnpm remove -g ernos
bun remove -g ernos
```

6. If you installed the macOS app:

```bash
rm -rf /Applications/ErnOS.app
```

Notes:

- If you used profiles (`--profile` / `ERNOS_PROFILE`), repeat step 3 for each state dir (defaults are `~/.ernos-<profile>`).
- In remote mode, the state dir lives on the **gateway host**, so run steps 1-4 there too.

## Manual service removal (CLI not installed)

Use this if the gateway service keeps running but `ernos` is missing.

### macOS (launchd)

Default label is `ai.ernos.gateway` (or `ai.ernos.<profile>`; legacy `com.ernos.*` may still exist):

```bash
launchctl bootout gui/$UID/ai.ernos.gateway
rm -f ~/Library/LaunchAgents/ai.ernos.gateway.plist
```

If you used a profile, replace the label and plist name with `ai.ernos.<profile>`. Remove any legacy `com.ernos.*` plists if present.

### Linux (systemd user unit)

Default unit name is `ernos-gateway.service` (or `ernos-gateway-<profile>.service`):

```bash
systemctl --user disable --now ernos-gateway.service
rm -f ~/.config/systemd/user/ernos-gateway.service
systemctl --user daemon-reload
```

### Windows (Scheduled Task)

Default task name is `ErnOS Gateway` (or `ErnOS Gateway (<profile>)`).
The task script lives under your state dir.

```powershell
schtasks /Delete /F /TN "ErnOS Gateway"
Remove-Item -Force "$env:USERPROFILE\.ernos\gateway.cmd"
```

If you used a profile, delete the matching task name and `~\.ernos-<profile>\gateway.cmd`.

## Normal install vs source checkout

### Normal install (install.sh / npm / pnpm / bun)

If you used `https://ernos.ai/install.sh` or `install.ps1`, the CLI was installed with `npm install -g ernos@latest`.
Remove it with `npm rm -g ernos` (or `pnpm remove -g` / `bun remove -g` if you installed that way).

### Source checkout (git clone)

If you run from a repo checkout (`git clone` + `ernos ...` / `bun run ernos ...`):

1. Uninstall the gateway service **before** deleting the repo (use the easy path above or manual service removal).
2. Delete the repo directory.
3. Remove state + workspace as shown above.
