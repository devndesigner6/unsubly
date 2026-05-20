/**
 * POST /api/save-credentials
 *
 * Saves service login credentials for a subscription.
 * Password is AES-256-GCM encrypted server-side before storage.
 * The plaintext password is NEVER stored or logged.
 *
 * Body: { subscription_id, username, password }
 * Auth: Bearer JWT (Supabase user token)
 *
 * Returns: { ok: true } — never returns the password back
 */

import { createClient } from "@supabase/supabase-js"
import { createCipheriv, randomBytes } from "node:crypto"

export const config = { api: { bodyParser: false } }

function jsonRes(res, status, data) {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify(data))
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

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns base64(iv + authTag + ciphertext)
 */
function encryptPassword(plaintext, keyHex) {
  const key = Buffer.from(keyHex, "hex")
  if (key.length !== 32) throw new Error("SUBSCRIPTION_CREDS_KEY must be 64 hex chars (32 bytes)")
  const iv = randomBytes(12) // 96-bit IV for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  // Pack: iv(12) + authTag(16) + ciphertext
  const packed = Buffer.concat([iv, authTag, encrypted])
  return packed.toString("base64")
}

async function handler(req, res) {
  if (req.method !== "POST") return jsonRes(res, 405, { error: "Method not allowed" })

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) return jsonRes(res, 401, { error: "Unauthorized" })
  const userJwt = authHeader.replace("Bearer ", "")

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const CREDS_KEY    = process.env.SUBSCRIPTION_CREDS_KEY

  if (!SUPABASE_URL || !SUPABASE_KEY || !SERVICE_KEY) {
    return jsonRes(res, 500, { error: "Server not configured" })
  }
  if (!CREDS_KEY) {
    return jsonRes(res, 500, { error: "SUBSCRIPTION_CREDS_KEY not configured on server" })
  }

  // Verify user JWT
  const userClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return jsonRes(res, 401, { error: "Invalid token" })

  const body = await readBody(req)
  const { subscription_id, username, password } = body

  if (!subscription_id || typeof subscription_id !== "string") {
    return jsonRes(res, 400, { error: "subscription_id is required" })
  }
  if (!username || typeof username !== "string" || username.trim().length === 0) {
    return jsonRes(res, 400, { error: "username is required" })
  }
  if (!password || typeof password !== "string" || password.length === 0) {
    return jsonRes(res, 400, { error: "password is required" })
  }

  // Rate limit: 10 credential saves per hour per user
  const svcClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  let rateOk = true
  try {
    const { data } = await svcClient.rpc("rate_limit_check", {
      p_bucket: "save_credentials",
      p_key: user.id,
      p_limit: 10,
      p_window_seconds: 3600,
    })
    if (data === false) rateOk = false
  } catch {
    // fail open if RPC missing
  }
  if (!rateOk) {
    return jsonRes(res, 429, { error: "Too many credential saves. Try again in an hour." })
  }

  // Verify the subscription belongs to this user
  const { data: sub } = await svcClient
    .from("subscriptions")
    .select("id, user_id")
    .eq("id", subscription_id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!sub) {
    return jsonRes(res, 404, { error: "Subscription not found or not yours" })
  }

  // Encrypt the password server-side
  let encryptedPassword
  try {
    encryptedPassword = encryptPassword(password, CREDS_KEY)
  } catch (err) {
    console.error("[save-credentials] Encryption failed:", err.message)
    return jsonRes(res, 500, { error: "Failed to encrypt credentials" })
  }

  // Save to DB — never log or return the plaintext password
  const { error: updateErr } = await svcClient
    .from("subscriptions")
    .update({
      service_username: username.trim(),
      service_password_enc: encryptedPassword,
      credentials_set_at: new Date().toISOString(),
    })
    .eq("id", subscription_id)
    .eq("user_id", user.id)

  if (updateErr) {
    console.error("[save-credentials] DB update failed:", updateErr.message)
    return jsonRes(res, 500, { error: "Failed to save credentials" })
  }

  // Return only success — never echo back the password
  return jsonRes(res, 200, { ok: true, credentials_set: true })
}

export default handler
export { handler as saveCredentialsHandler }
