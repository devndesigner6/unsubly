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
const ALGOD_URLS = NETWORK === "mainnet"
  ? [process.env.ALGOD_MAINNET_URL || "https://mainnet-api.algonode.cloud", "https://mainnet-api.4160.nodely.dev"]
  : [process.env.ALGOD_TESTNET_URL || "https://testnet-api.algonode.cloud", "https://testnet-api.4160.nodely.dev", "https://testnet-api.algonode.cloud"]
const ALGOD_URL = ALGOD_URLS[0]

let _agentAccount = null
let _algodClient  = null
let _algodClientFallback = null

function getAgent() {
  if (_agentAccount) return { agentAccount: _agentAccount, algodClient: _algodClient }
  const mnemonic = process.env.AGENT_WALLET_MNEMONIC
  if (!mnemonic) throw new Error("AGENT_WALLET_MNEMONIC is not set")
  _agentAccount = algosdk.mnemonicToSecretKey(mnemonic.trim())
  _algodClient  = new algosdk.Algodv2(process.env.ALGOD_TOKEN || "", ALGOD_URLS[0], "")
  if (ALGOD_URLS.length > 1) {
    _algodClientFallback = new algosdk.Algodv2(process.env.ALGOD_TOKEN || "", ALGOD_URLS[1], "")
  }
  return { agentAccount: _agentAccount, algodClient: _algodClient }
}

// Retry wrapper: tries primary algod, falls back to secondary on 403/network error
async function withRetry(fn) {
  try {
    return await fn(_algodClient || new algosdk.Algodv2("", ALGOD_URLS[0], ""))
  } catch (err) {
    const is403 = err.message?.includes("403") || err.message?.includes("Forbidden")
    const isNetwork = err.message?.includes("network") || err.message?.includes("ECONNREFUSED") || err.message?.includes("timeout")
    if ((is403 || isNetwork) && ALGOD_URLS.length > 1) {
      console.warn(`[release-vault] Primary algod failed (${err.message}), trying fallback...`)
      const fallback = _algodClientFallback || new algosdk.Algodv2("", ALGOD_URLS[1], "")
      return await fn(fallback)
    }
    throw err
  }
}

export async function checkAgentBalance() {
  const { agentAccount } = getAgent()
  const info = await withRetry(async (client) => client.accountInformation(agentAccount.addr).do())
  const balance = Number(info.amount) / 1_000_000
  return { address: agentAccount.addr, balance }
}

export async function releaseVault(vault) {
  const { agentAccount, algodClient } = getAgent()
  const appId      = Number(vault.app_id)
  const amountMicro = Math.round(Number(vault.amount || 0) * 1_000_000)

  // Detect actual contract version from on-chain global state.
  // agent_v2 has "cycle_index" key; v1 does not.
  // DB vault_type may be stale — always verify on-chain.
  let isAgentV2 = vault.vault_type === "agent_v2"
  try {
    const appInfo = await algodClient.getApplicationByID(appId).do()
    const gs = appInfo?.params?.["global-state"] ?? appInfo?.params?.globalState ?? []
    const hasCycleIndex = gs.some(e => {
      try { return Buffer.from(e.key, "base64").toString("utf-8") === "cycle_index" } catch { return false }
    })
    // Override DB type with on-chain truth
    isAgentV2 = hasCycleIndex
    console.log(`[release-vault] App ${appId} on-chain version: ${isAgentV2 ? "v2 (cycle_index found)" : "v1"}`)
  } catch (err) {
    console.warn(`[release-vault] Could not read global state for app ${appId}: ${err.message}`)
  }

  const params = await algodClient.getTransactionParams().do()
  const minFee = Number(params.minFee ?? params.fee ?? 1000) || 1000

  if (isAgentV2) {
    // Read current cycle_index to compute correct box name
    let nextCycleIndex = 1
    try {
      const appInfo = await algodClient.getApplicationByID(appId).do()
      const gs = appInfo?.params?.["global-state"] ?? appInfo?.params?.globalState ?? []
      const entry = gs.find(e => {
        try { return Buffer.from(e.key, "base64").toString("utf-8") === "cycle_index" } catch { return false }
      })
      if (entry) nextCycleIndex = (entry.value?.uint ?? 0) + 1
    } catch { /* default to 1 */ }

    // Box name = "h:" + uint64(next_cycle_index)
    const boxPrefix = Buffer.from("h:")
    const boxIndex  = algosdk.encodeUint64(nextCycleIndex)
    const boxName   = new Uint8Array(boxPrefix.length + boxIndex.length)
    boxName.set(boxPrefix, 0)
    boxName.set(boxIndex, boxPrefix.length)

    // Box MBR: 2500 + 400 * (key_len + value_len) = 2500 + 400*(10+24) = 16100 µALGO
    const BOX_MBR   = 16100
    const appAddress = algosdk.getApplicationAddress(appId)

    // Atomic group: [MBR payment] + [release() call]
    const mbrTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: agentAccount.addr,
      receiver: appAddress,
      amount: BOX_MBR,
      suggestedParams: { ...params, fee: minFee, flatFee: true },
    })
    const releaseTxn = algosdk.makeApplicationCallTxnFromObject({
      sender: agentAccount.addr,
      suggestedParams: { ...params, fee: minFee * 2, flatFee: true },
      appIndex: appId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      appArgs: [SEL_RELEASE_V2, algosdk.encodeUint64(amountMicro)],
      boxes: [{ appIndex: appId, name: boxName }],
      // Recipient must be in foreign accounts so the AVM inner txn can access it
      accounts: vault.escrow_address ? [vault.escrow_address] : undefined,
    })

    algosdk.assignGroupID([mbrTxn, releaseTxn])

    const signedMbr     = mbrTxn.signTxn(agentAccount.sk)
    const signedRelease = releaseTxn.signTxn(agentAccount.sk)

    const sendRes   = await algodClient.sendRawTransaction([signedMbr, signedRelease]).do()
    const txid      = sendRes.txId ?? sendRes.txid ?? ""
    const confirmed = await algosdk.waitForConfirmation(algodClient, txid, 4)

    if (confirmed?.["pool-error"]) throw new Error(`pool-error: ${confirmed["pool-error"]}`)
    if (!(confirmed?.["confirmed-round"] || confirmed?.confirmedRound)) throw new Error("Transaction never confirmed in a round")

    return txid
  } else {
    // Standard agent vault: single release() call
    const txn = algosdk.makeApplicationCallTxnFromObject({
      sender: agentAccount.addr,
      suggestedParams: { ...params, fee: minFee * 2, flatFee: true },
      appIndex: appId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      appArgs: [SEL_RELEASE],
    })

    const signed    = txn.signTxn(agentAccount.sk)
    const sendRes   = await algodClient.sendRawTransaction(signed).do()
    const txid      = sendRes.txId ?? sendRes.txid ?? ""
    const confirmed = await algosdk.waitForConfirmation(algodClient, txid, 4)

    if (confirmed?.["pool-error"]) throw new Error(`pool-error: ${confirmed["pool-error"]}`)
    if (!(confirmed?.["confirmed-round"] || confirmed?.confirmedRound)) throw new Error("Transaction never confirmed in a round")

    return txid
  }
}


/**
 * Kill a vault on-chain — calls the kill() ABI method which returns ALGO to the creator.
 * 
 * NOTE: The kill() method requires sender == creator. The agent can only call this
 * if the vault type allows agent-initiated kills. For standard vaults, the user
 * must kill from the UI (which signs with their wallet). This function attempts
 * the kill and falls back gracefully if unauthorized.
 * 
 * @param {object} vault - { id, app_id, user_id, amount, vault_type }
 * @returns {string} txid of the kill transaction
 */
export async function killVaultOnChain(vault) {
  const { agentAccount, algodClient } = getAgent()
  const appId = Number(vault.app_id)

  if (!appId || appId <= 0) {
    throw new Error(`Invalid app_id: ${appId}`)
  }

  const params = await algodClient.getTransactionParams().do()
  const minFee = Number(params.minFee ?? params.fee ?? 1000) || 1000

  // Use kill() ABI method selector (0xb9c21155) — this sends ALGO back to creator
  const SEL_KILL = new Uint8Array([0xb9, 0xc2, 0x11, 0x55])

  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender: agentAccount.addr,
    suggestedParams: { ...params, fee: minFee * 2, flatFee: true },
    appIndex: appId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [SEL_KILL],
  })

  const signed = txn.signTxn(agentAccount.sk)
  const sendRes = await algodClient.sendRawTransaction(signed).do()
  const txid = sendRes.txId ?? sendRes.txid ?? ""
  const confirmed = await algosdk.waitForConfirmation(algodClient, txid, 4)

  if (confirmed?.["pool-error"]) throw new Error(`pool-error: ${confirmed["pool-error"]}`)
  if (!(confirmed?.["confirmed-round"] || confirmed?.confirmedRound)) throw new Error("Kill transaction never confirmed")

  console.log(`[release-vault] Killed vault app ${appId}, txid: ${txid}`)
  return txid
}
