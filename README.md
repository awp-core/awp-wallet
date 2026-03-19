# AWP Wallet

  <p align="center">
    <a href="https://awp.pro/">
      <img src="assets/banner.png" alt="AWP - Agent Work Protocol" width="800">
    </a>
  </p>

  <p align="center">
    <img src="https://img.shields.io/badge/EVM-400%2B_Chains-6C47FF?style=flat" alt="EVM">
    <img src="https://img.shields.io/badge/ERC--4337-Gasless-F0B90B?style=flat" alt="ERC-4337">
    <img src="https://img.shields.io/badge/Self--Custodial-16A34A?style=flat&logo=ethereum&logoColor=white" alt="Self-Custodial">
    <img src="https://img.shields.io/badge/26_CLI_Commands-1a1a1a?style=flat&logo=windowsterminal&logoColor=white" alt="CLI">
    <img src="https://img.shields.io/badge/144_Tests-0_Failures-brightgreen?style=flat" alt="Tests">
    <img src="https://img.shields.io/badge/License-MIT-97CA00?style=flat" alt="MIT">
  </p>

  Self-custodial, chain-agnostic EVM blockchain wallet for AI agents. Direct EOA transactions by default, with on-demand ERC-4337 gasless support.

  ### Works with

  <p align="center">
    <a href="https://github.com/anthropics/claude-code"><img src="https://img.shields.io/badge/Claude_Code-191919?style=for-the-badge&logo=anthropic&logoColor=white" alt="Claude Code"></a>
    &nbsp;
    <a href="https://github.com/openclaw/openclaw"><img src="https://img.shields.io/badge/OpenClaw-FF4500?style=for-the-badge" alt="OpenClaw"></a>
    &nbsp;
    <a href="https://cursor.sh"><img src="https://img.shields.io/badge/Cursor-000000?style=for-the-badge" alt="Cursor"></a>
    &nbsp;
    <a href="https://openai.com/codex"><img src="https://img.shields.io/badge/Codex-412991?style=for-the-badge&logo=openai&logoColor=white" alt="Codex"></a>
    &nbsp;
    <a href="https://ai.google.dev/gemini-api/docs/cli"><img src="https://img.shields.io/badge/Gemini_CLI-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Gemini CLI"></a>
    &nbsp;
    <a href="https://windsurf.ai"><img src="https://img.shields.io/badge/Windsurf-06B6D4?style=for-the-badge" alt="Windsurf"></a>
  </p>

  <p align="center">Any agent that can invoke CLI commands.</p>

  ---

  ## Install

  Paste the repo URL in your agent conversation, or install manually:

  ```bash
  git clone https://github.com/awp-core/awp-wallet.git
  cd awp-wallet && bash install.sh
  ```

  The installer will:
  1. Install npm dependencies
  2. Register `awp-wallet` as a global command
  3. Create runtime directory (`~/.awp-wallet/`) with strict permissions
  4. Generate a 48-char random wallet password
  5. Initialize the wallet and verify the full lifecycle

  Output (JSON to stdout):

  ```json
  {
    "status": "installed",
    "installDir": "/home/user/awp-wallet",
    "walletDir": "/home/user/.awp-wallet",
    "walletPassword": "auto-generated-48-char-password",
    "address": "0x...",
    "command": "awp-wallet"
  }
  ```

  **Options:**

  | Flag | Default | Description |
  |------|---------|-------------|
  | `--dir <path>` | `~/awp-wallet` | Installation directory |
  | `--password <pwd>` | Auto-generated | Wallet password |
  | `--pimlico <key>` | None | Gasless transactions |
  | `--no-init` | Init enabled | Setup only |

  <details>
  <summary><strong>Manual Install (Step by Step)</strong></summary>

  #### Prerequisites

  - Node.js >= 20
  - npm >= 9
  - Git

  #### Step 1: Clone and install

  ```bash
  git clone https://github.com/awp-core/awp-wallet.git
  cd awp-wallet
  bash scripts/setup.sh
  ```

  This will:
  - Install 4 npm dependencies (viem, permissionless, ethers, commander)
  - Register the `awp-wallet` command globally via `npm link`
  - Create the runtime directory `~/.awp-wallet/` with strict permissions (0o700)
  - Copy the default chain config (16 chains, 3 bundler providers)
  - Generate a 32-byte HMAC session secret

  #### Step 2: Configure secrets

  Store these secrets securely via your agent platform's secret management (environment variables, encrypted store, etc.):

  | Secret | Purpose |
  |--------|---------|
  | `WALLET_PASSWORD` | Keystore encryption password (auto-generated if not set) |
  | `PIMLICO_API_KEY` | (Optional) Enable gasless ERC-4337 transactions |

  #### Step 3: Initialize wallet

  ```bash
  WALLET_PASSWORD="your-password" awp-wallet init
  # => { "status": "created", "address": "0x..." }
  ```

  #### Step 4: Register skill

  Point your agent to the `SKILL.md` file so it knows when and how to use the wallet. The method depends on your agent platform — typically adding the skill folder to the agent's skills directory or uploading via settings.

  #### Step 5: Verify

  ```bash
  WALLET_PASSWORD="your-password" awp-wallet unlock --duration 60
  # => { "sessionToken": "wlt_...", "expires": "..." }

  awp-wallet balance --token wlt_... --chain bsc
  # => { "chain": "BNB Smart Chain", "chainId": 56, "balances": { "BNB": "0", ... } }

  awp-wallet lock
  # => { "status": "locked" }
  ```

  </details>

  ## How Agents Use the Wallet

  Once installed, agents invoke wallet commands as subprocess calls:

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

  ### Transaction Routing

  ```
  User intent
       │
       ▼
   tx-router: select path
       │
       ├── Has native gas OR --mode direct ──→ direct-tx.js
       │     viem walletClient.sendTransaction()
       │     21k gas (ETH) / ~65k gas (ERC-20)
       │
       └── No gas OR --mode gasless ──→ gasless-tx.js
             Smart Account → Bundler → Paymaster → EntryPoint
             ERC-4337, gas paid by paymaster
  ```

  ## Security

  | Layer | Protection |
  |-------|-----------|
  | Keystore | scrypt (N=262144) + AES-128-CTR — ~1 attempt/sec brute-force |
  | Signer cache | scrypt (N=16384) + AES-256-GCM — ~2000 attempts/sec |
  | Session tokens | HMAC-SHA256, time-limited, tamper-proof |
  | Path traversal | Regex validation on token IDs |
  | File permissions | 0o600/0o700 (owner-only) |
  | Process isolation | Keys destroyed on exit |
  | Transaction limits | Per-tx and 24h rolling caps |
  | Audit log | SHA-256 hash-chain for tamper detection |

  **Private keys never enter the agent's context.** The agent only receives time-limited session tokens.

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

  ## Quick Start

  ```bash
  WALLET_PASSWORD="your-password" awp-wallet init
  WALLET_PASSWORD="your-password" awp-wallet unlock --duration 3600
  awp-wallet balance --token wlt_abc123 --chain ethereum
  WALLET_PASSWORD="your-password" awp-wallet send \
    --token wlt_abc123 --to 0xRecipient --amount 50 --asset usdc --chain base
  awp-wallet lock
  ```

  ## Testing

  ```bash
  node --test tests/integration/*.test.js tests/e2e/*.test.js
  ```

  144 tests, 11 files.

  ## Updating

  ```bash
  cd awp-wallet && git pull && npm install
  ```

  ## License

  [MIT](LICENSE)
  