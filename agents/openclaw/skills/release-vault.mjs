/**
 * Skill: release-vault
 * Signs and submits release() on an Algorand escrow vault.
 * Supports standard/agent (v1) and agent_v2 vault types.
 */

import algosdk from "algosdk"

// ARC-4 method selectors
const SEL_RELEASE    = new Uint8Array([0x07, 0x6b, 0xbd, 0x4d]) // release()void
const SEL_RELEASE_V2 = new Uint8Array([0x61, 0x17, 0xcc, 0xb8]) // release(uint64)uint64

const NETWORK    = (process.env.ALGO_NETWORK || "testnet").toLowerCase()
const ALGOD_URL  = NETWORK === "mainnet"
  ? (process.env.ALGOD_MAINNET_URL || "https://mainnet-api.algonode.cloud")
  : (process.env.ALGOD_TESTNET_URL || "https://testnet-api.algonode.cloud")

let _agentAccount = null
let _algodClient  = null

function getAgent() {
  if (_agentAccount) return { agentAccount: _agentAccount, algodClient: _algodClient }
  const mnemonic = process.env.AGENT_WALLET_MNEMONIC
  if (!mnemonic) throw new Error("AGENT_WALLET_MNEMONIC is not set")
  _agentAccount = algosdk.mnemonicToSecretKey(mnemonic.trim())
  _algodClient  = new algosdk.Algodv2(process.env.ALGOD_TOKEN || "", ALGOD_URL, "")
  return { agentAccount: _agentAccount, algodClient: _algodClient }
}

export async function checkAgentBalance() {
  const { agentAccount, algodClient } = getAgent()
  const info = await algodClient.accountInformation(agentAccount.addr).do()
  const balance = Number(info.amount) / 1_000_000
  return { address: agentAccount.addr, balance }
}

export async function releaseVault(vault) {
  const { agentAccount, algodClient } = getAgent()
  const appId      = Number(vault.app_id)
  const isAgentV2  = vault.vault_type === "agent_v2"
  const amountMicro = Math.round(Number(vault.amount || 0) * 1_000_000)

  const params = await algodClient.getTransactionParams().do()

  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender: agentAccount.addr,
    suggestedParams: { ...params, fee: 2000, flatFee: true },
    appIndex: appId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: isAgentV2
      ? [SEL_RELEASE_V2, algosdk.encodeUint64(amountMicro)]
      : [SEL_RELEASE],
    boxes: isAgentV2
      ? [{ appIndex: appId, name: new Uint8Array(0) }]
      : undefined,
  })

  const signed    = txn.signTxn(agentAccount.sk)
  const sendRes   = await algodClient.sendRawTransaction(signed).do()
  const txid      = sendRes.txId ?? sendRes.txid ?? ""

  const confirmed = await algosdk.waitForConfirmation(algodClient, txid, 4)

  if (confirmed?.["pool-error"]) {
    throw new Error(`pool-error: ${confirmed["pool-error"]}`)
  }
  if (!(confirmed?.["confirmed-round"] || confirmed?.confirmedRound)) {
    throw new Error("Transaction never confirmed in a round")
  }

  return txid
}
