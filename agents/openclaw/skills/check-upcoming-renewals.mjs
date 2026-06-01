/**
 * check-upcoming-renewals.mjs
 *
 * Checks for subscriptions renewing in exactly 3 days and sends a
 * pre-renewal Telegram alert asking the user to KEEP or CANCEL.
 *
 * Inserts a row into agent_renewal_alerts with user_decision = null.
 * Skips if an alert was already sent today for that subscription.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN

function sbFetch(path, opts = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  })
}

async function sendTelegram(chatId, text) {
  if (!BOT_TOKEN || !chatId) return
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    })
  } catch (err) {
    console.warn("[renewals] Telegram send failed:", err.message)
  }
}

/**
 * Returns ISO date string for today + N days.
 */
function dateInDays(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split("T")[0]
}

export async function checkUpcomingRenewals() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.warn("[renewals] Missing SUPABASE_URL or SERVICE_KEY — skipping")
    return
  }

  // Check today (due now or overdue), 1-day, and 3-day windows
  await checkOverdueSubscriptions()
  await checkRenewalWindow(0, true)
  await checkRenewalWindow(1, true)
  await checkRenewalWindow(3, false)
}

/**
 * Check for subscriptions that are OVERDUE (next_billing_date < today).
 * Only alert for subscriptions that have a LOCKED vault.
 */
async function checkOverdueSubscriptions() {
  const today = new Date().toISOString().split("T")[0]

  const subsRes = await sbFetch(
    `/subscriptions?next_billing_date=lt.${today}&status=eq.active&select=id,name,amount,currency,billing_cycle,user_id,next_billing_date`
  )
  if (!subsRes.ok) return
  const subs = await subsRes.json()
  if (!subs || subs.length === 0) return

  console.log(`[renewals] ${subs.length} overdue subscription(s) found, checking for vaults...`)

  for (const sub of subs) {
    try {
      // Only alert if subscription has a locked vault
      const vaultRes = await sbFetch(`/escrow_vaults?subscription_id=eq.${sub.id}&status=eq.locked&select=id&limit=1`)
      const vaults = vaultRes.ok ? await vaultRes.json() : []
      if (!vaults || vaults.length === 0) continue // No vault = no alert

      // Check if alert already sent (ever, for overdue type)
      const alertCheckRes = await sbFetch(
        `/agent_renewal_alerts?subscription_id=eq.${sub.id}&alert_type=eq.overdue&select=id&limit=1`
      )
      if (alertCheckRes.ok) {
        const existing = await alertCheckRes.json()
        if (existing && existing.length > 0) continue
      }

      // Get user's Telegram chat_id
      const profileRes = await sbFetch(`/profiles?id=eq.${sub.user_id}&select=telegram_chat_id`)
      const profiles = profileRes.ok ? await profileRes.json() : []
      const chatId = profiles?.[0]?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID
      if (!chatId) continue

      // Insert alert
      await sbFetch("/agent_renewal_alerts", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          subscription_id: sub.id,
          alert_sent_at: new Date().toISOString(),
          alert_type: "overdue",
          user_decision: null,
        }),
      })

      const amountStr = sub.amount ? `${sub.currency || "USD"} ${Number(sub.amount).toFixed(2)}` : "unknown"
      const msg = `⚠️ OVERDUE\n\n${sub.name} was due on ${sub.next_billing_date} (${amountStr}).\n\nReply "keep ${sub.name.toLowerCase()}" to pay now\nReply "cancel ${sub.name.toLowerCase()}" to cancel it`

      await sendTelegram(chatId, msg)
      console.log(`[renewals] Sent overdue alert for ${sub.name}`)
    } catch (err) {
      console.warn(`[renewals] Error processing overdue ${sub.name}: ${err.message}`)
    }
  }
}

/**
 * @param {number} daysAhead - how many days before renewal to alert
 * @param {boolean} isUrgent - true for 1-day alert (last chance message)
 */
async function checkRenewalWindow(daysAhead, isUrgent) {
  const targetDate = dateInDays(daysAhead)
  const todayStart = new Date().toISOString().split("T")[0] + "T00:00:00.000Z"
  const alertType = daysAhead === 0 ? "today" : isUrgent ? "1day" : "3day"

  console.log(`[renewals] Checking ${daysAhead}-day window for ${targetDate}`)

  // Fetch active subscriptions due in N days
  const subsRes = await sbFetch(
    `/subscriptions?next_billing_date=eq.${targetDate}&status=eq.active&select=id,name,amount,currency,billing_cycle,user_id,next_billing_date`
  )
  if (!subsRes.ok) {
    console.warn(`[renewals] Failed to fetch subscriptions for ${daysAhead}-day window:`, subsRes.status)
    return
  }
  const subs = await subsRes.json()

  if (!subs || subs.length === 0) {
    console.log(`[renewals] No subscriptions due in ${daysAhead} days`)
    return
  }

  console.log(`[renewals] ${subs.length} subscription(s) due in ${daysAhead} days`)

  for (const sub of subs) {
    try {
      // Only alert subscriptions that have a locked vault
      const vaultRes = await sbFetch(
        `/escrow_vaults?subscription_id=eq.${sub.id}&status=eq.locked&select=id&limit=1`
      )
      const vaults = vaultRes.ok ? await vaultRes.json() : []
      if (!vaults || vaults.length === 0) continue // No vault = no alert
      const vaultId = vaults[0].id

      // Check if an alert of this type was already sent today
      const alertCheckRes = await sbFetch(
        `/agent_renewal_alerts?subscription_id=eq.${sub.id}&alert_sent_at=gte.${todayStart}&select=id,alert_type&limit=5`
      )
      if (alertCheckRes.ok) {
        const existing = await alertCheckRes.json()
        const alreadySent = existing?.some((a) => (a.alert_type || "3day") === alertType)
        if (alreadySent) {
          console.log(`[renewals] ${alertType} alert already sent today for ${sub.name} — skipping`)
          continue
        }
      }

      // Get user's Telegram chat_id
      const profileRes = await sbFetch(
        `/profiles?id=eq.${sub.user_id}&select=telegram_chat_id`
      )
      const profiles = profileRes.ok ? await profileRes.json() : []
      const chatId = profiles?.[0]?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID

      // Insert alert record (use upsert-style: skip if same type already exists today)
      const insertRes = await sbFetch("/agent_renewal_alerts", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          subscription_id: sub.id,
          vault_id: vaultId,
          alert_sent_at: new Date().toISOString(),
          alert_type: alertType,
          user_decision: null,
        }),
      })

      if (!insertRes.ok) {
        const errText = await insertRes.text()
        if (insertRes.status === 409 || errText.includes("unique")) {
          console.log(`[renewals] ${alertType} alert already exists for ${sub.name} — skipping`)
          continue
        }
        // If alert_type column doesn't exist yet (migration not run), log clearly
        if (errText.includes("alert_type") || errText.includes("column")) {
          console.error(`[renewals] MIGRATION NEEDED: Run 20260513000001_subscription_credentials.sql in Supabase SQL editor`)
        }
        console.warn(`[renewals] Failed to insert alert for ${sub.name}:`, errText)
        continue
      }

      // Format amount
      const amountStr = sub.amount
        ? `${sub.currency || "USD"} ${Number(sub.amount).toFixed(2)}`
        : "unknown amount"

      // Format date nicely
      const renewDate = new Date(targetDate + "T00:00:00Z").toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })

      // Build message based on urgency
      let msg
      if (daysAhead === 0) {
        msg = [
          `🚨 Due TODAY`,
          ``,
          `${sub.name} is due TODAY (${amountStr}).`,
          ``,
          `Reply "keep ${sub.name.toLowerCase()}" to pay and continue`,
          `Reply "cancel ${sub.name.toLowerCase()}" to cancel and get ALGO back`,
        ].join("\n")
      } else if (isUrgent) {
        msg = [
          `⚠️ Renews Tomorrow`,
          ``,
          `${sub.name} renews TOMORROW (${renewDate}) for ${amountStr}.`,
          ``,
          `Reply "keep ${sub.name.toLowerCase()}" to let it renew`,
          `Reply "cancel ${sub.name.toLowerCase()}" to cancel it`,
        ].join("\n")
      } else {
        msg = [
          `📅 Renewal Alert`,
          ``,
          `${sub.name} renews in 3 days (${renewDate}) for ${amountStr}.`,
          ``,
          `Reply "keep ${sub.name.toLowerCase()}" to let it renew`,
          `Reply "cancel ${sub.name.toLowerCase()}" to cancel it`,
        ].join("\n")
      }

      await sendTelegram(chatId, msg)
      console.log(`[renewals] ✓ Sent ${alertType} alert for ${sub.name} to user ${sub.user_id.slice(0, 8)}…`)
    } catch (err) {
      console.error(`[renewals] Error processing ${sub.name}:`, err.message)
    }
  }
}
