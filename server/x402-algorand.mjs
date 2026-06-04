/**
 * Algorand-flavoured x402 server middleware.
 *
 * Implements the x402 HTTP-native payment protocol on Algorand using the
 * GoPlausible Facilitator for verification and settlement.
 *
 * Wire format (request → response):
 *
 *   1. Client GET/POST /paywalled-endpoint            (no X-PAYMENT header)
 *   2. Server replies 402 + JSON body with payment requirements
 *   3. Client builds an Algorand Payment txn, signs it, retries with X-PAYMENT header
 *   4. Server forwards to Facilitator for verification + settlement
 *   5. Facilitator verifies tx on-chain, confirms settlement
 *   6. Server runs the wrapped handler and returns X-PAYMENT-RESPONSE header
 *
 * Supports: ALGO native payments + USDC ASA payments
 * Facilitator: https://x402.goplausible.xyz (Algorand official)
 */

import algosdk from "algosdk"
import { createClient } from "@supabase/supabase-js"

const X402_VERSION = 1
const FACILITATOR_URL = process.env.X402_FACILITATOR_URL || "https://x402.goplausible.xyz"

// USDC ASA IDs
const USDC_TESTNET_ASA = 10458941 // Testnet USDC
const USDC_MAINNET_ASA = 31566704 // Mainnet USDC

// ── Replay-protection store ────────────────────────────────────────────────
// Persists claimed payment txids in Supabase so a single signed payment
// can NEVER be reused — even across server restarts or replicas. Falls
// back to in-memory if DB is unavailable (best-effort, single-instance).
const _memUsedTxids = new Map() // txid -> claimed_at_ms
let _replaySupabase = null
function _getReplayClient() {
  if (_replaySupabase) return _replaySupabase
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null
  _replaySupabase = createClient(url, key, { auth: { persistSession: false } })
  return _replaySupabase
}
async function claimTxidOnce(txid, meta) {
  // Returns true if this is the FIRST claim for this txid; false if replay.
  // Strategy:
  //   - Always check in-memory first (cheap fast-path).
  //   - Then attempt the DB INSERT. If it succeeds = first claim. If 23505 =
  //     replay. If DB is configured but errors otherwise, FAIL CLOSED (treat
  //     as replay) — we'd rather reject a valid payment than accept a replay.
  //   - If DB is not configured at all, we fall back to in-memory only.
  if (_memUsedTxids.has(txid)) return false

  const sb = _getReplayClient()
  if (sb) {
    const { error } = await sb.from("x402_used_txids").insert({
      txid,
      resource: meta.resource?.slice(0, 500) ?? null,
      amount_microalgos: meta.amount ?? null,
      pay_to: meta.payTo ?? null,
    })
    if (!error) {
      _memUsedTxids.set(txid, Date.now()) // mirror to memory for instant rejection on retry
      return true
    }
    if (error.code === "23505") return false // unique violation = replay
    // Unknown DB error with DB configured: fail closed.
    console.error("[x402 replay] DB insert failed, rejecting payment as a precaution:", error.message || error)
    return false
  }

  // No DB configured anywhere — best-effort in-memory only.
  _memUsedTxids.set(txid, Date.now())
  // Periodic GC: drop entries older than 24h to bound memory
  if (_memUsedTxids.size > 10000) {
    const cutoff = Date.now() - 86_400_000
    for (const [k, t] of _memUsedTxids) if (t < cutoff) _memUsedTxids.delete(k)
  }
  return true
}

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
  const isMainnet = opts.network === "algorand-mainnet"
  const usdcAsaId = isMainnet ? USDC_MAINNET_ASA : USDC_TESTNET_ASA

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
        facilitator: FACILITATOR_URL,
      },
      {
        scheme: "exact",
        network: opts.network,
        maxAmountRequired: String(opts.priceUsdc || Math.ceil(opts.priceMicroalgos / 5000)), // ~0.001 USDC per 5000 microALGO
        resource: opts.resource,
        description: opts.description,
        mimeType: "application/json",
        payTo: opts.payTo,
        asset: "USDC",
        assetId: usdcAsaId,
        maxTimeoutSeconds: 60,
        facilitator: FACILITATOR_URL,
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
  // Resolution order: explicit opts → env override → public algonode fallback.
  // This keeps the URL in ONE place (constants on the client; here on the
  // server) so swapping providers is a one-secret change.
  const isMainnet = opts.network === "algorand-mainnet"
  const envOverride = isMainnet
    ? (process.env.ALGOD_MAINNET_URL || process.env.VITE_ALGOD_MAINNET_URL)
    : (process.env.ALGOD_URL || process.env.VITE_ALGOD_TESTNET_URL)
  const algodUrl =
    opts.algodUrl ||
    envOverride ||
    (isMainnet ? "https://mainnet-api.algonode.cloud" : "https://testnet-api.algonode.cloud")
  const algod = new algosdk.Algodv2(opts.algodToken || process.env.ALGOD_TOKEN || "", algodUrl, "")

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
    //
    // SECURITY: only opt-in. Endpoints that don't perform their own JWT
    // verification inside the wrapped handler (e.g. the public x402 demo) MUST
    // set { allowAuthBypass: false } so a forged "Authorization: Bearer xxx"
    // header cannot skip payment. Endpoints that do verify (e.g. AI optimizer
    // calls getAuthedUserAndClient inside) can keep the default bypass.
    if (opts.allowAuthBypass !== false && authHeader?.startsWith("Bearer ") && !xPayment) {
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
    let confirmed
    try {
      // Primary: Use GoPlausible Facilitator for verification + settlement
      // The Facilitator verifies the signed transaction, simulates it on-chain,
      // and settles it — following the official x402 on Algorand flow.
      let facilitatorVerified = false
      try {
        const facilitatorRes = await fetch(`${FACILITATOR_URL}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signedTxn: signedBytes.toString("base64"),
            network: opts.network,
            payTo: opts.payTo,
            amount: opts.priceMicroalgos,
            resource,
          }),
          signal: AbortSignal.timeout(15000),
        })
        if (facilitatorRes.ok) {
          const result = await facilitatorRes.json()
          if (result.verified && result.txid) {
            txid = result.txid
            confirmed = { "confirmed-round": result.round || 1 }
            facilitatorVerified = true
            console.log(`[x402] Facilitator verified: txid=${txid}`)
          }
        }
      } catch (facErr) {
        console.warn(`[x402] Facilitator unavailable (${facErr.message}), falling back to direct verification`)
      }

      // Fallback: direct on-chain submission if Facilitator is unavailable
      if (!facilitatorVerified) {
        const sendRes = await algod.sendRawTransaction(signedBytes).do()
        txid = sendRes.txId ?? sendRes.txid
        confirmed = await algosdk.waitForConfirmation(algod, txid, 4)
        if (confirmed?.["pool-error"]) {
          throw new Error(`pool-error: ${confirmed["pool-error"]}`)
        }
      }
    } catch (err) {
      return send402(res, {
        network: opts.network, priceMicroalgos: opts.priceMicroalgos,
        payTo: opts.payTo, resource, description: opts.description,
        error: `Payment txn rejected: ${err.message}`,
      })
    }

    // Replay protection: claim the txid atomically. If anyone else (or this
    // same caller in a retry) already claimed it, reject.
    const isFirstClaim = await claimTxidOnce(txid, {
      resource, amount: opts.priceMicroalgos, payTo: opts.payTo,
    })
    if (!isFirstClaim) {
      return send402(res, {
        network: opts.network, priceMicroalgos: opts.priceMicroalgos,
        payTo: opts.payTo, resource, description: opts.description,
        error: "Payment replay detected — this txid was already used. Submit a fresh payment.",
      })
    }

    // Verify the confirmed txn matched the requirements.
    // Strategy: query algod for the confirmed transaction details (most reliable),
    // then fall back to decoding the raw signed bytes if algod response is unusual.
    try {
      let receiver = null
      let amount = 0

      // Primary: use the Algorand indexer-style lookup on the confirmed txn
      try {
        const txInfo = await algod.pendingTransactionInformation(txid).do()
        // Handle both algosdk v2 and v3 response shapes
        if (txInfo?.transaction?.["payment-transaction"]) {
          // REST API v2 shape
          const pt = txInfo.transaction["payment-transaction"]
          receiver = pt.receiver
          amount = Number(pt.amount || 0)
        } else {
          // algosdk internal shape
          const inner = txInfo?.txn?.txn ?? txInfo?.txn ?? {}
          const rcv = inner.rcv ?? inner.receiver ?? null
          if (rcv) {
            if (typeof rcv === "string") receiver = rcv
            else if (rcv instanceof Uint8Array) receiver = algosdk.encodeAddress(new Uint8Array(rcv))
            else if (rcv?.publicKey) receiver = algosdk.encodeAddress(rcv.publicKey)
          }
          const amt = inner.amt ?? inner.amount ?? 0
          amount = typeof amt === "bigint" ? Number(amt) : Number(amt || 0)
        }
      } catch (e) {
        console.warn(`[x402] pendingTransactionInformation failed: ${e.message}`)
      }

      // Fallback: decode the raw signed bytes
      if (!receiver || amount === 0) {
        try {
          const decoded = algosdk.decodeSignedTransaction(signedBytes)
          const txnObj = decoded.txn
          if (!receiver) {
            const rb = txnObj.receiver ?? txnObj.to ?? null
            if (rb) {
              if (typeof rb === "string") receiver = rb
              else if (rb?.publicKey) receiver = algosdk.encodeAddress(rb.publicKey)
              else if (rb instanceof Uint8Array) receiver = algosdk.encodeAddress(new Uint8Array(rb))
            }
            if (!receiver && typeof txnObj.toEncodingData === "function") {
              try {
                const enc = txnObj.toEncodingData()
                const r = enc.get?.("rcv") ?? enc["rcv"]
                if (r instanceof Uint8Array) receiver = algosdk.encodeAddress(new Uint8Array(r))
              } catch {}
            }
          }
          if (amount === 0) {
            const a = txnObj.amount ?? txnObj.amt
            if (a !== undefined && a !== null) amount = typeof a === "bigint" ? Number(a) : Number(a)
            if (amount === 0 && typeof txnObj.toEncodingData === "function") {
              try {
                const enc = txnObj.toEncodingData()
                const v = enc.get?.("amt") ?? enc["amt"] ?? 0
                amount = typeof v === "bigint" ? Number(v) : Number(v)
              } catch {}
            }
          }
        } catch {}
      }

      // Last resort: raw msgpack
      if (!receiver || amount === 0) {
        try {
          const raw = algosdk.msgpackRawDecode ? algosdk.msgpackRawDecode(signedBytes) : null
          if (raw) {
            const t = raw.txn ?? raw
            if (!receiver && t.rcv instanceof Uint8Array) receiver = algosdk.encodeAddress(new Uint8Array(t.rcv))
            if (amount === 0) { const a = t.amt ?? 0; amount = typeof a === "bigint" ? Number(a) : Number(a) }
          }
        } catch {}
      }

      console.log(`[x402] Verified: receiver=${receiver}, amount=${amount}, required=${opts.priceMicroalgos}`)
      if (!receiver) throw new Error("Could not extract receiver from confirmed transaction")
      if (receiver === "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ") {
        throw new Error("X402_PAY_TO_ADDRESS not configured — set it in Vercel env vars")
      }
      if (receiver !== opts.payTo) throw new Error(`receiver mismatch: got ${receiver}, expected ${opts.payTo}`)
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
      txid, pay_to: opts.payTo,
      amount_microalgos: String(opts.priceMicroalgos),
      facilitator: FACILITATOR_URL,
      settlement: "algorand",
    }))
    return handler(req, res)
  }
}
