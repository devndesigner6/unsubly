/**
 * Ghost Sub Content Script
 * Runs on every page. Detects subscription/checkout pages
 * and extracts subscription details.
 */

// Known subscription domains and their details
const KNOWN_SERVICES = {
  "spotify.com": { name: "Spotify", category: "Music" },
  "netflix.com": { name: "Netflix", category: "Entertainment" },
  "disneyplus.com": { name: "Disney+", category: "Entertainment" },
  "hulu.com": { name: "Hulu", category: "Entertainment" },
  "max.com": { name: "Max", category: "Entertainment" },
  "primevideo.com": { name: "Amazon Prime Video", category: "Entertainment" },
  "music.apple.com": { name: "Apple Music", category: "Music" },
  "youtube.com": { name: "YouTube Premium", category: "Entertainment" },
  "notion.so": { name: "Notion", category: "Productivity" },
  "figma.com": { name: "Figma", category: "Design" },
  "github.com": { name: "GitHub", category: "Development" },
  "chat.openai.com": { name: "ChatGPT Plus", category: "AI" },
  "claude.ai": { name: "Claude Pro", category: "AI" },
  "canva.com": { name: "Canva Pro", category: "Design" },
  "dropbox.com": { name: "Dropbox", category: "Cloud" },
  "slack.com": { name: "Slack", category: "Productivity" },
  "zoom.us": { name: "Zoom", category: "Productivity" },
  "adobe.com": { name: "Adobe Creative Cloud", category: "Design" },
  "grammarly.com": { name: "Grammarly", category: "Productivity" },
  "medium.com": { name: "Medium", category: "Education" },
  "linkedin.com": { name: "LinkedIn Premium", category: "Productivity" },
  "duolingo.com": { name: "Duolingo Super", category: "Education" },
  "audible.com": { name: "Audible", category: "Entertainment" },
  "cursor.com": { name: "Cursor", category: "Development" },
  "vercel.com": { name: "Vercel", category: "Development" },
  "replit.com": { name: "Replit", category: "Development" },
  "one.google.com": { name: "Google One", category: "Cloud" },
  "icloud.com": { name: "iCloud+", category: "Cloud" },
  "hotstar.com": { name: "Hotstar", category: "Entertainment" },
  "jiocinema.com": { name: "JioCinema", category: "Entertainment" },
  "gaana.com": { name: "Gaana", category: "Music" },
  "jiosaavn.com": { name: "JioSaavn", category: "Music" },
}

// Checkout/subscription keywords in URLs
const CHECKOUT_KEYWORDS = [
  "subscribe", "checkout", "premium", "upgrade", "pricing",
  "plans", "membership", "payment", "billing", "signup",
  "pro", "plus", "trial",
]

function getHostname() {
  return window.location.hostname.replace("www.", "")
}

function isSubscriptionPage() {
  const url = window.location.href.toLowerCase()
  const path = window.location.pathname.toLowerCase()
  return CHECKOUT_KEYWORDS.some(kw => url.includes(kw) || path.includes(kw))
}

function extractPrice() {
  // Try common price selectors
  const selectors = [
    '[class*="price"]', '[class*="amount"]', '[class*="cost"]',
    '[data-testid*="price"]', '.plan-price', '.subscription-price',
  ]
  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (el) {
      const text = el.textContent || ""
      const match = text.match(/[\$₹€£]\s*(\d+[.,]?\d*)/)
      if (match) {
        const amount = parseFloat(match[1].replace(",", ""))
        const currency = text.includes("₹") ? "INR" : text.includes("€") ? "EUR" : text.includes("£") ? "GBP" : "USD"
        return { amount, currency }
      }
    }
  }
  return null
}

function detectBillingCycle() {
  const text = document.body.innerText.toLowerCase()
  if (text.includes("/year") || text.includes("annually") || text.includes("per year")) return "yearly"
  if (text.includes("/week") || text.includes("per week")) return "weekly"
  return "monthly" // default
}

function detect() {
  const hostname = getHostname()

  // Check if we're on a known service domain
  const knownService = Object.entries(KNOWN_SERVICES).find(([domain]) => hostname.includes(domain))

  if (!knownService && !isSubscriptionPage()) return // Not a subscription page

  const service = knownService ? knownService[1] : null
  const priceInfo = extractPrice()
  const billingCycle = detectBillingCycle()

  const data = {
    name: service?.name || document.title.split(/[|\-–—]/)[0].trim(),
    category: service?.category || "Other",
    amount: priceInfo?.amount || null,
    currency: priceInfo?.currency || "USD",
    billing_cycle: billingCycle,
    url: window.location.href,
    domain: hostname,
    detected_at: new Date().toISOString(),
  }

  // Send to background script
  chrome.runtime.sendMessage({ action: "subscriptionDetected", data })
}

// Run detection after page loads
setTimeout(detect, 2000)
