/**
 * Algorand-flavoured x402 server middleware.
 *
 * The official x402 spec (https://x402.org) currently ships EVM-only
 * facilitators. This implementation keeps the EXACT same wire format —
 * HTTP 402 + paymentRequirements + X-PAYMENT header — but uses an Algorand
 * scheme so the payment is settled directly on Algorand, no facilitator
 * required.
 *
 * Wire format (request → response):
 *
 *   1. Client GET/POST /paywalled-endpoint            (no X-PAYMENT header)
 *   2. Server replies 402 + JSON body:
 *        {
 *          "x402Version": 1,
 *          "error": "Payment required",
 *          "accepts": [{
 *            "scheme":         "exact",
 *            "network":        "algorand-testnet" | "algorand-mainnet",
 *            "maxAmountRequired": "<microalgos as string>",
 *            "resource":       "<the endpoint url>",
 *            "description":    "AI optimizer single call",
 *            "mimeType":       "application/json",
 *            "payTo":          "<algorand address>",
 *            "asset":          "ALGO",
 *            "maxTimeoutSeconds": 60
 *          }]
 *        }
 *   3. Client builds an Algorand Payment txn for `maxAmountRequired`
 *      microalgos to `payTo`, signs it with their wallet, base64 encodes
 *      the SIGNED bytes, and retries the request with header:
 *        X-PAYMENT: base64url(<json {scheme, network, payload: {signedTxn}}>)
 *      OR (simpler) just:
 *        X-PAYMENT: <base64 of signed txn bytes>
 *      We accept both shapes for compatibility with x402-fetch.
 *   4. Server submits the txn, waits for confirmation, verifies:
 *        - sender = anyone
 *        - receiver = payTo
 *        - amount  >= maxAmountRequired
 *      Then runs the wrapped handler and adds X-PAYMENT-RESPONSE header
 *      containing the txid (so the client has a permanent receipt).
 *   5. If verification fails: 402 again with error detail.
 */

import algosdk from "algosdk"

const X402_VERSION = 1

function tryDecodeXPayment(headerValue) {
  // Accept either `<base64 signed txn>` or `<base64url JSON>`
  try {
    // Try JSON envelope first (x402-fetch style)
    const padded = headerValue.replace(/-/g, "+").replace(/_/g, "/")
    const json = JSON.parse(Buffer.from(padded, "base64").toString("utf-8"))
    if (json?.payload?.signedTxn) {
      return Buffer.from(json.payload.signedTxn, "base64")
    }
    if (json?.signedTxn) {
      return Buffer.from(json.signedTxn, "base64")
    }
  } catch { /* fall through */ }
  // Fallback: raw signed-txn base64
  try {
    return Buffer.from(headerValue, "base64")
  } catch {
    return null
  }
}

function send402(res, opts) {
  const body = {
    x402Version: X402_VERSION,
    error: opts.error || "Payment required",
    accepts: [
      {
        scheme: "exact",
        network: opts.network,
        maxAmountRequired: String(opts.priceMicroalgos),
        resource: opts.resource,
        description: opts.description,
        mimeType: "application/json",
        payTo: opts.payTo,
        asset: "ALGO",
        maxTimeoutSeconds: 60,
      },
    ],
  }
  res.statusCode = 402
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify(body))
}

/**
 * Wrap a handler with x402 payment enforcement.
 *
 * @param {object} opts
 * @param {string} opts.payTo            - Algorand address to receive funds
 * @param {number} opts.priceMicroalgos  - Required price in microalgos
 * @param {string} opts.network          - 'algorand-testnet' | 'algorand-mainnet'
 * @param {string} opts.algodUrl         - algod URL (defaults to algonode public)
 * @param {string} opts.description      - Human description shown in 402 body
 * @param {function} handler             - Underlying (req, res) handler
 */
export function withX402(opts, handler) {
  const algodUrl =
    opts.algodUrl ||
    (opts.network === "algorand-mainnet"
      ? "https://mainnet-api.algonode.cloud"
      : "https://testnet-api.algonode.cloud")
  const algod = new algosdk.Algodv2(opts.algodToken || "", algodUrl, "")

  return async function wrapped(req, res) {
    if (!opts.payTo) {
      // Misconfigured server — fail loud rather than silently bypass payment.
      res.statusCode = 500
      res.setHeader("Content-Type", "application/json")
      return res.end(JSON.stringify({ error: "x402 payTo address not configured on server" }))
    }

    const xPayment = req.headers["x-payment"]
    const authHeader = req.headers.authorization
    const resource = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host || ""}${req.url}`

    // ── Bypass paywall for authenticated human users ──────────────────────
    // x402 is for anonymous AI agents. The dashboard owner already authenticates
    // via Supabase JWT — they shouldn't pay to use their own product. Anonymous
    // agents (no Bearer token) still hit 402 and must pay on-chain.
    if (authHeader?.startsWith("Bearer ") && !xPayment) {
      res.setHeader("X-PAYMENT-BYPASS", "authenticated-user")
      return handler(req, res)
    }

    if (!xPayment) {
      return send402(res, {
        network: opts.network,
        priceMicroalgos: opts.priceMicroalgos,
        payTo: opts.payTo,
        resource,
        description: opts.description || "Paid endpoint",
      })
    }

    const signedBytes = tryDecodeXPayment(String(xPayment))
    if (!signedBytes) {
      return send402(res, {
        network: opts.network, priceMicroalgos: opts.priceMicroalgos,
        payTo: opts.payTo, resource,
        description: opts.description, error: "Malformed X-PAYMENT header",
      })
    }

    let txid
    try {
      const sendRes = await algod.sendRawTransaction(signedBytes).do()
      txid = sendRes.txId ?? sendRes.txid
      await algosdk.waitForConfirmation(algod, txid, 4)
    } catch (err) {
      return send402(res, {
        network: opts.network, priceMicroalgos: opts.priceMicroalgos,
        payTo: opts.payTo, resource, description: opts.description,
        error: `Payment txn rejected: ${err.message}`,
      })
    }

    // Verify the txn matched the requirements.
    try {
      const ptx = await algod.pendingTransactionInformation(txid).do()
      const txn = ptx?.txn?.txn ?? ptx?.txn
      const amount = Number(txn?.amt ?? txn?.amount ?? 0)
      const receiver = algosdk.encodeAddress(
        typeof txn?.rcv === "string"
          ? algosdk.decodeAddress(txn.rcv).publicKey
          : (txn?.rcv instanceof Uint8Array ? txn.rcv : new Uint8Array(32))
      )
      if (receiver !== opts.payTo) throw new Error(`receiver mismatch: ${receiver}`)
      if (amount < opts.priceMicroalgos) throw new Error(`amount ${amount} < required ${opts.priceMicroalgos}`)
    } catch (err) {
      return send402(res, {
        network: opts.network, priceMicroalgos: opts.priceMicroalgos,
        payTo: opts.payTo, resource, description: opts.description,
        error: `Payment verification failed: ${err.message}`,
      })
    }

    // Success — set receipt header and run the wrapped handler.
    res.setHeader("X-PAYMENT-RESPONSE", JSON.stringify({
      x402Version: X402_VERSION, network: opts.network,
      txid, payer_to: opts.payTo,
      amount_microalgos: String(opts.priceMicroalgos),
    }))
    return handler(req, res)
  }
}
