/**
 * Skill: release-vault
 *
 * Signs and submits a release() application call on Algorand.
 * Supports standard ALGO vaults, AgentEscrowVaultV2, and ASA vaults.
 *
 * Returns { txid, network, mode } on success.
 */

import algosdk from "algosdk"

// ARC-4 method selectors
const SEL_RELEASE = new Uint8Array([0x07, 0x6b, 0xbd, 0x4d])       // release()void
const SEL_RELEASE_V2 = new Uint8Array([0x61, 0x17, 0xcc, 0xb8])    // AgentEscrowVaultV2.release(uint64)uint64

function getAlgodClient(network) {
  const isMainnet = network === "mainnet"
  const url = isMainnet
    ? (process.env.ALGOD_MAINNET_URL || "https://mainnet-api.algonode.cloud")
    : (process.env.ALGOD_TESTNET_URL || process.env.ALGOD_URL || "https://testnet-api.algonode.cloud")
  return new algosdk.Algodv2(process.env.ALGOD_TOKEN || "", url, "")
}

function getAgentAccount() {
  const mnemonic = process.env.AGENT_WALLET_MNEMONIC
  if (!mnemonic) throw new Error("AGENT_WALLET_MNEMONIC not set")
  return algosdk.mnemonicToSecretKey(mnemonic.trim())
}

async function optInToAsa(algod, account, asaId) {
  try {
    const info = await algod.accountInformation(account.addr).do()
    const assets = info.assets || []
    if (assets.some((a) => Number(a["asset-id"]) === Number(asaId))) return
  } catch { /* proceed with opt-in */ }

  const params = await algod.getTransactionParams().do()
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: account.addr,
    receiver: account.addr,
    amount: 0,
    assetIndex: Number(asaId),
    suggestedParams: params,
  })
  const signed = txn.signTxn(account.sk)
  const { txId } = await algod.sendRawTransaction(signed).do()
  await algosdk.waitForConfirmation(algod, txId, 4)
}

/**
 * @param {object} vault — vault row from Supabase
 * @param {string} vault.app_id
 * @param {string} vault.vault_type
 * @param {number} vault.amount
 * @param {string} [vault.asa_id]
 * @param {string} [vault.network]
 * @returns {Promise<{txid: string, network: string, mode: string}>}
 */
export async function releaseVault(vault) {
  const network = vault.network || "testnet"
  const algod = getAlgodClient(network)
  const account = getAgentAccount()
  const appId = Number(vault.app_id)

  const isAgentV2 = vault.vault_type === "agent_v2"
  const isAsa = vault.vault_type === "asa"

  // ASA vaults need opt-in first
  if (isAsa && vault.asa_id) {
    await optInToAsa(algod, account, vault.asa_id)
  }

  const params = await algod.getTransactionParams().do()
  const amountMicro = Math.round(Number(vault.amount || 0) * 1_000_000)

  const txnObj = {
    sender: account.addr,
    suggestedParams: { ...params, fee: isAsa ? 3000 : 2000, flatFee: true },
    appIndex: appId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: isAgentV2
      ? [SEL_RELEASE_V2, algosdk.encodeUint64(amountMicro)]
      : [SEL_RELEASE],
  }

  if (isAgentV2) {
    txnObj.boxes = [{ appIndex: appId, name: new Uint8Array(0) }]
  }
  if (isAsa && vault.asa_id) {
    txnObj.foreignAssets = [Number(vault.asa_id)]
  }

  const txn = algosdk.makeApplicationCallTxnFromObject(txnObj)
  const signed = txn.signTxn(account.sk)
  const sendRes = await algod.sendRawTransaction(signed).do()
  const txid = sendRes.txId ?? sendRes.txid ?? ""

  const confirmed = await algosdk.waitForConfirmation(algod, txid, 4)
  if (confirmed?.["pool-error"]) {
    throw new Error(`pool-error: ${confirmed["pool-error"]}`)
  }
  if (!(confirmed?.["confirmed-round"] || confirmed?.confirmedRound)) {
    throw new Error("Transaction never confirmed")
  }

  return { txid, network, mode: "on-chain" }
}
