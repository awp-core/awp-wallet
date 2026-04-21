import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  createTestEnv,
  runCli,
  TEST_PASSWORD_NEW,
} from "../helpers/setup.js"

const TEST_MNEMONIC = "test test test test test test test test test test test junk"
const KNOWN_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

describe("encrypted keystore", () => {
  let ctx

  beforeEach(() => {
    ctx = createTestEnv()
  })

  afterEach(() => {
    ctx.cleanup()
  })

  it("init stores wallet.json as encrypted payload instead of plaintext secret material", () => {
    const res = runCli("init", ctx.env)
    assert.equal(res.exitCode, 0, res.stderr)

    const walletPath = join(ctx.walletDir, "wallet.json")
    assert.ok(existsSync(walletPath), "wallet.json should exist")
    const stored = JSON.parse(readFileSync(walletPath, "utf8"))

    assert.equal(stored.format, "awp-wallet-encrypted")
    assert.equal(stored.version, 1)
    assert.equal(stored.address, res.json.address)
    assert.ok(stored.crypto?.ciphertext, "ciphertext missing")
    assert.ok(stored.crypto?.iv, "iv missing")
    assert.ok(stored.crypto?.tag, "tag missing")
    assert.ok(stored.kdf?.salt, "salt missing")
    assert.equal("privateKey" in stored, false)
    assert.equal("mnemonic" in stored, false)
  })

  it("status can decrypt the wallet with the correct WALLET_PASSWORD", () => {
    const initRes = runCli("init", ctx.env)
    assert.equal(initRes.exitCode, 0, initRes.stderr)

    const statusRes = runCli("status", ctx.env)
    assert.equal(statusRes.exitCode, 0, statusRes.stderr)
    assert.equal(statusRes.json.address, initRes.json.address)
  })

  it("export fails with a wrong WALLET_PASSWORD", () => {
    const initRes = runCli("init", ctx.env)
    assert.equal(initRes.exitCode, 0, initRes.stderr)

    const wrongEnv = { ...ctx.env, WALLET_PASSWORD: "definitely-wrong" }
    const exportRes = runCli("export", wrongEnv)
    assert.notEqual(exportRes.exitCode, 0)
    const output = exportRes.stderr || exportRes.stdout
    assert.match(output, /Wrong password or corrupted wallet/)
  })

  it("change-password re-encrypts the wallet and invalidates the old password", () => {
    const initRes = runCli("init", ctx.env)
    assert.equal(initRes.exitCode, 0, initRes.stderr)

    const rotateEnv = { ...ctx.env, NEW_WALLET_PASSWORD: TEST_PASSWORD_NEW }
    const rotateRes = runCli("change-password", rotateEnv)
    assert.equal(rotateRes.exitCode, 0, rotateRes.stderr)
    assert.equal(rotateRes.json.status, "password_changed")

    const oldExport = runCli("export", ctx.env)
    assert.notEqual(oldExport.exitCode, 0)

    const newEnv = { ...ctx.env, WALLET_PASSWORD: TEST_PASSWORD_NEW }
    const newExport = runCli("export", newEnv)
    assert.equal(newExport.exitCode, 0, newExport.stderr)
    assert.equal(newExport.json.mnemonic.trim().split(/\s+/).length, 12)
  })

  it("status can decrypt the wallet via WALLET_PASSWORD_FILE", () => {
    const initRes = runCli("init", ctx.env)
    assert.equal(initRes.exitCode, 0, initRes.stderr)

    const secretPath = join(ctx.home, "wallet-password.secret")
    writeFileSync(secretPath, `${ctx.env.WALLET_PASSWORD}\n`, { mode: 0o600 })
    const fileEnv = { ...ctx.env }
    delete fileEnv.WALLET_PASSWORD
    fileEnv.WALLET_PASSWORD_FILE = secretPath

    const statusRes = runCli("status", fileEnv)
    assert.equal(statusRes.exitCode, 0, statusRes.stderr)
    assert.equal(statusRes.json.address, initRes.json.address)
  })

  it("change-password accepts NEW_WALLET_PASSWORD_FILE for rotation", () => {
    const initRes = runCli("init", ctx.env)
    assert.equal(initRes.exitCode, 0, initRes.stderr)

    const rotateSecretPath = join(ctx.home, "wallet-password-next.secret")
    writeFileSync(rotateSecretPath, `${TEST_PASSWORD_NEW}\n`, { mode: 0o600 })
    const rotateEnv = { ...ctx.env }
    delete rotateEnv.NEW_WALLET_PASSWORD
    rotateEnv.NEW_WALLET_PASSWORD_FILE = rotateSecretPath

    const rotateRes = runCli("change-password", rotateEnv)
    assert.equal(rotateRes.exitCode, 0, rotateRes.stderr)
    assert.equal(rotateRes.json.status, "password_changed")

    const newSecretEnv = { ...ctx.env }
    delete newSecretEnv.WALLET_PASSWORD
    newSecretEnv.WALLET_PASSWORD_FILE = rotateSecretPath
    const exportRes = runCli("export", newSecretEnv)
    assert.equal(exportRes.exitCode, 0, exportRes.stderr)
    assert.equal(exportRes.json.mnemonic.trim().split(/\s+/).length, 12)
  })

  it("loads a legacy plaintext wallet.json once, then migrates it to encrypted format", () => {
    const plaintext = {
      address: KNOWN_ADDRESS,
      privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      mnemonic: TEST_MNEMONIC,
    }
    writeFileSync(join(ctx.walletDir, "wallet.json"), JSON.stringify(plaintext), { mode: 0o600 })
    writeFileSync(join(ctx.walletDir, "meta.json"), JSON.stringify({ address: KNOWN_ADDRESS, smartAccounts: {} }), { mode: 0o600 })

    const exportRes = runCli("export", ctx.env)
    assert.equal(exportRes.exitCode, 0, exportRes.stderr)
    assert.equal(exportRes.json.mnemonic, TEST_MNEMONIC)

    const migrated = JSON.parse(readFileSync(join(ctx.walletDir, "wallet.json"), "utf8"))
    assert.equal(migrated.format, "awp-wallet-encrypted")
    assert.equal("privateKey" in migrated, false)
    assert.equal("mnemonic" in migrated, false)
  })
})
