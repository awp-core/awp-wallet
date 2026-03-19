# AWP Wallet

[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

Self-custodial, chain-agnostic EVM blockchain wallet for AI agents. Direct EOA transactions by default, with on-demand ERC-4337 gasless support.

Works with OpenClaw · Claude Code · Cursor · Codex · Gemini CLI · Windsurf — and any agent that can invoke CLI commands.

## Install

Paste the repo URL in your agent conversation, or install manually:

```bash
git clone https://github.com/awp-core/awp-wallet.git
cd awp-wallet && bash install.sh
```

### How Agents Use the Wallet

```
Agent
  │
  │  User: "Send 50 USDC to 0xBob on Base"
  │
  ├─ 1. WALLET_PASSWORD="$SECRET" awp-wallet unlock --duration 300
  │     → { "sessionToken": "wlt_abc..." }
  │
  ├─ 2. WALLET_PASSWORD="$SECRET" awp-wallet send \
  │       --token wlt_abc --to 0xBob --amount 50 --asset usdc --chain base
  │     → { "status": "sent", "txHash": "0x...", "mode": "direct", ... }
  │
  └─ 3. awp-wallet lock
        → { "status": "locked" }
```

Each command is an independent process. The agent only sees JSON and session tokens — **never** private keys. Password is auto-generated on first use.

## Features

- **400+ EVM chains** — 16 preconfigured + any custom chain via `--chain <id> --rpc-url`
- **Dual-mode** — Direct EOA (default) or gasless ERC-4337 (auto when no gas)
- **Self-custodial** — Private keys never leave the wallet process
- **16 preconfigured chains** — Ethereum, Base, BSC, Arbitrum, Optimism, Polygon, Avalanche, Fantom, zkSync, Linea, Scroll, Mantle, Blast, Celo + testnets
- **26 commands** — Send, balance, approve, revoke, sign, estimate, batch, and more
- **144 tests** — Integration + E2E, 0 failures

## Commands

| Command | What It Does |
|---------|-------------|
| `init` | Create a new wallet |
| `import --mnemonic "..."` | Import from seed phrase |
| `unlock [--duration N] [--scope S]` | Get a session token |
| `lock` | Revoke all sessions |
| `balance --token T [--chain C]` | Check balances |
| `portfolio --token T` | Balances across all chains |
| `send --token T --to A --amount N` | Send tokens |
| `batch --token T --ops JSON` | Batch operations |
| `approve / revoke` | Token approvals |
| `estimate --to A --amount N` | Gas estimation |
| `sign-message / sign-typed-data` | Message signing (EIP-191/712) |
| `history / tx-status / verify-log` | Transaction tracking |
| `chain-info / chains / receive` | Chain & address info |
| `change-password / export` | Account management |
| `upgrade-7702 / deploy-4337` | Smart account ops |

See [SKILL.md](SKILL.md) for full command reference.

## Architecture

```
Agent
  │
  ├── awp-wallet balance --token T --chain ethereum  → JSON stdout
  ├── awp-wallet send --token T --to 0x... ...       → JSON stdout
  └── awp-wallet lock                                → JSON stdout

Each command = independent Node.js process
  ├── Reads encrypted keystore (scrypt N=262144)
  ├── Decrypts signer from AES-GCM cache (scrypt N=16384)
  ├── Executes on-chain operation via viem
  ├── Returns JSON result
  └── Process exits — all secrets destroyed
```

## Security

| Layer | Protection |
|-------|-----------|
| Keystore | scrypt (N=262144) + AES-128-CTR |
| Signer cache | scrypt (N=16384) + AES-256-GCM |
| Session tokens | HMAC-SHA256, time-limited, tamper-proof |
| Path traversal | Regex validation on token IDs |
| File permissions | 0o600/0o700 (owner-only) |
| Process isolation | Keys destroyed on exit |
| Transaction limits | Per-tx and 24h rolling caps |
| Audit log | SHA-256 hash-chain |

**Private keys never enter the agent's context.**

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `WALLET_PASSWORD` | For write ops | Keystore password (auto-generated if not set) |
| `NEW_WALLET_PASSWORD` | change-password | New password |
| `PIMLICO_API_KEY` | For gasless | ERC-4337 bundler/paymaster |
| `ALCHEMY_API_KEY` | Optional | RPC + bundler fallback |

## Platform Integration

### Claude Code

Add the wallet guide to your project:

```bash
cat awp-wallet/docs/CLAUDE-WEB3-GUIDE.md >> your-project/CLAUDE.md
```

See [docs/CLAUDE-WEB3-GUIDE.md](docs/CLAUDE-WEB3-GUIDE.md).

### Other Agents

Works with any agent that can run CLI commands and parse JSON. Point your agent to this repo's `SKILL.md`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| CLI | commander |
| Keystore | ethers v6 + AES-256-GCM cache |
| Transactions | viem (direct EOA) |
| Smart Accounts | permissionless 0.3 (Kernel v3) |
| Bundler | viem/account-abstraction (fallback transport) |
| Chain Registry | viem/chains (400+ built-in) |

4 runtime dependencies. Node.js >= 20.

---

## Development

### Build from Source

```bash
git clone https://github.com/awp-core/awp-wallet.git
cd awp-wallet && bash scripts/setup.sh
```

### One-Click Deploy

```bash
git clone https://github.com/awp-core/awp-wallet.git
cd awp-wallet && bash install.sh
```

Options:

| Flag | Default | Description |
|------|---------|-------------|
| `--dir <path>` | `~/awp-wallet` | Installation directory |
| `--password <pwd>` | Auto-generated | Wallet password |
| `--pimlico <key>` | None | Gasless transactions |
| `--no-init` | Init enabled | Setup only |

### Quick Start

```bash
WALLET_PASSWORD="your-password" awp-wallet init
WALLET_PASSWORD="your-password" awp-wallet unlock --duration 3600
awp-wallet balance --token wlt_abc123 --chain ethereum
WALLET_PASSWORD="your-password" awp-wallet send \
  --token wlt_abc123 --to 0xRecipient --amount 50 --asset usdc --chain base
awp-wallet lock
```

### Testing

```bash
node --test tests/integration/*.test.js tests/e2e/*.test.js
```

144 tests, 11 files.

### Updating

```bash
cd awp-wallet && git pull && npm install
```

## License

[MIT](LICENSE)
