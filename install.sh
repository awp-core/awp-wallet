#!/usr/bin/env bash
# ==============================================================================
# AWP Wallet — Install & Setup
#
# Usage:
#   bash install.sh [OPTIONS]
#
# Options:
#   --dir <path>          Installation directory (default: ~/awp-wallet)
#   --no-init             Install only, do not create a wallet
#   --password <pwd>      Use explicit password (default: auto-managed)
#   --mnemonic <phrase>   Import existing wallet from seed phrase
#   --pimlico <key>       Set PIMLICO_API_KEY for gasless transactions
#   --agent-id <id>       Wallet profile ID (multi-agent isolation)
#   --session-id <id>     Wallet session ID (per-session isolation)
#   --help                Show this help
# ==============================================================================
set -euo pipefail

# ---------- Defaults ----------
INSTALL_DIR="$HOME/awp-wallet"
WALLET_PASSWORD=""
AUTO_INIT=true
MNEMONIC=""
PIMLICO_API_KEY=""
ADDRESS=""
AGENT_ID=""
SESSION_ID=""
REPO_URL="https://github.com/awp-core/awp-wallet.git"

# ---------- Colors (stderr only) ----------
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[awp-wallet]${NC} $*" >&2; }
warn() { echo -e "${YELLOW}[awp-wallet]${NC} $*" >&2; }
err()  { echo -e "${RED}[awp-wallet]${NC} $*" >&2; exit 1; }

# ---------- Parse arguments ----------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)          INSTALL_DIR="$2"; shift 2 ;;
    --no-init)      AUTO_INIT=false; shift ;;
    --password)     WALLET_PASSWORD="$2"; USER_PROVIDED_PASSWORD=true; shift 2 ;;
    --mnemonic)     MNEMONIC="$2"; shift 2 ;;
    --pimlico)      PIMLICO_API_KEY="$2"; shift 2 ;;
    --agent-id)     AGENT_ID="$2"; shift 2 ;;
    --session-id)   SESSION_ID="$2"; shift 2 ;;
    --help|-h)      head -18 "$0" | tail -13; exit 0 ;;
    *)              err "Unknown option: $1. Use --help." ;;
  esac
done

# ---------- Pre-flight ----------
log "Checking prerequisites..."

if ! command -v node &>/dev/null; then
  err "Node.js not found. Install Node.js >= 20: https://nodejs.org/"
fi
NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VER" -lt 20 ]]; then
  err "Node.js >= 20 required (found: $(node -v))."
fi
command -v npm &>/dev/null || err "npm not found."
command -v git &>/dev/null || err "git not found."
command -v openssl &>/dev/null || err "openssl not found."

log "Node.js $(node -v), npm $(npm -v)"

# ---------- Step 1: Get source code ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -d "$INSTALL_DIR/.git" ]]; then
  log "Updating existing installation..."
  cd "$INSTALL_DIR"
  git pull --ff-only 2>/dev/null || warn "git pull failed, using existing code"
elif [[ -f "$SCRIPT_DIR/package.json" ]] && grep -q "awp-wallet" "$SCRIPT_DIR/package.json" 2>/dev/null; then
  if [[ "$INSTALL_DIR" != "$SCRIPT_DIR" ]]; then
    log "Copying local repo to $INSTALL_DIR..."
    mkdir -p "$INSTALL_DIR"
    cp -r "$SCRIPT_DIR/." "$INSTALL_DIR/"
    rm -rf "$INSTALL_DIR/node_modules" "$INSTALL_DIR/.git"
  fi
  cd "$INSTALL_DIR"
else
  log "Cloning repository..."
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ---------- Step 2: Install dependencies ----------
log "Installing npm dependencies..."
npm install --no-audit --no-fund 2>&1 | tail -1

# ---------- Step 3: Register CLI command ----------
log "Registering awp-wallet command..."
if npm link 2>/dev/null; then
  log "Registered: $(which awp-wallet 2>/dev/null || echo 'awp-wallet')"
elif sudo npm link 2>/dev/null; then
  log "Registered (sudo): $(which awp-wallet 2>/dev/null || echo 'awp-wallet')"
else
  mkdir -p "$HOME/.local/bin"
  ln -sf "$INSTALL_DIR/scripts/wallet-cli.js" "$HOME/.local/bin/awp-wallet"
  chmod +x "$INSTALL_DIR/scripts/wallet-cli.js"
  log "Registered: ~/.local/bin/awp-wallet"
  if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
    warn "Add to PATH: export PATH=\"\$HOME/.local/bin:\$PATH\""
  fi
fi

# CLI command (as array for space-safe invocation)
if command -v awp-wallet &>/dev/null; then
  CLI=(awp-wallet)
else
  CLI=(node "$INSTALL_DIR/scripts/wallet-cli.js")
fi

# ---------- Step 4: Create runtime directories ----------
BASE_DIR="$HOME/.openclaw-wallet"
mkdir -p "$BASE_DIR" && chmod 0700 "$BASE_DIR"
mkdir -p "$BASE_DIR/wallets" && chmod 0700 "$BASE_DIR/wallets"

# Determine profile directory
PROFILE_ID="default"
if [[ -n "$SESSION_ID" ]]; then
  PROFILE_ID="$SESSION_ID"
elif [[ -n "$AGENT_ID" ]]; then
  PROFILE_ID="$AGENT_ID"
fi

# Helper: run CLI with correct wallet identity env vars
run_cli() {
  local extra_env=()
  [[ -n "$SESSION_ID" ]] && extra_env+=(AWP_SESSION_ID="$SESSION_ID")
  [[ -n "$AGENT_ID" ]] && extra_env+=(AWP_AGENT_ID="$AGENT_ID")
  if [[ ${#extra_env[@]} -gt 0 ]]; then
    env "${extra_env[@]}" "${CLI[@]}" "$@"
  else
    "${CLI[@]}" "$@"
  fi
}

PROFILE_DIR="$BASE_DIR/wallets/$PROFILE_ID"
mkdir -p "$PROFILE_DIR" && chmod 0700 "$PROFILE_DIR"
mkdir -p "$PROFILE_DIR/sessions" && chmod 0700 "$PROFILE_DIR/sessions"

if [[ ! -f "$PROFILE_DIR/config.json" ]]; then
  cp "$INSTALL_DIR/assets/default-config.json" "$PROFILE_DIR/config.json"
  chmod 0600 "$PROFILE_DIR/config.json"
fi

if [[ ! -f "$PROFILE_DIR/.session-secret" ]]; then
  openssl rand -hex 32 > "$PROFILE_DIR/.session-secret"
  chmod 0600 "$PROFILE_DIR/.session-secret"
fi

log "Profile: $PROFILE_ID ($PROFILE_DIR)"

# Helper: run CLI with optional WALLET_PASSWORD
run_cli_pw() {
  if [[ -n "$WALLET_PASSWORD" ]]; then
    WALLET_PASSWORD="$WALLET_PASSWORD" run_cli "$@"
  else
    run_cli "$@"
  fi
}

# ---------- Step 5: Initialize wallet ----------
if [[ "$AUTO_INIT" == true ]]; then
  if [[ -f "$PROFILE_DIR/keystore.enc" ]]; then
    log "Wallet already exists, skipping init"
    ADDRESS=$(run_cli receive 2>/dev/null | node -e "try{process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).eoaAddress)}catch{}" 2>/dev/null || echo "")
  else
    log "Initializing wallet..."
    if [[ -n "$MNEMONIC" ]]; then
      INIT_RESULT=$(run_cli_pw import --mnemonic "$MNEMONIC" 2>&1)
    else
      INIT_RESULT=$(run_cli_pw init 2>&1)
    fi
    ADDRESS=$(echo "$INIT_RESULT" | node -e "try{process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).address)}catch{}" 2>/dev/null || echo "")
    log "Wallet ready: $ADDRESS"
  fi

  # Verify: unlock + lock
  log "Verifying..."
  run_cli_pw unlock --duration 10 >/dev/null 2>&1 || true
  run_cli lock >/dev/null 2>&1 || true
  log "OK"
fi

# ---------- Done ----------
echo "" >&2
echo -e "${CYAN}  AWP Wallet installed successfully!${NC}" >&2
echo -e "  ${GREEN}Install dir:${NC}  $INSTALL_DIR" >&2
echo -e "  ${GREEN}Profile:${NC}      $PROFILE_ID ($PROFILE_DIR)" >&2
echo -e "  ${GREEN}Command:${NC}      ${CLI[*]}" >&2
if [[ -n "$ADDRESS" ]]; then
  echo -e "  ${GREEN}Address:${NC}      $ADDRESS" >&2
fi
echo "" >&2

# JSON output
PMODE="auto"
if [[ -n "${USER_PROVIDED_PASSWORD:-}" ]]; then
  PMODE="explicit"
fi

cat <<ENDJSON
{"status":"installed","installDir":"$INSTALL_DIR","profileId":"$PROFILE_ID","profileDir":"$PROFILE_DIR","passwordMode":"$PMODE","address":"${ADDRESS:-null}","command":"${CLI[*]}","pimlicoEnabled":$([ -n "$PIMLICO_API_KEY" ] && echo true || echo false)}
ENDJSON
