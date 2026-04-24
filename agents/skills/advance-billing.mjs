/**
 * Skill: advance-billing
 *
 * After a vault is released, advances the subscription's next_billing_date
 * forward by one billing cycle (weekly / monthly / quarterly / yearly).
 *
 * Uses the service role key to bypass RLS.
 */

import { createClient } from "@supabase/supabase-js"

let _client = null
function getClient() {
  if (_client) return _client
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
  _client = createClient(url, key, { auth: { persistSession: false } })
  return _client
}

/**
 * Compute the next billing date from the current one + cycle.
 */
function computeNextDate(currentDateStr, cycle) {
  const d = new Date(currentDateStr + "T00:00:00Z")
  switch (cycle) {
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7)
      break
    case "quarterly":
      d.setUTCMonth(d.getUTCMonth() + 3)
      break
    case "yearly":
      d.setUTCFullYear(d.getUTCFullYear() + 1)
      break
    case "monthly":
    default:
      d.setUTCMonth(d.getUTCMonth() + 1)
      break
  }
  return d.toISOString().slice(0, 10)
}

/**
 * @param {object} subscription — subscription row with id, next_billing_date, billing_cycle
 * @returns {Promise<{nextBillingDate: string}>}
 */
export async function advanceBilling(subscription) {
  const sb = getClient()
  const nextDate = computeNextDate(
    subscription.next_billing_date || new Date().toISOString().slice(0, 10),
    subscription.billing_cycle || "monthly",
  )

  const { error } = await sb
    .from("subscriptions")
    .update({
      next_billing_date: nextDate,
      last_billed_at: new Date().toISOString(),
    })
    .eq("id", subscription.id)

  if (error) {
    console.error(`[advance-billing] Failed to advance billing for ${subscription.id}: ${error.message}`)
    throw error
  }

  return { nextBillingDate: nextDate }
}
