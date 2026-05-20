/**
 * Shared API handlers used by BOTH the Vite dev server (vite.config.ts)
 * AND the production server (server.js). Single source of truth for /api/*.
 *
 * Each export is a plain async function that takes (req, res) — Node http
 * style. They read JSON bodies themselves so there's no Express dependency.
 */

import { createClient } from "@supabase/supabase-js"
import algosdk from "algosdk"
import { withX402 } from "./x402-algorand.mjs"
import { rateLimitAllow } from "./rate-limit.mjs"

// ── Common helpers ──────────────────────────────────────────────────────────

function readBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on("data", (chunk) => {
      // Check BEFORE concatenating so a single huge chunk can't OOM us.
      const chunkLen = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk)
      if (size + chunkLen > maxBytes) {
        const err = new Error("Request body too large")
        err.status = 413
        reject(err)
        req.destroy()
        return
      }
      size += chunkLen
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
    req.on("error", reject)
  })
}

function jsonRes(res, status, data) {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify(data))
}

function getEnv(name) {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not configured on the server`)
  return v
}

// ── Auth helper: verifies a Supabase JWT and returns the user ───────────────

async function getAuthedUserAndClient(req) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) {
    const e = new Error("Unauthorized — missing bearer token")
    e.status = 401
    throw e
  }
  const userJwt = authHeader.replace("Bearer ", "")

  const SUPABASE_URL = getEnv("VITE_SUPABASE_URL")
  const SUPABASE_KEY = getEnv("VITE_SUPABASE_PUBLISHABLE_KEY")

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
    auth: { persistSession: false },
  })

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    const e = new Error("Invalid or expired token")
    e.status = 401
    throw e
  }
  return { supabase, user }
}

// ── /api/ai-optimizer ───────────────────────────────────────────────────────
//
// AUTHED endpoint. Accepts a user's portfolio JSON and returns Groq's
// structured analysis. Bounded body size to keep a malicious caller from
// burning the server's Groq quota.
//
// x402 layer: when X402_PAY_TO_ADDRESS is set, the endpoint additionally
// requires an HTTP 402 → Algorand payment → retry round-trip. This is
// what makes the call agentic-commerce-track compliant. When unset the
// endpoint behaves as a normal authed REST call (dev-friendly).
//
// Lazily-built x402 wrapper for the core handler. Built once on first call.
let _aiOptimizerWrapped = null
function _getAiOptimizerHandler() {
  if (_aiOptimizerWrapped) return _aiOptimizerWrapped
  const payTo = process.env.X402_PAY_TO_ADDRESS
    || process.env.VITE_AGENT_WALLET_ADDRESS
    || null
  if (!payTo) {
    _aiOptimizerWrapped = _aiOptimizerCore
    return _aiOptimizerWrapped
  }
  const price = Number(process.env.X402_PRICE_MICROALGOS || "1000")
  const network = process.env.X402_NETWORK || "algorand-testnet"
  _aiOptimizerWrapped = withX402(
    {
      payTo, priceMicroalgos: price, network,
      description: "Unsubscribely AI optimizer — single analysis call",
    },
    _aiOptimizerCore,
  )
  console.log(`[x402] ai-optimizer protected: ${price} microALGO → ${payTo} on ${network}`)
  return _aiOptimizerWrapped
}

export async function aiOptimizerHandler(req, res) {
  return _getAiOptimizerHandler()(req, res)
}

// ── /api/x402-demo — public x402 walkthrough endpoint ──────────────────────
// A dedicated, *unauthenticated* paywalled endpoint used by the dashboard
// "x402 Demo" page. After the caller pays, it returns a *real* on-chain
// network status snapshot: the live Algorand round at the moment the
// request was served, the live ServiceRegistry box count, the agent
// wallet address, and the txid the caller just paid with. This is the
// real "premium content" being sold and it changes on every block.
let _x402DemoWrapped = null
function _getX402DemoHandler() {
  if (_x402DemoWrapped) return _x402DemoWrapped
  const payTo = process.env.X402_PAY_TO_ADDRESS
    || process.env.VITE_AGENT_WALLET_ADDRESS
    || null
  if (!payTo) {
    _x402DemoWrapped = (_req, res) => jsonRes(res, 503, {
      error: "x402 demo unavailable — set X402_PAY_TO_ADDRESS in Vercel environment variables",
    })
    return _x402DemoWrapped
  }
  const price = Number(process.env.X402_PRICE_MICROALGOS || "1000")
  const network = process.env.X402_NETWORK || "algorand-testnet"
  const isMainnet = network.includes("mainnet")
  const algodUrl = isMainnet
    ? (process.env.ALGOD_MAINNET_URL || "https://mainnet-api.algonode.cloud")
    : (process.env.ALGOD_TESTNET_URL || "https://testnet-api.algonode.cloud")
  _x402DemoWrapped = withX402(
    {
      payTo, priceMicroalgos: price, network,
      description: "Unsubscribely x402 — live Algorand network snapshot",
      // Demo endpoint has no inner JWT check, so we cannot let any caller
      // fake an Authorization header to skip payment.
      allowAuthBypass: false,
    },
    async (_req, res) => {
      const algod = new algosdk.Algodv2(process.env.ALGOD_TOKEN || "", algodUrl, "")
      // Read live network state. These calls are cheap (sub-100ms against algonode)
      // and the values change every block, so each paid request returns fresh data.
      let round = null
      let genesisId = null
      let registryServices = null
      const registryAppId = process.env.SERVICE_REGISTRY_APP_ID
      try {
        const status = await algod.status().do()
        round = Number(status["last-round"] ?? status.lastRound ?? 0) || null
        genesisId = status["genesis-id"] || status.genesisId || null
      } catch (e) { console.warn("[x402-demo] status fetch failed:", e?.message || e) }
      if (registryAppId) {
        try {
          const boxes = await algod.getApplicationBoxes(Number(registryAppId)).do()
          registryServices = (boxes.boxes || []).length
        } catch (e) { console.warn("[x402-demo] registry box list failed:", e?.message || e) }
      }
      jsonRes(res, 200, {
        ok: true,
        served_at: new Date().toISOString(),
        network,
        algorand: {
          round,
          genesis_id: genesisId,
          algod_url: algodUrl,
        },
        agent: {
          pay_to_address: payTo,
          x402_price_microalgos: price,
        },
        service_registry: {
          app_id: registryAppId ? Number(registryAppId) : null,
          registered_services: registryServices,
        },
        note: "Premium content delivered. Payment txid is in the X-PAYMENT-RESPONSE header. All values above are live from the Algorand network at the moment your payment confirmed.",
      })
    },
  )
  return _x402DemoWrapped
}
export async function x402DemoHandler(req, res) {
  return _getX402DemoHandler()(req, res)
}

// The actual handler, wrapped by x402 if configured.
async function _aiOptimizerCore(req, res) {
  if (req.method !== "POST") return jsonRes(res, 405, { error: "Method Not Allowed" })

  try {
    // Persistent per-user rate-limit (10 calls / hour). Survives restarts,
    // shared across instances. Keyed on the auth token so one stolen JWT
    // can't fan-out across IPs to bypass the limit.
    const authHeader = req.headers.authorization || ""
    const tokenForLimit = authHeader.replace(/^Bearer\s+/i, "").slice(0, 80) || (req.socket?.remoteAddress ?? "anon")
    const allowed = await rateLimitAllow("ai_optimizer", tokenForLimit, 10, 3600)
    if (!allowed) return jsonRes(res, 429, { error: "Rate limit: 10 calls/hour. Please wait." })

    // Auth FIRST so anonymous traffic can't burn our LLM quota.
    await getAuthedUserAndClient(req)

    const GROQ_API_KEY = getEnv("GROQ_API_KEY")
    const body = await readBody(req)
    let parsedBody
    try { parsedBody = JSON.parse(body || "{}") } catch {
      return jsonRes(res, 400, { error: "Invalid JSON body" })
    }
    // Lightweight inline schema validation (avoids pulling zod into the server bundle).
    const isObj = (v) => v && typeof v === "object" && !Array.isArray(v)
    if (!isObj(parsedBody)) return jsonRes(res, 400, { error: "Body must be a JSON object" })
    if (parsedBody.subscriptions !== undefined && !Array.isArray(parsedBody.subscriptions)) {
      return jsonRes(res, 400, { error: "subscriptions must be an array" })
    }
    if (parsedBody.vaults !== undefined && !Array.isArray(parsedBody.vaults)) {
      return jsonRes(res, 400, { error: "vaults must be an array" })
    }
    if (parsedBody.userCurrency !== undefined && typeof parsedBody.userCurrency !== "string") {
      return jsonRes(res, 400, { error: "userCurrency must be a string" })
    }
    for (const k of ["totalMonthly", "totalVaultLocked"]) {
      if (parsedBody[k] !== undefined && (typeof parsedBody[k] !== "number" || !Number.isFinite(parsedBody[k]))) {
        return jsonRes(res, 400, { error: `${k} must be a finite number` })
      }
    }
    const {
      subscriptions = [],
      vaults = [],
      userCurrency = "USD",
      totalMonthly = 0,
      totalVaultLocked = 0,
    } = parsedBody
    // Cap arrays so a malicious caller can't blow up the prompt.
    if (subscriptions.length > 500 || vaults.length > 500) {
      return jsonRes(res, 413, { error: "Too many subscriptions/vaults (max 500 each)" })
    }

    const activeSubs = subscriptions.filter((s) => s && s.status === "active")

    const systemPrompt = `You are an AI financial advisor specializing in subscription management and Algorand blockchain escrow vaults.

CRITICAL RULES — violating any of these will cause a hard failure:
1. Respond with ONLY a single valid JSON object. No markdown, no code fences, no prose outside the JSON.
2. All number fields must be plain numeric literals (e.g. 19.99). NEVER use expressions, fractions, or division (e.g. NEVER write 199/75).
3. All string fields must be non-null strings. NEVER use null for any field — use "Unknown" for missing categories, "N/A" for missing values.
4. "riskScore" must be an integer between 0 and 100.
5. "risk" must be exactly one of: "low", "medium", or "high".
6. "priority" must be exactly one of: "high", "medium", or "low".
7. "recommended" must be exactly one of: "standard", "time-locked", "multi-sig", "dispute", "asa".
8. "riskLabel" must be exactly one of: "Low", "Medium", or "High".

Return exactly this structure:
{
  "spending": {
    "summary": "one sentence summary of total spend",
    "topCategory": "highest spend category name or Unknown",
    "monthlyTotal": 0.00,
    "annualTotal": 0.00,
    "breakdown": [
      { "name": "subscription name", "monthly": 0.00, "category": "category or Unknown", "risk": "low" }
    ]
  },
  "savings": [
    { "title": "short title", "description": "specific actionable recommendation", "saving": "$19/mo", "priority": "high" }
  ],
  "vaultStrategy": [
    { "subscription": "name", "recommended": "standard", "reason": "one sentence why" }
  ],
  "riskScore": 50,
  "riskLabel": "Medium",
  "topAction": "single most important thing to do right now"
}`

    const userPrompt = `Portfolio data:
Monthly: ${Number(totalMonthly).toFixed(2)} ${userCurrency}
Annual: ${(Number(totalMonthly) * 12).toFixed(2)} ${userCurrency}
Active subscriptions: ${activeSubs.length}
Locked ALGO: ${Number(totalVaultLocked).toFixed(4)}

Subscriptions: ${JSON.stringify(activeSubs.map((s) => ({ name: s.name, amount: s.amount, currency: s.currency, cycle: s.billing_cycle, category: s.category })))}
Vaults: ${JSON.stringify(vaults.map((v) => ({ type: v.vault_type, amount: v.amount, status: v.status })))}

Respond with ONLY the JSON structure specified.`

    const payload = {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    }

    const callGroq = () => fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    // Exponential backoff: up to 3 retries on 429 with jitter (1s, 3s, 9s ± 30%)
    // Hard cap: total retry time ≤ 30 seconds
    const retryStart = Date.now()
    let aiRes = await callGroq()
    for (let attempt = 0; attempt < 3 && aiRes.status === 429; attempt++) {
      if (Date.now() - retryStart > 28_000) break // hard 28s cap
      const baseMs = 1000 * Math.pow(3, attempt)
      const jitter = baseMs * 0.3 * (Math.random() - 0.5) * 2
      await new Promise((r) => setTimeout(r, Math.max(500, baseMs + jitter)))
      aiRes = await callGroq()
    }
    if (!aiRes.ok) {
      const t = await aiRes.text()
      console.error("[ai-optimizer] Groq error:", aiRes.status, t)
      if (aiRes.status === 401) throw new Error("AI service key is invalid — update GROQ_API_KEY.")
      if (aiRes.status === 429) throw new Error("AI rate limit reached — please wait 30s.")
      throw new Error(`AI service error ${aiRes.status}`)
    }

    const aiData = await aiRes.json()
    const raw = aiData.choices?.[0]?.message?.content || "{}"
    let parsed
    try { parsed = JSON.parse(raw) } catch {
      const m = raw.match(/\{[\s\S]*\}/)
      parsed = m ? JSON.parse(m[0]) : {}
    }
    jsonRes(res, 200, { analysis: parsed })
  } catch (err) {
    console.error("[ai-optimizer] error:", err)
    jsonRes(res, err.status || 500, { error: err.message || "Analysis failed" })
  }
}

// ── /api/agent-run ──────────────────────────────────────────────────────────

const RELEASE_SELECTOR = new Uint8Array([0x07, 0x6b, 0xbd, 0x4d])
// AgentEscrowVaultV2.release(uint64)uint64
const RELEASE_V2_SELECTOR = new Uint8Array([0x61, 0x17, 0xcc, 0xb8])

// Service-role client used ONLY for server-managed tables (locks, replay store).
// Never used to bypass user RLS on user data — that still goes through the
// authed user client.
let _serviceClient = null
function _getServiceClient() {
  if (_serviceClient) return _serviceClient
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null
  _serviceClient = createClient(url, key, { auth: { persistSession: false } })
  return _serviceClient
}

// Acquire an idempotency lock keyed on (vault_id, billing_period). Returns
// true on first acquisition; false ONLY if another caller already holds the
// same lock (Postgres unique-violation 23505). Other DB errors don't block —
// we'd rather risk a rare duplicate release than silently skip every release.
async function _acquireRunLock(vaultId, billingDate) {
  const sb = _getServiceClient()
  if (!sb) return true // No DB configured → best-effort, don't block legit releases.
  const lockKey = `${vaultId}:${billingDate ?? "no-date"}`
  const { error } = await sb.from("agent_run_locks").insert({ lock_key: lockKey, vault_id: vaultId })
  if (!error) return true
  if (error.code === "23505") return false // legitimate duplicate
  // Unknown error (RLS, schema cache, network). Warn loudly and proceed.
  console.warn("[agent-run lock] insert failed but not unique-violation; allowing release:", error.message || error)
  return true
}

export async function agentRunHandler(req, res) {
  if (req.method !== "POST") return jsonRes(res, 405, { error: "Method Not Allowed" })

  try {
    // Two valid auth modes:
    //   (a) Cron / admin: shared secret in X-Agent-Secret header
    //   (b) Authenticated user, restricted to their OWN vaults only
    const adminSecret = process.env.AGENT_RUN_SECRET
    const presentedSecret = req.headers["x-agent-secret"]
    const isAdmin = adminSecret && presentedSecret === adminSecret

    let supabase, user, restrictToUserId
    if (isAdmin) {
      supabase = _getServiceClient()
      if (!supabase) return jsonRes(res, 500, { error: "Service client not configured for admin run" })
      user = { id: "agent-cron" }
      restrictToUserId = null // admin sweeps all users
    } else {
      const ctx = await getAuthedUserAndClient(req)
      supabase = ctx.supabase
      user = ctx.user
      restrictToUserId = user.id // user can only release their own vaults
    }

    let subQuery = supabase
      .from("subscriptions")
      .select("id, name, next_billing_date, user_id")
      .eq("status", "active")
    if (restrictToUserId) subQuery = subQuery.eq("user_id", restrictToUserId)
    const { data: activeSubs } = await subQuery

    if (!activeSubs?.length) {
      return jsonRes(res, 200, { success: true, message: "No active subscriptions", released: 0, checked: 0 })
    }

    // Only act on subscriptions that are actually due today or earlier. Releasing
    // a vault before the billing date would be a real bug — funds would leave
    // the user's escrow a day (or a month) early.
    const todayISO = new Date().toISOString().slice(0, 10)
    const dueSubs = activeSubs.filter((s) => !s.next_billing_date || s.next_billing_date <= todayISO)
    const notYetDue = activeSubs.length - dueSubs.length

    if (!dueSubs.length) {
      return jsonRes(res, 200, {
        success: true,
        message: notYetDue > 0
          ? `${notYetDue} subscription${notYetDue !== 1 ? "s" : ""} found but none are due yet.`
          : "No active subscriptions",
        released: 0, checked: activeSubs.length, not_yet_due: notYetDue,
      })
    }

    const subIds = dueSubs.map((s) => s.id)
    const { data: vaults } = await supabase
      .from("escrow_vaults")
      .select("id, app_id, subscription_id, amount, vault_type, app_address, escrow_address")
      .in("subscription_id", subIds)
      .eq("status", "locked")

    if (!vaults?.length) {
      return jsonRes(res, 200, {
        success: true,
        message: "No locked vaults for due subscriptions",
        released: 0, checked: activeSubs.length, not_yet_due: notYetDue,
      })
    }

    const mnemonic = process.env.AGENT_WALLET_MNEMONIC
    let agentAccount = null
    let algodClient = null
    let agentMode = "db-only"

    if (mnemonic && mnemonic.trim() !== "" && mnemonic !== "skip") {
      try {
        agentAccount = algosdk.mnemonicToSecretKey(mnemonic.trim())
        // Centralized algod URL: prefer self-hosted/paid, fall back to algonode.
        const algodUrl = process.env.ALGOD_URL
          || process.env.VITE_ALGOD_TESTNET_URL
          || "https://testnet-api.algonode.cloud"
        algodClient = new algosdk.Algodv2(process.env.ALGOD_TOKEN || "", algodUrl, "")
        agentMode = "on-chain"
      } catch { agentMode = "db-only" }
    }

    const results = { checked: activeSubs.length, released: 0, skipped: 0, errors: [], actions: [], agent_mode: agentMode }

    // Send Telegram alerts for due-today subscriptions that haven't been alerted yet
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
    let alertsSent = 0
    for (const sub of dueSubs) {
      try {
        // Check if alert already sent
        const { data: existingAlert } = await supabase
          .from("agent_renewal_alerts")
          .select("id")
          .eq("subscription_id", sub.id)
          .limit(1)
        if (existingAlert && existingAlert.length > 0) continue

        // Get user's telegram chat_id
        const { data: profiles } = await supabase
          .from("profiles")
          .select("telegram_chat_id")
          .eq("id", sub.user_id)
          .limit(1)
        const chatId = profiles?.[0]?.telegram_chat_id
        if (!chatId || !BOT_TOKEN) continue

        // Get vault info
        const matchingVault = vaults?.find((v) => v.subscription_id === sub.id)
        const amountStr = matchingVault ? `${matchingVault.amount} ALGO` : "unknown"

        // Insert alert
        await supabase.from("agent_renewal_alerts").insert({
          subscription_id: sub.id,
          vault_id: matchingVault?.id || null,
          alert_sent_at: new Date().toISOString(),
          alert_type: "today",
          user_decision: null,
        })

        // Send Telegram
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🚨 Due TODAY\n\n${sub.name} is due TODAY (${amountStr}).\n\nReply "keep ${sub.name.toLowerCase()}" to pay and continue\nReply "cancel ${sub.name.toLowerCase()}" to cancel and get ALGO back`,
            disable_web_page_preview: true,
          }),
        })
        alertsSent++
      } catch (err) {
        console.warn(`[agent-run] alert for ${sub.name} failed: ${err.message}`)
      }
    }

    // If we sent new alerts, STOP here — don't release anything until user decides
    if (alertsSent > 0) {
      return jsonRes(res, 200, {
        success: true,
        message: `Sent ${alertsSent} renewal alert(s). Waiting for user decision before releasing.`,
        released: 0, checked: activeSubs.length, alerts_sent: alertsSent,
      })
    }

    for (const vault of vaults) {
      const sub = activeSubs.find((s) => s.id === vault.subscription_id)
      const subName = sub?.name ?? "Unknown"
      let txid = null
      let mode = "db-only"

      // Check if there's a pending renewal alert with no decision — don't release yet
      try {
        const { data: pendingAlerts } = await supabase
          .from("agent_renewal_alerts")
          .select("id, user_decision")
          .eq("subscription_id", vault.subscription_id)
          .limit(1)
        if (pendingAlerts && pendingAlerts.length > 0) {
          const decision = pendingAlerts[0].user_decision
          if (decision === null || decision === "cancel") {
            results.skipped++
            results.actions.push({ vault_id: vault.id, name: subName, status: decision === null ? "waiting_for_decision" : "cancel_in_progress" })
            continue
          }
        }
      } catch {}
      try {
        const isAgentVault = vault.vault_type === "agent" || vault.vault_type === "agent_v2"
        // Detect actual contract version from on-chain global state — DB vault_type may be stale
        let isAgentV2 = vault.vault_type === "agent_v2"
        if (algodClient && vault.app_id) {
          try {
            const appInfo = await algodClient.getApplicationByID(Number(vault.app_id)).do()
            const gs = appInfo?.params?.["global-state"] ?? appInfo?.params?.globalState ?? []
            isAgentV2 = gs.some(e => {
              try { return Buffer.from(e.key, "base64").toString("utf-8") === "cycle_index" } catch { return false }
            })
          } catch { /* keep DB value as fallback */ }
        }
        // agent_actions row per (vault, billing period). Without this the agent
        // appends a duplicate row on every tick.
        const gotLock = await _acquireRunLock(vault.id, sub?.next_billing_date)
        if (!gotLock) {
          results.skipped++
          continue
        }
        if (algodClient && agentAccount && vault.app_id && isAgentVault) {
          try {
            const params = await algodClient.getTransactionParams().do()
            const minFee = Number(params.minFee ?? params.fee ?? 1000) || 1000
            const amountMicro = Math.round(Number(vault.amount || 0) * 1_000_000)
            const appId = Number(vault.app_id)

            if (isAgentV2) {
              // AgentEscrowVaultV2: needs atomic group [MBR payment + release() call]
              // Box name = "h:" + uint64(next_cycle_index)
              // Read current cycle_index from global state first
              let nextCycleIndex = 1
              try {
                const appInfo = await algodClient.getApplicationByID(appId).do()
                const gs = appInfo?.params?.["global-state"] ?? appInfo?.params?.globalState ?? []
                const entry = gs.find(e => {
                  try { return Buffer.from(e.key, "base64").toString("utf-8") === "cycle_index" } catch { return false }
                })
                if (entry) nextCycleIndex = (entry.value?.uint ?? 0) + 1
              } catch { /* default to 1 */ }

              const boxPrefix = Buffer.from("h:")
              const boxIndex = algosdk.encodeUint64(nextCycleIndex)
              const boxName = new Uint8Array(boxPrefix.length + boxIndex.length)
              boxName.set(boxPrefix, 0)
              boxName.set(boxIndex, boxPrefix.length)

              // Box MBR: 2500 + 400 * (key_len + value_len) = 2500 + 400*(10+24) = 16100 µALGO
              const BOX_MBR = 16100
              const appAddress = algosdk.getApplicationAddress(appId)

              // Txn 1: MBR payment to fund the new box
              const mbrTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                sender: agentAccount.addr,
                receiver: appAddress,
                amount: BOX_MBR,
                suggestedParams: { ...params, fee: minFee, flatFee: true },
              })
              // Txn 2: release() call
              const releaseTxn = algosdk.makeApplicationCallTxnFromObject({
                sender: agentAccount.addr,
                suggestedParams: { ...params, fee: minFee * 2, flatFee: true },
                appIndex: appId,
                onComplete: algosdk.OnApplicationComplete.NoOpOC,
                appArgs: [RELEASE_V2_SELECTOR, algosdk.encodeUint64(amountMicro)],
                boxes: [{ appIndex: appId, name: boxName }],
                // Recipient must be in foreign accounts so AVM inner txn can access it
                accounts: vault.escrow_address ? [vault.escrow_address] : undefined,
              })

              // Assign group ID
              algosdk.assignGroupID([mbrTxn, releaseTxn])

              const signedMbr = mbrTxn.signTxn(agentAccount.sk)
              const signedRelease = releaseTxn.signTxn(agentAccount.sk)

              const sendRes = await algodClient.sendRawTransaction([signedMbr, signedRelease]).do()
              txid = sendRes.txId ?? sendRes.txid ?? ""
              const confirmed = await algosdk.waitForConfirmation(algodClient, txid, 4)
              if (confirmed?.["pool-error"]) throw new Error(`pool-error: ${confirmed["pool-error"]}`)
              if (!(confirmed?.["confirmed-round"] || confirmed?.confirmedRound)) throw new Error("Txn never confirmed in a round")
            } else {
              // Standard agent vault: single release() call
              const txn = algosdk.makeApplicationCallTxnFromObject({
                sender: agentAccount.addr,
                suggestedParams: { ...params, fee: minFee * 2, flatFee: true },
                appIndex: appId,
                onComplete: algosdk.OnApplicationComplete.NoOpOC,
                appArgs: [RELEASE_SELECTOR],
              })
              const signed = txn.signTxn(agentAccount.sk)
              const sendRes = await algodClient.sendRawTransaction(signed).do()
              txid = sendRes.txId ?? sendRes.txid ?? ""
              const confirmed = await algosdk.waitForConfirmation(algodClient, txid, 4)
              if (confirmed?.["pool-error"]) throw new Error(`pool-error: ${confirmed["pool-error"]}`)
              if (!(confirmed?.["confirmed-round"] || confirmed?.confirmedRound)) throw new Error("Txn never confirmed in a round")
            }
            mode = "on-chain"
          } catch (onChainErr) {
            results.errors.push(`Vault ${vault.id} on-chain failed: ${onChainErr.message}`)
            // We failed — release the lock so a future retry can succeed.
            const sb = _getServiceClient()
            if (sb) await sb.from("agent_run_locks").delete().eq("lock_key", `${vault.id}:${sub?.next_billing_date ?? "no-date"}`)
            // Skip the simulation row insert below; we want the next retry to be
            // a real on-chain release, not a misleading sim entry.
            continue
          }
        } else if (algodClient && agentAccount && vault.app_id && !isAgentVault) {
          results.errors.push(`Vault ${vault.id} skipped: type "${vault.vault_type}" requires creator signature`)
        }

        if (mode === "on-chain" && txid) {
          await supabase.from("escrow_vaults")
            .update({ status: "released", released_at: new Date().toISOString(), txn_id: txid })
            .eq("id", vault.id)
        }

        // agent_actions table only allows INSERT via service_role (RLS blocks user JWT).
        // Always use the service client here regardless of auth mode.
        const svcClient = _getServiceClient()
        const actionClient = svcClient || supabase
        await actionClient.from("agent_actions").insert({
          action_type: "auto_release",
          vault_id: vault.id,
          subscription_id: vault.subscription_id,
          user_id: user.id === "agent-cron" ? vault.user_id ?? user.id : user.id,
          payload: {
            subscription_name: subName, amount: vault.amount, mode, txid,
            agent_address: agentAccount?.addr ?? null,
            released_at: new Date().toISOString(),
            note: mode === "db-only"
              ? "Simulation only — vault stays locked on-chain. Configure AGENT_WALLET_MNEMONIC for real releases."
              : "On-chain release confirmed.",
          },
          txid, status: mode === "on-chain" ? "success" : "simulation",
        })

        // Only count as released when the on-chain txn confirmed.
        // db-only mode is a simulation — counting it would mislead ops.
        if (mode === "on-chain" && txid) results.released++
        else results.skipped++
        results.actions.push({ vault_id: vault.id, sub_name: subName, mode, txid })
      } catch (err) {
        results.errors.push(`Vault ${vault.id}: ${err.message}`)
        results.skipped++
      }
    }

    jsonRes(res, 200, { success: true, ...results })
  } catch (err) {
    console.error("[agent-run] error:", err)
    jsonRes(res, err.status || 500, { error: err.message || "Agent run failed" })
  }
}

// ── /api/advance-billing ────────────────────────────────────────────────────

export async function advanceBillingHandler(req, res) {
  if (req.method !== "POST") return jsonRes(res, 405, { error: "Method Not Allowed" })

  try {
    const { supabase, user } = await getAuthedUserAndClient(req)

    const today = new Date().toISOString().split("T")[0]
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("id, next_billing_date, billing_cycle")
      .eq("user_id", user.id)
      .in("status", ["active", "trial"])
      .lte("next_billing_date", today)  // BUG FIX: was .lt() — today's dates were skipped

    if (!subs?.length) return jsonRes(res, 200, { success: true, advanced: 0 })

    const subIds = subs.map((s) => s.id)
    const { data: lockedVaults } = await supabase
      .from("escrow_vaults")
      .select("subscription_id")
      .in("subscription_id", subIds)
      .eq("status", "locked")
    const lockedSubIds = new Set((lockedVaults ?? []).map((v) => v.subscription_id))

    function advance(dateStr, cycle) {
      const d = new Date(dateStr + "T00:00:00")
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      const VALID_CYCLES = ["weekly", "monthly", "quarterly", "yearly"]
      if (!VALID_CYCLES.includes(cycle)) return dateStr // unknown cycle — don't advance
      let iterations = 0
      while (d < now && iterations < 1000) {
        iterations++
        if (cycle === "weekly")    d.setDate(d.getDate() + 7)
        else if (cycle === "monthly")   d.setMonth(d.getMonth() + 1)
        else if (cycle === "quarterly") d.setMonth(d.getMonth() + 3)
        else if (cycle === "yearly")    d.setFullYear(d.getFullYear() + 1)
        else break
      }
      return d.toISOString().split("T")[0]
    }

    let advanced = 0
    for (const sub of subs) {
      if (lockedSubIds.has(sub.id)) continue
      const next = advance(sub.next_billing_date, sub.billing_cycle)
      const { error } = await supabase.from("subscriptions")
        .update({ next_billing_date: next })
        .eq("id", sub.id).eq("user_id", user.id)
      if (!error) advanced++
    }

    jsonRes(res, 200, { success: true, advanced, skipped: lockedSubIds.size })
  } catch (err) {
    console.error("[advance-billing] error:", err)
    jsonRes(res, err.status || 500, { error: err.message || "Advance billing failed" })
  }
}

// ── /api/agent/registry — Service registry lookup (A2A discovery) ───────────
//
// Read-only endpoint that returns the on-chain service registry contents.
// Wallets / agents discover available subscription services here.
//
// Per-IP rate limit for the public registry read.
// Cheap in-memory token bucket — fine for a single Node instance; if we ever
// scale horizontally, swap for the supabase-backed limiter (rate-limit.mjs).
const REGISTRY_DEFAULT_LIMIT = 100
const REGISTRY_MAX_LIMIT = 500
const REGISTRY_RATE_PER_MIN = 60
const REGISTRY_MAX_TRACKED_IPS = 5000
// Map iteration order = insertion order, which we rely on for LRU-style eviction.
const _registryHits = new Map() // ip -> { count, windowStart }
function registryRateLimitOk(ip) {
  const now = Date.now()
  const windowMs = 60_000
  const entry = _registryHits.get(ip)
  if (!entry || now - entry.windowStart >= windowMs) {
    // Refresh insertion order so this IP is now the most-recent in the Map.
    if (entry) _registryHits.delete(ip)
    _registryHits.set(ip, { count: 1, windowStart: now })

    // Hard cap on tracked IPs. Drop expired entries first, then evict the
    // oldest insertion-order entries if still over the cap. This guarantees
    // the Map can never grow without bound, even under a flood of unique IPs
    // within a single window.
    if (_registryHits.size > REGISTRY_MAX_TRACKED_IPS) {
      const cutoff = now - windowMs
      for (const [k, v] of _registryHits) {
        if (v.windowStart < cutoff) _registryHits.delete(k)
        if (_registryHits.size <= REGISTRY_MAX_TRACKED_IPS) break
      }
      while (_registryHits.size > REGISTRY_MAX_TRACKED_IPS) {
        const oldest = _registryHits.keys().next().value
        if (oldest === undefined) break
        _registryHits.delete(oldest)
      }
    }
    return true
  }
  if (entry.count >= REGISTRY_RATE_PER_MIN) return false
  entry.count++
  return true
}

export async function agentRegistryHandler(req, res) {
  if (req.method !== "GET") return jsonRes(res, 405, { error: "Method Not Allowed" })

  // Resolve client IP (trust the first X-Forwarded-For hop when behind the Replit proxy).
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()
  const ip = fwd || req.socket?.remoteAddress || "unknown"
  if (!registryRateLimitOk(ip)) {
    res.setHeader("Retry-After", "60")
    return jsonRes(res, 429, { error: "Too many requests. Try again in a minute." })
  }

  try {
    // Network selection: ?network=testnet|mainnet (default testnet).
    const url = new URL(req.url || "/", "http://localhost")
    const requested = (url.searchParams.get("network") || "testnet").toLowerCase()
    const network = requested === "mainnet" ? "mainnet" : "testnet"

    // Pagination: ?limit=N (1..500), defaults to 100.
    const limitRaw = Number(url.searchParams.get("limit") || REGISTRY_DEFAULT_LIMIT)
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(REGISTRY_MAX_LIMIT, Math.floor(limitRaw)))
      : REGISTRY_DEFAULT_LIMIT

    // Per-network app id (with single-value back-compat for testnet only).
    const REGISTRY_APP_ID = network === "mainnet"
      ? process.env.SERVICE_REGISTRY_APP_ID_MAINNET
      : (process.env.SERVICE_REGISTRY_APP_ID_TESTNET || process.env.SERVICE_REGISTRY_APP_ID)

    if (!REGISTRY_APP_ID) {
      return jsonRes(res, 200, {
        registry_app_id: null,
        services: [],
        network,
        message: network === "mainnet"
          ? "Service registry has not been deployed on Algorand MainNet yet. Set SERVICE_REGISTRY_APP_ID_MAINNET to enable."
          : "Service registry not yet deployed. Run `npm run deploy:contracts` after compiling smart_contracts/service_registry.",
      })
    }

    const algodUrl = network === "mainnet"
      ? (process.env.ALGOD_MAINNET_URL || "https://mainnet-api.algonode.cloud")
      : (process.env.ALGOD_TESTNET_URL || "https://testnet-api.algonode.cloud")
    const algod = new algosdk.Algodv2(process.env.ALGOD_TOKEN || "", algodUrl, "")
    const boxes = await algod.getApplicationBoxes(Number(REGISTRY_APP_ID)).do()
    const allBoxes = boxes.boxes || []
    const totalBoxes = allBoxes.length
    const sliced = allBoxes.slice(0, limit)
    const services = []

    for (const b of sliced) {
      try {
        const boxName = b.name
        const boxResp = await algod.getApplicationBoxByName(Number(REGISTRY_APP_ID), boxName).do()
        const value = boxResp.value
        // ARC-4 struct layout (head/tail) written by puyapy:
        //   provider           : 32 bytes (address)
        //   price_microalgos   : 8  bytes (uint64 big-endian)
        //   cycle_days         : 8  bytes (uint64 big-endian)
        //   name_offset        : 2  bytes uint16-BE  -> tail position of name
        //   ... at tail position:
        //     name_length      : 2  bytes uint16-BE
        //     name             : N  bytes UTF-8
        if (!value || value.length < 52) continue
        const provider = algosdk.encodeAddress(value.slice(0, 32))
        const price = Number(algosdk.decodeUint64(value.slice(32, 40), "safe"))
        const cycle = Number(algosdk.decodeUint64(value.slice(40, 48), "safe"))
        const nameOffset = (value[48] << 8) | value[49]
        const nameLen = (value[nameOffset] << 8) | value[nameOffset + 1]
        const nameStart = nameOffset + 2
        const name = new TextDecoder().decode(value.slice(nameStart, nameStart + nameLen))
        // Box name layout: "svc:" prefix (4 bytes) + ARC-4 string (uint16-BE length + bytes).
        let serviceId = ""
        if (boxName.length >= 6 && boxName[0] === 0x73 && boxName[1] === 0x76 && boxName[2] === 0x63 && boxName[3] === 0x3a) {
          const idLen = (boxName[4] << 8) | boxName[5]
          serviceId = new TextDecoder().decode(boxName.slice(6, 6 + idLen))
        } else {
          // Fallback for boxes that pre-date the prefix scheme.
          serviceId = new TextDecoder().decode(boxName)
        }
        services.push({
          service_id: serviceId,
          provider, price_microalgos: price, cycle_days: cycle, name,
        })
      } catch { /* skip malformed boxes */ }
    }

    jsonRes(res, 200, {
      registry_app_id: Number(REGISTRY_APP_ID),
      network,
      services,
      count: services.length,
      total: totalBoxes,
      limit,
      truncated: totalBoxes > services.length,
    })
  } catch (err) {
    console.error("[agent-registry] error:", err)
    jsonRes(res, 500, { error: err.message || "Registry lookup failed" })
  }
}

// ── /api/ai-optimizer (Chat) ────────────────────────────────────────────────
// Interactive AI chat endpoint. Accepts conversation
// history + user context, calls Cerebras (gpt-oss-120b), returns structured
// JSON with reply text and optional action buttons.

export async function chatHandler(req, res) {
  if (req.method !== "POST") return jsonRes(res, 405, { error: "Method Not Allowed" })

  try {
    const authHeader = req.headers.authorization || ""
    const tokenForLimit = authHeader.replace(/^Bearer\s+/i, "").slice(0, 80) || (req.socket?.remoteAddress ?? "anon")
    const allowed = await rateLimitAllow("pulse_chat", tokenForLimit, 30, 3600)
    if (!allowed) return jsonRes(res, 429, { error: "Rate limit: 30 messages/hour. Please wait." })

    const { supabase: sb, user } = await getAuthedUserAndClient(req)

    const body = await readBody(req)
    let parsedBody
    try { parsedBody = JSON.parse(body || "{}") } catch {
      return jsonRes(res, 400, { error: "Invalid JSON body" })
    }

    const { messages = [] } = parsedBody
    if (!Array.isArray(messages)) return jsonRes(res, 400, { error: "messages must be an array" })
    if (messages.length > 50) return jsonRes(res, 400, { error: "Too many messages (max 50)" })

    // Fetch user data for context
    const [subsRes, vaultsRes, profileRes] = await Promise.all([
      sb.from("subscriptions")
        .select("id, name, amount, currency, billing_cycle, status, next_billing_date, category")
        .eq("user_id", user.id)
        .limit(50),
      sb.from("escrow_vaults")
        .select("id, subscription_id, amount, currency, status, vault_type, created_at, unlock_time")
        .eq("user_id", user.id)
        .limit(50),
      sb.from("profiles")
        .select("currency")
        .eq("id", user.id)
        .single(),
    ])

    const subscriptions = subsRes.data || []
    const vaults = vaultsRes.data || []
    const userCurrency = profileRes.data?.currency || "USD"

    // Calculate spending stats
    const activeSubs = subscriptions.filter((s) => s.status === "active")
    const totalMonthly = activeSubs.reduce((sum, s) => {
      const amt = Number(s.amount) || 0
      switch (s.billing_cycle) {
        case "weekly":    return sum + amt * 4.33
        case "monthly":   return sum + amt
        case "quarterly": return sum + amt / 3
        case "yearly":    return sum + amt / 12
        default:          return sum + amt
      }
    }, 0)

    const totalVaultLocked = vaults
      .filter((v) => v.status === "locked")
      .reduce((sum, v) => sum + (Number(v.amount) || 0), 0)

    // Map vaults to subscriptions
    const vaultMap = {}
    for (const v of vaults) {
      if (v.subscription_id) vaultMap[v.subscription_id] = v
    }

    // Build subscription context block
    const subsBlock = subscriptions.length > 0
      ? subscriptions.map((s, i) => {
          const vault = vaultMap[s.id]
          const vaultInfo = vault ? `vault: ${vault.status} (${vault.amount} ALGO, ${vault.vault_type})` : "no vault"
          return `${i + 1}. "${s.name}" | ${s.status} | ${s.currency} ${s.amount}/${s.billing_cycle || "mo"} | next: ${s.next_billing_date || "unknown"} | category: ${s.category || "uncategorized"} | ${vaultInfo}`
        }).join("\n")
      : "No subscriptions tracked yet."

    const vaultsBlock = vaults.length > 0
      ? vaults.map((v, i) => `${i + 1}. ${v.vault_type} | ${v.status} | ${v.amount} ALGO | sub: ${v.subscription_id || "unlinked"}`).join("\n")
      : "No vaults created."

    const systemPrompt = `You are Pulse, the Unsubscribely AI assistant embedded in the web dashboard. You help users manage their subscriptions intelligently — finding savings, suggesting vault strategies, and providing spending insights.

## USER CONTEXT

### Subscriptions (${activeSubs.length} active, ${subscriptions.length} total)
${subsBlock}

### Escrow Vaults (${vaults.length} total, ${totalVaultLocked} ALGO locked)
${vaultsBlock}

### Spending Stats
- Currency: ${userCurrency}
- Total monthly spend: ${userCurrency} ${totalMonthly.toFixed(2)}/mo
- Annual projected: ${userCurrency} ${(totalMonthly * 12).toFixed(2)}/yr
- Active subscriptions: ${activeSubs.length}
- Vaults: ${vaults.length} (${totalVaultLocked.toFixed(4)} ALGO locked)

## RULES
1. Be concise but informative. Use **bold** for emphasis and • for lists.
2. NEVER show UUIDs. Always use subscription names.
3. When suggesting actions, include them in the "actions" array.
4. Available action hrefs: "/subscriptions" (manage/cancel subs), "/escrow-vaults" (create/manage vaults), "/analytics" (spending charts), "/calendar" (billing calendar), "/settings" (account settings).
5. Match action labels to what the user should do: "Cancel [Name]", "Create Vault for [Name]", "View Analytics", "Check Calendar", etc.
6. For spending questions, give specific numbers from the context.
7. For the initial greeting, provide a brief spending summary and one actionable insight.
8. Use emoji sparingly (1-2 per message max).

## RESPONSE FORMAT
Return ONLY valid JSON (no markdown backticks wrapping it):
{
  "reply": "Your message to the user (can use **bold**, • bullets, line breaks)",
  "actions": [
    {"label": "Button Text", "type": "link", "href": "/page-path"}
  ]
}

The "actions" array is optional. Only include it when you have specific actionable suggestions. Each action becomes a clickable button in the UI.`

    // Build messages array for Cerebras
    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-20).map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      })),
    ]

    // Call Cerebras
    const CEREBRAS_API_KEY = getEnv("CEREBRAS_API_KEY")
    const cerebrasRes = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CEREBRAS_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-oss-120b",
        messages: chatMessages,
        temperature: 0.4,
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(20000),
    })

    if (!cerebrasRes.ok) {
      const errText = await cerebrasRes.text().catch(() => "")
      console.warn(`[pulse] Cerebras API error ${cerebrasRes.status}: ${errText.slice(0, 200)}`)
      return jsonRes(res, 502, { error: "AI service temporarily unavailable" })
    }

    const cerebrasData = await cerebrasRes.json()
    const content = cerebrasData?.choices?.[0]?.message?.content?.trim()

    if (!content) {
      return jsonRes(res, 502, { error: "Empty response from AI" })
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return jsonRes(res, 200, { reply: content, actions: [] })
    }

    try {
      const parsed = JSON.parse(jsonMatch[0])
      return jsonRes(res, 200, {
        reply: parsed.reply || content,
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      })
    } catch {
      return jsonRes(res, 200, { reply: content, actions: [] })
    }
  } catch (err) {
    if (err.status) return jsonRes(res, err.status, { error: err.message })
    console.error("[pulse] error:", err)
    jsonRes(res, 500, { error: "Internal server error" })
  }
}
