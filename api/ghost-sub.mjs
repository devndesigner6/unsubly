/**
 * POST /api/ghost-sub
 *
 * Called by the Ghost Sub browser extension to create a subscription
 * entry from a detected checkout page.
 *
 * Auth: Bearer token (Supabase session token)
 * Body: { name, amount, currency, billing_cycle, category, url, domain }
 */

import { createClient } from "@supabase/supabase-js"

async function getAuthedUser(req) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) return null
  const token = authHeader.slice(7)
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null
  const client = createClient(url, key, { auth: { persistSession: false } })
  const { data: { user }, error } = await client.auth.getUser(token)
  if (error || !user) return null
  return user
}

export default async function handler(req, res) {
  // CORS for extension
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

  if (req.method === "OPTIONS") {
    res.statusCode = 204
    return res.end()
  }

  if (req.method !== "POST") {
    res.statusCode = 405
    return res.end(JSON.stringify({ error: "Method not allowed" }))
  }

  const user = await getAuthedUser(req)
  if (!user) {
    res.statusCode = 401
    return res.end(JSON.stringify({ error: "Unauthorized — invalid or expired token" }))
  }

  let body = {}
  try {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    body = JSON.parse(Buffer.concat(chunks).toString())
  } catch {
    res.statusCode = 400
    return res.end(JSON.stringify({ error: "Invalid JSON" }))
  }

  const { name, amount, currency, billing_cycle, category, url, domain } = body

  if (!name) {
    res.statusCode = 400
    return res.end(JSON.stringify({ error: "name is required" }))
  }

  // Check for duplicates
  const sbUrl = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!sbUrl || !serviceKey) {
    res.statusCode = 500
    return res.end(JSON.stringify({ error: "Server not configured" }))
  }

  const sb = createClient(sbUrl, serviceKey, { auth: { persistSession: false } })

  // Check if subscription already exists for this user
  const { data: existing } = await sb
    .from("subscriptions")
    .select("id, name")
    .eq("user_id", user.id)
    .ilike("name", name)
    .limit(1)

  if (existing && existing.length > 0) {
    res.statusCode = 200
    res.setHeader("Content-Type", "application/json")
    return res.end(JSON.stringify({
      ok: true,
      duplicate: true,
      message: `${name} is already tracked`,
      subscription_id: existing[0].id,
    }))
  }

  // Calculate next billing date (1 month from now)
  const nextBilling = new Date()
  if (billing_cycle === "yearly") nextBilling.setFullYear(nextBilling.getFullYear() + 1)
  else if (billing_cycle === "weekly") nextBilling.setDate(nextBilling.getDate() + 7)
  else nextBilling.setMonth(nextBilling.getMonth() + 1)

  // Create subscription
  const { data: sub, error: insertErr } = await sb
    .from("subscriptions")
    .insert({
      user_id: user.id,
      name,
      amount: amount || 0,
      currency: currency || "USD",
      billing_cycle: billing_cycle || "monthly",
      category: category || "Other",
      url: url || null,
      next_billing_date: nextBilling.toISOString().split("T")[0],
      status: "active",
      source: "extension",
      alert_enabled: true,
      alert_days: 3,
    })
    .select("id, name")
    .single()

  if (insertErr) {
    res.statusCode = 500
    return res.end(JSON.stringify({ error: insertErr.message }))
  }

  res.statusCode = 200
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify({
    ok: true,
    message: `${name} added to Unsubscribely`,
    subscription_id: sub.id,
    next_step: "Open the app to create an escrow vault for this subscription.",
  }))
}
