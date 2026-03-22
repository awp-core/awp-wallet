import { join, basename } from "node:path"

// Auto-detect agent identity from platform environment
function detectAgentId() {
  // 1. OpenClaw: running inside agent workspace (~/.openclaw/agents/<id>/)
  const cwd = process.cwd()
  const agentsMatch = cwd.match(/\.openclaw\/agents\/([^/]+)/)
  if (agentsMatch) return agentsMatch[1]

  // 2. OpenClaw: profile env var
  if (process.env.OPENCLAW_PROFILE && process.env.OPENCLAW_PROFILE !== "default") {
    return process.env.OPENCLAW_PROFILE
  }

  // 3. OpenClaw: workspace env var
  for (const key of ["OPENCLAW_WORKSPACE", "CLAWDBOT_WORKSPACE"]) {
    if (process.env[key]) {
      const name = basename(process.env[key])
      if (name && name !== "workspace") return name
    }
  }

  // 4. No agent identity — shared default
  return null
}

const agentId = detectAgentId()

// AWP_WALLET_DIR = full path override (advanced)
// Auto-detect = profiles/<agentId>/ (from OpenClaw context)
// Default = ~/.openclaw-wallet/ (no agent context)
export const WALLET_DIR = process.env.AWP_WALLET_DIR
  || (agentId
    ? join(process.env.HOME, ".openclaw-wallet", "profiles", agentId)
    : join(process.env.HOME, ".openclaw-wallet"))

export { agentId }
