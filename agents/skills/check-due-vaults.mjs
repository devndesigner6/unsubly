/**
 * Skill: check-due-vaults
 *
 * Queries Supabase (service role key — bypasses RLS) for locked escrow
 * vaults whose subscription billing date is today or earlier.
 *
 * Returns { vaults, subscriptions } where each vault is enriched with
 * its parent subscription metadata.
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

export async function checkDueVaults() {
  const sb = getClient()
  const today = new Date().toISOString().slice(0, 10)

  // Fetch active subscriptions whose next billing date is due
  const { data: subs, error: subErr } = await sb
    .from("subscriptions")
    .select("id, name, user_id, next_billing_date, billing_cycle, amount, currency, category")
    .eq("status", "active")
    .lte("next_billing_date", today)

  if (subErr) throw new Error(`Supabase subscriptions query failed: ${subErr.message}`)
  if (!subs?.length) return { vaults: [], subscriptions: [], today }

  const subIds = subs.map((s) => s.id)

  // Fetch locked vaults for those subscriptions
  const { data: vaults, error: vaultErr } = await sb
    .from("escrow_vaults")
    .select("id, app_id, app_address, subscription_id, user_id, amount, vault_type, asa_id, network")
    .in("subscription_id", subIds)
    .eq("status", "locked")

  if (vaultErr) throw new Error(`Supabase vaults query failed: ${vaultErr.message}`)

  return {
    vaults: vaults || [],
    subscriptions: subs,
    today,
  }
}
