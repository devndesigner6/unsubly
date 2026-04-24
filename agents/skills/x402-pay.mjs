/**
 * Skill: x402-pay
 *
 * Algorand-native HTTP 402 payment handler. When an HTTP response returns
 * status 402, this skill:
 *
 *   1. Parses the paymentRequirements from the 402 body.
 *   2. Builds an Algorand Payment txn for `maxAmountRequired` microALGO.
 *   3. Signs with the agent wallet.
 *   4. Submits the txn on-chain.
 *   5. Retries the original request with X-PAYMENT header.
 *   6. Returns the response + payment receipt from X-PAYMENT-RESPONSE.
 *
 * This replaces the EVM-only x402-fetch library with native Algorand support.
 */

import algosdk from "algosdk"

function getAlgodClient(network) {
  const isMainnet = network?.includes("mainnet")
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

/**
 * Parse a 402 response body into payment requirements.
 * Supports the x402 wire format: { accepts: [{ payTo, maxAmountRequired, network, ... }] }
 */
function parsePaymentRequirements(body) {
  if (!body?.accepts?.length) {
    throw new Error("402 response missing accepts array")
  }
  const req = body.accepts[0]
  if (!req.payTo || !req.maxAmountRequired) {
    throw new Error("402 requirement missing payTo or maxAmountRequired")
  }
  return {
    payTo: req.payTo,
    amount: Number(req.maxAmountRequired),
    network: req.network || "algorand-testnet",
    resource: req.resource || "",
    description: req.description || "",
  }
}

/**
 * Build, sign, and submit an Algorand Payment txn for the 402 challenge.
 * @returns {{ txid: string, signedTxnB64: string }}
 */
async function payOnChain(payTo, amountMicroAlgos, network) {
  const algod = getAlgodClient(network)
  const account = getAgentAccount()

  const params = await algod.getTransactionParams().do()
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: account.addr,
    receiver: payTo,
    amount: amountMicroAlgos,
    suggestedParams: { ...params, fee: 1000, flatFee: true },
  })

  const signed = txn.signTxn(account.sk)
  const { txId } = await algod.sendRawTransaction(signed).do()
  await algosdk.waitForConfirmation(algod, txId, 4)

  // Base64-encode the signed txn for the X-PAYMENT header
  const signedTxnB64 = Buffer.from(signed).toString("base64")

  return { txid: txId, signedTxnB64 }
}

/**
 * Wraps a fetch call with x402 payment handling.
 *
 * @param {string} url — the endpoint to call
 * @param {RequestInit} init — fetch options
 * @returns {Promise<{ response: Response, paymentTxid: string | null, paymentReceipt: string | null }>}
 */
export async function fetchWithX402Pay(url, init = {}) {
  // First attempt — may return 402
  const firstRes = await fetch(url, init)

  if (firstRes.status !== 402) {
    return { response: firstRes, paymentTxid: null, paymentReceipt: null }
  }

  // Parse 402 payment requirements
  const body = await firstRes.json()
  const reqs = parsePaymentRequirements(body)

  console.log(`[x402-pay] 402 received: ${reqs.amount} microALGO to ${reqs.payTo} on ${reqs.network}`)

  // Pay on-chain
  const { txid, signedTxnB64 } = await payOnChain(reqs.payTo, reqs.amount, reqs.network)
  console.log(`[x402-pay] Payment submitted: ${txid}`)

  // Retry with X-PAYMENT header
  const retryInit = { ...init, headers: { ...init.headers, "X-PAYMENT": signedTxnB64 } }
  const retryRes = await fetch(url, retryInit)
  const paymentReceipt = retryRes.headers.get("X-PAYMENT-RESPONSE")

  return {
    response: retryRes,
    paymentTxid: txid,
    paymentReceipt,
  }
}
