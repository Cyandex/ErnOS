#!/usr/bin/env bash
set -euo pipefail

cd /repo

export ERNOS_STATE_DIR="/tmp/ernos-test"
export ERNOS_CONFIG_PATH="${ERNOS_STATE_DIR}/ernos.json"

echo "==> Build"
pnpm build

echo "==> Seed state"
mkdir -p "${ERNOS_STATE_DIR}/credentials"
mkdir -p "${ERNOS_STATE_DIR}/agents/main/sessions"
echo '{}' >"${ERNOS_CONFIG_PATH}"
echo 'creds' >"${ERNOS_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${ERNOS_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
pnpm ernos reset --scope config+creds+sessions --yes --non-interactive

test ! -f "${ERNOS_CONFIG_PATH}"
test ! -d "${ERNOS_STATE_DIR}/credentials"
test ! -d "${ERNOS_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${ERNOS_STATE_DIR}/credentials"
echo '{}' >"${ERNOS_CONFIG_PATH}"

echo "==> Uninstall (state only)"
pnpm ernos uninstall --state --yes --non-interactive

test ! -d "${ERNOS_STATE_DIR}"

echo "OK"
