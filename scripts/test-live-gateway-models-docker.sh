#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="${ERNOS_IMAGE:-${ERNOS_IMAGE:-ernos:local}}"
CONFIG_DIR="${ERNOS_CONFIG_DIR:-${ERNOS_CONFIG_DIR:-$HOME/.ernos}}"
WORKSPACE_DIR="${ERNOS_WORKSPACE_DIR:-${ERNOS_WORKSPACE_DIR:-$HOME/.ernos/workspace}}"
PROFILE_FILE="${ERNOS_PROFILE_FILE:-${ERNOS_PROFILE_FILE:-$HOME/.profile}}"

PROFILE_MOUNT=()
if [[ -f "$PROFILE_FILE" ]]; then
  PROFILE_MOUNT=(-v "$PROFILE_FILE":/home/node/.profile:ro)
fi

echo "==> Build image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" -f "$ROOT_DIR/Dockerfile" "$ROOT_DIR"

echo "==> Run gateway live model tests (profile keys)"
docker run --rm -t \
  --entrypoint bash \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -e HOME=/home/node \
  -e NODE_OPTIONS=--disable-warning=ExperimentalWarning \
  -e ERNOS_LIVE_TEST=1 \
  -e ERNOS_LIVE_GATEWAY_MODELS="${ERNOS_LIVE_GATEWAY_MODELS:-${ERNOS_LIVE_GATEWAY_MODELS:-modern}}" \
  -e ERNOS_LIVE_GATEWAY_PROVIDERS="${ERNOS_LIVE_GATEWAY_PROVIDERS:-${ERNOS_LIVE_GATEWAY_PROVIDERS:-}}" \
  -e ERNOS_LIVE_GATEWAY_MAX_MODELS="${ERNOS_LIVE_GATEWAY_MAX_MODELS:-${ERNOS_LIVE_GATEWAY_MAX_MODELS:-24}}" \
  -e ERNOS_LIVE_GATEWAY_MODEL_TIMEOUT_MS="${ERNOS_LIVE_GATEWAY_MODEL_TIMEOUT_MS:-${ERNOS_LIVE_GATEWAY_MODEL_TIMEOUT_MS:-}}" \
  -v "$CONFIG_DIR":/home/node/.ernos \
  -v "$WORKSPACE_DIR":/home/node/.ernos/workspace \
  "${PROFILE_MOUNT[@]}" \
  "$IMAGE_NAME" \
  -lc "set -euo pipefail; [ -f \"$HOME/.profile\" ] && source \"$HOME/.profile\" || true; cd /app && pnpm test:live"
