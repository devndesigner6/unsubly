/**
 * Skill: notify-user
 * Sends a Telegram message to the vault owner.
 * Falls back to console.log if TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set.
 *
 * Bot: @unsublyybot
 * To get your chat ID: message the bot, then visit
 * https://api.telegram.org/bot8221335634:AAFBrbOyk6QTXdgzff2S_v91GmB-MAK_tes/getUpdates
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID

const NETWORK = (process.env.ALGO_NETWORK || "testnet").toLowerCase()

export async function notifyUser(message, txid = null) {
  let text = `🤖 *Unsubscribely Agent*\n\n${message}`

  if (txid) {
    const loraUrl = `https://lora.algokit.io/${NETWORK}/transaction/${txid}`
    text += `\n\n🔗 [View on Lora Explorer](${loraUrl})`
  }

  // Console always
  console.log(`[notify] ${message}${txid ? ` | txid: ${txid}` : ""}`)

  // Telegram if configured
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log(`[notify] Telegram not configured — set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID`)
    return
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: false,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.warn(`[notify] Telegram send failed: ${err}`)
    }
  } catch (err) {
    console.warn(`[notify] Telegram error: ${err.message}`)
  }
}
