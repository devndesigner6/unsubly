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
// "x402 Demo" page. Returns a fake "premium quote" to keep the demo cheap
// and deterministic. The whole point is to let the user experience the
// 402 → pay → 200+receipt round-trip on their own wallet.
let _x402DemoWrapped = null
function _getX402DemoHandler() {
  if (_x402DemoWrapped) return _x402DemoWrapped
  const payTo = process.env.X402_PAY_TO_ADDRESS
  if (!payTo) {
    _x402DemoWrapped = (_req, res) => jsonRes(res, 503, {
      error: "x402 demo unavailable — server is missing X402_PAY_TO_ADDRESS",
    })
    return _x402DemoWrapped
  }
  const price = Number(process.env.X402_PRICE_MICROALGOS || "1000")
  const network = process.env.X402_NETWORK || "algorand-testnet"
  _x402DemoWrapped = withX402(
    {
      payTo, priceMicroalgos: price, network,
      description: "Unsubscribely x402 demo — premium quote",
      // Demo endpoint has no inner JWT check, so we cannot let any caller
      // fake an Authorization header to skip payment.
      allowAuthBypass: false,
    },
    async (_req, res) => {
      const quotes = [
        "Money is better than poverty, if only for financial reasons. — Woody Allen",
        "It is better to look ahead and prepare than to look back and regret. — Jackie Joyner-Kersee",
        "An investment in knowledge pays the best interest. — Benjamin Franklin",
        "The best time to plant a tree was 20 years ago. The second best time is now. — Chinese proverb",
        "On-chain receipts cannot be lost. Paper ones can. — anon",
      ]
      const pick = quotes[Math.floor(Math.random() * quotes.length)]
      jsonRes(res, 200, {
        ok: true,
        quote: pick,
        served_at: new Date().toISOString(),
        note: "You just paid for this with x402 over Algorand. The X-PAYMENT-RESPONSE header contains the on-chain txid.",
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

CRITICAL: You must respond with ONLY valid JSON. No markdown, no prose, no explanation outside the JSON.

Return exactly this structure:
{
  "spending": {
    "summary": "one sentence summary of total spend",
    "topCategory": "highest spend category name",
    "monthlyTotal": number,
    "annualTotal": number,
    "breakdown": [
      { "name": "subscription name", "monthly": number, "category": "category", "risk": "low|medium|high" }
    ]
  },
  "savings": [
    { "title": "short title", "description": "specific actionable recommendation", "saving": "e.g. $19/mo", "priority": "high|medium|low" }
  ],
  "vaultStrategy": [
    { "subscription": "name", "recommended": "standard|time-locked|multi-sig|dispute|asa", "reason": "one sentence why" }
  ],
  "riskScore": number between 0 and 100,
  "riskLabel": "Low|Medium|High",
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
      temperature: 0.3,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    }

    const callGroq = () => fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    // Exponential backoff: up to 3 retries on 429 with jitter (1s, 3s, 9s ± 30%)
    let aiRes = await callGroq()
    for (let attempt = 0; attempt < 3 && aiRes.status === 429; attempt++) {
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
      .select("id, app_id, subscription_id, amount, vault_type")
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

    for (const vault of vaults) {
      const sub = activeSubs.find((s) => s.id === vault.subscription_id)
      const subName = sub?.name ?? "Unknown"
      let txid = null
      let mode = "db-only"

      try {
        const isAgentVault = vault.vault_type === "agent"
        // Idempotency for ALL modes (including db-only sim): exactly one
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
            const txn = algosdk.makeApplicationCallTxnFromObject({
              sender: agentAccount.addr,
              suggestedParams: { ...params, fee: 2000, flatFee: true },
              appIndex: Number(vault.app_id),
              onComplete: algosdk.OnApplicationComplete.NoOpOC,
              appArgs: [RELEASE_SELECTOR],
            })
            const signed = txn.signTxn(agentAccount.sk)
            const sendRes = await algodClient.sendRawTransaction(signed).do()
            txid = sendRes.txId ?? sendRes.txid ?? ""
            const confirmed = await algosdk.waitForConfirmation(algodClient, txid, 4)
            // Hard-check the txn actually succeeded; algod returns pool-error
            // for txns that confirmed-but-failed (e.g. logic eval rejected).
            if (confirmed?.["pool-error"]) {
              throw new Error(`pool-error: ${confirmed["pool-error"]}`)
            }
            // Success requires confirmed-round to be set.
            if (!(confirmed?.["confirmed-round"] || confirmed?.confirmedRound)) {
              throw new Error("Txn never confirmed in a round")
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

        await supabase.from("agent_actions").insert({
          action_type: "auto_release",
          vault_id: vault.id,
          subscription_id: vault.subscription_id,
          user_id: user.id,
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
      .lt("next_billing_date", today)

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
      while (d < now) {
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
export async function agentRegistryHandler(req, res) {
  if (req.method !== "GET") return jsonRes(res, 405, { error: "Method Not Allowed" })

  try {
    const REGISTRY_APP_ID = process.env.SERVICE_REGISTRY_APP_ID
    if (!REGISTRY_APP_ID) {
      return jsonRes(res, 200, {
        registry_app_id: null,
        services: [],
        message: "Service registry not yet deployed. Run `npm run deploy:contracts` after compiling smart_contracts/service_registry.",
      })
    }

    const algod = new algosdk.Algodv2("", "https://testnet-api.algonode.cloud", "")
    const boxes = await algod.getApplicationBoxes(Number(REGISTRY_APP_ID)).do()
    const services = []

    for (const b of (boxes.boxes || [])) {
      try {
        const boxName = b.name
        const boxResp = await algod.getApplicationBoxByName(Number(REGISTRY_APP_ID), boxName).do()
        const value = boxResp.value
        // value layout: [provider:32 bytes][price_microalgos:8 bytes][cycle_days:8 bytes][name:variable]
        if (!value || value.length < 48) continue
        const provider = algosdk.encodeAddress(value.slice(0, 32))
        const price = Number(algosdk.decodeUint64(value.slice(32, 40), "safe"))
        const cycle = Number(algosdk.decodeUint64(value.slice(40, 48), "safe"))
        const name = new TextDecoder().decode(value.slice(48))
        services.push({
          service_id: new TextDecoder().decode(boxName),
          provider, price_microalgos: price, cycle_days: cycle, name,
        })
      } catch { /* skip malformed boxes */ }
    }

    jsonRes(res, 200, { registry_app_id: Number(REGISTRY_APP_ID), services, count: services.length })
  } catch (err) {
    console.error("[agent-registry] error:", err)
    jsonRes(res, 500, { error: err.message || "Registry lookup failed" })
  }
}
