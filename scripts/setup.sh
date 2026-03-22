#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$HOME/.openclaw-wallet"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 1. Install npm dependencies and register CLI command
cd "$SCRIPT_DIR/.."
npm install
if ! npm link 2>/dev/null; then
  echo '{"warning":"npm link failed. Run with sudo or use: node scripts/wallet-cli.js"}' >&2
fi

# 2. Create base directory
mkdir -p "$BASE_DIR" && chmod 0700 "$BASE_DIR"
mkdir -p "$BASE_DIR/wallets" && chmod 0700 "$BASE_DIR/wallets"

echo '{"status":"setup_complete","baseDir":"'"$BASE_DIR"'"}'
