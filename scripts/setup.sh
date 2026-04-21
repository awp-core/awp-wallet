#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="${HOME}/.openclaw-wallet"
WALLET_ID="${AWP_SESSION_ID:-${AWP_AGENT_ID:-default}}"
PROFILE_DIR="${BASE_DIR}/wallets/${WALLET_ID}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_CHAINS="${SCRIPT_DIR}/../assets/default-chains.json"

mkdir -p "${BASE_DIR}" && chmod 700 "${BASE_DIR}"
mkdir -p "${BASE_DIR}/wallets" && chmod 700 "${BASE_DIR}/wallets"
mkdir -p "${PROFILE_DIR}" && chmod 700 "${PROFILE_DIR}"
mkdir -p "${PROFILE_DIR}/sessions" && chmod 700 "${PROFILE_DIR}/sessions"

if [[ ! -f "${PROFILE_DIR}/chains.json" && -f "${DEFAULT_CHAINS}" ]]; then
  cp "${DEFAULT_CHAINS}" "${PROFILE_DIR}/chains.json"
  chmod 600 "${PROFILE_DIR}/chains.json"
fi

if [[ ! -f "${PROFILE_DIR}/.session-secret" ]]; then
  openssl rand -hex 32 > "${PROFILE_DIR}/.session-secret"
  chmod 600 "${PROFILE_DIR}/.session-secret"
fi

cat <<EOF
{"status":"ready","profileDir":"${PROFILE_DIR}"}
EOF
