/**
 * Skill: check-due-vaults
 * Queries Supabase for all locked vaults whose subscription billing date
 * is today or earlier. Uses service role key to bypass RLS.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
  })
  if (!res.ok) throw new Error(`Supabase GET ${path} failed: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function checkDueVaults() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
  }

  const today = new Date().toISOString().split("T")[0]

  // Get all active subscriptions due today or earlier
  const subs = await sbGet(
    `subscriptions?status=eq.active&next_billing_date=lte.${today}&select=id,name,user_id,next_billing_date,billing_cycle`
  )

  if (!Array.isArray(subs) || subs.length === 0) {
    console.log(`[check-due-vaults] No subscriptions due on or before ${today}`)
    return []
  }

  console.log(`[check-due-vaults] ${subs.length} subscription(s) due`)

  const subIds = subs.map(s => s.id).filter(Boolean)

  if (subIds.length === 0) {
    console.log(`[check-due-vaults] No valid subscription IDs found`)
    return []
  }

  // Get locked vaults for those subscriptions
  const vaults = await sbGet(
    `escrow_vaults?status=eq.locked&subscription_id=in.(${subIds.join(",")})&select=id,app_id,app_address,escrow_address,subscription_id,user_id,amount,vault_type,asset_id`
  )

  if (!Array.isArray(vaults) || vaults.length === 0) {
    console.log(`[check-due-vaults] No locked vaults found for due subscriptions`)
    return []
  }

  // Attach subscription info to each vault
  return vaults.map(vault => ({
    ...vault,
    subscription: subs.find(s => s.id === vault.subscription_id) || null,
  }))
}
