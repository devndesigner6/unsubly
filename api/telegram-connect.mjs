/**
 * POST /api/telegram-connect
 *
 * Verifies a 6-digit code from the Telegram bot and saves the user's
 * chat_id to their profile. Called from the Settings page.
 *
 * Body: { code: "123456" }
 * Auth: Bearer JWT (Supabase user token)
 */

import { createClient } from "@supabase/supabase-js"

// Rate limiting: max 5 attempts per user per 10 minutes
const _attempts = new Map() // userId -> { count, firstAt }
const RATE_WINDOW_MS = 10 * 60_000
const RATE_MAX = 5

function checkRateLimit(userId) {
  const now = Date.now()
  const entry = _attempts.get(userId)
  if (!entry || now - entry.firstAt > RATE_WINDOW_MS) {
    _attempts.set(userId, { count: 1, firstAt: now })
    return true
  }
  if (entry.count >= RATE_MAX) return false
  entry.count++
  return true
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on("data", (c) => chunks.push(c))
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
    req.on("error", reject)
  })
}

function jsonRes(res, status, data) {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify(data))
}

export async function telegramConnectHandler(req, res) {
  if (req.method !== "POST") return jsonRes(res, 405, { error: "Method not allowed" })

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) return jsonRes(res, 401, { error: "Unauthorized" })
  const userJwt = authHeader.replace("Bearer ", "")

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SUPABASE_KEY || !SERVICE_KEY) {
    return jsonRes(res, 500, { error: "Server not configured" })
  }

  // Verify user JWT
  const userClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return jsonRes(res, 401, { error: "Invalid token" })

  // Rate limit: prevent brute-force on 6-digit codes
  if (!checkRateLimit(user.id)) {
    return jsonRes(res, 429, { error: "Too many attempts. Try again in 10 minutes." })
  }

  // Parse body
  let body
  try { body = JSON.parse(await readBody(req)) } catch {
    return jsonRes(res, 400, { error: "Invalid JSON" })
  }
  const { code } = body
  if (!code || typeof code !== "string" || !/^\d{6}$/.test(code)) {
    return jsonRes(res, 400, { error: "Code must be a 6-digit number" })
  }

  // Look up code using service client (bypasses RLS on telegram_pending_codes)
  const svcClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  const { data: pending } = await svcClient
    .from("telegram_pending_codes")
    .select("chat_id, expires_at")
    .eq("code", code)
    .single()

  if (!pending) return jsonRes(res, 400, { error: "Invalid or expired code. Send /start to @unsublyybot to get a new one." })
  if (new Date(pending.expires_at) < new Date()) {
    await svcClient.from("telegram_pending_codes").delete().eq("code", code)
    return jsonRes(res, 400, { error: "Code expired. Send /start to @unsublyybot to get a new one." })
  }

  // Save chat_id to user's profile
  const { error: updateErr } = await svcClient
    .from("profiles")
    .update({ telegram_chat_id: pending.chat_id })
    .eq("id", user.id)

  if (updateErr) return jsonRes(res, 500, { error: "Failed to save Telegram connection" })

  // Clean up the used code
  await svcClient.from("telegram_pending_codes").delete().eq("code", code)

  // Send confirmation message to user's Telegram
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  if (BOT_TOKEN) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: pending.chat_id,
        text: "🎉 Connected! You'll now receive personal notifications from the OpenClaw agent whenever your vaults are released or need your attention.",
      }),
    })
  }

  return jsonRes(res, 200, { ok: true, chat_id: pending.chat_id })
}

// Vercel serverless: must be export default
export default telegramConnectHandler
export const config = { api: { bodyParser: false } }
