---
name: awp-wallet
description: >
  Use when the user wants to send crypto, check balance, approve tokens,
  sign messages, estimate gas, or any on-chain wallet operation. Covers
  "send ETH to 0x...", "how much USDC do I have", "approve spending",
  "sign this for me". 400+ EVM chains, auto-gasless, multi-agent isolated.
metadata:
  openclaw:
    requires:
      env:
        - PIMLICO_API_KEY    # optional — enables gasless ERC-4337
        - ALCHEMY_API_KEY    # optional — RPC + bundler fallback
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

EVM wallet for agents. All output is JSON. No password needed — the wallet auto-manages encryption internally.

## Before First Use

Run this once. Skip entirely if `awp-wallet --version` works.

```bash
git clone https://github.com/awp-core/awp-wallet.git /tmp/awp-wallet
cd /tmp/awp-wallet && bash scripts/setup.sh
```

`setup.sh` does everything: `npm install`, registers the `awp-wallet` command, creates runtime dirs.

If `awp-wallet` is still not found after setup (npm link failed), add it manually:
```bash
mkdir -p ~/.local/bin && ln -sf /tmp/awp-wallet/scripts/wallet-cli.js ~/.local/bin/awp-wallet
export PATH="$HOME/.local/bin:$PATH"
```

## Every Session

```bash
# 1. Ensure wallet exists (creates one if needed — no password required)
awp-wallet receive 2>/dev/null || awp-wallet init

# 2. Unlock (returns session token for subsequent commands)
TOKEN=$(awp-wallet unlock --duration 3600 | jq -r '.sessionToken')

# 3. Do what the user asked (see Actions below)

# 4. Lock when done
awp-wallet lock
```

Tell the user when creating a new wallet: `[WALLET] creating new wallet...` then `[WALLET] ready: 0x...`

Never ask the user for a password. If any command fails, check Error Recovery at the bottom.

## Output Tags

| Tag | When |
|-----|------|
| `[QUERY]` | Balance, gas estimates |
| `[TX]` | Transactions — show explorer link |
| `[SIGN]` | Signing |
| `[WALLET]` | When user asks about wallet |

## Write Safety

Before send/approve, show confirmation:
```
[TX] about to send:
     to:      0xBob...1234
     amount:  50 USDC
     chain:   Base
     proceed? (y/n)
```

## Actions

`$T` = session token from unlock.

### Check balance
```bash
awp-wallet balance --token $T --chain ethereum
awp-wallet balance --token $T --chain bsc --asset usdc
awp-wallet portfolio --token $T
```

### Send tokens
```bash
awp-wallet send --token $T --to 0xAddr --amount 0.1 --chain ethereum
awp-wallet send --token $T --to 0xAddr --amount 100 --asset usdc --chain base
awp-wallet send --token $T --to 0xAddr --amount 50 --asset usdc --chain base --mode gasless
```

### Approve / Revoke
```bash
awp-wallet approve --token $T --asset usdc --spender 0xRouter --amount 1000 --chain base
awp-wallet revoke --token $T --asset usdc --spender 0xRouter --chain base
```

### Sign message
```bash
awp-wallet sign-message --token $T --message "Hello World"
awp-wallet sign-typed-data --token $T --data '{"types":{...},"primaryType":"...","domain":{...},"message":{...}}'
```

### Batch sends
```bash
awp-wallet batch --token $T --chain base \
  --ops '[{"to":"0xA","amount":"10","asset":"usdc"},{"to":"0xB","amount":"20","asset":"usdc"}]'
```

### Get address
```bash
awp-wallet receive
```

### Estimate gas
```bash
awp-wallet estimate --to 0xAddr --amount 0.1 --chain ethereum
```

### Transaction status
```bash
awp-wallet tx-status --hash 0xHash --chain ethereum
```

### History
```bash
awp-wallet history --token $T --chain ethereum --limit 20
```

### Allowances
```bash
awp-wallet allowances --token $T --asset usdc --spender 0xRouter --chain base
```

### Chain info
```bash
awp-wallet chains
awp-wallet chain-info --chain zksync
```

### Account management
```bash
awp-wallet init                                                            # create wallet
awp-wallet import --mnemonic "word1 word2 ... word12"                      # import
WALLET_PASSWORD="<pw>" awp-wallet export                                   # export (requires explicit password)
WALLET_PASSWORD="<old>" NEW_WALLET_PASSWORD="<new>" awp-wallet change-password
awp-wallet verify-log
awp-wallet wallets                                                         # list all wallet profiles
awp-wallet wallet-id                                                       # current wallet ID
```

## Chains & Tokens

`--chain` — name or ID. Default: `ethereum`.

16 chains: `ethereum` `base` `bsc` `arbitrum` `optimism` `polygon` `avalanche` `fantom` `zksync` `linea` `scroll` `mantle` `blast` `celo` `sepolia` `base-sepolia`

Custom: `--chain 99999 --rpc-url https://custom.rpc.com`

`--asset` — `usdc` `usdt` `awp` `weth` `wbnb` `dai` or `0x...`

## Multi-Agent Isolation

| Env Var | Isolation |
|---------|-----------|
| `AWP_SESSION_ID=sess-1` | Per session |
| `AWP_AGENT_ID=agent-1` | Per agent |
| _(neither)_ | Shared ("default") |

## Gasless Mode

Auto-activates when no native gas. Requires `PIMLICO_API_KEY`.

## Error Recovery

| Error | Fix |
|-------|-----|
| `awp-wallet: command not found` | Run install: `cd /tmp/awp-wallet && bash scripts/setup.sh` |
| `No wallet found` | `awp-wallet init` |
| `Config not found` | `awp-wallet init` (self-provisions config) |
| `Invalid or expired session` | `awp-wallet unlock --duration 3600` |
| `Insufficient balance` | Tell user, suggest funding or `--mode gasless` |
| `Daily limit exceeded` | Tell user to try tomorrow |
