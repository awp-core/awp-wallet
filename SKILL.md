---
name: awp-wallet
description: >
  Crypto wallet for AI agents — send tokens, check balances, sign messages,
  and manage approvals on any EVM blockchain. Use this skill when the user
  wants to send crypto, check wallet balance, approve or revoke a DeFi
  contract, sign a message or EIP-712 typed data, estimate gas, check a
  transaction, or create/manage a wallet. Supports 16 preconfigured chains
  (Ethereum, Base, BSC, Arbitrum, Optimism, Polygon, Avalanche, Fantom,
  zkSync, Linea, Scroll, Mantle, Blast, Celo + testnets) plus any custom EVM chain.
  Handles gasless transactions automatically when no native gas is available.
  Do NOT use for writing Solidity, deploying contracts, or blockchain analytics.
metadata:
  openclaw:
    requires:
      bins:
        - node
        - openssl
      anyBins:
        - npm
    primaryEnv: WALLET_PASSWORD  # optional — auto-managed if not set
    emoji: "\U0001F4B0"
    homepage: https://github.com/awp-core/awp-wallet
    install:
      - kind: node
        package: awp-wallet
        bins: [awp-wallet]
---

# AWP Wallet

EVM wallet for agents. All commands output JSON. Private keys stay inside the wallet process — the agent only receives session tokens and transaction results. The `export` command requires an explicit `WALLET_PASSWORD` env var and cannot be used in auto-managed (default) mode.

## Two Modes

### Default Mode (no password needed)

The wallet auto-generates and stores a password internally. No `WALLET_PASSWORD` needed. Just run commands:

```bash
awp-wallet init                          # auto-generates password, stores in ~/.openclaw-wallet/.wallet-password
awp-wallet unlock --duration 3600        # reads password from file automatically
awp-wallet send --token $T --to 0x...    # works without WALLET_PASSWORD env var
```

This is the recommended mode for agents. The user never sees or manages a password.

### Password Mode (explicit password)

Set `WALLET_PASSWORD` environment variable to take full control. The auto-managed password file is not used:

```bash
WALLET_PASSWORD="my-secret" awp-wallet init    # uses provided password, returns it in JSON output
WALLET_PASSWORD="my-secret" awp-wallet unlock  # agent must pass password every time
```

`init` returns `{"status":"created","address":"0x...","passwordMode":"explicit","password":"my-secret"}` so the agent can store it.

## Invisible Setup

Wallet setup is completely transparent to the user. They only see the result of their request.

When any wallet operation is needed:

1. **Check if wallet exists** (silently):
   ```bash
   awp-wallet receive 2>/dev/null
   ```

2. **If not, create and unlock silently**:
   ```bash
   awp-wallet init 2>/dev/null
   TOKEN=$(awp-wallet unlock --duration 3600 | jq -r '.sessionToken')
   ```

3. **If wallet exists, just unlock**:
   ```bash
   TOKEN=$(awp-wallet unlock --duration 3600 | jq -r '.sessionToken')
   ```

No password handling needed in default mode. The wallet manages it internally.

**Rules:**
- Never ask the user for a password.
- Never show setup progress, initialization logs, or wallet creation output.
- If `awp-wallet` is not installed, install it silently before proceeding.
- If a session token expires, re-unlock silently and retry the command.

## What the User Sees

The user only sees **results of their request**, formatted with tags:

| Tag | When | Example |
|-----|------|---------|
| `[QUERY]` | Balance, allowances, gas | `[QUERY] balance on Ethereum` |
| `[TX]` | Transactions | `[TX] sent 50 USDC → 0xBob...` |
| `[SIGN]` | Signing | `[SIGN] signed ✓` |
| `[WALLET]` | Only when user asks about wallet | `[WALLET] address: 0x...` |

## Write Safety

Before sending tokens or approving, show a confirmation:

```
[TX] about to send:
     to:      0xBob...1234
     amount:  50 USDC
     chain:   Base
     proceed? (y/n)
```

On "y": execute. On "n": `[TX] cancelled.`

## Actions

`--token $T` below = session token from unlock. Always have a valid token before running commands.

### "Check my balance" / "How much do I have"

```bash
awp-wallet balance --token $T --chain ethereum
awp-wallet balance --token $T --chain bsc --asset usdc
awp-wallet portfolio --token $T   # all 16 chains
```

Show to user:
```
[QUERY] balance on Ethereum
── balances ──────────────────────
ETH:    0.15
USDC:   1,250.00
──────────────────────────────────
```

### "Send X to 0x..."

```bash
# Native (ETH/BNB)
WALLET_PASSWORD="<pw>" awp-wallet send --token $T --to 0xAddr --amount 0.1 --chain ethereum

# ERC-20
WALLET_PASSWORD="<pw>" awp-wallet send --token $T --to 0xAddr --amount 100 --asset usdc --chain base

# Gasless (no native gas)
WALLET_PASSWORD="<pw>" awp-wallet send --token $T --to 0xAddr --amount 50 --asset usdc --chain base --mode gasless
```

Show to user:
```
[TX] sent 50 USDC → 0xBob...1234
[TX] hash: 0xabc...def
[TX] view: https://basescan.org/tx/0xabc...def
[TX] confirmed ✓
```

### "Approve token" / "Revoke approval"

```bash
WALLET_PASSWORD="<pw>" awp-wallet approve --token $T --asset usdc --spender 0xRouter --amount 1000 --chain base
WALLET_PASSWORD="<pw>" awp-wallet revoke --token $T --asset usdc --spender 0xRouter --chain base
```

### "Sign this message"

```bash
# EIP-191
WALLET_PASSWORD="<pw>" awp-wallet sign-message --token $T --message "Hello World"

# EIP-712 typed data
WALLET_PASSWORD="<pw>" awp-wallet sign-typed-data --token $T --data '{"types":{...},"primaryType":"...","domain":{...},"message":{...}}'
```

### "Send to multiple addresses"

```bash
WALLET_PASSWORD="<pw>" awp-wallet batch --token $T --chain base \
  --ops '[{"to":"0xA","amount":"10","asset":"usdc"},{"to":"0xB","amount":"20","asset":"usdc"}]'
```

### "What's my address"

```bash
awp-wallet receive
```

Show: `[WALLET] your address: 0x1234...5678`

### "Estimate gas"

```bash
awp-wallet estimate --to 0xAddr --amount 0.1 --chain ethereum
```

### "Check transaction"

```bash
awp-wallet tx-status --hash 0xHash --chain ethereum
```

### "Show history"

```bash
awp-wallet history --token $T --chain ethereum --limit 20
```

### "Check allowances"

```bash
awp-wallet allowances --token $T --asset usdc --spender 0xRouter --chain base
```

### "List chains" / "Chain info"

```bash
awp-wallet chains
awp-wallet chain-info --chain zksync
```

### Account management (only when user explicitly asks)

```bash
WALLET_PASSWORD="<pw>" awp-wallet init
WALLET_PASSWORD="<pw>" awp-wallet import --mnemonic "word1 word2 ... word12"
WALLET_PASSWORD="<pw>" awp-wallet export
WALLET_PASSWORD="<old>" NEW_WALLET_PASSWORD="<new>" awp-wallet change-password
awp-wallet verify-log
```

### Lock (do this after every session)

```bash
awp-wallet lock
```

## Chains & Tokens

`--chain` — name or numeric ID. Default: `ethereum`.

16 preconfigured: `ethereum` `base` `bsc` `arbitrum` `optimism` `polygon` `avalanche` `fantom` `zksync` `linea` `scroll` `mantle` `blast` `celo` `sepolia` `base-sepolia`

Custom: `--chain 99999 --rpc-url https://custom.rpc.com`

`--asset` — symbol or address: `usdc` `usdt` `awp` `weth` `wbnb` `dai` or `0x...`

## Gasless Mode

Auto-activates when wallet has no native gas. Requires `PIMLICO_API_KEY`. Force with `--mode gasless`. The user doesn't need to know about this — just handle it.

## Error Recovery

Handle all errors silently. Never show raw error messages to the user.

| Error | Recovery (silent) |
|-------|-------------------|
| `WALLET_PASSWORD required` | Generate password, store, retry |
| `No wallet found` | Run `awp-wallet init`, retry |
| `Config not found` | Run `bash scripts/setup.sh`, retry |
| `Invalid or expired session` | Re-unlock, retry the command |
| `Insufficient balance` | Tell user: "Insufficient balance. You have X, need Y." |
| `Daily limit exceeded` | Tell user: "Daily transfer limit reached. Try again tomorrow." |
| `Amount must be a positive number` | Tell user: "Please specify a valid amount." |
