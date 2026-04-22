#!/usr/bin/env node
/**
 * Deploy all 5 Unsubscribely escrow vault contracts to Algorand Testnet.
 *
 * Usage:
 *   node scripts/deploy.js
 *
 * Required environment variables (.env file):
 *   TESTNET_MNEMONIC   — 25-word mnemonic of a funded Testnet account
 *   ALGOD_URL          — (optional) defaults to https://testnet-api.algonode.cloud
 *   ALGOD_TOKEN        — (optional) defaults to empty string
 *
 * Fund your deployer account at: https://bank.testnet.algorand.network/
 */

import algosdk from "algosdk"
import { readFileSync, writeFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const ARTIFACTS_DIR = join(ROOT, "smart_contracts", "artifacts")
const OUTPUT_FILE = join(ARTIFACTS_DIR, "deployed.json")

const ALGOD_URL = process.env.ALGOD_URL || "https://testnet-api.algonode.cloud"
const ALGOD_TOKEN = process.env.ALGOD_TOKEN || ""
const TESTNET_MNEMONIC = process.env.TESTNET_MNEMONIC || ""

const CONTRACT_CONFIGS = [
  {
    name: "EscrowVault",
    description: "Standard Escrow Vault",
    numGlobalInts: 1, numGlobalBytes: 2,
    numLocalInts: 0, numLocalBytes: 0,
  },
  {
    name: "AgentEscrowVault",
    description: "Agent-Managed Escrow Vault (A2A Autonomous Payments)",
    numGlobalInts: 1, numGlobalBytes: 3,
    numLocalInts: 0, numLocalBytes: 0,
  },
  {
    name: "TimeLockEscrow",
    description: "Time-Locked Escrow Vault",
    numGlobalInts: 2, numGlobalBytes: 2,
    numLocalInts: 0, numLocalBytes: 0,
  },
  {
    name: "MultiSigEscrow",
    description: "Multi-Signature Escrow Vault",
    numGlobalInts: 3, numGlobalBytes: 3,
    numLocalInts: 0, numLocalBytes: 0,
  },
  {
    name: "DisputeEscrow",
    description: "Dispute-Resolution Escrow Vault",
    numGlobalInts: 1, numGlobalBytes: 3,
    numLocalInts: 0, numLocalBytes: 0,
  },
  {
    name: "ASAEscrow",
    description: "ASA Token Escrow Vault",
    numGlobalInts: 2, numGlobalBytes: 2,
    numLocalInts: 0, numLocalBytes: 0,
  },
  // ── Singleton contracts (one app for the whole platform) ──────────────────
  {
    name: "ServiceRegistry",
    description: "A2A on-chain service registry (Box-Storage)",
    numGlobalInts: 2, numGlobalBytes: 1,
    numLocalInts: 0, numLocalBytes: 0,
    singleton: true,
  },
  {
    name: "AgentEscrowVaultV2",
    description: "Agent Escrow v2 with on-chain billing history (Box-Storage)",
    numGlobalInts: 2, numGlobalBytes: 3,
    numLocalInts: 0, numLocalBytes: 0,
    template: true, // deploys one canonical instance for spec discovery only
  },
]

function loadTeal(name, kind) {
  const candidates = [
    join(ARTIFACTS_DIR, name, `${name}.${kind}.teal`),
    join(ARTIFACTS_DIR, name, `${kind}.teal`),
  ]
  for (const path of candidates) {
    if (existsSync(path)) {
      return readFileSync(path)
    }
  }
  throw new Error(`TEAL file not found for ${name}/${kind}. Tried:\n${candidates.join("\n")}`)
}

async function compileTeal(algodClient, tealSource) {
  const result = await algodClient.compile(tealSource).do()
  return Buffer.from(result.result, "base64")
}

async function deployContract(algodClient, senderAddress, senderSk, approvalBinary, clearBinary, config) {
  const suggestedParams = await algodClient.getTransactionParams().do()

  const txn = algosdk.makeApplicationCreateTxnFromObject({
    sender: senderAddress,
    suggestedParams,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    approvalProgram: approvalBinary,
    clearProgram: clearBinary,
    numGlobalByteSlices: config.numGlobalBytes,
    numGlobalInts: config.numGlobalInts,
    numLocalByteSlices: config.numLocalBytes,
    numLocalInts: config.numLocalInts,
  })

  const signedTxn = txn.signTxn(senderSk)
  const { txid } = await algodClient.sendRawTransaction(signedTxn).do()
  console.log(`    TxID: ${txid}`)

  const result = await algosdk.waitForConfirmation(algodClient, txid, 4)
  return Number(result["application-index"])
}

async function main() {
  if (!TESTNET_MNEMONIC) {
    console.error("ERROR: TESTNET_MNEMONIC environment variable is not set.")
    console.error("Set it in your .env file with your 25-word mnemonic.")
    process.exit(1)
  }

  const privateKey = algosdk.mnemonicToSecretKey(TESTNET_MNEMONIC)
  const senderAddress = privateKey.addr.toString()
  const senderSk = privateKey.sk

  const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, "")

  const accountInfo = await algodClient.accountInformation(senderAddress).do()
  const balanceAlgo = Number(accountInfo.amount) / 1_000_000
  console.log(`Deployer : ${senderAddress}`)
  console.log(`Balance  : ${balanceAlgo.toFixed(6)} ALGO`)
  console.log(`Network  : ${ALGOD_URL}`)
  console.log("=".repeat(60))

  if (balanceAlgo < 1.0) {
    console.warn(`\nWARNING: Low balance (${balanceAlgo.toFixed(4)} ALGO).`)
    console.warn(`Fund this address: https://bank.testnet.algorand.network/`)
    console.warn(`Address: ${senderAddress}\n`)
    if (balanceAlgo === 0) {
      console.error("ERROR: Zero balance — cannot deploy. Fund the account first.")
      process.exit(1)
    }
  }

  const deployed = {}

  for (const config of CONTRACT_CONFIGS) {
    console.log(`\nDeploying ${config.name} (${config.description})...`)
    try {
      const approvalTeal = loadTeal(config.name, "approval")
      const clearTeal = loadTeal(config.name, "clear")

      const approvalBinary = await compileTeal(algodClient, approvalTeal)
      const clearBinary = await compileTeal(algodClient, clearTeal)

      const appId = await deployContract(algodClient, senderAddress, senderSk, approvalBinary, clearBinary, config)
      const appAddress = algosdk.getApplicationAddress(appId)

      deployed[config.name] = {
        app_id: appId,
        app_address: appAddress,
        lora_url: `https://lora.algokit.io/testnet/application/${appId}`,
        network: ALGOD_URL,
        deployer: senderAddress,
      }

      console.log(`    App ID:      ${appId}`)
      console.log(`    App Address: ${appAddress}`)
      console.log(`    Lora URL:    https://lora.algokit.io/testnet/application/${appId}`)
    } catch (err) {
      console.error(`    FAILED — ${err.message}`)
      deployed[config.name] = { error: err.message }
    }
  }

  console.log("\n" + "=".repeat(60))
  console.log("Deployment Summary:")
  for (const [name, info] of Object.entries(deployed)) {
    if (info.app_id) {
      console.log(`  ${name}: App ID ${info.app_id}`)
      console.log(`    Lora: ${info.lora_url}`)
    } else {
      console.log(`  ${name}: ERROR — ${info.error}`)
    }
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(deployed, null, 2))
  console.log(`\nDeployment results saved to: ${OUTPUT_FILE}`)
}

main().catch((err) => {
  console.error("Fatal:", err.message)
  process.exit(1)
})
