import { join } from "node:path"

// Wallet directory — supports multi-agent isolation via AWP_WALLET_ID
// AWP_WALLET_DIR overrides the entire path (advanced)
// AWP_WALLET_ID creates a namespaced profile (recommended for multi-agent)
// No env var = default shared wallet (backward compatible)
export const WALLET_DIR = process.env.AWP_WALLET_DIR
  || (process.env.AWP_WALLET_ID
    ? join(process.env.HOME, ".openclaw-wallet", "profiles", process.env.AWP_WALLET_ID)
    : join(process.env.HOME, ".openclaw-wallet"))
