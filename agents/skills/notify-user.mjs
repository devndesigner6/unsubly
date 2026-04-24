/**
 * Skill: notify-user
 *
 * Sends a Telegram message to a user. Uses the Telegram Bot API.
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN — Bot API token from @BotFather
 *
 * The user's Telegram chat ID is looked up from the `profiles` table
 * in Supabase (column: telegram_chat_id). If the user has not linked
 * Telegram, the notification is logged but not sent.
 */

import { createClient } from "@supabase/supabase-js"

let _client = null
function getClient() {
  if (_client) return _client
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  _client = createClient(url, key, { auth: { persistSession: false } })
  return _client
}

/**
 * Look up a user's Telegram chat ID from their profile.
 * Returns null if not found or not linked.
 */
async function getTelegramChatId(userId) {
  const sb = getClient()
  if (!sb) return null
  const { data } = await sb
    .from("profiles")
    .select("telegram_chat_id")
    .eq("id", userId)
    .maybeSingle()
  return data?.telegram_chat_id || null
}

/**
 * Send a message via Telegram Bot API.
 */
async function sendTelegram(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.warn("[notify-user] TELEGRAM_BOT_TOKEN not set — skipping Telegram notification")
    return false
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: false,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`[notify-user] Telegram API error ${res.status}: ${body}`)
    return false
  }
  return true
}

/**
 * Notify a user about an agent action.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.message — Markdown-formatted message
 * @returns {Promise<{sent: boolean, channel: string | null}>}
 */
export async function notifyUser({ userId, message }) {
  const chatId = await getTelegramChatId(userId)
  if (!chatId) {
    console.log(`[notify-user] No Telegram chat ID for user ${userId} — notification logged only`)
    return { sent: false, channel: null }
  }

  const sent = await sendTelegram(chatId, message)
  return { sent, channel: sent ? "telegram" : null }
}

/**
 * Build a standard release notification message.
 */
export function buildReleaseMessage({ subscriptionName, amount, txid, network }) {
  const explorer = network === "mainnet"
    ? `https://lora.algokit.io/mainnet/transaction/${txid}`
    : `https://lora.algokit.io/testnet/transaction/${txid}`

  return [
    `Released *${amount} ALGO* for *${subscriptionName}*`,
    `Txid: \`${txid}\``,
    `[View on Lora](${explorer})`,
  ].join("\n")
}
