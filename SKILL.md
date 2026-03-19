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
      env:
        - WALLET_PASSWORD
      bins:
        - node
        - openssl
      anyBins:
        - npm
    primaryEnv: WALLET_PASSWORD
    emoji: "\U0001F4B0"
    homepage: https://github.com/awp-core/awp-wallet
    install:
      - kind: node
        package: awp-wallet
        bins: [awp-wallet]
---

# AWP Wallet

EVM wallet for agents. All commands output JSON. Private keys never enter the agent's context.

Show the user what you're doing — every balance check, transaction, and signing operation should be printed clearly with tagged output.

## On Skill Load

Show welcome on first session, then check wallet state:

```
── awp wallet ────────────────────
self-custodial · chain-agnostic · gasless

400+ EVM chains. direct + gasless tx.
keys never leave the wallet process.

── quick start ──────────────────
"check my balance"  → balances
"send 0.1 ETH to …" → transfer
"what's my address" → wallet address
"wallet help"       → all commands
──────────────────────────────────
```

Then check:
```bash
awp-wallet receive 2>/dev/null
```
- If wallet exists: `[WALLET] restored: <short_address>`
- If not found: do nothing — setup happens when user requests an action.

## User Commands

When user types "wallet help":

```
── wallet commands ───────────────
"check my balance"    → balances
"send X to 0x..."     → transfer
"approve X for 0x..." → token approval
"sign message"        → EIP-191 signing
"what's my address"   → wallet address
"estimate gas"        → gas estimation
"tx status 0x..."     → check transaction
"show history"        → recent transactions
──────────────────────────────────
```

## Output Tags

Use these prefixes for all operations:

| Tag | When |
|-----|------|
| `[WALLET]` | Wallet setup, status, address |
| `[QUERY]` | Balance checks, allowances, gas estimates |
| `[TX]` | Transactions — always show explorer link |
| `[SIGN]` | Message/data signing |
| `[!]` | Warnings, errors |

## Setup (automatic, no user input)

Run once when any wallet action is first requested. If `WALLET_PASSWORD` is not stored, generate one silently — never ask the user.

```bash
WALLET_PASSWORD=$(openssl rand -base64 36)
WALLET_PASSWORD="<pw>" awp-wallet init
TOKEN=$(WALLET_PASSWORD="<pw>" awp-wallet unlock --duration 3600 | jq -r '.sessionToken')
```

Print setup progress:
```
[1/3] wallet       initializing...
[1/3] wallet       <short_address> ✓
[2/3] tools        node, openssl ✓
[3/3] unlocked     session active ✓

ready.
```

`--token` in commands below = session token from unlock.

## Write Safety — Confirm Before Execute

Every transaction (send, approve, revoke) must show a preview before executing:

```
[TX] about to send:
     to:        <address>
     amount:    <amount> <asset>
     chain:     <chain_name>
     mode:      <direct / gasless>
     gas est:   ~<amount>
     proceed? (y/n)
```

On "y": execute. On "n": `[TX] cancelled.`

## Actions

### Check balance

```bash
awp-wallet balance --token $T --chain ethereum
awp-wallet balance --token $T --chain bsc --asset usdc
awp-wallet portfolio --token $T   # all 16 chains
```

Print:
```
[QUERY] balance on <chain_name>
── balances ──────────────────────
ETH:        <amount>
USDC:       <amount>
──────────────────────────────────
```

### Send tokens

```bash
# Native (ETH/BNB)
WALLET_PASSWORD="<pw>" awp-wallet send --token $T --to 0xAddr --amount 0.1 --chain ethereum

# ERC-20
WALLET_PASSWORD="<pw>" awp-wallet send --token $T --to 0xAddr --amount 100 --asset usdc --chain base

# Gasless (no native gas)
WALLET_PASSWORD="<pw>" awp-wallet send --token $T --to 0xAddr --amount 50 --asset usdc --chain base --mode gasless
```

Print after send:
```
[TX] sent <amount> <asset> → <short_address>
[TX] hash: <txHash>
[TX] view: https://<explorer>/tx/<txHash>
[TX] confirmed ✓
```

### Approve / Revoke

```bash
WALLET_PASSWORD="<pw>" awp-wallet approve --token $T --asset usdc --spender 0xRouter --amount 1000 --chain base
WALLET_PASSWORD="<pw>" awp-wallet revoke --token $T --asset usdc --spender 0xRouter --chain base
```

### Sign message

```bash
# EIP-191
WALLET_PASSWORD="<pw>" awp-wallet sign-message --token $T --message "Hello World"

# EIP-712 typed data
WALLET_PASSWORD="<pw>" awp-wallet sign-typed-data --token $T --data '{"types":{...},"primaryType":"...","domain":{...},"message":{...}}'
```

Print: `[SIGN] signed ✓ signature: <sig>`

### Batch operations

```bash
WALLET_PASSWORD="<pw>" awp-wallet batch --token $T --chain base \
  --ops '[{"to":"0xA","amount":"10","asset":"usdc"},{"to":"0xB","amount":"20","asset":"usdc"}]'
```

### Get wallet address

```bash
awp-wallet receive
```

Print:
```
[WALLET] address
── wallet ────────────────────────
EOA:            <address>
smart account:  <address or "not deployed">
──────────────────────────────────
```

### Estimate gas

```bash
awp-wallet estimate --to 0xAddr --amount 0.1 --chain ethereum
```

### Check transaction

```bash
awp-wallet tx-status --hash 0xHash --chain ethereum
```

### Transaction history

```bash
awp-wallet history --token $T --chain ethereum --limit 20
```

### Check allowances

```bash
awp-wallet allowances --token $T --asset usdc --spender 0xRouter --chain base
```

### Chain info

```bash
awp-wallet chains                     # list all 16 chains
awp-wallet chain-info --chain zksync  # capabilities
```

### Account management

```bash
WALLET_PASSWORD="<pw>" awp-wallet init
WALLET_PASSWORD="<pw>" awp-wallet import --mnemonic "word1 word2 ... word12"
WALLET_PASSWORD="<pw>" awp-wallet export
WALLET_PASSWORD="<old>" NEW_WALLET_PASSWORD="<new>" awp-wallet change-password
awp-wallet verify-log
```

## Lock

Always lock when done:

```bash
awp-wallet lock
```

Print: `[WALLET] locked ✓`

## Chains & Tokens

`--chain` — name or numeric ID. Default: `ethereum`.

16 preconfigured: `ethereum` `base` `bsc` `arbitrum` `optimism` `polygon` `avalanche` `fantom` `zksync` `linea` `scroll` `mantle` `blast` `celo` `sepolia` `base-sepolia`

Custom: `--chain 99999 --rpc-url https://custom.rpc.com`

`--asset` — symbol or address: `usdc` `usdt` `awp` `weth` `wbnb` `dai` or `0x...`

## Gasless Mode

Auto-activates when wallet has no native gas. Requires `PIMLICO_API_KEY`. Force with `--mode gasless`.

Print when auto-switching:
```
[GAS] native balance: 0
[GAS] switching to gasless mode (ERC-4337)
```

## Error Recovery

Recover automatically — don't show raw errors to users:

| Error | Print | Recovery |
|-------|-------|----------|
| `WALLET_PASSWORD required` | `[!] wallet password missing.` | Generate one automatically |
| `No wallet found` | `[!] no wallet. creating...` | Auto run `awp-wallet init` |
| `Config not found` | `[!] not configured.` | Auto run `setup.sh` |
| `Invalid or expired session` | `[!] session expired.` | Auto re-unlock |
| `Insufficient balance` | `[!] insufficient: <current>. need <required>.` | Suggest funding or gasless |
| `Daily limit exceeded` | `[!] daily limit reached.` | Inform user |
