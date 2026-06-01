/**
 * x402-cancel-agent.mjs
 *
 * Agent-to-Agent Cancellation Service via x402 Protocol.
 *
 * This skill exposes the browser-cancel capability as an x402-gated endpoint.
 * When the main OpenClaw agent wants to cancel a subscription, it pays this
 * cancellation-specialist agent via x402 micropayment (0.001 ALGO) to execute
 * the browser automation.
 *
 * Flow:
 *   1. Main agent hits POST /api/x402-cancel with subscription_id + chat_id
 *   2. x402 middleware requires payment (1000 microALGO = 0.001 ALGO)
 *   3. After payment verified on-chain, browser-cancel executes
 *   4. Result returned + proof written on-chain
 *
 * This demonstrates real agentic commerce: agents paying agents for services.
 */

import { browserCancel } from "./browser-cancel.mjs"
import { writeCancellationProof } from "./cancellation-proof.mjs"
import { logAction } from "./log-action.mjs"
import { notifyUser } from "./notify-user.mjs"

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function sbFetch(path, opts = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  })
}

/**
 * Execute a paid cancellation via x402.
 * Called after x402 payment is verified.
 *
 * @param {string} subscriptionId - UUID of the subscription to cancel
 * @param {string} chatId - Telegram chat ID for notifications
 * @param {string} paymentTxid - The x402 payment transaction ID (proof of payment)
 * @returns {object} { success, message, proofTxid, paymentTxid }
 */
export async function executeX402Cancel(subscriptionId, chatId, paymentTxid) {
  console.log(`[x402-cancel] Executing paid cancellation: sub=${subscriptionId}, payment=${paymentTxid}`)

  // Log the x402 payment as an agent action
  await logAction({
    vaultId: null,
    subscriptionId,
    userId: null,
    status: "info",
    mode: "x402-cancel",
    txid: paymentTxid,
    payload: {
      action: "agent_paid_for_cancellation",
      payment_txid: paymentTxid,
      amount_microalgos: 1000,
      runtime: "openclaw",
      description: "Agent-to-agent x402 payment for browser cancellation service",
    },
  })

  // Notify user that agent is paying for cancellation
  await notifyUser(
    `🤖 Agent paying 0.001 ALGO via x402 to cancellation service...\nPayment tx: ${paymentTxid}`,
    paymentTxid,
    null,
    false
  )

  // Execute browser cancellation
  const result = await browserCancel(subscriptionId, chatId)

  if (result.success) {
    // Write on-chain cancellation proof
    let proofTxid = null
    try {
      const subRes = await sbFetch(`/subscriptions?id=eq.${subscriptionId}&select=name&limit=1`)
      const subs = subRes.ok ? await subRes.json() : []
      const subName = subs?.[0]?.name || "Unknown"

      const proofResult = await writeCancellationProof({
        subscriptionName: subName,
        subscriptionId,
        method: "x402-agent",
        userId: null,
      })
      proofTxid = proofResult?.txid || null
      console.log(`[x402-cancel] Proof written: ${proofTxid}`)
    } catch (err) {
      console.warn(`[x402-cancel] Proof write failed: ${err.message}`)
    }

    await logAction({
      vaultId: null,
      subscriptionId,
      userId: null,
      status: "success",
      mode: "x402-cancel",
      txid: proofTxid,
      payload: {
        action: "cancellation_completed",
        method: "browser_automation",
        payment_txid: paymentTxid,
        proof_txid: proofTxid,
        runtime: "openclaw",
      },
    })

    return {
      success: true,
      message: "Subscription cancelled via x402 agent-to-agent service",
      proofTxid,
      paymentTxid,
    }
  }

  // Failed
  await logAction({
    vaultId: null,
    subscriptionId,
    userId: null,
    status: "error",
    mode: "x402-cancel",
    payload: {
      action: "cancellation_failed",
      reason: result.message,
      payment_txid: paymentTxid,
      runtime: "openclaw",
    },
  })

  return {
    success: false,
    message: result.message || "Browser cancellation failed",
    paymentTxid,
  }
}

/**
 * HTTP handler for the x402-gated cancel endpoint.
 * This is mounted at /api/x402-cancel on the Railway agent.
 *
 * The x402 middleware wraps this — by the time this runs,
 * payment has already been verified on-chain.
 */
export async function x402CancelHandler(req, res, paymentInfo) {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Method not allowed" }))
    return
  }

  try {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString())

    const { subscription_id, chat_id } = body
    if (!subscription_id) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "subscription_id required" }))
      return
    }

    const paymentTxid = paymentInfo?.txid || "unknown"
    const result = await executeX402Cancel(subscription_id, chat_id || null, paymentTxid)

    res.writeHead(result.success ? 200 : 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify(result))
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: err.message }))
  }
}
