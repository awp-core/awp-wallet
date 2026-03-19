---
name: awp-wallet
description: >
  Crypto wallet for AI agents — send tokens, check balances, sign messages,
  and manage approvals on any EVM blockchain. Use this skill when the user
  wants to send crypto, check wallet balance, approve or revoke a DeFi
  contract, sign a message or EIP-712 typed data, estimate gas, check a
  transaction, or create/manage a wallet. Supports 16 preconfigured chains
  (Ethereum, Base, BSC, Arbitrum, Optimism, Polygon, Avalanche, Fantom,
  zkSync, Linea, Scroll, Mantle, Blast, Celo) plus any custom EVM chain.
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

EVM wallet for agents. All commands output JSON. `--token` = session token from `unlock`.

## Setup & Unlock

Before any operation, ensure the wallet is ready. If `WALLET_PASSWORD` is not stored, generate one silently — never ask the user.

```bash
# Check if wallet exists; if not, create it
awp-wallet receive 2>/dev/null || WALLET_PASSWORD="$(openssl rand -base64 36)" awp-wallet init

# Unlock to get a session token (needed for most commands)
WALLET_PASSWORD="<pw>" awp-wallet unlock --duration 3600
# => {"sessionToken":"wlt_abc123...","expires":"..."}
```

## What the User Wants → Command

### Check balance

```bash
awp-wallet balance --token $T --chain ethereum             # all balances on chain
awp-wallet balance --token $T --chain bsc --asset usdc     # specific token
awp-wallet portfolio --token $T                             # all 16 chains at once
```

### Send tokens

```bash
# Native (ETH/BNB)
WALLET_PASSWORD="<pw>" awp-wallet send --token $T --to 0xAddr --amount 0.1 --chain ethereum

# ERC-20
WALLET_PASSWORD="<pw>" awp-wallet send --token $T --to 0xAddr --amount 100 --asset usdc --chain base

# Gasless (no native gas needed)
WALLET_PASSWORD="<pw>" awp-wallet send --token $T --to 0xAddr --amount 50 --asset usdc --chain base --mode gasless
```

### Approve / Revoke token spending

```bash
WALLET_PASSWORD="<pw>" awp-wallet approve --token $T --asset usdc --spender 0xRouter --amount 1000 --chain base
WALLET_PASSWORD="<pw>" awp-wallet revoke --token $T --asset usdc --spender 0xRouter --chain base
```

### Sign message

```bash
# EIP-191
WALLET_PASSWORD="<pw>" awp-wallet sign-message --token $T --message "Hello World"

# EIP-712 typed data (Permit2, DeFi protocols)
WALLET_PASSWORD="<pw>" awp-wallet sign-typed-data --token $T --data '{"types":{...},"primaryType":"...","domain":{...},"message":{...}}'
```

### Batch operations

```bash
WALLET_PASSWORD="<pw>" awp-wallet batch --token $T --chain base \
  --ops '[{"to":"0xA","amount":"10","asset":"usdc"},{"to":"0xB","amount":"20","asset":"usdc"}]'
```

### Get wallet address

```bash
awp-wallet receive                    # no token needed
awp-wallet receive --chain base       # includes smart account address
```

### Estimate gas

```bash
awp-wallet estimate --to 0xAddr --amount 0.1 --chain ethereum
awp-wallet estimate --to 0xAddr --amount 100 --asset usdc --chain base
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
awp-wallet chains                     # list all 16 configured chains
awp-wallet chain-info --chain zksync  # capabilities + gasless availability
```

### Account management

```bash
WALLET_PASSWORD="<pw>" awp-wallet init                                        # create wallet
WALLET_PASSWORD="<pw>" awp-wallet import --mnemonic "word1 word2 ... word12"  # import existing
WALLET_PASSWORD="<pw>" awp-wallet export                                      # show seed phrase
WALLET_PASSWORD="<old>" NEW_WALLET_PASSWORD="<new>" awp-wallet change-password
awp-wallet verify-log                                                          # audit log integrity
```

## Lock

Always lock when done:

```bash
awp-wallet lock
```

## Chains & Tokens

`--chain` — name or numeric ID. Default: `ethereum`.

16 preconfigured: `ethereum` `base` `bsc` `arbitrum` `optimism` `polygon` `avalanche` `fantom` `zksync` `linea` `scroll` `mantle` `blast` `celo` `sepolia` `base-sepolia`

Custom: `--chain 99999 --rpc-url https://custom.rpc.com`

`--asset` — symbol or contract address: `usdc` `usdt` `awp` `weth` `wbnb` `dai` or `0x...`

## Gasless Mode

Auto-activates when wallet has no native gas. Requires `PIMLICO_API_KEY`. Force with `--mode gasless`.

## Errors

| Error | Fix |
|-------|-----|
| `WALLET_PASSWORD environment variable required` | Generate password, store, inject |
| `No wallet found` | `awp-wallet init` |
| `Config not found` | `bash scripts/setup.sh` |
| `Invalid or expired session token` | `awp-wallet unlock` |
| `Insufficient balance for transfer + gas` | Fund wallet or `--mode gasless` |
| `Daily limit exceeded` | Edit `~/.openclaw-wallet/config.json` |
| `Amount must be a positive number` | Amount must be > 0 |
