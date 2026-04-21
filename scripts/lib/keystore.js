import { Wallet } from "ethers"
import { privateKeyToAccount } from "viem/accounts"
import { randomBytes, createCipheriv, createDecipheriv, scryptSync, createHash } from "node:crypto"
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { WALLET_DIR, WALLETS_DIR, registerWallet } from "./paths.js"
import { readSecret } from "./secrets.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const WALLET_PATH = join(WALLET_DIR, "wallet.json")
const LEGACY_KS_PATH = join(WALLET_DIR, "keystore.enc")
const LEGACY_PW_PATH = join(WALLET_DIR, ".wallet-password")
const META_PATH = join(WALLET_DIR, "meta.json")
const SESSION_SECRET_PATH = join(WALLET_DIR, ".session-secret")
const SIGNER_CACHE_DIR = join(WALLET_DIR, ".signer-cache")

const ENCRYPTED_FORMAT = "awp-wallet-encrypted"
const ENCRYPTED_VERSION = 1
const KEY_LEN = 32
const IV_LEN = 12
const SALT_LEN = 16
const SCRYPT_N = 32768
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_MAXMEM = 128 * 1024 * 1024

function getWalletPassword() {
  if (existsSync(LEGACY_PW_PATH)) return readFileSync(LEGACY_PW_PATH, "utf8").trim()
  return readSecret({
    envKey: "WALLET_PASSWORD",
    fileEnvKey: "WALLET_PASSWORD_FILE",
    label: "WALLET_PASSWORD",
  })
}

function getNextWalletPassword() {
  return readSecret({
    envKey: "NEW_WALLET_PASSWORD",
    fileEnvKey: "NEW_WALLET_PASSWORD_FILE",
    label: "NEW_WALLET_PASSWORD",
  })
}

function isEncryptedWallet(data) {
  return data && data.format === ENCRYPTED_FORMAT && data.version === ENCRYPTED_VERSION
}

function encryptWalletData(data, password) {
  const salt = randomBytes(SALT_LEN)
  const iv = randomBytes(IV_LEN)
  const key = scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  })
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const plaintext = JSON.stringify(data)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    version: ENCRYPTED_VERSION,
    format: ENCRYPTED_FORMAT,
    kdf: {
      name: "scrypt",
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      salt: salt.toString("base64"),
    },
    crypto: {
      cipher: "aes-256-gcm",
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    },
    address: data.address,
  }
}

function decryptWalletData(data, password) {
  try {
    const salt = Buffer.from(data.kdf.salt, "base64")
    const iv = Buffer.from(data.crypto.iv, "base64")
    const tag = Buffer.from(data.crypto.tag, "base64")
    const ciphertext = Buffer.from(data.crypto.ciphertext, "base64")
    const key = scryptSync(password, salt, KEY_LEN, {
      N: data.kdf.N || SCRYPT_N,
      r: data.kdf.r || SCRYPT_R,
      p: data.kdf.p || SCRYPT_P,
      maxmem: SCRYPT_MAXMEM,
    })
    const decipher = createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
    return JSON.parse(plaintext)
  } catch {
    throw new Error("Wrong password or corrupted wallet.")
  }
}

function persistWalletPayload(data) {
  const password = getWalletPassword()
  const encrypted = encryptWalletData(data, password)
  writeFileSync(WALLET_PATH, JSON.stringify(encrypted), { mode: 0o600 })
}

function getSessionSecret() {
  if (!existsSync(SESSION_SECRET_PATH)) {
    throw new Error("Session secret not found. Run 'awp-wallet init' first.")
  }
  return readFileSync(SESSION_SECRET_PATH, "utf8").trim()
}

function cachePath(sessionId) {
  return join(SIGNER_CACHE_DIR, `${sessionId}.key`)
}

function signerCacheKey(sessionId) {
  return createHash("sha256")
    .update(`${getSessionSecret()}:${sessionId}`)
    .digest()
}

function writeSignerCache(sessionId, data) {
  if (!sessionId) return
  if (!existsSync(SIGNER_CACHE_DIR)) mkdirSync(SIGNER_CACHE_DIR, { recursive: true, mode: 0o700 })
  const key = signerCacheKey(sessionId)
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  writeFileSync(cachePath(sessionId), Buffer.concat([iv, tag, ciphertext]), { mode: 0o600 })
}

export function readSignerCache(sessionId) {
  const path = cachePath(sessionId)
  if (!existsSync(path)) return null
  const raw = readFileSync(path)
  if (raw.length < IV_LEN + 16) return null
  try {
    const iv = raw.subarray(0, IV_LEN)
    const tag = raw.subarray(IV_LEN, IV_LEN + 16)
    const ciphertext = raw.subarray(IV_LEN + 16)
    const decipher = createDecipheriv("aes-256-gcm", signerCacheKey(sessionId), iv)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
    return JSON.parse(plaintext)
  } catch {
    return null
  }
}

// --- Load wallet from plaintext wallet.json (with legacy keystore.enc migration) ---

function loadWallet() {
  if (existsSync(WALLET_PATH)) {
    const parsed = JSON.parse(readFileSync(WALLET_PATH, "utf8"))
    if (isEncryptedWallet(parsed)) {
      return decryptWalletData(parsed, getWalletPassword())
    }
    if (parsed?.privateKey) {
      persistWalletPayload(parsed)
      return parsed
    }
    throw new Error("Wallet file format is invalid.")
  }

  // Legacy migration: encrypted keystore.enc → wallet.json
  if (existsSync(LEGACY_KS_PATH)) {
    const password = getWalletPassword()
    const json = readFileSync(LEGACY_KS_PATH, "utf8")
    const w = Wallet.fromEncryptedJsonSync(json, password)
    const data = { privateKey: w.privateKey, address: w.address }
    if (w.mnemonic) data.mnemonic = w.mnemonic.phrase
    persistWalletPayload(data)
    return data
  }

  throw new Error("No wallet found. Run 'init' first.")
}

// Persist new wallet to disk
function persistNewWallet(wallet, status) {
  // Provision wallet directory
  if (!existsSync(WALLETS_DIR)) mkdirSync(WALLETS_DIR, { recursive: true, mode: 0o700 })
  if (!existsSync(WALLET_DIR)) mkdirSync(WALLET_DIR, { mode: 0o700 })
  mkdirSync(join(WALLET_DIR, "sessions"), { recursive: true, mode: 0o700 })

  const data = { privateKey: wallet.privateKey, address: wallet.address }
  if (wallet.mnemonic) data.mnemonic = wallet.mnemonic.phrase
  persistWalletPayload(data)

  // Write meta.json
  writeFileSync(META_PATH, JSON.stringify({ address: wallet.address, smartAccounts: {} }), { mode: 0o600 })

  // Copy default config if not present
  const configPath = join(WALLET_DIR, "chains.json")
  if (!existsSync(configPath)) {
    const defaultConfig = join(__dirname, "..", "..", "assets", "default-chains.json")
    if (existsSync(defaultConfig)) writeFileSync(configPath, readFileSync(defaultConfig), { mode: 0o600 })
  }

  // Generate session secret if not present
  const secretPath = join(WALLET_DIR, ".session-secret")
  if (!existsSync(secretPath)) {
    writeFileSync(secretPath, randomBytes(32).toString("hex"), { mode: 0o600 })
  }

  registerWallet(wallet.address)
  _metaCache = null

  return { status, address: wallet.address }
}

// --- Exports ---

export function loadSigner() {
  const data = loadWallet()
  return { account: privateKeyToAccount(data.privateKey) }
}

export function unlockAndCache(sessionId, expiresISO) {
  const data = loadWallet()
  writeSignerCache(sessionId, { privateKey: data.privateKey, address: data.address, expiresISO })
  return { account: privateKeyToAccount(data.privateKey) }
}

export function clearSignerCache() {
  if (!existsSync(SIGNER_CACHE_DIR)) return
  for (const f of readdirSync(SIGNER_CACHE_DIR).filter((name) => name.endsWith(".key"))) {
    try { unlinkSync(join(SIGNER_CACHE_DIR, f)) } catch {}
  }
}

export function initWallet() {
  if (existsSync(WALLET_PATH) || existsSync(LEGACY_KS_PATH)) throw new Error("Wallet already exists.")
  return persistNewWallet(Wallet.createRandom(), "created")
}

export function importWallet(mnemonic) {
  if (existsSync(WALLET_PATH) || existsSync(LEGACY_KS_PATH)) throw new Error("Wallet already exists.")
  return persistNewWallet(Wallet.fromPhrase(mnemonic.trim()), "imported")
}

export function changePassword(newPassword) {
  newPassword = newPassword || getNextWalletPassword()
  if (!newPassword) throw new Error("NEW_WALLET_PASSWORD is required.")
  const data = loadWallet()
  const encrypted = encryptWalletData(data, newPassword)
  writeFileSync(WALLET_PATH, JSON.stringify(encrypted), { mode: 0o600 })
  return { status: "password_changed", address: data.address }
}

export function exportMnemonic() {
  const data = loadWallet()
  if (!data.mnemonic) throw new Error("Wallet has no mnemonic (imported from private key).")
  return {
    mnemonic: data.mnemonic,
    warning: "Store this offline. Anyone with these words has full access to your funds."
  }
}

export function exportPrivateKey() {
  const data = loadWallet()
  return {
    privateKey: data.privateKey,
    address: data.address,
    warning: "Store this offline. Anyone with this key has full access to your funds."
  }
}

// --- Meta.json with in-process cache ---
let _metaCache = null

function loadMeta() {
  if (_metaCache) return _metaCache
  try {
    _metaCache = JSON.parse(readFileSync(META_PATH, "utf8"))
    return _metaCache
  } catch (err) {
    if (err.code === "ENOENT") throw new Error("No wallet found. Run 'init' first.")
    if (err instanceof SyntaxError) throw new Error("Wallet metadata corrupted. Re-import with 'import --mnemonic'.")
    throw err
  }
}

export function getAddress(type = "eoa", chainId) {
  const meta = loadMeta()
  if (type === "smart") return meta.smartAccounts?.[String(chainId)] || null
  return meta.address
}

export function saveSmartAccountAddress(chainId, addr) {
  const meta = loadMeta()
  if (meta.smartAccounts?.[String(chainId)] === addr) return
  if (!meta.smartAccounts) meta.smartAccounts = {}
  meta.smartAccounts[String(chainId)] = addr
  writeFileSync(META_PATH, JSON.stringify(meta), { mode: 0o600 })
  _metaCache = meta
}

export function getReceiveInfo(chainId) {
  return {
    eoaAddress: getAddress("eoa"),
    smartAccountAddress: chainId ? getAddress("smart", chainId) : null,
    note: "Send to EOA address for direct transactions. Smart Account address is for gasless operations (if deployed)."
  }
}
