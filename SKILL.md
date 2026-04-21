---
name: awp-wallet
description: >
  Self-custodial EVM blockchain wallet for executing on-chain operations.
  Use this skill whenever the user wants to: send or transfer crypto/tokens
  (ETH, USDC, USDT, etc.) to an address, check wallet balance or portfolio,
  get their wallet/receiving address, approve or revoke token spending
  allowances, sign messages or typed data, estimate gas costs, check
  transaction status, view transaction history, or do batch transfers.
  Supports 400+ EVM chains (Ethereum, Base, Arbitrum, Polygon, BSC, etc.)
  with automatic gasless fallback.
metadata:
  openclaw:
    requires:
      bins:
        - node
        - git
        - openssl
      anyBins:
        - npm
    emoji: "\U0001F4B0"
    homepage: https://github.com/awp-core/awp-wallet
---

# AWP Wallet

EVM wallet for agents. Output is JSON. Wallet storage is encrypted. Sensitive operations require explicit session tokens.

## Install

```bash
git clone https://github.com/awp-core/awp-wallet.git ~/awp-wallet
cd ~/awp-wallet && bash install.sh
```

If `awp-wallet` is not in PATH after install:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

## Password Material

Use one of these before `init`, `unlock`, `export`, or other decrypting commands:

```bash
export WALLET_PASSWORD='strong secret'
# or
export WALLET_PASSWORD_FILE=/run/secrets/awp-wallet-password
```

For rotation:

```bash
export NEW_WALLET_PASSWORD='next secret'
# or
export NEW_WALLET_PASSWORD_FILE=/run/secrets/awp-wallet-password-next
awp-wallet change-password
```

## Core Flow

```bash
awp-wallet init
TOKEN=$(awp-wallet unlock --duration 3600 | jq -r '.sessionToken')
awp-wallet balance --token "$TOKEN" --chain ethereum
awp-wallet send --token "$TOKEN" --to 0xRecipient --amount 50 --asset usdc --chain base
awp-wallet lock
```

## Rules

1. For `send`, `approve`, `revoke`, `sign-message`, `sign-typed-data`, and other privileged commands, always pass `--token` from `unlock`.
2. Confirm with the user before any on-chain transaction or signature that has external effect.
3. Prefer `WALLET_PASSWORD_FILE` over plain env vars in containers or shared hosts.
4. Treat this as a hot work wallet. Use isolated funds only.

## Common Commands

### Balance / Portfolio
```bash
awp-wallet balance --token "$TOKEN" --chain ethereum
awp-wallet balance --token "$TOKEN" --chain base --asset usdc
awp-wallet portfolio --token "$TOKEN"
```

### Send
```bash
awp-wallet send --token "$TOKEN" --to 0xAddr --amount 0.1 --chain ethereum
awp-wallet send --token "$TOKEN" --to 0xAddr --amount 100 --asset usdc --chain base
```

### Receive / Status
```bash
awp-wallet receive
awp-wallet status --token "$TOKEN"
```

### Approve / Revoke
```bash
awp-wallet approve --token "$TOKEN" --asset usdc --spender 0xRouter --amount 1000 --chain base
awp-wallet revoke --token "$TOKEN" --asset usdc --spender 0xRouter --chain base
```

### Sign
```bash
awp-wallet sign-message --token "$TOKEN" --message "Hello World"
awp-wallet sign-typed-data --token "$TOKEN" --data '{"types":{...},...}'
```

### History / Audit
```bash
awp-wallet history --token "$TOKEN" --chain ethereum --limit 20
awp-wallet verify-log
```

### Export / Rotation
```bash
awp-wallet export
awp-wallet export-private-key
awp-wallet change-password
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `WALLET_PASSWORD` | Wallet decryption password |
| `WALLET_PASSWORD_FILE` | File path containing the wallet decryption password |
| `NEW_WALLET_PASSWORD` | New password for `change-password` |
| `NEW_WALLET_PASSWORD_FILE` | File path containing the new password for `change-password` |
| `PIMLICO_API_KEY` | Enable gasless ERC-4337 |
| `AWP_AGENT_ID` | Multi-agent wallet isolation |
| `AWP_SESSION_ID` | Per-session wallet isolation |
