/**
 * Skill: advance-billing
 * Updates next_billing_date for a subscription after a successful vault release.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

function advanceDate(dateStr, cycle) {
  const d = new Date(dateStr + "T00:00:00")
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  while (d <= now) {
    if (cycle === "weekly")         d.setDate(d.getDate() + 7)
    else if (cycle === "monthly")   d.setMonth(d.getMonth() + 1)
    else if (cycle === "quarterly") d.setMonth(d.getMonth() + 3)
    else if (cycle === "yearly")    d.setFullYear(d.getFullYear() + 1)
    else break
  }
  return d.toISOString().split("T")[0]
}

export async function advanceBilling(subscriptionId, billingCycle, currentBillingDate, userId) {
  if (!subscriptionId) return

  const nextDate = advanceDate(currentBillingDate, billingCycle)

  try {
    // Always filter by subscription id. userId is optional extra safety guard.
    let url = `${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${subscriptionId}`
    if (userId) url += `&user_id=eq.${userId}`

    const res = await fetch(url,
      {
        method: "PATCH",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          next_billing_date: nextDate,
          last_billed_at: new Date().toISOString(),
        }),
      }
    )

    if (res.ok) {
      console.log(`[advance-billing] ${subscriptionId} → next billing: ${nextDate}`)
    } else {
      console.warn(`[advance-billing] Failed: ${res.status}`)
    }
  } catch (err) {
    console.warn(`[advance-billing] Error: ${err.message}`)
  }
}
