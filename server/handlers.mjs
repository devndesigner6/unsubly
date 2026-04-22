/**
 * Shared API handlers used by BOTH the Vite dev server (vite.config.ts)
 * AND the production server (server.js). Single source of truth for /api/*.
 *
 * Each export is a plain async function that takes (req, res) — Node http
 * style. They read JSON bodies themselves so there's no Express dependency.
 */

import { createClient } from "@supabase/supabase-js"
import algosdk from "algosdk"

// ── Common helpers ──────────────────────────────────────────────────────────

function readBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let body = ""
    let size = 0
    req.on("data", (chunk) => {
      size += chunk.length
      if (size > maxBytes) {
        reject(new Error("Request body too large"))
        req.destroy()
        return
      }
      body += chunk.toString()
    })
    req.on("end", () => resolve(body))
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
export async function aiOptimizerHandler(req, res) {
  if (req.method !== "POST") return jsonRes(res, 405, { error: "Method Not Allowed" })

  try {
    // Auth FIRST so anonymous traffic can't burn our LLM quota.
    await getAuthedUserAndClient(req)

    const GROQ_API_KEY = getEnv("GROQ_API_KEY")
    const body = await readBody(req)
    const {
      subscriptions = [],
      vaults = [],
      userCurrency = "USD",
      totalMonthly = 0,
      totalVaultLocked = 0,
    } = JSON.parse(body || "{}")

    const activeSubs = subscriptions.filter((s) => s.status === "active")

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

    let aiRes = await callGroq()
    if (aiRes.status === 429) {
      await new Promise((r) => setTimeout(r, 8000))
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

export async function agentRunHandler(req, res) {
  if (req.method !== "POST") return jsonRes(res, 405, { error: "Method Not Allowed" })

  try {
    const { supabase, user } = await getAuthedUserAndClient(req)

    const { data: activeSubs } = await supabase
      .from("subscriptions")
      .select("id, name, next_billing_date")
      .eq("status", "active")

    if (!activeSubs?.length) {
      return jsonRes(res, 200, { success: true, message: "No active subscriptions", released: 0, checked: 0 })
    }

    const subIds = activeSubs.map((s) => s.id)
    const { data: vaults } = await supabase
      .from("escrow_vaults")
      .select("id, app_id, subscription_id, amount, vault_type")
      .in("subscription_id", subIds)
      .eq("status", "locked")

    if (!vaults?.length) {
      return jsonRes(res, 200, { success: true, message: "No locked vaults", released: 0, checked: activeSubs.length })
    }

    const mnemonic = process.env.AGENT_WALLET_MNEMONIC
    let agentAccount = null
    let algodClient = null
    let agentMode = "db-only"

    if (mnemonic && mnemonic.trim() !== "" && mnemonic !== "skip") {
      try {
        agentAccount = algosdk.mnemonicToSecretKey(mnemonic.trim())
        algodClient = new algosdk.Algodv2("", "https://testnet-api.algonode.cloud", "")
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
            await algosdk.waitForConfirmation(algodClient, txid, 4)
            mode = "on-chain"
          } catch (onChainErr) {
            results.errors.push(`Vault ${vault.id} on-chain failed: ${onChainErr.message}`)
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

        results.released++
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
