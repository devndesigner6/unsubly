/**
 * Skill: buy-from-agent
 * Feature 8 — A2A Commerce Demo
 *
 * OpenClaw (buyer agent) discovers the seller agent via ServiceRegistry,
 * calls its x402-protected endpoint, pays microALGO autonomously, and
 * receives the premium data. No human involved at any step.
 *
 * This is the "negotiate + transact + verify" loop from the Agentic Commerce spec.
 */

import algosdk from "algosdk"

const NETWORK   = (process.env.ALGO_NETWORK || "testnet").toLowerCase()
const ALGOD_URL = NETWORK === "mainnet"
  ? (process.env.ALGOD_MAINNET_URL || "https://mainnet-api.algonode.cloud")
  : (process.env.ALGOD_TESTNET_URL || "https://testnet-api.algonode.cloud")

// Seller agent URL — must be configured in production
const SELLER_URL = process.env.SELLER_AGENT_URL
if (!SELLER_URL) console.warn("[buy-from-agent] SELLER_AGENT_URL not set — buy operations will fail")

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

/**
 * Buy market data from the seller agent using x402.
 *
 * Flow:
 *   1. Call seller endpoint (no payment) → get 402 challenge
 *   2. Build Algorand payment txn to seller's address
 *   3. Sign with agent wallet
 *   4. Retry with X-PAYMENT header
 *   5. Return the purchased data + txid receipt
 */
export async function buyFromAgent() {
  const { agentAccount, algodClient } = getAgent()

  console.log(`[buy-from-agent] Calling seller at ${SELLER_URL}/api/market-data`)

  // Step 1: Initial request — expect 402
  const firstRes = await fetch(`${SELLER_URL}/api/market-data`)

  if (firstRes.status !== 402) {
    if (firstRes.ok) {
      const data = await firstRes.json()
      console.log(`[buy-from-agent] Got data without payment (seller not protected):`, data)
      return { data, txid: null, paid: false }
    }
    throw new Error(`Unexpected status ${firstRes.status} from seller`)
  }

  // Step 2: Parse 402 challenge
  const challenge = await firstRes.json()
  const requirement = challenge?.accepts?.[0]
  if (!requirement?.payTo || !requirement?.maxAmountRequired) {
    throw new Error("Invalid 402 response from seller agent")
  }

  const payTo  = requirement.payTo
  const amount = Number(requirement.maxAmountRequired)

  console.log(`[buy-from-agent] 402 received — paying ${amount} µALGO to ${payTo.slice(0, 8)}…`)

  if (!algosdk.isValidAddress(payTo)) {
    throw new Error(`Invalid payTo address: ${payTo}`)
  }

  // Step 3: Build payment transaction
  const params = await algodClient.getTransactionParams().do()
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: agentAccount.addr,
    receiver: payTo,
    amount,
    suggestedParams: { ...params, fee: 1000, flatFee: true },
  })

  // Step 4: Sign with agent wallet (no human needed)
  const signedBytes = txn.signTxn(agentAccount.sk)
  const b64 = Buffer.from(signedBytes).toString("base64")

  console.log(`[buy-from-agent] Payment signed — retrying with X-PAYMENT header`)

  // Step 5: Retry with payment
  const paidRes = await fetch(`${SELLER_URL}/api/market-data`, {
    headers: { "X-PAYMENT": b64 },
  })

  if (!paidRes.ok) {
    const err = await paidRes.text()
    throw new Error(`Payment rejected by seller: ${err}`)
  }

  const data = await paidRes.json()
  const receipt = paidRes.headers.get("X-PAYMENT-RESPONSE")
  const txid = receipt ? JSON.parse(receipt).txid : data.payment_txid

  console.log(`[buy-from-agent] ✅ Data purchased! txid: ${txid}`)
  console.log(`[buy-from-agent] Market data:`, JSON.stringify(data.market_data, null, 2))

  return { data, txid, paid: true, amount }
}
