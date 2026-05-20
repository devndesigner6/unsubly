/**
 * Skill: notify-user
 * Sends a Telegram message to the vault owner.
 *
 * Feature 2: Per-user Telegram — looks up the user's personal chat_id from
 * their profile. Falls back to the global TELEGRAM_CHAT_ID env var (admin).
 *
 * Bot: @unsublyybot
 */

const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN
const DEFAULT_CHAT = process.env.TELEGRAM_CHAT_ID  // admin fallback
const NETWORK      = (process.env.ALGO_NETWORK || "testnet").toLowerCase()
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

// Rate limit: max 3 Telegram messages per user per hour to prevent spam.
// Critical messages (CANCEL decisions, errors) bypass this limit entirely.
const _telegramLastSent = new Map() // chatId -> { count, windowStart }
const TELEGRAM_RATE_LIMIT_MS = 60 * 60 * 1000 // 1 hour window
const TELEGRAM_RATE_MAX = 10 // max messages per window

/**
 * Look up a user's personal Telegram chat_id from their profile.
 * Returns null if not connected or on any error.
 */
async function getUserChatId(userId) {
  if (!userId || !SUPABASE_URL || !SERVICE_KEY) return null
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=telegram_chat_id`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      }
    )
    if (!res.ok) return null
    const rows = await res.json()
    return rows?.[0]?.telegram_chat_id ?? null
  } catch {
    return null
  }
}

/**
 * Send a Telegram message.
 *
 * @param {string} message  - Plain text message
 * @param {string|null} txid - Optional Algorand txid for Lora link
 * @param {string|null} userId - Supabase user UUID for per-user routing
 * @param {boolean} urgent - If true, bypasses rate limit (for CANCEL decisions, errors)
 */
export async function notifyUser(message, txid = null, userId = null, urgent = false) {
  let text = `🤖 Unsubscribely Agent\n\n${message}`

  if (txid) {
    const loraUrl = `https://lora.algokit.io/${NETWORK}/transaction/${txid}`
    text += `\n\n🔗 View on Lora: ${loraUrl}`
  }

  // Console always
  console.log(`[notify] ${message}${txid ? ` | txid: ${txid}` : ""}`)

  if (!BOT_TOKEN) {
    console.log(`[notify] Telegram not configured — set TELEGRAM_BOT_TOKEN`)
    return
  }

  // Resolve chat_id: user's personal chat first, then admin fallback
  let chatId = null
  if (userId) {
    chatId = await getUserChatId(userId)
    if (chatId) {
      console.log(`[notify] Sending to user ${userId.slice(0, 8)}… personal Telegram`)
    }
  }
  if (!chatId) {
    chatId = DEFAULT_CHAT
    if (chatId) {
      console.log(`[notify] Falling back to admin Telegram chat`)
    }
  }

  if (!chatId) {
    console.log(`[notify] No Telegram chat_id available — skipping`)
    return
  }

  try {
    const now = Date.now()
    const entry = _telegramLastSent.get(chatId) || { count: 0, windowStart: now }

    // Reset window if expired
    if (now - entry.windowStart >= TELEGRAM_RATE_LIMIT_MS) {
      entry.count = 0
      entry.windowStart = now
    }

    // Urgent messages (CANCEL decisions, vault errors) always go through
    if (!urgent && entry.count >= TELEGRAM_RATE_MAX) {
      console.log(`[notify] Rate limited for chat ${chatId} — ${entry.count} messages sent in this window`)
      return
    }

    entry.count++
    _telegramLastSent.set(chatId, entry)

    // Retry up to 2 times on Telegram API failure
    let lastErr = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: false }),
        })
        if (res.ok) { lastErr = null; break }
        const errText = await res.text()
        lastErr = `HTTP ${res.status}: ${errText}`
        if (res.status === 400) break // bad request — don't retry
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      } catch (e) {
        lastErr = e.message
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      }
    }
    if (lastErr) console.warn(`[notify] Telegram send failed after retries: ${lastErr}`)
  } catch (err) {
    console.warn(`[notify] Telegram error: ${err.message}`)
  }
}
