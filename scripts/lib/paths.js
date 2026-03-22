import { join, basename } from "node:path"
import { existsSync } from "node:fs"

// Auto-detect agent identity from platform environment
function detectAgentId() {
  // 1. Explicit override — always wins
  if (process.env.AWP_WALLET_ID) return process.env.AWP_WALLET_ID

  // 2. OpenClaw: check if running inside an agent workspace
  //    OpenClaw agents run in ~/.openclaw/agents/<agentId>/ or custom workspace
  const cwd = process.cwd()
  const agentsMatch = cwd.match(/\.openclaw\/agents\/([^/]+)/)
  if (agentsMatch) return agentsMatch[1]

  // 3. OpenClaw: OPENCLAW_PROFILE env var
  if (process.env.OPENCLAW_PROFILE && process.env.OPENCLAW_PROFILE !== "default") {
    return process.env.OPENCLAW_PROFILE
  }

  // 4. OpenClaw: workspace path from OPENCLAW_WORKSPACE or CLAWDBOT_WORKSPACE
  for (const key of ["OPENCLAW_WORKSPACE", "CLAWDBOT_WORKSPACE"]) {
    if (process.env[key]) {
      const name = basename(process.env[key])
      if (name && name !== "workspace") return name
    }
  }

  // 5. No agent identity detected — use shared default
  return null
}

// Wallet directory — supports multi-agent isolation
// Priority: AWP_WALLET_DIR > AWP_WALLET_ID > auto-detect > default
const agentId = detectAgentId()

export const WALLET_DIR = process.env.AWP_WALLET_DIR
  || (agentId
    ? join(process.env.HOME, ".openclaw-wallet", "profiles", agentId)
    : join(process.env.HOME, ".openclaw-wallet"))

export { agentId }
