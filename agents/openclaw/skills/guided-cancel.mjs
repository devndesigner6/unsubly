/**
 * guided-cancel.mjs
 *
 * Guided cancellation skill for the OpenClaw agent.
 *
 * Given a subscription_id:
 *   1. Looks up the subscription name
 *   2. If it's a Google service, tries auto-cancel-google first
 *   3. Otherwise finds the cancel flow from the embedded catalog
 *   4. Kills the escrow vault if one exists
 *   5. Sends Telegram with step-by-step cancel instructions
 *
 * The agent cannot import from src/ (different runtime), so the cancel flow
 * catalog is duplicated here as a plain JS object.
 */

import { isGoogleService, autoCancelGoogle } from "./auto-cancel-google.mjs"
import { browserCancel } from "./browser-cancel.mjs"

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
    console.warn("[guided-cancel] Telegram send failed:", err.message)
  }
}

// ── Cancel flow catalog (mirrors src/data/cancelFlows.ts) ──────────────────
const CANCEL_FLOWS = [
  { name: "Netflix", aliases: ["netflix"], cancelUrl: "https://www.netflix.com/cancelplan", steps: ["Sign in if prompted", "Click \"Finish Cancellation\"", "Confirm, access continues until your billing date"] },
  { name: "Disney+", aliases: ["disney", "disney+", "disneyplus"], cancelUrl: "https://www.disneyplus.com/account/subscription", steps: ["Sign in to your Disney+ account", "Find your subscription and click \"Cancel Subscription\"", "Confirm, you keep access until the period ends"] },
  { name: "Hulu", aliases: ["hulu"], cancelUrl: "https://secure.hulu.com/account/cancel", steps: ["Sign in to your Hulu account", "Click \"Cancel\" next to your plan", "Choose \"Continue to Cancel\" and confirm"] },
  { name: "HBO Max", aliases: ["hbo", "max", "hbo max"], cancelUrl: "https://auth.max.com/subscription", steps: ["Sign in to Max", "Open Subscription settings", "Click \"Cancel Subscription\" and confirm"] },
  { name: "Amazon Prime", aliases: ["prime", "amazon prime", "amazon"], cancelUrl: "https://www.amazon.com/gp/primecentral", steps: ["Sign in to Amazon", "Go to \"Manage Membership\" → \"End Membership\"", "Click through 3 confirmation screens"] },
  { name: "Apple TV+", aliases: ["apple tv", "appletv", "tv+"], cancelUrl: "https://tv.apple.com/account", steps: ["Sign in with your Apple ID", "Open Settings → Subscriptions", "Click \"Cancel Subscription\" next to Apple TV+"] },
  { name: "Paramount+", aliases: ["paramount", "paramount+"], cancelUrl: "https://www.paramountplus.com/account/signin/?redirect_uri=/account/", steps: ["Sign in to your Paramount+ account", "Open Account → Cancel Subscription", "Confirm cancellation"] },
  { name: "Peacock", aliases: ["peacock"], cancelUrl: "https://www.peacocktv.com/account/plans", steps: ["Sign in to Peacock", "Open Plans & Payment → Change or Cancel Plan", "Choose \"Cancel Plan\" and confirm"] },
  { name: "YouTube Premium", aliases: ["youtube premium", "youtube"], cancelUrl: "https://www.youtube.com/paid_memberships", steps: ["Sign in with your Google account", "Click \"Manage membership\" → \"Deactivate\"", "Choose \"Cancel\" and confirm reason"] },
  { name: "Spotify", aliases: ["spotify"], cancelUrl: "https://www.spotify.com/account/subscription/", steps: ["Sign in to your Spotify account", "Scroll to \"Available plans\" and pick \"Spotify Free\"", "Click \"Cancel Premium\" and confirm"] },
  { name: "Apple Music", aliases: ["apple music"], cancelUrl: "https://music.apple.com/account/settings", steps: ["Sign in with your Apple ID", "Open Settings → Subscriptions", "Click \"Cancel Subscription\" next to Apple Music"] },
  { name: "Tidal", aliases: ["tidal"], cancelUrl: "https://my.tidal.com/account/subscription", steps: ["Sign in to Tidal", "Open Subscription and click \"Cancel Subscription\"", "Confirm cancellation"] },
  { name: "SoundCloud Go", aliases: ["soundcloud"], cancelUrl: "https://soundcloud.com/settings/subscription", steps: ["Sign in to SoundCloud", "Open Settings → Subscription", "Click \"Cancel Subscription\" and confirm"] },
  { name: "New York Times", aliases: ["new york times", "nyt", "ny times", "nytimes"], cancelUrl: "https://www.nytimes.com/subscription/manage", steps: ["Sign in to your NYT account", "Open \"Manage Subscriptions\" and click \"Cancel\"", "Follow the prompts to confirm"] },
  { name: "Wall Street Journal", aliases: ["wsj", "wall street journal"], cancelUrl: "https://customercenter.wsj.com/view/membership", steps: ["Sign in to your WSJ account", "Open Membership → Cancel Subscription", "Confirm or call the listed retention number"] },
  { name: "Washington Post", aliases: ["washington post", "wapo"], cancelUrl: "https://subscribe.washingtonpost.com/account/subscription/manage/", steps: ["Sign in to your account", "Open Subscription → Cancel Subscription", "Confirm cancellation"] },
  { name: "Medium", aliases: ["medium"], cancelUrl: "https://medium.com/me/membership", steps: ["Sign in to Medium", "Open Membership settings", "Click \"Cancel Membership\" and confirm"] },
  { name: "Substack", aliases: ["substack"], cancelUrl: "https://substack.com/account", steps: ["Sign in to Substack", "Open the publication you want to cancel", "Click \"Cancel subscription\" and confirm"] },
  { name: "Notion", aliases: ["notion"], cancelUrl: "https://www.notion.so/my-integrations", steps: ["Sign in to Notion", "Open Settings & Members → Plans", "Click \"Downgrade\" → \"Free\" and confirm"] },
  { name: "Figma", aliases: ["figma"], cancelUrl: "https://www.figma.com/files/team/personal/billing", steps: ["Sign in to Figma", "Open Settings → Plans", "Click \"Cancel plan\" and confirm"] },
  { name: "Slack", aliases: ["slack"], cancelUrl: "https://my.slack.com/admin/billing", steps: ["Sign in as a workspace admin", "Open Billing → Change plan", "Choose \"Cancel paid plan\" and confirm"] },
  { name: "Dropbox", aliases: ["dropbox"], cancelUrl: "https://www.dropbox.com/account/plan", steps: ["Sign in to Dropbox", "Open Plan → Cancel plan", "Choose a reason and confirm"] },
  { name: "Google One", aliases: ["google one", "google storage"], cancelUrl: "https://one.google.com/storage", steps: ["Sign in with your Google account", "Open Settings → Cancel Membership", "Confirm cancellation"] },
  { name: "iCloud+", aliases: ["icloud", "icloud+"], cancelUrl: "https://www.icloud.com/settings", steps: ["On your Apple device: Settings → [your name] → iCloud", "Tap \"Manage Storage\" → \"Change Storage Plan\"", "Tap \"Downgrade Options\" → choose Free → Done"] },
  { name: "Microsoft 365", aliases: ["microsoft 365", "office 365", "m365"], cancelUrl: "https://account.microsoft.com/services", steps: ["Sign in with your Microsoft account", "Find Microsoft 365 → Manage → Cancel Subscription", "Confirm and pick a reason"] },
  { name: "Adobe Creative Cloud", aliases: ["adobe", "creative cloud", "photoshop", "lightroom"], cancelUrl: "https://account.adobe.com/plans", steps: ["Sign in to your Adobe account", "Click \"Manage plan\" → \"Cancel plan\"", "Confirm, early termination fees may apply on annual plans"] },
  { name: "Canva Pro", aliases: ["canva"], cancelUrl: "https://www.canva.com/settings/billing-and-teams", steps: ["Sign in to Canva", "Open Billing & Plans", "Click \"Cancel subscription\" and confirm"] },
  { name: "GitHub", aliases: ["github", "github copilot", "copilot"], cancelUrl: "https://github.com/settings/billing/plans", steps: ["Sign in to GitHub", "Open Settings → Billing & plans", "Click \"Downgrade\" or \"Cancel\" on the relevant plan"] },
  { name: "Vercel", aliases: ["vercel"], cancelUrl: "https://vercel.com/account/plans", steps: ["Sign in to Vercel", "Open Account Settings → Plans", "Click \"Downgrade to Hobby\" and confirm"] },
  { name: "Peloton", aliases: ["peloton"], cancelUrl: "https://account.onepeloton.com/preferences/membership", steps: ["Sign in to your Peloton account", "Open Membership → Cancel Membership", "Confirm cancellation"] },
  { name: "Calm", aliases: ["calm"], cancelUrl: "https://app.calm.com/me", steps: ["Sign in to Calm", "Open Profile → Manage Subscription", "Click \"Cancel Subscription\" and confirm"] },
  { name: "Headspace", aliases: ["headspace"], cancelUrl: "https://my.headspace.com/subscription", steps: ["Sign in to Headspace", "Open Subscription settings", "Click \"Cancel Subscription\" and confirm"] },
  { name: "ChatGPT Plus", aliases: ["chatgpt", "openai", "gpt"], cancelUrl: "https://chat.openai.com/#settings/Subscription", steps: ["Sign in to ChatGPT", "Open Settings → Subscription → Manage", "Click \"Cancel Plan\" and confirm"] },
  { name: "Claude Pro", aliases: ["claude", "anthropic"], cancelUrl: "https://claude.ai/settings/billing", steps: ["Sign in to Claude", "Open Settings → Billing", "Click \"Cancel subscription\" and confirm"] },
  { name: "Cursor", aliases: ["cursor"], cancelUrl: "https://www.cursor.com/settings", steps: ["Sign in to Cursor", "Open Settings → Manage Subscription", "Click \"Cancel Plan\" and confirm"] },
  { name: "Replit", aliases: ["replit"], cancelUrl: "https://replit.com/account", steps: ["Sign in to Replit", "Open Account → Cyclic / Membership", "Click \"Cancel\" on the active plan and confirm"] },
  { name: "LinkedIn Premium", aliases: ["linkedin", "linkedin premium"], cancelUrl: "https://www.linkedin.com/premium/manage/", steps: ["Sign in to LinkedIn", "Open Premium subscription settings", "Click \"Cancel subscription\" and confirm"] },
  { name: "Duolingo Super", aliases: ["duolingo"], cancelUrl: "https://www.duolingo.com/settings/super", steps: ["Sign in to Duolingo", "Open Super → Manage Subscription", "Click \"Cancel Subscription\" and confirm"] },
  { name: "Audible", aliases: ["audible"], cancelUrl: "https://www.audible.com/account/cancel-membership", steps: ["Sign in to your Audible account", "Choose a cancel reason and click \"Continue\"", "Click \"Cancel Membership\" to confirm"] },
]

function findCancelFlow(subscriptionName) {
  if (!subscriptionName) return null
  const q = subscriptionName.toLowerCase().trim()
  if (!q) return null
  for (const flow of CANCEL_FLOWS) {
    if (flow.name.toLowerCase().includes(q) || q.includes(flow.name.toLowerCase())) return flow
    for (const alias of flow.aliases) {
      if (q.includes(alias)) return flow
    }
  }
  return null
}

/**
 * Run the guided cancellation flow for a subscription.
 *
 * @param {string} subscriptionId
 * @param {string} chatId - Telegram chat ID to send instructions to
 */
export async function guidedCancel(subscriptionId, chatId) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.warn("[guided-cancel] Missing env vars")
    return
  }

  // 1. Look up subscription
  const subRes = await sbFetch(
    `/subscriptions?id=eq.${subscriptionId}&select=id,name,amount,currency,user_id&limit=1`
  )
  if (!subRes.ok) {
    console.warn("[guided-cancel] Failed to fetch subscription:", subRes.status)
    return
  }
  const subs = await subRes.json()
  const sub = subs?.[0]
  if (!sub) {
    console.warn("[guided-cancel] Subscription not found:", subscriptionId)
    await sendTelegram(chatId, "❌ Subscription not found. It may have already been deleted.")
    return
  }

  const subName = sub.name
  const amountStr = sub.amount
    ? `${sub.currency || "USD"} ${Number(sub.amount).toFixed(2)}`
    : "your funds"

  // 2. Try Google auto-cancel first if it's a Google service
  if (isGoogleService(subName)) {
    console.log(`[guided-cancel] ${subName} is a Google service — trying auto-cancel`)
    const result = await autoCancelGoogle(subscriptionId, subName, sub.user_id, chatId)
    if (result.success) {
      console.log(`[guided-cancel] Google auto-cancel succeeded for ${subName}`)
      return
    }
    console.log(`[guided-cancel] Google auto-cancel failed (${result.message}), falling back to browser`)
  }

  // 3. Try browser automation if credentials are stored
  console.log(`[guided-cancel] Trying browser automation for ${subName}`)
  const browserResult = await browserCancel(subscriptionId, chatId).catch((err) => {
    console.warn(`[guided-cancel] browserCancel threw: ${err.message}`)
    return { success: false, message: err.message }
  })
  if (browserResult.success) {
    console.log(`[guided-cancel] Browser cancel succeeded for ${subName}`)
    return
  }

  // If browser was attempted (credentials existed) but failed, don't send manual instructions
  // The browserCancel function already sent a screenshot + error message to the user
  const hadCredentials = browserResult.message !== "No credentials stored for " + sub.name
    && browserResult.message !== `No credentials stored for ${subName}`
    && !browserResult.message?.includes("No credentials stored")
    && !browserResult.message?.includes("SUBSCRIPTION_CREDS_KEY not set")
    && !browserResult.message?.includes("Missing server config")

  if (hadCredentials) {
    // Browser was attempted with real credentials but failed (OAuth, CAPTCHA, etc.)
    // Send manual instructions as fallback but without the "Starting browser..." noise
    console.log(`[guided-cancel] Browser attempted but failed (${browserResult.message}), sending manual steps`)
  } else {
    console.log(`[guided-cancel] No credentials stored, sending manual instructions directly`)
  }

  // 4. Find the cancel flow (guided fallback)
  const flow = findCancelFlow(subName)

  // 5. Kill the escrow vault if one exists
  const vaultRes = await sbFetch(
    `/escrow_vaults?subscription_id=eq.${subscriptionId}&status=eq.locked&select=id,vault_type,app_id&limit=1`
  )
  const vaults = vaultRes.ok ? await vaultRes.json() : []
  const vault = vaults?.[0]

  let vaultMsg = ""
  if (vault) {
    // Do NOT mark vault as killed in DB — the on-chain kill requires the creator's
    // wallet signature and must be done from the app. Marking it killed here would
    // show the user their ALGO is returned when it isn't yet.
    // Instead, send a clear message telling them to kill it from the app.
    const appUrl = process.env.APP_URL || "https://unsubly.xyz"
    vaultMsg = `⚠️ You have a locked vault for ${amountStr}.\nTo get your ALGO back, open the app and click Kill Switch:\n${appUrl}/escrow-vaults\n\n`
  }

  // 6. Do NOT mark subscription as cancelled yet — wait for user to confirm with DONE
  // The old code marked it cancelled here which was premature.

  // 7. Build and send Telegram message (only if browser wasn't attempted with credentials)
  // If browser was attempted and failed, it already sent a screenshot. Just send the steps.
  let msg
  if (flow) {
    const stepsText = flow.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")
    msg = [
      hadCredentials ? `Browser automation couldn't complete. Here are the manual steps:` : `🚫 Cancelling ${subName}`,
      ``,
      hadCredentials ? "" : vaultMsg.trim(),
      ``,
      `To cancel ${subName}:`,
      stepsText,
      ``,
      `Go to: ${flow.cancelUrl}`,
      ``,
      `Reply "done" when you've cancelled.`,
    ].filter(Boolean).join("\n")
  } else {
    msg = [
      hadCredentials ? `Browser automation couldn't complete. Cancel manually:` : `🚫 Cancelling ${subName}`,
      ``,
      hadCredentials ? "" : vaultMsg.trim(),
      ``,
      `To cancel ${subName}:`,
      `Go to ${subName}'s account settings → Billing → Cancel subscription.`,
      ``,
      `Reply "done" when you've cancelled.`,
    ].filter(Boolean).join("\n")
  }

  await sendTelegram(chatId, msg)
  console.log(`[guided-cancel] ✓ Sent cancel instructions for ${subName} to chat ${chatId}`)
}
