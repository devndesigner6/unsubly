import { createClient } from "@supabase/supabase-js"

/**
 * POST /api/advance-billing
 * Advances next_billing_date for past-due subscriptions.
 * Skips any subscription that has a LOCKED vault — the agent must
 * release the vault first before the billing date is moved forward.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const authHeader = req.headers.authorization || ""
  const token = authHeader.replace("Bearer ", "")
  if (!token) return res.status(401).json({ error: "Missing authorization token" })

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: "Missing Supabase configuration" })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: "Invalid token" })

  const todayStr = new Date().toISOString().split("T")[0]

  // Fetch past-due active subscriptions
  const { data: subs, error: fetchError } = await supabase
    .from("subscriptions")
    .select("id, next_billing_date, billing_cycle")
    .eq("user_id", user.id)
    .in("status", ["active", "trial"])
    .lt("next_billing_date", todayStr)

  if (fetchError) return res.status(500).json({ error: fetchError.message })
  if (!subs || subs.length === 0) {
    return res.status(200).json({ advanced: 0, message: "No past-due subscriptions" })
  }

  // Skip subscriptions that still have a locked vault — the agent releases those
  const subIds = subs.map((s) => s.id)
  const { data: lockedVaults } = await supabase
    .from("escrow_vaults")
    .select("subscription_id")
    .in("subscription_id", subIds)
    .eq("status", "locked")

  const lockedSubIds = new Set((lockedVaults || []).map((v) => v.subscription_id))
  const subsToAdvance = subs.filter((s) => !lockedSubIds.has(s.id))

  if (subsToAdvance.length === 0) {
    return res.status(200).json({
      advanced: 0,
      skipped: subs.length,
      message: "All past-due subscriptions have locked vaults — agent must release them first",
    })
  }

  function advanceDate(dateStr, cycle) {
    let d = new Date(dateStr + "T00:00:00")
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    while (d < now) {
      if (cycle === "weekly") d.setDate(d.getDate() + 7)
      else if (cycle === "monthly") d.setMonth(d.getMonth() + 1)
      else if (cycle === "quarterly") d.setMonth(d.getMonth() + 3)
      else if (cycle === "yearly") d.setFullYear(d.getFullYear() + 1)
      else break
    }
    return d.toISOString().split("T")[0]
  }

  let advanced = 0
  for (const sub of subsToAdvance) {
    const { error } = await supabase
      .from("subscriptions")
      .update({ next_billing_date: advanceDate(sub.next_billing_date, sub.billing_cycle) })
      .eq("id", sub.id)
      .eq("user_id", user.id)
    if (!error) advanced++
  }

  return res.status(200).json({
    advanced,
    skipped: lockedSubIds.size,
    total: subs.length,
    message: `Advanced ${advanced} subscription(s). Skipped ${lockedSubIds.size} with locked vaults.`,
  })
}
