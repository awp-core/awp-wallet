import { readFileSync } from "node:fs"

function readSecretFile(path) {
  try {
    return readFileSync(path, "utf8").trim()
  } catch (err) {
    throw new Error(`Failed to read secret file: ${path}`)
  }
}

export function readSecret({ envKey, fileEnvKey, required = true, label = envKey }) {
  const direct = process.env[envKey]
  if (direct) return direct

  const filePath = process.env[fileEnvKey]
  if (filePath) {
    const value = readSecretFile(filePath)
    if (value) return value
    throw new Error(`${label} secret file is empty.`)
  }

  if (required) {
    throw new Error(`${label} is required.`)
  }
  return ""
}
