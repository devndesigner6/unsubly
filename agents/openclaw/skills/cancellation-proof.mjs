/**
 * cancellation-proof.mjs
 *
 * Writes an on-chain cancellation attestation to Algorand.
 * 
 * When a subscription is cancelled, this skill sends a zero-ALGO transaction
 * from the agent wallet to itself with a structured note field containing:
 * - Protocol identifier: "unsub:cancel:v1"
 * - Subscription name hash (SHA-256, first 8 bytes hex)
 * - Timestamp (ISO 8601)
 * - Method: "browser" | "guided" | "manual"
 * - User address (if connected)
 *
 * This creates an immutable, timestamped, verifiable proof on the Algorand
 * blockchain that the cancellation occurred. Can be used in disputes with
 * service providers who claim the user didn't cancel.
 *
 * The proof is queryable via any Algorand indexer by searching for transactions
 * from the agent address with note prefix "unsub:cancel:v1".
 */

import algosdk from "algosdk"
import { createHash } from "node:crypto"

const NETWORK = (process.env.ALGO_NETWORK || "testnet").toLowerCase()
const ALGOD_URL = NETWORK === "mainnet"
  ? (process.env.ALGOD_MAINNET_URL || "https://mainnet-api.algonode.cloud")
  : (process.env.ALGOD_TESTNET_URL || "https://testnet-api.algonode.cloud")

let _agentAccount = null
let _algodClient = null

function getAgent() {
  if (_agentAccount) return { agentAccount: _agentAccount, algodClient: _algodClient }
  const mnemonic = process.env.AGENT_WALLET_MNEMONIC
  if (!mnemonic) throw new Error("AGENT_WALLET_MNEMONIC not set")
  _agentAccount = algosdk.mnemonicToSecretKey(mnemonic.trim())
  _algodClient = new algosdk.Algodv2(process.env.ALGOD_TOKEN || "", ALGOD_URL, "")
  return { agentAccount: _agentAccount, algodClient: _algodClient }
}

/**
 * Hash a subscription name to a short identifier (first 8 bytes of SHA-256).
 * This avoids storing the full name on-chain while still being verifiable.
 */
function hashSubscriptionName(name) {
  const hash = createHash("sha256").update(name.toLowerCase().trim()).digest("hex")
  return hash.slice(0, 16) // 8 bytes = 16 hex chars
}

/**
 * Write a cancellation proof on-chain.
 *
 * @param {object} opts
 * @param {string} opts.subscriptionName - Name of the cancelled subscription
 * @param {string} opts.subscriptionId - Supabase UUID
 * @param {string} opts.method - "browser" | "guided" | "manual"
 * @param {string} [opts.userAddress] - User's Algorand address (optional)
 * @param {string} [opts.userId] - Supabase user ID (optional)
 * @returns {{ txid: string, proof: object }} - Transaction ID and proof data
 */
export async function writeCancellationProof({ subscriptionName, subscriptionId, method, userAddress, userId }) {
  const { agentAccount, algodClient } = getAgent()

  const nameHash = hashSubscriptionName(subscriptionName)
  const timestamp = new Date().toISOString()

  // Structured proof data
  const proof = {
    protocol: "unsub:cancel:v1",
    name_hash: nameHash,
    subscription_id: subscriptionId,
    method: method || "manual",
    timestamp,
    user_address: userAddress || null,
    user_id_hash: userId ? createHash("sha256").update(userId).digest("hex").slice(0, 16) : null,
    network: NETWORK,
    agent: agentAccount.addr,
  }

  // Encode as JSON note (max 1KB for Algorand note field)
  const noteStr = JSON.stringify(proof)
  if (noteStr.length > 1000) {
    // Truncate if too long (shouldn't happen with our data)
    throw new Error("Proof data exceeds note field limit")
  }
  const note = new TextEncoder().encode(noteStr)

  // Build zero-ALGO transaction (agent sends to itself)
  const params = await algodClient.getTransactionParams().do()
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: agentAccount.addr,
    receiver: agentAccount.addr, // self-transfer
    amount: 0,
    suggestedParams: params,
    note,
  })

  // Sign and submit
  const signed = txn.signTxn(agentAccount.sk)
  const sendRes = await algodClient.sendRawTransaction(signed).do()
  const txid = sendRes.txId ?? sendRes.txid ?? ""

  // Wait for confirmation
  const confirmed = await algosdk.waitForConfirmation(algodClient, txid, 4)
  if (confirmed?.["pool-error"]) throw new Error(`pool-error: ${confirmed["pool-error"]}`)

  const confirmedRound = confirmed?.["confirmed-round"] || confirmed?.confirmedRound
  if (!confirmedRound) throw new Error("Proof transaction never confirmed")

  console.log(`[cancellation-proof] ✓ Written on-chain: txid=${txid}, round=${confirmedRound}, name_hash=${nameHash}`)

  return {
    txid,
    round: confirmedRound,
    proof,
  }
}

/**
 * Verify a cancellation proof exists on-chain by txid.
 * Returns the proof data if found, null otherwise.
 */
export async function verifyCancellationProof(txid) {
  const { algodClient } = getAgent()
  try {
    const txInfo = await algodClient.pendingTransactionInformation(txid).do()
    const noteB64 = txInfo?.txn?.txn?.note || txInfo?.transaction?.note
    if (!noteB64) return null
    const noteStr = Buffer.from(noteB64, "base64").toString("utf8")
    const proof = JSON.parse(noteStr)
    if (proof.protocol !== "unsub:cancel:v1") return null
    return proof
  } catch {
    return null
  }
}
