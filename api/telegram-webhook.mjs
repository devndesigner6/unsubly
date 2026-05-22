/**
 * POST /api/telegram-webhook
 *
 * Full AI chatbot powered by Cerebras (Llama 3.1 70B).
 * Every non-button message goes through AI with full user context.
 *
 * Flows:
 * 1. /start — generate 6-digit connection code
 * 2. Button callbacks (KEEP_uuid, CANCEL_uuid, DONE_uuid) — fast-path
 * 3. Voice → transcribe (Gemini) → treat as text
 * 4. Everything else → Cerebras AI with full context → reply + action
 * 5. Fallback to keyword matching if Cerebras fails
 */

import { createClient } from "@supabase/supabase-js"
import algosdk from "algosdk"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

async function sendTelegram(botToken, chatId, text, opts = {}) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: opts.parseMode || undefined,
      disable_web_page_preview: true,
      ...opts.extra,
    }),
  })
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on("data", (c) => chunks.push(c))
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8"))) }
      catch { resolve({}) }
    })
    req.on("error", reject)
  })
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── On-chain vault kill (inline, no dynamic import) ─────────────────────────

async function killVaultOnChainInline(vault) {
  const mnemonic = process.env.AGENT_WALLET_MNEMONIC
  if (!mnemonic || mnemonic === "skip") {
    console.warn("[webhook] AGENT_WALLET_MNEMONIC not set, skipping on-chain kill")
    return
  }
  const appId = Number(vault.app_id)
  if (!appId || appId <= 0) {
    console.warn(`[webhook] Invalid app_id for on-chain kill: ${appId}`)
    return
  }

  const network = (process.env.ALGO_NETWORK || "testnet").toLowerCase()
  const algodUrl = network === "mainnet"
    ? (process.env.ALGOD_MAINNET_URL || "https://mainnet-api.algonode.cloud")
    : (process.env.ALGOD_TESTNET_URL || "https://testnet-api.algonode.cloud")

  const agentAccount = algosdk.mnemonicToSecretKey(mnemonic.trim())
  const algodClient = new algosdk.Algodv2(process.env.ALGOD_TOKEN || "", algodUrl, "")

  const params = await algodClient.getTransactionParams().do()
  const minFee = Number(params.minFee ?? params.fee ?? 1000) || 1000

  // kill() ABI method selector: 0xb9c21155
  const SEL_KILL = new Uint8Array([0xb9, 0xc2, 0x11, 0x55])

  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender: agentAccount.addr,
    suggestedParams: { ...params, fee: minFee * 2, flatFee: true },
    appIndex: appId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [SEL_KILL],
  })

  const signed = txn.signTxn(agentAccount.sk)
  const sendRes = await algodClient.sendRawTransaction(signed).do()
  const txid = sendRes.txId ?? sendRes.txid ?? ""
  const confirmed = await algosdk.waitForConfirmation(algodClient, txid, 4)

  if (confirmed?.["pool-error"]) {
    throw new Error(`pool-error: ${confirmed["pool-error"]}`)
  }
  if (!(confirmed?.["confirmed-round"] || confirmed?.confirmedRound)) {
    throw new Error("Kill transaction never confirmed")
  }

  console.log(`[webhook] On-chain vault kill succeeded: app ${appId}, txid: ${txid}`)
  return txid
}

// ─── On-chain cancellation proof (zero-ALGO note transaction) ────────────────

async function writeCancellationProofInline(subscriptionName, subscriptionId) {
  const mnemonic = process.env.AGENT_WALLET_MNEMONIC
  if (!mnemonic || mnemonic === "skip") return null

  const network = (process.env.ALGO_NETWORK || "testnet").toLowerCase()
  const algodUrl = network === "mainnet"
    ? (process.env.ALGOD_MAINNET_URL || "https://mainnet-api.algonode.cloud")
    : (process.env.ALGOD_TESTNET_URL || "https://testnet-api.algonode.cloud")

  const agentAccount = algosdk.mnemonicToSecretKey(mnemonic.trim())
  const algodClient = new algosdk.Algodv2(process.env.ALGOD_TOKEN || "", algodUrl, "")

  const proof = {
    protocol: "unsub:cancel:v1",
    service: subscriptionName,
    subscription_id: subscriptionId,
    method: "telegram",
    timestamp: new Date().toISOString(),
    network,
  }

  const note = new TextEncoder().encode(JSON.stringify(proof))
  const params = await algodClient.getTransactionParams().do()

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: agentAccount.addr,
    receiver: agentAccount.addr,
    amount: 0,
    suggestedParams: params,
    note,
  })

  const signed = txn.signTxn(agentAccount.sk)
  const sendRes = await algodClient.sendRawTransaction(signed).do()
  const txid = sendRes.txId ?? sendRes.txid ?? ""
  await algosdk.waitForConfirmation(algodClient, txid, 4)

  console.log(`[webhook] Cancellation proof written: txid=${txid}`)
  return txid
}

// ─── Cerebras AI ─────────────────────────────────────────────────────────────

async function callCerebras(systemPrompt, userMessage) {
  const apiKey = process.env.CEREBRAS_API_KEY
  if (!apiKey) {
    console.warn("[cerebras] CEREBRAS_API_KEY not set")
    return null
  }

  try {
    const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-oss-120b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      console.warn(`[cerebras] API error ${res.status}: ${errText.slice(0, 200)}`)
      return null
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content?.trim()
    if (!content) {
      console.warn("[cerebras] Empty response content")
      return null
    }

    // Parse JSON from response (may have markdown backticks)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      // If AI didn't return JSON, wrap the raw text as reply
      console.warn("[cerebras] No JSON in response, using raw text")
      return { reply: content, action: null }
    }

    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      // JSON parse failed, use raw content
      return { reply: content, action: null }
    }
  } catch (err) {
    console.warn(`[cerebras] fetch error: ${err.message}`)
    return null
  }
}

function buildSystemPrompt(context) {
  const { subscriptions, vaults, totalMonthly, lastAlert, cancelInProgress } = context

  const subsBlock = subscriptions.length > 0
    ? subscriptions.map((s, i) => {
        const vaultInfo = s.vault ? `vault: ${s.vault.status} (${s.vault.amount} ALGO)` : "no vault"
        return `${i + 1}. "${s.name}" | ${s.status} | ${s.currency} ${s.amount}/mo | next billing: ${s.next_billing_date || "unknown"} | ${vaultInfo} | id: ${s.id}`
      }).join("\n")
    : "No subscriptions found."

  const vaultsBlock = vaults.length > 0
    ? vaults.map((v, i) => `${i + 1}. ${v.linked_sub || "unlinked"} | ${v.status} | ${v.amount} ALGO | id: ${v.id}`).join("\n")
    : "No vaults."

  return `You are the Unsubscribely AI assistant on Telegram. You help users manage their subscriptions intelligently.

## USER CONTEXT

### Subscriptions
${subsBlock}

### Vaults
${vaultsBlock}

### Stats
- Total monthly spend: ${context.currency} ${totalMonthly.toFixed(2)}/mo
- Last renewal alert: ${lastAlert || "none"}
- Cancel in progress: ${cancelInProgress || "none"}${context.cancelInProgressId ? ` (id: ${context.cancelInProgressId})` : ""}

## RULES
1. NEVER show UUIDs to the user. Always use subscription names.
2. Resolve ambiguous references: "it", "that one", "the expensive one", "my streaming", category words like "music" or "video" - match to the most likely subscription from context.
3. If the user's intent maps to an action, include it in your response.
4. Be concise, friendly, and helpful. Use emoji sparingly.
5. If you can't determine which subscription they mean, ask a clarifying question listing their options by name only.
6. For status/spending questions, summarize their data conversationally.
7. When user wants to CANCEL: say "Starting cancellation for [name]..." and include the cancel action. The system will automatically attempt browser automation then send manual steps.
8. When user says "done" or "I cancelled it" or "finished" or "done [name]": ALWAYS return the done action. Match the subscription from cancel-in-progress or from the name they mention. Reply briefly like "Got it! Processing..." - the system sends the full confirmation.
9. CRITICAL: When user says "done" (with or without a name), you MUST return action type "done". If cancel-in-progress shows a subscription, use that ID. If user says "done [name]", match the name to a subscription and use its ID.
10. NEVER say "I don't see any cancellation in progress" if the user says "done". Always try to match their intent to a subscription and return the done action.
11. If user says "start browser automation" or "start browser" or "automate", treat it as a cancel request for the subscription in cancel-in-progress. Return the cancel action with that subscription_id.
12. NEVER list subscription options unprompted. Only list them if user asks "what are my subscriptions" or you genuinely can't determine which one they mean.

## RESPONSE FORMAT
Return ONLY valid JSON (no markdown, no backticks):
{
  "reply": "Your message to the user",
  "action": null OR {"type": "cancel|done|keep|suggest_vault", "subscription_id": "the-uuid-from-context"}
}

## ACTIONS
- "cancel": User wants to cancel a subscription. You must identify which one. Reply should say "Starting cancellation for [name]..." not "cancelled".
- "done": User confirms they finished cancelling (said "done", "finished", "cancelled it", "done [name]"). Use the cancel-in-progress subscription_id, or match the name they mention to a subscription. Reply should be brief like "Got it! Processing..." - the system will send the full confirmation automatically.
- "keep": User wants to keep a subscription that had a renewal alert.
- "suggest_vault": User asks about protecting/saving for a subscription. Suggest creating a vault.

If no action is needed (general chat, status question, greeting), set action to null.
CRITICAL: If user says "done" or any variant, you MUST return action type "done". Find the subscription_id from cancel-in-progress or by matching the name they mention. NEVER respond with "I don't see any cancellation" - always return the done action.`
}

async function fetchUserContext(sb, chatId) {
  // Find user by telegram chat_id
  const { data: profiles } = await sb
    .from("profiles")
    .select("id")
    .eq("telegram_chat_id", chatId)
    .limit(1)

  const userId = profiles?.[0]?.id
  if (!userId) return null

  // Fetch subscriptions
  const { data: subs } = await sb
    .from("subscriptions")
    .select("id, name, status, amount, currency, next_billing_date, category")
    .eq("user_id", userId)
    .limit(30)

  const subscriptions = subs || []

  // Fetch vaults
  const subIds = subscriptions.map((s) => s.id)
  let vaults = []
  if (subIds.length > 0) {
    const { data: vaultData } = await sb
      .from("escrow_vaults")
      .select("id, subscription_id, status, amount")
      .in("subscription_id", subIds)
    vaults = vaultData || []
  }

  // Map vaults to subscriptions
  const vaultMap = {}
  vaults.forEach((v) => { vaultMap[v.subscription_id] = v })

  const enrichedSubs = subscriptions.map((s) => ({
    ...s,
    vault: vaultMap[s.id] || null,
  }))

  // Total monthly spend (active only)
  const active = subscriptions.filter((s) => s.status === "active")
  const totalMonthly = active.reduce((sum, s) => sum + (s.amount || 0), 0)
  const currency = active[0]?.currency || "USD"

  // Last renewal alert + cancel in progress
  let lastAlert = null
  let cancelInProgress = null
  let cancelInProgressId = null
  if (subIds.length > 0) {
    // Query 1: most recent alerts (for lastAlert display)
    const { data: alerts } = await sb
      .from("agent_renewal_alerts")
      .select("subscription_id, user_decision, created_at, decided_at")
      .in("subscription_id", subIds)
      .order("created_at", { ascending: false })
      .limit(10)

    if (alerts && alerts.length > 0) {
      const lastAlertSub = subscriptions.find((s) => s.id === alerts[0].subscription_id)
      lastAlert = lastAlertSub?.name || null
    }

    // Query 2: explicitly find cancel-in-progress (separate query to avoid ordering issues)
    // Only consider alerts for subscriptions that are still ACTIVE (not already cancelled)
    const activeSubIds = subscriptions.filter((s) => s.status === "active").map((s) => s.id)
    if (activeSubIds.length > 0) {
      const { data: cancelAlerts } = await sb
        .from("agent_renewal_alerts")
        .select("subscription_id, decided_at")
        .in("subscription_id", activeSubIds)
        .eq("user_decision", "cancel")
        .order("decided_at", { ascending: false })
        .limit(1)

      if (cancelAlerts && cancelAlerts.length > 0) {
        const cancelSub = subscriptions.find((s) => s.id === cancelAlerts[0].subscription_id)
        cancelInProgress = cancelSub?.name || null
        cancelInProgressId = cancelAlerts[0].subscription_id
      }
    }
  }

  return {
    userId,
    subscriptions: enrichedSubs,
    vaults: vaults.map((v) => ({
      ...v,
      linked_sub: subscriptions.find((s) => s.id === v.subscription_id)?.name || null,
    })),
    totalMonthly,
    currency,
    lastAlert,
    cancelInProgress,
    cancelInProgressId,
  }
}

// ─── Action Executors ────────────────────────────────────────────────────────

async function executeAction(action, sb, chatId, botToken, context) {
  if (!action || !action.type || !action.subscription_id) return
  if (!UUID_RE.test(action.subscription_id)) return

  const subId = action.subscription_id
  const sub = context.subscriptions.find((s) => s.id === subId)
  const subName = sub?.name || "that subscription"

  switch (action.type) {
    case "cancel": {
      // Check if already cancelling — if so, just re-trigger guided cancel
      const { data: existing } = await sb
        .from("agent_renewal_alerts")
        .select("id")
        .eq("subscription_id", subId)
        .eq("user_decision", "cancel")
        .limit(1)

      if (!existing || existing.length === 0) {
        // No cancel alert yet — create or update one
        // First try update (if alert exists with null decision)
        const { data: updated } = await sb
          .from("agent_renewal_alerts")
          .update({ user_decision: "cancel", decided_at: new Date().toISOString() })
          .eq("subscription_id", subId)
          .is("user_decision", null)
          .select("id")

        // If no existing alert was updated, insert a new one
        if (!updated || updated.length === 0) {
          await sb
            .from("agent_renewal_alerts")
            .insert({
              subscription_id: subId,
              user_decision: "cancel",
              decided_at: new Date().toISOString(),
              alert_sent_at: new Date().toISOString(),
              alert_type: "user_initiated",
            })
            .select("id")
        }
      }

      // Always trigger guided cancel (browser automation + manual steps)
      // Await it so Vercel doesn't freeze the function before it completes
      try {
        await triggerGuidedCancel(subId, chatId)
      } catch (err) {
        console.error("[webhook] guidedCancel error:", err.message)
      }
      break
    }

    case "done": {
      const amountStr = sub?.amount ? `${sub.currency || "USD"} ${Number(sub.amount).toFixed(2)}` : ""

      // Mark subscription cancelled
      await sb
        .from("subscriptions")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_method: "guided",
        })
        .eq("id", subId)

      // Update renewal alert (try both "cancel" and null states)
      await sb
        .from("agent_renewal_alerts")
        .update({ user_decision: "done", decided_at: new Date().toISOString() })
        .eq("subscription_id", subId)
        .eq("user_decision", "cancel")

      // Also update any null-decision alerts for this sub
      await sb
        .from("agent_renewal_alerts")
        .update({ user_decision: "done", decided_at: new Date().toISOString() })
        .eq("subscription_id", subId)
        .is("user_decision", null)

      // Kill vault
      const { data: vaults } = await sb
        .from("escrow_vaults")
        .select("id, app_id, vault_type")
        .eq("subscription_id", subId)
        .eq("status", "locked")
        .limit(1)

      let vaultKilled = false
      if (vaults && vaults.length > 0) {
        await sb
          .from("escrow_vaults")
          .update({ status: "killed", killed_at: new Date().toISOString() })
          .eq("id", vaults[0].id)
        vaultKilled = true

        // Try on-chain kill inline (no dynamic import needed)
        try {
          await killVaultOnChainInline(vaults[0])
        } catch (killErr) {
          console.warn(`[webhook] On-chain vault kill failed: ${killErr.message}`)
        }
      }

      // Send confirmation to user
      const savingsMsg = amountStr ? `\n\n💰 You saved ${amountStr}/month!` : ""
      const vaultNote = vaultKilled ? "\n\n🔓 Vault killed - ALGO returning to your wallet." : ""
      await sendTelegram(botToken, chatId, `✅ ${subName} cancelled!${savingsMsg}${vaultNote}`)
      console.log(`[webhook] Done action completed: ${subName} cancelled, vault ${vaultKilled ? "killed" : "none found"}`)
      break
    }

    case "keep": {
      await sb
        .from("agent_renewal_alerts")
        .update({ user_decision: "keep", decided_at: new Date().toISOString() })
        .eq("subscription_id", subId)
        .is("user_decision", null)
      break
    }

    case "suggest_vault": {
      await sendTelegram(botToken, chatId,
        `💰 Want to protect ${subName} with a vault?\n\nCreate one here: https://unsubly.xyz/vaults?sub=${subId}`
      )
      break
    }
  }
}

// ─── Main Handler ────────────────────────────────────────────────────────────

export async function telegramWebhookHandler(req, res) {
  const jsonReply = (status, data) => {
    res.statusCode = status
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify(data))
  }

  // Top-level try-catch to prevent 500 errors
  try {

  if (req.method !== "POST") return jsonReply(405, { error: "Method not allowed" })

  // ── Webhook secret validation ──────────────────────────────────────────────
  const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET
  if (WEBHOOK_SECRET) {
    const presented = req.headers["x-telegram-bot-api-secret-token"]
    if (presented !== WEBHOOK_SECRET) {
      console.warn("[webhook] Invalid secret token — rejecting request")
      return jsonReply(401, { error: "Unauthorized" })
    }
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  if (!BOT_TOKEN) return jsonReply(500, { error: "TELEGRAM_BOT_TOKEN not configured" })

  const sb = getServiceClient()
  if (!sb) return jsonReply(500, { error: "Supabase not configured" })

  let update
  try {
    update = await readBody(req)
  } catch (e) {
    console.error("[webhook] readBody failed:", e.message)
    return jsonReply(200, { ok: true })
  }

  // ── Handle callback queries (inline button presses) ────────────────────────
  const callback = update?.callback_query
  if (callback) {
    const cbChatId = String(callback.message?.chat?.id)
    const cbData = callback.data || ""
    // Acknowledge the callback
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callback.id }),
    })
    // Process as text
    const fakeReq = {
      method: "POST",
      headers: req.headers,
      on: (event, cb) => {
        if (event === "data") cb(Buffer.from(JSON.stringify({ message: { chat: { id: cbChatId }, text: cbData } })))
        if (event === "end") cb()
      },
    }
    return telegramWebhookHandler(fakeReq, res)
  }

  const message = update?.message
  if (!message) return jsonReply(200, { ok: true })

  const chatId = String(message.chat?.id)
  const text = (message.text || "").trim()

  // ── Voice message → transcribe → treat as text ─────────────────────────────
  if (message.voice && !text) {
    const fileId = message.voice.file_id
    try {
      const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`)
      const fileData = await fileRes.json()
      const filePath = fileData?.result?.file_path
      if (!filePath) throw new Error("Could not get voice file path")

      const audioUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`
      const audioRes = await fetch(audioUrl)
      const audioBuffer = await audioRes.arrayBuffer()
      const audioBase64 = Buffer.from(audioBuffer).toString("base64")

      const GOOGLE_KEY = process.env.GOOGLE_API_KEY
      let transcription = null
      if (GOOGLE_KEY) {
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { text: "Transcribe this voice message. Return ONLY the transcribed text, nothing else." },
                    { inlineData: { mimeType: "audio/ogg", data: audioBase64 } },
                  ],
                }],
              }),
            }
          )
          if (geminiRes.ok) {
            const geminiData = await geminiRes.json()
            transcription = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
          }
        } catch {}
      }

      if (transcription) {
        await sendTelegram(BOT_TOKEN, chatId, `🎤 "${transcription}"\n\nProcessing...`)
        const fakeReq = {
          method: "POST",
          headers: req.headers,
          on: (event, cb) => {
            if (event === "data") cb(Buffer.from(JSON.stringify({ message: { ...message, text: transcription, voice: undefined } })))
            if (event === "end") cb()
          },
        }
        return telegramWebhookHandler(fakeReq, res)
      } else {
        await sendTelegram(BOT_TOKEN, chatId, "🎤 Couldn't transcribe. Please type your message instead.")
        return jsonReply(200, { ok: true })
      }
    } catch {
      await sendTelegram(BOT_TOKEN, chatId, "🎤 Voice processing failed. Please type your message.")
      return jsonReply(200, { ok: true })
    }
  }

  // ── /start — generate connection code ──────────────────────────────────────
  if (text === "/start" || text.startsWith("/start ")) {
    const code = String(Math.floor(100000 + Math.random() * 900000))

    await sb.from("telegram_pending_codes").delete().eq("chat_id", chatId)
    await sb.from("telegram_pending_codes").insert({
      code,
      chat_id: chatId,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })

    await sendTelegram(BOT_TOKEN, chatId,
      `👋 Welcome to Unsubscribely!\n\nYour connection code is:\n\n🔑 ${code}\n\nPaste this in the app under Settings → Connect Telegram.\n\nExpires in 10 minutes.`
    )
    return jsonReply(200, { ok: true })
  }

  // ── Fast-path: KEEP_<uuid> ─────────────────────────────────────────────────
  const keepUuidMatch = text.match(/^KEEP_([0-9a-f-]{36})$/i)
  if (keepUuidMatch) {
    const subscriptionId = keepUuidMatch[1]
    if (!UUID_RE.test(subscriptionId)) {
      await sendTelegram(BOT_TOKEN, chatId, "❌ Invalid subscription ID.")
      return jsonReply(200, { ok: true })
    }

    const { data: subs } = await sb.from("subscriptions").select("name").eq("id", subscriptionId).limit(1)
    const subName = subs?.[0]?.name || "that subscription"

    await sb.from("agent_renewal_alerts")
      .update({ user_decision: "keep", decided_at: new Date().toISOString() })
      .eq("subscription_id", subscriptionId)
      .is("user_decision", null)

    await sendTelegram(BOT_TOKEN, chatId,
      `✅ Keeping ${subName}. For how long?\n\nReply:\nKEEP1_${subscriptionId} — 1 month\nKEEP3_${subscriptionId} — 3 months\nKEEP6_${subscriptionId} — 6 months\nKEEP12_${subscriptionId} — 1 year`
    )
    return jsonReply(200, { ok: true })
  }

  // ── Fast-path: KEEP<N>_<uuid> ─────────────────────────────────────────────
  const keepDurationMatch = text.match(/^KEEP(\d+)_([0-9a-f-]{36})$/i)
  if (keepDurationMatch) {
    const months = parseInt(keepDurationMatch[1])
    const subscriptionId = keepDurationMatch[2]
    if (!UUID_RE.test(subscriptionId) || ![1, 3, 6, 12].includes(months)) {
      await sendTelegram(BOT_TOKEN, chatId, "❌ Invalid option.")
      return jsonReply(200, { ok: true })
    }

    const { data: subs } = await sb.from("subscriptions").select("name").eq("id", subscriptionId).limit(1)
    const subName = subs?.[0]?.name || "that subscription"

    const keepUntil = new Date()
    keepUntil.setMonth(keepUntil.getMonth() + months)
    const keepUntilStr = keepUntil.toISOString().split("T")[0]

    await sb.from("agent_renewal_alerts")
      .update({ keep_until: keepUntilStr })
      .eq("subscription_id", subscriptionId)
      .eq("user_decision", "keep")

    const dateLabel = keepUntil.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    await sendTelegram(BOT_TOKEN, chatId, `✅ ${subName} locked in until ${dateLabel}. Vault will release payment.`)
    return jsonReply(200, { ok: true })
  }

  // ── Fast-path: CANCEL_<uuid> ───────────────────────────────────────────────
  const cancelUuidMatch = text.match(/^CANCEL_([0-9a-f-]{36})$/i)
  if (cancelUuidMatch) {
    const subscriptionId = cancelUuidMatch[1]
    if (!UUID_RE.test(subscriptionId)) {
      await sendTelegram(BOT_TOKEN, chatId, "❌ Invalid subscription ID.")
      return jsonReply(200, { ok: true })
    }

    const { data: existing } = await sb.from("agent_renewal_alerts").select("id").eq("subscription_id", subscriptionId).eq("user_decision", "cancel").limit(1)
    if (existing && existing.length > 0) {
      await sendTelegram(BOT_TOKEN, chatId, `⏳ Already cancelling. Reply "done" when finished.`)
      return jsonReply(200, { ok: true })
    }

    // Try to update existing alert with null decision
    const { data: updated } = await sb.from("agent_renewal_alerts")
      .update({ user_decision: "cancel", decided_at: new Date().toISOString() })
      .eq("subscription_id", subscriptionId)
      .is("user_decision", null)
      .select("id")

    // If no existing alert, insert a new one
    if (!updated || updated.length === 0) {
      await sb.from("agent_renewal_alerts").insert({
        subscription_id: subscriptionId,
        user_decision: "cancel",
        decided_at: new Date().toISOString(),
        alert_sent_at: new Date().toISOString(),
        alert_type: "user_initiated",
      })
    }

    await sendTelegram(BOT_TOKEN, chatId, "⏳ Got it! Starting cancellation...")
    triggerGuidedCancel(subscriptionId, chatId).catch((err) => {
      console.error("[webhook] guidedCancel error:", err.message)
    })
    return jsonReply(200, { ok: true })
  }

  // ── Fast-path: DONE_<uuid> ─────────────────────────────────────────────────
  const doneUuidMatch = text.match(/^DONE_([0-9a-f-]{36})$/i)
  if (doneUuidMatch) {
    const subscriptionId = doneUuidMatch[1]
    if (!UUID_RE.test(subscriptionId)) {
      await sendTelegram(BOT_TOKEN, chatId, "❌ Invalid subscription ID.")
      return jsonReply(200, { ok: true })
    }

    const { data: subs } = await sb.from("subscriptions").select("name, amount, currency").eq("id", subscriptionId).limit(1)
    const sub = subs?.[0]
    const subName = sub?.name || "that subscription"
    const amountStr = sub?.amount ? `${sub.currency || "USD"} ${Number(sub.amount).toFixed(2)}` : ""

    await sb.from("subscriptions").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_method: "guided" }).eq("id", subscriptionId)
    await sb.from("agent_renewal_alerts").update({ user_decision: "done", decided_at: new Date().toISOString() }).eq("subscription_id", subscriptionId).eq("user_decision", "cancel")

    const { data: vaults } = await sb.from("escrow_vaults").select("id, app_id, vault_type").eq("subscription_id", subscriptionId).eq("status", "locked").limit(1)
    if (vaults && vaults.length > 0) {
      await sb.from("escrow_vaults").update({ status: "killed", killed_at: new Date().toISOString() }).eq("id", vaults[0].id)
      // Try on-chain kill
      try {
        await killVaultOnChainInline(vaults[0])
      } catch (killErr) {
        console.warn(`[webhook] On-chain vault kill failed (DONE_uuid): ${killErr.message}`)
      }
    }

    const savingsMsg = amountStr ? `\n\n💰 You saved ${amountStr}/month!` : ""
    const vaultNote = (vaults && vaults.length > 0) ? "\n\n🔓 Vault killed - ALGO returning to your wallet." : ""
    await sendTelegram(BOT_TOKEN, chatId, `✅ ${subName} cancelled!${savingsMsg}${vaultNote}`)
    return jsonReply(200, { ok: true })
  }

  // ── DETERMINISTIC COMMAND HANDLERS (before AI) ───────────────────────────────
  // These handle cancel/done/keep commands directly without AI involvement.
  // This prevents the AI from misinterpreting or ignoring user intent.

  const lowerText = text.toLowerCase().trim()

  // ── "done" or "done <name>" or "done <name> <extra words>" ──────────────────
  if (lowerText === "done" || lowerText.startsWith("done ")) {
    // Strip "done " prefix and remove extra words like "release funds", "cancel it", etc.
    let nameHint = lowerText === "done" ? null : lowerText.slice(5).trim()
    // Remove common trailing phrases that aren't part of the subscription name
    if (nameHint) {
      nameHint = nameHint.replace(/\s+(release|kill|cancel|funds|vault|payment|it|now|please|pls).*$/i, "").trim()
    }
    await handleDoneCommand(sb, chatId, BOT_TOKEN, nameHint || null)
    return jsonReply(200, { ok: true })
  }

  // ── "cancel <name>" — start cancellation ───────────────────────────────────
  const cancelMatch = lowerText.match(/^cancel\s+(.+)$/)
  if (cancelMatch) {
    const searchName = cancelMatch[1].trim()
    await handleCancelCommand(sb, chatId, BOT_TOKEN, searchName)
    return jsonReply(200, { ok: true })
  }

  // ── "keep <name>" — keep subscription ──────────────────────────────────────
  const keepMatch = lowerText.match(/^keep\s+(.+)$/)
  if (keepMatch) {
    const searchName = keepMatch[1].trim()
    await handleKeepCommand(sb, chatId, BOT_TOKEN, searchName)
    return jsonReply(200, { ok: true })
  }

  // ── "start browser" / "start browser automation" — re-trigger cancel ───────
  if (/^start\s*(browser|automation)/i.test(lowerText)) {
    await handleBrowserCommand(sb, chatId, BOT_TOKEN)
    return jsonReply(200, { ok: true })
  }

  // ── PAY / CANCEL trial-guard decisions ─────────────────────────────────────
  const upperText = text.toUpperCase()
  if (upperText === "PAY" || upperText === "CANCEL") {
    const decision = upperText === "PAY" ? "pay" : "cancel"

    const { data: pending } = await sb
      .from("agent_pending_decisions")
      .select("id, vault_id, subscription_id")
      .eq("chat_id", chatId)
      .is("decision", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)

    if (pending && pending.length > 0) {
      await sb.from("agent_pending_decisions")
        .update({ decision, decided_at: new Date().toISOString() })
        .eq("id", pending[0].id)

      await sendTelegram(BOT_TOKEN, chatId,
        decision === "pay"
          ? "✅ Got it! The agent will release payment from your vault now."
          : "✅ Got it! The agent will cancel and return your ALGO."
      )
      return jsonReply(200, { ok: true })
    }
    // No pending decision — fall through to AI
  }

  // ── PRIMARY: Cerebras AI with full context ─────────────────────────────────
  try {
    const context = await fetchUserContext(sb, chatId)
    console.log(`[webhook] context for chat ${chatId}: ${context ? `found user ${context.userId}, ${context.subscriptions.length} subs` : "user not found"}`)

    // Build prompt even without context (for general chat / unconnected users)
    const systemPrompt = context
      ? buildSystemPrompt(context)
      : `You are the Unsubscribely AI assistant on Telegram. The user hasn't connected their account yet. Help them understand the platform: lock ALGO in escrow vaults, autonomous agent pays on billing day, cancel via Telegram. Tell them to connect at https://unsubly.xyz/settings. Be concise and friendly. Return JSON: {"reply": "your message", "action": null}`

    const aiResponse = await callCerebras(systemPrompt, text)
    console.log(`[webhook] cerebras response: ${aiResponse ? "got reply" : "null/failed"}`)

    if (aiResponse && aiResponse.reply) {
      await sendTelegram(BOT_TOKEN, chatId, aiResponse.reply)

      // If AI returned an action (for edge cases not caught by deterministic handlers)
      if (aiResponse.action && context) {
        await executeAction(aiResponse.action, sb, chatId, BOT_TOKEN, context)
      }

      return jsonReply(200, { ok: true })
    }
  } catch (err) {
    console.warn("[webhook] Cerebras AI failed:", err.message, err.stack)
  }

  // ── FALLBACK: General response ───────────────────────────────────────────────
  await sendTelegram(BOT_TOKEN, chatId,
    "🤖 Unsubscribely Agent\n\nI can help you:\n- \"cancel <name>\" to cancel a subscription\n- \"done\" or \"done <name>\" when you've cancelled\n- \"keep <name>\" to keep a subscription\n\nOr just ask me anything about your subscriptions!"
  )
  return jsonReply(200, { ok: true })

  } catch (fatalErr) {
    console.error("[webhook] FATAL:", fatalErr.message, fatalErr.stack)
    return jsonReply(200, { ok: true }) // Return 200 to Telegram so it doesn't retry
  }
}

// ─── Deterministic Command Handlers ──────────────────────────────────────────

async function handleDoneCommand(sb, chatId, botToken, nameHint) {
  const { data: profiles } = await sb.from("profiles").select("id").eq("telegram_chat_id", chatId).limit(1)
  const userId = profiles?.[0]?.id
  if (!userId) {
    await sendTelegram(botToken, chatId, "Connect your account first at https://unsubly.xyz/settings")
    return
  }

  // Get user's subscriptions
  const { data: userSubs } = await sb.from("subscriptions").select("id, name, amount, currency, status").eq("user_id", userId).limit(30)
  if (!userSubs || userSubs.length === 0) {
    await sendTelegram(botToken, chatId, "No subscriptions found.")
    return
  }

  // Find the subscription to mark as done
  let targetSub = null

  // Strategy 1: If nameHint provided, match by name
  if (nameHint) {
    targetSub = userSubs.find((s) =>
      s.name.toLowerCase().includes(nameHint) || nameHint.includes(s.name.toLowerCase())
    )
  }

  // Strategy 2: Find the most recent cancel-in-progress alert for an ACTIVE sub
  if (!targetSub) {
    const activeIds = userSubs.filter((s) => s.status === "active").map((s) => s.id)
    if (activeIds.length > 0) {
      const { data: cancelAlerts } = await sb
        .from("agent_renewal_alerts")
        .select("subscription_id, decided_at")
        .in("subscription_id", activeIds)
        .eq("user_decision", "cancel")
        .order("decided_at", { ascending: false })
        .limit(1)
      if (cancelAlerts && cancelAlerts.length > 0) {
        targetSub = userSubs.find((s) => s.id === cancelAlerts[0].subscription_id)
      }
    }
  }

  // Strategy 3: If nameHint matches any sub (even cancelled), use it
  if (!targetSub && nameHint) {
    targetSub = userSubs.find((s) =>
      s.name.toLowerCase().includes(nameHint) || nameHint.includes(s.name.toLowerCase())
    )
  }

  if (!targetSub) {
    await sendTelegram(botToken, chatId, "Which subscription did you cancel? Reply \"done <name>\".")
    return
  }

  // Execute the done flow
  const amountStr = targetSub.amount ? `${targetSub.currency || "USD"} ${Number(targetSub.amount).toFixed(2)}` : ""

  // Mark subscription cancelled
  await sb.from("subscriptions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_method: "guided" })
    .eq("id", targetSub.id)

  // Update alerts
  await sb.from("agent_renewal_alerts")
    .update({ user_decision: "done", decided_at: new Date().toISOString() })
    .eq("subscription_id", targetSub.id)
    .eq("user_decision", "cancel")
  await sb.from("agent_renewal_alerts")
    .update({ user_decision: "done", decided_at: new Date().toISOString() })
    .eq("subscription_id", targetSub.id)
    .is("user_decision", null)

  // Release/kill vault
  const { data: vaults } = await sb.from("escrow_vaults")
    .select("id, app_id, vault_type, amount")
    .eq("subscription_id", targetSub.id)
    .eq("status", "locked")
    .limit(1)

  let vaultMsg = ""
  let txid = null
  if (vaults && vaults.length > 0) {
    const vault = vaults[0]
    await sb.from("escrow_vaults")
      .update({ status: "killed", killed_at: new Date().toISOString() })
      .eq("id", vault.id)

    // Try on-chain release (returns ALGO to creator)
    try {
      txid = await releaseVaultOnChainInline(vault)
      const explorerUrl = `https://testnet.explorer.perawallet.app/tx/${txid}`
      vaultMsg = `\n\n🔓 Vault released! ALGO returned to your wallet.\n🔗 ${explorerUrl}`
    } catch (err) {
      console.warn(`[webhook] On-chain release failed: ${err.message}`)
      // Try kill as fallback
      try {
        txid = await killVaultOnChainInline(vault)
        const explorerUrl = `https://testnet.explorer.perawallet.app/tx/${txid}`
        vaultMsg = `\n\n🔓 Vault killed! ALGO returned.\n🔗 ${explorerUrl}`
      } catch (killErr) {
        console.warn(`[webhook] On-chain kill also failed: ${killErr.message}`)
        vaultMsg = `\n\n🔓 Vault marked as killed in DB. On-chain release pending (use Kill Switch in app).`
      }
    }
  }

  const savingsMsg = amountStr ? `\n\n💰 You saved ${amountStr}/month!` : ""
  await sendTelegram(botToken, chatId, `✅ ${targetSub.name} cancelled!${savingsMsg}${vaultMsg}`)

  // Write on-chain cancellation proof (zero-ALGO self-transfer with structured note)
  try {
    const proofTxid = await writeCancellationProofInline(targetSub.name, targetSub.id)
    if (proofTxid) {
      const proofUrl = `https://testnet.explorer.perawallet.app/tx/${proofTxid}`
      await sendTelegram(botToken, chatId, `🔗 Cancellation proof recorded on Algorand.\n${proofUrl}`)
    }
  } catch (proofErr) {
    console.warn(`[webhook] Cancellation proof failed (non-blocking): ${proofErr.message}`)
  }

  console.log(`[webhook] Done: ${targetSub.name} cancelled, txid: ${txid || "none"}`)
}

async function handleCancelCommand(sb, chatId, botToken, searchName) {
  const { data: profiles } = await sb.from("profiles").select("id").eq("telegram_chat_id", chatId).limit(1)
  const userId = profiles?.[0]?.id
  if (!userId) {
    await sendTelegram(botToken, chatId, "Connect your account first at https://unsubly.xyz/settings")
    return
  }

  const { data: subs } = await sb.from("subscriptions").select("id, name, service_username, service_password_enc").eq("user_id", userId).eq("status", "active")
  if (!subs || subs.length === 0) {
    await sendTelegram(botToken, chatId, "No active subscriptions found.")
    return
  }

  const match = subs.find((s) => s.name.toLowerCase().includes(searchName) || searchName.includes(s.name.toLowerCase()))
  if (!match) {
    const names = subs.map((s) => s.name).join(", ")
    await sendTelegram(botToken, chatId, `Couldn't find "${searchName}". Your active subs: ${names}`)
    return
  }

  // Create/update cancel alert
  const { data: existing } = await sb.from("agent_renewal_alerts").select("id").eq("subscription_id", match.id).eq("user_decision", "cancel").limit(1)
  if (!existing || existing.length === 0) {
    const { data: updated } = await sb.from("agent_renewal_alerts")
      .update({ user_decision: "cancel", decided_at: new Date().toISOString() })
      .eq("subscription_id", match.id).is("user_decision", null).select("id")
    if (!updated || updated.length === 0) {
      await sb.from("agent_renewal_alerts").insert({
        subscription_id: match.id,
        user_decision: "cancel",
        decided_at: new Date().toISOString(),
        alert_sent_at: new Date().toISOString(),
        alert_type: "user_initiated",
      })
    }
  }

  // Send acknowledgment
  await sendTelegram(botToken, chatId, `Starting cancellation for ${match.name}...`)

  // Call Railway agent for browser automation (it has Playwright installed)
  // Railway's /api/cancel runs guidedCancel which: tries browser -> sends screenshot -> falls back to manual steps
  const railwayUrl = process.env.OPENCLAW_RAILWAY_URL || "https://unsubscribely-agent-agent-production.up.railway.app"
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN
  try {
    const res = await fetch(`${railwayUrl}/api/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(gatewayToken ? { Authorization: `Bearer ${gatewayToken}` } : {}),
      },
      body: JSON.stringify({ subscription_id: match.id, chat_id: chatId }),
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      console.log(`[webhook] Triggered browser cancel via Railway for ${match.name}`)
      return // Railway will send screenshot + steps directly to Telegram
    }
    console.warn(`[webhook] Railway /api/cancel failed: ${res.status}`)
  } catch (err) {
    console.warn(`[webhook] Railway unreachable: ${err.message}`)
  }

  // Fallback: send manual cancel steps (Railway is down)
  await triggerGuidedCancel(match.id, chatId)
}

async function handleKeepCommand(sb, chatId, botToken, searchName) {
  const { data: profiles } = await sb.from("profiles").select("id").eq("telegram_chat_id", chatId).limit(1)
  const userId = profiles?.[0]?.id
  if (!userId) return

  const { data: subs } = await sb.from("subscriptions").select("id, name").eq("user_id", userId).eq("status", "active")
  if (!subs || subs.length === 0) return

  const match = subs.find((s) => s.name.toLowerCase().includes(searchName) || searchName.includes(s.name.toLowerCase()))
  if (match) {
    await sb.from("agent_renewal_alerts")
      .update({ user_decision: "keep", decided_at: new Date().toISOString() })
      .eq("subscription_id", match.id)
      .is("user_decision", null)
    await sendTelegram(botToken, chatId, `✅ Keeping ${match.name}.`)
  }
}

async function handleBrowserCommand(sb, chatId, botToken) {
  // Find the cancel-in-progress subscription
  const { data: profiles } = await sb.from("profiles").select("id").eq("telegram_chat_id", chatId).limit(1)
  const userId = profiles?.[0]?.id
  if (!userId) return

  const { data: subs } = await sb.from("subscriptions").select("id, name").eq("user_id", userId).eq("status", "active")
  if (!subs || subs.length === 0) {
    await sendTelegram(botToken, chatId, "No active subscriptions to cancel.")
    return
  }

  const subIds = subs.map((s) => s.id)
  const { data: cancelAlerts } = await sb.from("agent_renewal_alerts")
    .select("subscription_id")
    .in("subscription_id", subIds)
    .eq("user_decision", "cancel")
    .order("decided_at", { ascending: false })
    .limit(1)

  if (!cancelAlerts || cancelAlerts.length === 0) {
    await sendTelegram(botToken, chatId, "No cancellation in progress. Say \"cancel <name>\" first.")
    return
  }

  const targetSub = subs.find((s) => s.id === cancelAlerts[0].subscription_id)
  if (!targetSub) return

  await sendTelegram(botToken, chatId, `🤖 Starting browser automation for ${targetSub.name}...`)

  // Call Railway for browser automation
  const railwayUrl = process.env.OPENCLAW_RAILWAY_URL || "https://unsubscribely-agent-agent-production.up.railway.app"
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN
  try {
    const res = await fetch(`${railwayUrl}/api/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(gatewayToken ? { Authorization: `Bearer ${gatewayToken}` } : {}),
      },
      body: JSON.stringify({ subscription_id: targetSub.id, chat_id: chatId }),
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      console.log(`[webhook] Browser cancel triggered via Railway for ${targetSub.name}`)
      return
    }
    console.warn(`[webhook] Railway /api/cancel failed: ${res.status}`)
  } catch (err) {
    console.warn(`[webhook] Railway unreachable for browser: ${err.message}`)
  }

  await sendTelegram(botToken, chatId, `Browser automation unavailable. Cancel manually:`)
  await triggerGuidedCancel(targetSub.id, chatId)
}

// ─── On-chain vault release (returns ALGO to user) ───────────────────────────

async function releaseVaultOnChainInline(vault) {
  const mnemonic = process.env.AGENT_WALLET_MNEMONIC
  if (!mnemonic || mnemonic === "skip") throw new Error("AGENT_WALLET_MNEMONIC not set")

  const appId = Number(vault.app_id)
  if (!appId || appId <= 0) throw new Error(`Invalid app_id: ${appId}`)

  const network = (process.env.ALGO_NETWORK || "testnet").toLowerCase()
  const algodUrl = network === "mainnet"
    ? (process.env.ALGOD_MAINNET_URL || "https://mainnet-api.algonode.cloud")
    : (process.env.ALGOD_TESTNET_URL || "https://testnet-api.algonode.cloud")

  const agentAccount = algosdk.mnemonicToSecretKey(mnemonic.trim())
  const algodClient = new algosdk.Algodv2(process.env.ALGOD_TOKEN || "", algodUrl, "")

  const params = await algodClient.getTransactionParams().do()
  const minFee = Number(params.minFee ?? params.fee ?? 1000) || 1000

  // Detect vault version from on-chain state
  let isV2 = vault.vault_type === "agent_v2"
  try {
    const appInfo = await algodClient.getApplicationByID(appId).do()
    const gs = appInfo?.params?.["global-state"] ?? appInfo?.params?.globalState ?? []
    isV2 = gs.some(e => {
      try { return Buffer.from(e.key, "base64").toString("utf-8") === "cycle_index" } catch { return false }
    })
  } catch {}

  if (isV2) {
    // V2: atomic group [MBR payment + release(uint64)]
    const SEL_RELEASE_V2 = new Uint8Array([0x61, 0x17, 0xcc, 0xb8])
    const amountMicro = Math.round(Number(vault.amount || 0) * 1_000_000)

    let nextCycleIndex = 1
    try {
      const appInfo = await algodClient.getApplicationByID(appId).do()
      const gs = appInfo?.params?.["global-state"] ?? appInfo?.params?.globalState ?? []
      const entry = gs.find(e => {
        try { return Buffer.from(e.key, "base64").toString("utf-8") === "cycle_index" } catch { return false }
      })
      if (entry) nextCycleIndex = (entry.value?.uint ?? 0) + 1
    } catch {}

    const boxPrefix = Buffer.from("h:")
    const boxIndex = algosdk.encodeUint64(nextCycleIndex)
    const boxName = new Uint8Array(boxPrefix.length + boxIndex.length)
    boxName.set(boxPrefix, 0)
    boxName.set(boxIndex, boxPrefix.length)

    const BOX_MBR = 16100
    const appAddress = algosdk.getApplicationAddress(appId)

    const mbrTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: agentAccount.addr,
      receiver: appAddress,
      amount: BOX_MBR,
      suggestedParams: { ...params, fee: minFee, flatFee: true },
    })
    const releaseTxn = algosdk.makeApplicationCallTxnFromObject({
      sender: agentAccount.addr,
      suggestedParams: { ...params, fee: minFee * 2, flatFee: true },
      appIndex: appId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      appArgs: [SEL_RELEASE_V2, algosdk.encodeUint64(amountMicro)],
      boxes: [{ appIndex: appId, name: boxName }],
    })

    algosdk.assignGroupID([mbrTxn, releaseTxn])
    const signedMbr = mbrTxn.signTxn(agentAccount.sk)
    const signedRelease = releaseTxn.signTxn(agentAccount.sk)

    const sendRes = await algodClient.sendRawTransaction([signedMbr, signedRelease]).do()
    const txid = sendRes.txId ?? sendRes.txid ?? ""
    const confirmed = await algosdk.waitForConfirmation(algodClient, txid, 4)
    if (confirmed?.["pool-error"]) throw new Error(`pool-error: ${confirmed["pool-error"]}`)
    if (!(confirmed?.["confirmed-round"] || confirmed?.confirmedRound)) throw new Error("Never confirmed")
    console.log(`[webhook] V2 release succeeded: app ${appId}, txid: ${txid}`)
    return txid
  } else {
    // V1: single release() call
    const SEL_RELEASE = new Uint8Array([0x07, 0x6b, 0xbd, 0x4d])
    const txn = algosdk.makeApplicationCallTxnFromObject({
      sender: agentAccount.addr,
      suggestedParams: { ...params, fee: minFee * 2, flatFee: true },
      appIndex: appId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      appArgs: [SEL_RELEASE],
    })

    const signed = txn.signTxn(agentAccount.sk)
    const sendRes = await algodClient.sendRawTransaction(signed).do()
    const txid = sendRes.txId ?? sendRes.txid ?? ""
    const confirmed = await algosdk.waitForConfirmation(algodClient, txid, 4)
    if (confirmed?.["pool-error"]) throw new Error(`pool-error: ${confirmed["pool-error"]}`)
    if (!(confirmed?.["confirmed-round"] || confirmed?.confirmedRound)) throw new Error("Never confirmed")
    console.log(`[webhook] V1 release succeeded: app ${appId}, txid: ${txid}`)
    return txid
  }
}

// ─── Guided Cancel Trigger ───────────────────────────────────────────────────

/**
 * Trigger guided cancellation.
 * Sends cancel steps directly (inline). Does NOT call Railway to avoid
 * duplicate AI messages being sent to the user's chat.
 */
async function triggerGuidedCancel(subscriptionId, chatId) {
  // Send cancel steps directly from Vercel (no Railway, no dynamic import)
  // Railway agent was causing duplicate messages by running its own AI
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  if (!BOT_TOKEN || !chatId) return

  const sb = getServiceClient()
  if (!sb) return

  try {
    const { data: subs } = await sb.from("subscriptions").select("name, amount, currency").eq("id", subscriptionId).limit(1)
    const sub = subs?.[0]
    const subName = sub?.name || "your subscription"

    // Cancel URL catalog
    const cancelUrls = {
      "netflix": "https://www.netflix.com/cancelplan",
      "spotify": "https://www.spotify.com/account/subscription/",
      "hulu": "https://secure.hulu.com/account/cancel",
      "disney": "https://www.disneyplus.com/account/subscription",
      "youtube premium": "https://www.youtube.com/paid_memberships",
      "youtube": "https://www.youtube.com/paid_memberships",
      "apple music": "https://music.apple.com/account/settings",
      "duolingo": "https://www.duolingo.com/settings/super",
      "notion": "https://www.notion.so/my-integrations",
      "chatgpt": "https://chat.openai.com/#settings/Subscription",
      "claude": "https://claude.ai/settings/billing",
      "cursor": "https://www.cursor.com/settings",
      "lovable": "https://lovable.dev/settings/billing",
      "github": "https://github.com/settings/billing/plans",
      "figma": "https://www.figma.com/files/team/personal/billing",
      "canva": "https://www.canva.com/settings/billing-and-teams",
      "adobe": "https://account.adobe.com/plans",
      "google one": "https://one.google.com/storage",
      "amazon prime": "https://www.amazon.com/gp/primecentral",
      "linkedin": "https://www.linkedin.com/premium/manage/",
      "google ai": "https://one.google.com/storage",
      "domain": "https://domains.google.com/registrar/",
    }

    const cancelSteps = {
      "spotify": ["Sign in to your Spotify account", "Scroll to \"Available plans\" and pick \"Spotify Free\"", "Click \"Cancel Premium\" and confirm"],
      "netflix": ["Sign in if prompted", "Click \"Finish Cancellation\"", "Confirm, access continues until your billing date"],
      "youtube premium": ["Sign in with your Google account", "Click \"Manage membership\" then \"Deactivate\"", "Choose \"Cancel\" and confirm reason"],
      "youtube": ["Sign in with your Google account", "Click \"Manage membership\" then \"Deactivate\"", "Choose \"Cancel\" and confirm reason"],
      "duolingo": ["Sign in to Duolingo", "Open Super then Manage Subscription", "Click \"Cancel Subscription\" and confirm"],
      "apple music": ["Sign in with your Apple ID", "Open Settings then Subscriptions", "Click \"Cancel Subscription\" next to Apple Music"],
      "notion": ["Sign in to Notion", "Open Settings & Members then Plans", "Click \"Downgrade\" then \"Free\" and confirm"],
      "cursor": ["Sign in to Cursor", "Open Settings then Manage Subscription", "Click \"Cancel Plan\" and confirm"],
      "lovable": ["Sign in to Lovable", "Open Settings then Billing", "Click \"Cancel\" and confirm"],
      "github": ["Sign in to GitHub", "Open Settings then Billing & plans", "Click \"Downgrade\" or \"Cancel\" on the relevant plan"],
    }

    const q = subName.toLowerCase().trim()
    let cancelUrl = null
    let steps = null
    for (const [key, url] of Object.entries(cancelUrls)) {
      if (q.includes(key) || key.includes(q)) { cancelUrl = url; break }
    }
    for (const [key, s] of Object.entries(cancelSteps)) {
      if (q.includes(key) || key.includes(q)) { steps = s; break }
    }

    let msg
    if (steps && cancelUrl) {
      const stepsText = steps.map((s, i) => `${i + 1}. ${s}`).join("\n")
      msg = `To cancel ${subName}:\n${stepsText}\n\nGo to: ${cancelUrl}\n\nReply "done" when you've cancelled.`
    } else if (cancelUrl) {
      msg = `To cancel ${subName}:\nGo to: ${cancelUrl}\nCancel your subscription from account settings.\n\nReply "done" when you've cancelled.`
    } else {
      msg = `To cancel ${subName}:\nGo to ${subName}'s website, open account settings, and cancel your subscription.\n\nReply "done" when you've cancelled.`
    }

    await sendTelegram(BOT_TOKEN, chatId, msg)
    console.log(`[webhook] Sent cancel instructions for ${subName}`)
  } catch (err) {
    console.warn("[webhook] Cancel instructions failed:", err.message)
    await sendTelegram(BOT_TOKEN, chatId, `Reply "done" when you've cancelled the subscription.`)
  }
}

// ─── Export ──────────────────────────────────────────────────────────────────

export default telegramWebhookHandler
export const config = { api: { bodyParser: false } }
