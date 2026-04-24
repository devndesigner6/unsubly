/**
 * Skill: x402-pay
 * Algorand-native HTTP 402 payment handler.
 * When a server returns 402, this skill:
 *   1. Parses the payment requirements
 *   2. Builds an Algorand Payment transaction
 *   3. Signs it with the agent wallet
 *   4. Retries the request with X-PAYMENT header
 *   5. Returns the response and payment receipt
 */

import algosdk from "algosdk"

const NETWORK   = (process.env.ALGO_NETWORK || "testnet").toLowerCase()
const ALGOD_URL = NETWORK === "mainnet"
  ? (process.env.ALGOD_MAINNET_URL || "https://mainnet-api.algonode.cloud")
  : (process.env.ALGOD_TESTNET_URL || "https://testnet-api.algonode.cloud")

function getAgentAccount() {
  const mnemonic = process.env.AGENT_WALLET_MNEMONIC
  if (!mnemonic) throw new Error("AGENT_WALLET_MNEMONIC is not set")
  return algosdk.mnemonicToSecretKey(mnemonic.trim())
}

/**
 * Fetch a URL, automatically handling HTTP 402 by paying on Algorand.
 * Returns { data, paymentReceipt } where paymentReceipt is the txid or null.
 */
export async function fetchWithX402(url, init = {}) {
  // First attempt — no payment
  let res = await fetch(url, init)

  if (res.status !== 402) {
    if (!res.ok) throw new Error(`Request failed (${res.status}): ${await res.text()}`)
    const data = await res.json()
    return { data, paymentReceipt: null }
  }

  // Parse 402 challenge
  const challenge = await res.json()
  const requirement = challenge?.accepts?.[0]

  if (!requirement) {
    throw new Error("402 response has no payment requirements")
  }

  const payTo  = requirement.payTo
  const amount = Number(requirement.maxAmountRequired)
  const network = requirement.network || "algorand-testnet"

  if (!payTo || !amount) {
    throw new Error(`Invalid 402 requirements: payTo=${payTo} amount=${amount}`)
  }

  console.log(`[x402-pay] Paying ${amount} microALGO to ${payTo} on ${network}`)

  // Build and sign Algorand payment transaction
  const agentAccount = getAgentAccount()
  const algod = new algosdk.Algodv2(process.env.ALGOD_TOKEN || "", ALGOD_URL, "")

  const params = await algod.getTransactionParams().do()
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: agentAccount.addr,
    receiver: payTo,
    amount: amount,
    suggestedParams: params,
  })

  const signedBytes = txn.signTxn(agentAccount.sk)
  const b64 = Buffer.from(signedBytes).toString("base64")

  // Retry with payment proof
  res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      "X-PAYMENT": b64,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`x402 payment rejected (${res.status}): ${body}`)
  }

  const data = await res.json()
  const paymentReceipt = res.headers.get("X-PAYMENT-RESPONSE")

  console.log(`[x402-pay] Payment accepted. Receipt: ${paymentReceipt}`)

  return { data, paymentReceipt }
}
