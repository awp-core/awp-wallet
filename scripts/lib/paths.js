import { join, basename } from "node:path"
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, renameSync } from "node:fs"
import { createHash } from "node:crypto"

const BASE_DIR = join(process.env.HOME, ".openclaw-wallet")
const WALLETS_DIR = join(BASE_DIR, "wallets")
const REGISTRY_PATH = join(BASE_DIR, "wallets.json")

// Generate wallet ID from environment context
function deriveWalletId() {
  const parts = []

  const cwd = process.cwd()
  const agentsMatch = cwd.match(/\.openclaw\/agents\/([^/]+)/)
  if (agentsMatch) parts.push(agentsMatch[1])

  if (process.env.OPENCLAW_PROFILE && process.env.OPENCLAW_PROFILE !== "default") {
    parts.push(process.env.OPENCLAW_PROFILE)
  }

  for (const key of ["OPENCLAW_WORKSPACE", "CLAWDBOT_WORKSPACE"]) {
    if (process.env[key]) {
      const name = basename(process.env[key])
      if (name && name !== "workspace") parts.push(name)
    }
  }

  if (parts.length === 0) return null

  const raw = parts[0]
  if (/^[a-z0-9_-]+$/i.test(raw) && raw.length <= 24) return raw
  return createHash("sha256").update(parts.join(":")).digest("hex").slice(0, 12)
}

// Resolve: explicit > auto-detect > "default"
function resolveWalletId() {
  if (process.env.AWP_WALLET_ID) return process.env.AWP_WALLET_ID
  return deriveWalletId() || "default"
}

export const walletId = resolveWalletId()

// Backward compat: migrate old root-level wallet to wallets/default/
if (existsSync(join(BASE_DIR, "keystore.enc")) && !existsSync(join(WALLETS_DIR, "default", "keystore.enc"))) {
  const defaultDir = join(WALLETS_DIR, "default")
  mkdirSync(defaultDir, { recursive: true, mode: 0o700 })
  for (const f of ["keystore.enc", "meta.json", ".wallet-password", ".session-secret", "tx-log.jsonl", "config.json"]) {
    const src = join(BASE_DIR, f)
    if (existsSync(src)) {
      writeFileSync(join(defaultDir, f), readFileSync(src), { mode: 0o600 })
      renameSync(src, src + ".migrated")
    }
  }
  for (const d of [".signer-cache", "sessions"]) {
    const src = join(BASE_DIR, d)
    const dst = join(defaultDir, d)
    if (existsSync(src) && !existsSync(dst)) {
      renameSync(src, dst)
    }
  }
}

// Wallet directory for current agent
export const WALLET_DIR = join(WALLETS_DIR, walletId)

// Register wallet in the wallets.json registry
export function registerWallet(address) {
  let registry = {}
  if (existsSync(REGISTRY_PATH)) {
    try { registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8")) } catch {}
  }
  registry[walletId] = {
    address,
    createdAt: registry[walletId]?.createdAt || new Date().toISOString(),
    lastUsed: new Date().toISOString(),
    source: process.env.AWP_WALLET_ID ? "explicit" : (deriveWalletId() ? "auto" : "default"),
  }
  if (!existsSync(BASE_DIR)) mkdirSync(BASE_DIR, { mode: 0o700 })
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), { mode: 0o600 })
}

// List all wallets
export function listWallets() {
  if (!existsSync(REGISTRY_PATH)) return {}
  try { return JSON.parse(readFileSync(REGISTRY_PATH, "utf8")) } catch { return {} }
}

export { BASE_DIR, WALLETS_DIR }
