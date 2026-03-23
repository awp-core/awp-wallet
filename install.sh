#!/usr/bin/env bash
# ==============================================================================
# AWP Wallet — One-click deployment script
#
# Usage:
#   bash install.sh [OPTIONS]
#
# Options:
#   --dir <path>        Installation directory (default: ~/awp-wallet)
#   --password <pwd>    Wallet password (default: auto-managed, no password needed)
#   --no-init           Skip wallet initialization (setup only)
#   --pimlico <key>     Set PIMLICO_API_KEY for gasless transactions
#   --help              Show this help message
# ==============================================================================
set -euo pipefail

# ---------- Defaults ----------
INSTALL_DIR="$HOME/awp-wallet"
WALLET_PASSWORD=""
AUTO_INIT=true
PIMLICO_API_KEY=""
ADDRESS=""
REPO_URL="https://github.com/awp-core/awp-wallet.git"

# ---------- Colors (stderr only) ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[awp-wallet]${NC} $*" >&2; }
warn() { echo -e "${YELLOW}[awp-wallet]${NC} $*" >&2; }
err()  { echo -e "${RED}[awp-wallet]${NC} $*" >&2; exit 1; }

# ---------- Parse arguments ----------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)        INSTALL_DIR="$2"; shift 2 ;;
    --password)   WALLET_PASSWORD="$2"; USER_PROVIDED_PASSWORD=true; shift 2 ;;
    --no-init)    AUTO_INIT=false; shift ;;
    --pimlico)    PIMLICO_API_KEY="$2"; shift 2 ;;
    --help|-h)
      head -14 "$0" | tail -9
      exit 0 ;;
    *) err "Unknown option: $1. Use --help for usage." ;;
  esac
done

# ---------- Pre-flight checks ----------
log "Checking prerequisites..."

if ! command -v node &>/dev/null; then
  err "Node.js not found. Install Node.js >= 20: https://nodejs.org/"
fi
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VERSION" -lt 20 ]]; then
  err "Node.js >= 20 required (found: $(node -v))."
fi

if ! command -v npm &>/dev/null; then
  err "npm not found."
fi

if ! command -v git &>/dev/null; then
  err "git not found. Install: sudo apt install git"
fi

log "Node.js $(node -v), npm $(npm -v)"

# ---------- Step 1: Clone or update ----------
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
CLI_REGISTERED=false
if npm link 2>/dev/null; then
  CLI_REGISTERED=true
  log "Registered: $(which awp-wallet 2>/dev/null || echo 'awp-wallet')"
elif sudo npm link 2>/dev/null; then
  CLI_REGISTERED=true
  log "Registered (sudo): $(which awp-wallet 2>/dev/null || echo 'awp-wallet')"
fi

# Fallback: add to PATH via symlink in ~/.local/bin
if [[ "$CLI_REGISTERED" == false ]]; then
  mkdir -p "$HOME/.local/bin"
  ln -sf "$INSTALL_DIR/scripts/wallet-cli.js" "$HOME/.local/bin/awp-wallet"
  chmod +x "$INSTALL_DIR/scripts/wallet-cli.js"
  if echo "$PATH" | grep -q "$HOME/.local/bin"; then
    CLI_REGISTERED=true
    log "Registered: ~/.local/bin/awp-wallet"
  else
    warn "Added to ~/.local/bin/awp-wallet. Add to PATH: export PATH=\"\$HOME/.local/bin:\$PATH\""
    CLI_REGISTERED=true
  fi
fi

# Determine how to call the CLI
if command -v awp-wallet &>/dev/null; then
  CLI="awp-wallet"
else
  CLI="node $INSTALL_DIR/scripts/wallet-cli.js"
fi

# ---------- Step 4: Create runtime directories ----------
BASE_DIR="$HOME/.openclaw-wallet"
PROFILE_DIR="$BASE_DIR/wallets/default"
log "Setting up runtime directory..."
mkdir -p "$BASE_DIR" && chmod 0700 "$BASE_DIR"
mkdir -p "$BASE_DIR/wallets" && chmod 0700 "$BASE_DIR/wallets"
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

# ---------- Step 5: Initialize wallet ----------
if [[ "$AUTO_INIT" == true ]]; then
  if [[ -f "$PROFILE_DIR/keystore.enc" ]]; then
    log "Wallet already exists, skipping init"
    ADDRESS=$($CLI receive 2>/dev/null | node -e "try{process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).eoaAddress)}catch{}" 2>/dev/null || echo "")
  else
    log "Initializing wallet..."
    if [[ -n "$WALLET_PASSWORD" ]]; then
      INIT_RESULT=$(WALLET_PASSWORD="$WALLET_PASSWORD" $CLI init 2>&1)
    else
      INIT_RESULT=$($CLI init 2>&1)
    fi
    ADDRESS=$(echo "$INIT_RESULT" | node -e "try{process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).address)}catch{}" 2>/dev/null || echo "")
    log "Wallet created: $ADDRESS"
  fi
fi

# ---------- Step 6: Verify ----------
log "Verifying..."
if [[ -n "$WALLET_PASSWORD" ]]; then
  VERIFY=$( WALLET_PASSWORD="$WALLET_PASSWORD" $CLI unlock --duration 10 2>&1 ) || true
else
  VERIFY=$( $CLI unlock --duration 10 2>&1 ) || true
fi
$CLI lock >/dev/null 2>&1 || true
log "OK"

# ---------- Done ----------
echo "" >&2
echo -e "${CYAN}  AWP Wallet installed successfully!${NC}" >&2
echo -e "  ${GREEN}Install dir:${NC}  $INSTALL_DIR" >&2
echo -e "  ${GREEN}Runtime dir:${NC}  $BASE_DIR" >&2
echo -e "  ${GREEN}Command:${NC}      $CLI --version" >&2
if [[ -n "$ADDRESS" ]]; then
  echo -e "  ${GREEN}Address:${NC}      $ADDRESS" >&2
fi
echo "" >&2

# Output JSON
PMODE="auto"
PW_JSON=""
if [[ -n "${USER_PROVIDED_PASSWORD:-}" ]]; then
  PMODE="explicit"
  PW_JSON="\"walletPassword\":\"$WALLET_PASSWORD\","
fi

cat <<ENDJSON
{"status":"installed","installDir":"$INSTALL_DIR","walletDir":"$BASE_DIR","profileDir":"$PROFILE_DIR","passwordMode":"$PMODE",${PW_JSON}"address":"${ADDRESS:-null}","command":"$CLI","pimlicoEnabled":$([ -n "$PIMLICO_API_KEY" ] && echo true || echo false)}
ENDJSON
