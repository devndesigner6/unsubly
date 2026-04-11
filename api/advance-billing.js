import { createClient } from "@supabase/supabase-js"

/**
 * POST /api/advance-billing
 * Advances next_billing_date for subscriptions that are past due,
 * scoped to the authenticated user (uses their JWT — respects RLS).
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const authHeader = req.headers.authorization || ""
  const token = authHeader.replace("Bearer ", "")

  if (!token) {
    return res.status(401).json({ error: "Missing authorization token" })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: "Missing Supabase configuration" })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  // Verify the user session
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return res.status(401).json({ error: "Invalid token" })
  }

  // Fetch past-due active subscriptions for this user
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split("T")[0]

  const { data: subs, error: fetchError } = await supabase
    .from("subscriptions")
    .select("id, next_billing_date, billing_cycle")
    .eq("user_id", user.id)
    .in("status", ["active", "trial"])
    .lt("next_billing_date", todayStr)

  if (fetchError) {
    return res.status(500).json({ error: fetchError.message })
  }

  if (!subs || subs.length === 0) {
    return res.status(200).json({ advanced: 0, message: "No past-due subscriptions" })
  }

  const cycleMap = {
    weekly: 7,
    monthly: null, // handled specially
    quarterly: null,
    yearly: null,
  }

  function advanceDate(dateStr, cycle) {
    let d = new Date(dateStr + "T00:00:00")
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Advance until the date is today or in the future
    while (d < today) {
      if (cycle === "weekly") {
        d.setDate(d.getDate() + 7)
      } else if (cycle === "monthly") {
        d.setMonth(d.getMonth() + 1)
      } else if (cycle === "quarterly") {
        d.setMonth(d.getMonth() + 3)
      } else if (cycle === "yearly") {
        d.setFullYear(d.getFullYear() + 1)
      } else {
        break
      }
    }
    return d.toISOString().split("T")[0]
  }

  const updates = subs.map((sub) => ({
    id: sub.id,
    next_billing_date: advanceDate(sub.next_billing_date, sub.billing_cycle),
  }))

  let advanced = 0
  for (const update of updates) {
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({ next_billing_date: update.next_billing_date })
      .eq("id", update.id)
      .eq("user_id", user.id)

    if (!updateError) advanced++
  }

  return res.status(200).json({
    advanced,
    total: subs.length,
    message: `Advanced ${advanced} of ${subs.length} past-due subscription(s)`,
  })
}
