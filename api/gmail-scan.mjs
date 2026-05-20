/**
 * POST /api/gmail-scan  — Vercel serverless function
 *
 * Scans the authenticated user's Gmail for subscription-related emails
 * (receipts, invoices, billing confirmations) from the last 6 months.
 *
 * Auth: Bearer JWT (Supabase user token)
 *
 * Returns: array of detected subscriptions:
 *   { name, amount, currency, billing_cycle, source: 'gmail', detected_from_email: true }
 */

import { createClient } from "@supabase/supabase-js"

// Required by Vercel: disable body parser so we handle the raw stream ourselves
export const config = { api: { bodyParser: false } }

function jsonRes(res, status, data) {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify(data))
}

// Known service domain → display name mapping
const DOMAIN_MAP = {
  "netflix.com": "Netflix",
  "spotify.com": "Spotify",
  "apple.com": "Apple",
  "music.apple.com": "Apple Music",
  "tv.apple.com": "Apple TV+",
  "icloud.com": "iCloud+",
  "amazon.com": "Amazon Prime",
  "primevideo.com": "Amazon Prime Video",
  "hulu.com": "Hulu",
  "disneyplus.com": "Disney+",
  "max.com": "HBO Max",
  "hbo.com": "HBO Max",
  "paramountplus.com": "Paramount+",
  "peacocktv.com": "Peacock",
  "youtube.com": "YouTube Premium",
  "google.com": "Google",
  "googleone.com": "Google One",
  "microsoft.com": "Microsoft 365",
  "office.com": "Microsoft 365",
  "adobe.com": "Adobe Creative Cloud",
  "dropbox.com": "Dropbox",
  "notion.so": "Notion",
  "figma.com": "Figma",
  "slack.com": "Slack",
  "github.com": "GitHub",
  "vercel.com": "Vercel",
  "openai.com": "ChatGPT Plus",
  "anthropic.com": "Claude Pro",
  "cursor.sh": "Cursor",
  "replit.com": "Replit",
  "canva.com": "Canva Pro",
  "duolingo.com": "Duolingo Super",
  "audible.com": "Audible",
  "linkedin.com": "LinkedIn Premium",
  "nytimes.com": "New York Times",
  "wsj.com": "Wall Street Journal",
  "washingtonpost.com": "Washington Post",
  "medium.com": "Medium",
  "substack.com": "Substack",
  "tidal.com": "Tidal",
  "soundcloud.com": "SoundCloud Go",
  "calm.com": "Calm",
  "headspace.com": "Headspace",
  "peloton.com": "Peloton",
  "aws.amazon.com": "AWS",
  "zoom.us": "Zoom",
  "atlassian.com": "Atlassian",
  "hubspot.com": "HubSpot",
  "mailchimp.com": "Mailchimp",
  "twilio.com": "Twilio",
  "digitalocean.com": "DigitalOcean",
  "heroku.com": "Heroku",
  "cloudflare.com": "Cloudflare",
  "fastly.com": "Fastly",
  "datadog.com": "Datadog",
  "newrelic.com": "New Relic",
  "sentry.io": "Sentry",
  "grammarly.com": "Grammarly",
  "evernote.com": "Evernote",
  "todoist.com": "Todoist",
  "asana.com": "Asana",
  "monday.com": "Monday.com",
  "trello.com": "Trello",
  "airtable.com": "Airtable",
  "miro.com": "Miro",
  "loom.com": "Loom",
  "descript.com": "Descript",
  "1password.com": "1Password",
  "lastpass.com": "LastPass",
  "nordvpn.com": "NordVPN",
  "expressvpn.com": "ExpressVPN",
  "protonmail.com": "Proton Mail",
  "fastmail.com": "Fastmail",
}

function extractDomain(sender) {
  if (!sender) return null
  const emailMatch = sender.match(/<([^>]+)>/)
  const email = emailMatch ? emailMatch[1] : sender
  const atIdx = email.indexOf("@")
  if (atIdx === -1) return null
  const domain = email.slice(atIdx + 1).toLowerCase().trim()
  const parts = domain.split(".")
  if (parts.length >= 2) return parts.slice(-2).join(".")
  return domain
}

function domainToServiceName(domain) {
  if (!domain) return null
  if (DOMAIN_MAP[domain]) return DOMAIN_MAP[domain]
  for (const [knownDomain, name] of Object.entries(DOMAIN_MAP)) {
    if (domain.endsWith("." + knownDomain) || domain === knownDomain) return name
  }
  return null
}

function extractAmount(text) {
  if (!text) return null
  const patterns = [
    /([₹$€£¥₩])\s*(\d{1,6}(?:[.,]\d{2})?)/,
    /\b(USD|EUR|GBP|INR|CAD|AUD|JPY|BRL|MXN|SGD|HKD|CHF|SEK|NOK|DKK)\s+(\d{1,6}(?:[.,]\d{2})?)/i,
    /(\d{1,6}(?:[.,]\d{2})?)\s+(USD|EUR|GBP|INR|CAD|AUD|JPY|BRL|MXN|SGD|HKD|CHF|SEK|NOK|DKK)\b/i,
    /Rs\.?\s*(\d{1,6}(?:[.,]\d{2})?)/i,
  ]
  const symbolToCurrency = { "$": "USD", "€": "EUR", "£": "GBP", "₹": "INR", "¥": "JPY", "₩": "KRW" }
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      if (pattern.source.startsWith("Rs")) {
        const amount = parseFloat(match[1].replace(",", ""))
        if (amount > 0 && amount < 100000) return { amount, currency: "INR" }
      } else if (match[1] in symbolToCurrency) {
        const amount = parseFloat(match[2].replace(",", ""))
        if (amount > 0 && amount < 100000) return { amount, currency: symbolToCurrency[match[1]] }
      } else {
        const codeFirst = /^[A-Z]{3}$/i.test(match[1])
        const currency = codeFirst ? match[1].toUpperCase() : match[2].toUpperCase()
        const amountStr = codeFirst ? match[2] : match[1]
        const amount = parseFloat(amountStr.replace(",", ""))
        if (amount > 0 && amount < 100000) return { amount, currency }
      }
    }
  }
  return null
}

function decodeBase64Url(data) {
  if (!data) return ""
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
  } catch { return "" }
}

function extractTextFromParts(parts) {
  if (!parts) return ""
  let text = ""
  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      text += decodeBase64Url(part.body.data) + "\n"
    } else if (part.parts) {
      text += extractTextFromParts(part.parts)
    }
  }
  return text
}

// Core handler — used by both Vercel (default export) and server.js (named export)
async function handler(req, res) {
  if (req.method !== "POST") return jsonRes(res, 405, { error: "Method not allowed" })

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) return jsonRes(res, 401, { error: "Unauthorized" })
  const userJwt = authHeader.replace("Bearer ", "")

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SUPABASE_KEY || !SERVICE_KEY) {
    return jsonRes(res, 500, { error: "Server not configured" })
  }

  // Verify user JWT
  const userClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return jsonRes(res, 401, { error: "Invalid token" })

  // Get user's Google access token from profiles
  const svcClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const { data: profile } = await svcClient
    .from("profiles")
    .select("google_access_token")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.google_access_token) {
    return jsonRes(res, 400, {
      error: "No Google access token found. Please sign out and sign in again with Google.",
    })
  }

  const accessToken = profile.google_access_token

  try {
    const query = encodeURIComponent(
      'subject:(receipt OR invoice OR "subscription renewed" OR "payment confirmation" OR "billing" OR "your subscription" OR "payment received") newer_than:6m'
    )
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=50`

    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!listRes.ok) {
      const errText = await listRes.text()
      if (listRes.status === 401) {
        await svcClient.from("profiles").update({ google_access_token: null }).eq("id", user.id)
        return jsonRes(res, 401, {
          error: "Google access token expired. Please sign out and sign in with Google again.",
        })
      }
      console.error("[gmail-scan] Gmail API list error:", listRes.status, errText)
      return jsonRes(res, 502, { error: "Failed to access Gmail API. Check that Gmail API is enabled in Google Cloud Console." })
    }

    const listData = await listRes.json()
    const messages = listData.messages || []

    if (messages.length === 0) {
      return jsonRes(res, 200, { subscriptions: [], scanned: 0 })
    }

    const detectedMap = new Map()

    // Process in batches of 10 to avoid hitting Gmail API quota (250 units/sec)
    const BATCH_SIZE = 10
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map(async (msg) => {
        try {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          )
          if (!msgRes.ok) return

          const msgData = await msgRes.json()
          const headers = msgData.payload?.headers || []
          const getHeader = (name) =>
            headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || ""

          const sender = getHeader("From")
          const subject = getHeader("Subject")
          const domain = extractDomain(sender)
          const serviceName = domainToServiceName(domain)
          if (!serviceName) return

          let bodyText = ""
          if (msgData.payload?.body?.data) {
            bodyText = decodeBase64Url(msgData.payload.body.data)
          } else if (msgData.payload?.parts) {
            bodyText = extractTextFromParts(msgData.payload.parts)
          }

          const amountData = extractAmount(subject) || extractAmount(bodyText)
          const existing = detectedMap.get(serviceName)
          if (!existing || (amountData && !existing.amount)) {
            detectedMap.set(serviceName, {
              name: serviceName,
              amount: amountData?.amount || null,
              currency: amountData?.currency || "USD",
              billing_cycle: "monthly",
              source: "gmail",
              detected_from_email: true,
              domain,
            })
          }
        } catch (err) {
          console.warn("[gmail-scan] Error processing message:", err.message)
        }
      })
    ) // end batch
    } // end for loop

    const subscriptions = Array.from(detectedMap.values())
      .filter((s) => s.name)
      .sort((a, b) => a.name.localeCompare(b.name))

    return jsonRes(res, 200, { subscriptions, scanned: messages.length })
  } catch (err) {
    console.error("[gmail-scan] error:", err)
    return jsonRes(res, 500, { error: err.message || "Gmail scan failed" })
  }
}

// Vercel serverless: must be default export
export default handler

// server.js / vite.config.ts: named export
export { handler as gmailScanHandler }
