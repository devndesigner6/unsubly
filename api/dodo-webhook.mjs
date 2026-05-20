/**
 * POST /api/dodo-webhook
 *
 * Receives payment confirmation from Dodo Payments.
 * On successful payment, upgrades the user's plan to "pro" in Supabase.
 *
 * Dodo sends: { event: "payment.succeeded", data: { customer: { email }, metadata: { plan } } }
 */

import { createClient } from "@supabase/supabase-js"
import { createHmac } from "node:crypto"

function getServiceClient() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on("data", (c) => chunks.push(c))
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
    req.on("error", reject)
  })
}

function verifyWebhook(payload, signature, secret) {
  if (!secret || !signature) return false
  const expected = createHmac("sha256", secret).update(payload).digest("hex")
  return signature === expected || signature === `sha256=${expected}`
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405
    return res.end("Method not allowed")
  }

  const body = await readBody(req)

  // Verify webhook signature (optional but recommended)
  const secret = process.env.DODO_WEBHOOK_SECRET
  const signature = req.headers["x-dodo-signature"] || req.headers["webhook-signature"] || ""
  if (secret && signature && !verifyWebhook(body, signature, secret)) {
    console.warn("[dodo-webhook] Invalid signature")
    res.statusCode = 401
    return res.end(JSON.stringify({ error: "Invalid signature" }))
  }

  let event
  try {
    event = JSON.parse(body)
  } catch {
    res.statusCode = 400
    return res.end(JSON.stringify({ error: "Invalid JSON" }))
  }

  console.log(`[dodo-webhook] Received event: ${event.event_type || event.type || "unknown"}`)

  // Handle payment success
  const eventType = event.event_type || event.type || ""
  if (eventType === "payment.succeeded" || eventType === "payment_succeeded" || eventType === "order.completed") {
    const customerEmail = event.data?.customer?.email || event.data?.email || null
    const paymentId = event.data?.payment_id || event.data?.id || null

    if (!customerEmail) {
      console.warn("[dodo-webhook] No customer email in payload")
      res.statusCode = 200
      return res.end(JSON.stringify({ ok: true, note: "No email found" }))
    }

    const sb = getServiceClient()
    if (!sb) {
      res.statusCode = 500
      return res.end(JSON.stringify({ error: "DB not configured" }))
    }

    // Find user by email in auth.users (via profiles or direct lookup)
    const { data: users } = await sb.auth.admin.listUsers()
    const user = users?.users?.find((u) => u.email === customerEmail)

    if (!user) {
      console.warn(`[dodo-webhook] User not found for email: ${customerEmail}`)
      // Store the payment anyway so we can reconcile later
      await sb.from("profiles").update({
        plan: "pro",
        plan_purchased_at: new Date().toISOString(),
        dodo_payment_id: paymentId,
      }).eq("email", customerEmail).catch(() => {})
      res.statusCode = 200
      return res.end(JSON.stringify({ ok: true, note: "User not found by email, attempted profile update" }))
    }

    // Upgrade user to pro
    const { error } = await sb.from("profiles").update({
      plan: "pro",
      plan_purchased_at: new Date().toISOString(),
      dodo_payment_id: paymentId,
    }).eq("id", user.id)

    if (error) {
      console.error(`[dodo-webhook] Failed to upgrade user ${user.id}: ${error.message}`)
      res.statusCode = 500
      return res.end(JSON.stringify({ error: "Failed to upgrade" }))
    }

    console.log(`[dodo-webhook] Upgraded user ${user.id} (${customerEmail}) to pro`)
    res.statusCode = 200
    return res.end(JSON.stringify({ ok: true, upgraded: user.id }))
  }

  // Acknowledge other events
  res.statusCode = 200
  res.end(JSON.stringify({ ok: true, ignored: eventType }))
}

export const config = { api: { bodyParser: false } }
