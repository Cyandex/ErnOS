#!/usr/bin/env bash
# One-time host setup for rootless ErnOS in Podman: creates the ernos
# user, builds the image, loads it into that user's Podman store, and installs
# the launch script. Run from repo root with sudo capability.
#
# Usage: ./setup-podman.sh [--quadlet|--container]
#   --quadlet   Install systemd Quadlet so the container runs as a user service
#   --container Only install user + image + launch script; you start the container manually (default)
#   Or set ERNOS_PODMAN_QUADLET=1 (or 0) to choose without a flag.
#
# After this, start the gateway manually:
#   ./scripts/run-ernos-podman.sh launch
#   ./scripts/run-ernos-podman.sh launch setup   # onboarding wizard
# Or as the ernos user: sudo -u ernos /home/ernos/run-ernos-podman.sh
# If you used --quadlet, you can also: sudo systemctl --machine ernos@ --user start ernos.service
set -euo pipefail

ERNOS_USER="${ERNOS_PODMAN_USER:-ernos}"
REPO_PATH="${ERNOS_REPO_PATH:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
RUN_SCRIPT_SRC="$REPO_PATH/scripts/run-ernos-podman.sh"
QUADLET_TEMPLATE="$REPO_PATH/scripts/podman/ernos.container.in"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing dependency: $1" >&2
    exit 1
  fi
}

is_root() { [[ "$(id -u)" -eq 0 ]]; }

run_root() {
  if is_root; then
    "$@"
  else
    sudo "$@"
  fi
}

run_as_user() {
  local user="$1"
  shift
  if command -v sudo >/dev/null 2>&1; then
    sudo -u "$user" "$@"
  elif is_root && command -v runuser >/dev/null 2>&1; then
    runuser -u "$user" -- "$@"
  else
    echo "Need sudo (or root+runuser) to run commands as $user." >&2
    exit 1
  fi
}

run_as_ernos() {
  # Avoid root writes into $ERNOS_HOME (symlink/hardlink/TOCTOU footguns).
  # Anything under the target user's home should be created/modified as that user.
  run_as_user "$ERNOS_USER" env HOME="$ERNOS_HOME" "$@"
}

# Quadlet: opt-in via --quadlet or ERNOS_PODMAN_QUADLET=1
INSTALL_QUADLET=false
for arg in "$@"; do
  case "$arg" in
    --quadlet)   INSTALL_QUADLET=true ;;
    --container) INSTALL_QUADLET=false ;;
  esac
done
if [[ -n "${ERNOS_PODMAN_QUADLET:-}" ]]; then
  case "${ERNOS_PODMAN_QUADLET,,}" in
    1|yes|true)  INSTALL_QUADLET=true ;;
    0|no|false) INSTALL_QUADLET=false ;;
  esac
fi

require_cmd podman
if ! is_root; then
  require_cmd sudo
fi
if [[ ! -f "$REPO_PATH/Dockerfile" ]]; then
  echo "Dockerfile not found at $REPO_PATH. Set ERNOS_REPO_PATH to the repo root." >&2
  exit 1
fi
if [[ ! -f "$RUN_SCRIPT_SRC" ]]; then
  echo "Launch script not found at $RUN_SCRIPT_SRC." >&2
  exit 1
fi

generate_token_hex_32() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
    return 0
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
    return 0
  fi
  if command -v od >/dev/null 2>&1; then
    # 32 random bytes -> 64 lowercase hex chars
    od -An -N32 -tx1 /dev/urandom | tr -d " \n"
    return 0
  fi
  echo "Missing dependency: need openssl or python3 (or od) to generate ERNOS_GATEWAY_TOKEN." >&2
  exit 1
}

user_exists() {
  local user="$1"
  if command -v getent >/dev/null 2>&1; then
    getent passwd "$user" >/dev/null 2>&1 && return 0
  fi
  id -u "$user" >/dev/null 2>&1
}

resolve_user_home() {
  local user="$1"
  local home=""
  if command -v getent >/dev/null 2>&1; then
    home="$(getent passwd "$user" 2>/dev/null | cut -d: -f6 || true)"
  fi
  if [[ -z "$home" && -f /etc/passwd ]]; then
    home="$(awk -F: -v u="$user" '$1==u {print $6}' /etc/passwd 2>/dev/null || true)"
  fi
  if [[ -z "$home" ]]; then
    home="/home/$user"
  fi
  printf '%s' "$home"
}

resolve_nologin_shell() {
  for cand in /usr/sbin/nologin /sbin/nologin /usr/bin/nologin /bin/false; do
    if [[ -x "$cand" ]]; then
      printf '%s' "$cand"
      return 0
    fi
  done
  printf '%s' "/usr/sbin/nologin"
}

# Create ernos user (non-login, with home) if missing
if ! user_exists "$ERNOS_USER"; then
  NOLOGIN_SHELL="$(resolve_nologin_shell)"
  echo "Creating user $ERNOS_USER ($NOLOGIN_SHELL, with home)..."
  if command -v useradd >/dev/null 2>&1; then
    run_root useradd -m -s "$NOLOGIN_SHELL" "$ERNOS_USER"
  elif command -v adduser >/dev/null 2>&1; then
    # Debian/Ubuntu: adduser supports --disabled-password/--gecos. Busybox adduser differs.
    run_root adduser --disabled-password --gecos "" --shell "$NOLOGIN_SHELL" "$ERNOS_USER"
  else
    echo "Neither useradd nor adduser found, cannot create user $ERNOS_USER." >&2
    exit 1
  fi
else
  echo "User $ERNOS_USER already exists."
fi

ERNOS_HOME="$(resolve_user_home "$ERNOS_USER")"
ERNOS_UID="$(id -u "$ERNOS_USER" 2>/dev/null || true)"
ERNOS_CONFIG="$ERNOS_HOME/.ernos"
LAUNCH_SCRIPT_DST="$ERNOS_HOME/run-ernos-podman.sh"

# Prefer systemd user services (Quadlet) for production. Enable lingering early so rootless Podman can run
# without an interactive login.
if command -v loginctl &>/dev/null; then
  run_root loginctl enable-linger "$ERNOS_USER" 2>/dev/null || true
fi
if [[ -n "${ERNOS_UID:-}" && -d /run/user ]] && command -v systemctl &>/dev/null; then
  run_root systemctl start "user@${ERNOS_UID}.service" 2>/dev/null || true
fi

# Rootless Podman needs subuid/subgid for the run user
if ! grep -q "^${ERNOS_USER}:" /etc/subuid 2>/dev/null; then
  echo "Warning: $ERNOS_USER has no subuid range. Rootless Podman may fail." >&2
  echo "  Add a line to /etc/subuid and /etc/subgid, e.g.: $ERNOS_USER:100000:65536" >&2
fi

echo "Creating $ERNOS_CONFIG and workspace..."
run_as_ernos mkdir -p "$ERNOS_CONFIG/workspace"
run_as_ernos chmod 700 "$ERNOS_CONFIG" "$ERNOS_CONFIG/workspace" 2>/dev/null || true

ENV_FILE="$ERNOS_CONFIG/.env"
if run_as_ernos test -f "$ENV_FILE"; then
  if ! run_as_ernos grep -q '^ERNOS_GATEWAY_TOKEN=' "$ENV_FILE" 2>/dev/null; then
    TOKEN="$(generate_token_hex_32)"
    printf 'ERNOS_GATEWAY_TOKEN=%s\n' "$TOKEN" | run_as_ernos tee -a "$ENV_FILE" >/dev/null
    echo "Added ERNOS_GATEWAY_TOKEN to $ENV_FILE."
  fi
  run_as_ernos chmod 600 "$ENV_FILE" 2>/dev/null || true
else
  TOKEN="$(generate_token_hex_32)"
  printf 'ERNOS_GATEWAY_TOKEN=%s\n' "$TOKEN" | run_as_ernos tee "$ENV_FILE" >/dev/null
  run_as_ernos chmod 600 "$ENV_FILE" 2>/dev/null || true
  echo "Created $ENV_FILE with new token."
fi

# The gateway refuses to start unless gateway.mode=local is set in config.
# Make first-run non-interactive; users can run the wizard later to configure channels/providers.
ERNOS_JSON="$ERNOS_CONFIG/ernos.json"
if ! run_as_ernos test -f "$ERNOS_JSON"; then
  printf '%s\n' '{ gateway: { mode: "local" } }' | run_as_ernos tee "$ERNOS_JSON" >/dev/null
  run_as_ernos chmod 600 "$ERNOS_JSON" 2>/dev/null || true
  echo "Created $ERNOS_JSON (minimal gateway.mode=local)."
fi

echo "Building image from $REPO_PATH..."
podman build -t ernos:local -f "$REPO_PATH/Dockerfile" "$REPO_PATH"

echo "Loading image into $ERNOS_USER's Podman store..."
TMP_IMAGE="$(mktemp -p /tmp ernos-image.XXXXXX.tar)"
trap 'rm -f "$TMP_IMAGE"' EXIT
podman save ernos:local -o "$TMP_IMAGE"
chmod 644 "$TMP_IMAGE"
(cd /tmp && run_as_user "$ERNOS_USER" env HOME="$ERNOS_HOME" podman load -i "$TMP_IMAGE")
rm -f "$TMP_IMAGE"
trap - EXIT

echo "Copying launch script to $LAUNCH_SCRIPT_DST..."
run_root cat "$RUN_SCRIPT_SRC" | run_as_ernos tee "$LAUNCH_SCRIPT_DST" >/dev/null
run_as_ernos chmod 755 "$LAUNCH_SCRIPT_DST"

# Optionally install systemd quadlet for ernos user (rootless Podman + systemd)
QUADLET_DIR="$ERNOS_HOME/.config/containers/systemd"
if [[ "$INSTALL_QUADLET" == true && -f "$QUADLET_TEMPLATE" ]]; then
  echo "Installing systemd quadlet for $ERNOS_USER..."
  run_as_ernos mkdir -p "$QUADLET_DIR"
  ERNOS_HOME_SED="$(printf '%s' "$ERNOS_HOME" | sed -e 's/[\\/&|]/\\\\&/g')"
  sed "s|{{ERNOS_HOME}}|$ERNOS_HOME_SED|g" "$QUADLET_TEMPLATE" | run_as_ernos tee "$QUADLET_DIR/ernos.container" >/dev/null
  run_as_ernos chmod 700 "$ERNOS_HOME/.config" "$ERNOS_HOME/.config/containers" "$QUADLET_DIR" 2>/dev/null || true
  run_as_ernos chmod 600 "$QUADLET_DIR/ernos.container" 2>/dev/null || true
  if command -v systemctl &>/dev/null; then
    run_root systemctl --machine "${ERNOS_USER}@" --user daemon-reload 2>/dev/null || true
    run_root systemctl --machine "${ERNOS_USER}@" --user enable ernos.service 2>/dev/null || true
    run_root systemctl --machine "${ERNOS_USER}@" --user start ernos.service 2>/dev/null || true
  fi
fi

echo ""
echo "Setup complete. Start the gateway:"
echo "  $RUN_SCRIPT_SRC launch"
echo "  $RUN_SCRIPT_SRC launch setup   # onboarding wizard"
echo "Or as $ERNOS_USER (e.g. from cron):"
echo "  sudo -u $ERNOS_USER $LAUNCH_SCRIPT_DST"
echo "  sudo -u $ERNOS_USER $LAUNCH_SCRIPT_DST setup"
if [[ "$INSTALL_QUADLET" == true ]]; then
  echo "Or use systemd (quadlet):"
  echo "  sudo systemctl --machine ${ERNOS_USER}@ --user start ernos.service"
  echo "  sudo systemctl --machine ${ERNOS_USER}@ --user status ernos.service"
else
  echo "To install systemd quadlet later: $0 --quadlet"
fi
