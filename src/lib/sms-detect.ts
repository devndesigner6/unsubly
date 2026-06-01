/**
 * SMS-based subscription detection for Indian bank messages.
 *
 * Parses transaction SMS from Indian banks (HDFC, SBI, ICICI, Axis, Kotak, etc.)
 * to detect recurring subscription charges.
 *
 * Supported formats:
 * - "Your A/c XX1234 debited for Rs.199.00 on 24-May-26. Info: UPI/SPOTIFY"
 * - "INR 649.00 spent on HDFC CC X1234 at NETFLIX on 24-May"
 * - "Debited INR 139 from A/c ending 5678 for SPOTIFYINDIA"
 * - "Rs 499 debited from A/c **1234 on 24-05-26 to GOOGLE*YOUTUBE"
 * - "Transaction of Rs.299.00 on your card ending 4321 at AMAZONPRIME"
 */

export interface SmsTransaction {
  amount: number
  merchant: string
  date: string // ISO date
  type: "debit" | "credit"
  account: string // last 4 digits
  raw: string // original SMS text
}

export interface DetectedSmsSubscription {
  name: string
  amount: number
  currency: string
  billingCycle: "monthly" | "quarterly" | "yearly"
  occurrences: number
  lastDate: string
  confidence: number // 0-1
}

// Known subscription merchants (Indian market)
const KNOWN_MERCHANTS: Record<string, string> = {
  "spotify": "Spotify",
  "spotifyindia": "Spotify",
  "netflix": "Netflix",
  "netflixcom": "Netflix",
  "amazonprime": "Amazon Prime",
  "amazon prime": "Amazon Prime",
  "primevideo": "Amazon Prime",
  "hotstar": "Disney+ Hotstar",
  "disneyplus": "Disney+ Hotstar",
  "youtube": "YouTube Premium",
  "googleyoutube": "YouTube Premium",
  "google*youtube": "YouTube Premium",
  "jiocinema": "JioCinema",
  "sonyliv": "SonyLIV",
  "zee5": "ZEE5",
  "mxplayer": "MX Player",
  "apple.com": "Apple (iCloud/Music)",
  "applemusic": "Apple Music",
  "icloud": "iCloud",
  "notion": "Notion",
  "figma": "Figma",
  "canva": "Canva",
  "github": "GitHub",
  "chatgpt": "ChatGPT",
  "openai": "OpenAI",
  "claude": "Claude",
  "cursor": "Cursor",
  "grammarly": "Grammarly",
  "duolingo": "Duolingo",
  "linkedin": "LinkedIn Premium",
  "medium": "Medium",
  "audible": "Audible",
  "kindle": "Kindle Unlimited",
  "googleone": "Google One",
  "google one": "Google One",
  "googlestorage": "Google One",
  "dropbox": "Dropbox",
  "nordvpn": "NordVPN",
  "expressvpn": "ExpressVPN",
  "surfshark": "Surfshark",
  "adobe": "Adobe Creative Cloud",
  "microsoft": "Microsoft 365",
  "office365": "Microsoft 365",
  "slack": "Slack",
  "zoom": "Zoom",
  "cred": "CRED",
  "swiggy": "Swiggy One",
  "zomato": "Zomato Gold",
  "zerodha": "Zerodha",
  "groww": "Groww",
  "upstox": "Upstox",
  "unacademy": "Unacademy",
  "byjus": "BYJU'S",
  "whitehat": "WhiteHat Jr",
  "coursera": "Coursera",
  "udemy": "Udemy",
  "headspace": "Headspace",
  "calm": "Calm",
  "strava": "Strava",
  "cultfit": "Cult.fit",
  "gaana": "Gaana",
  "wynk": "Wynk Music",
  "jiosaavn": "JioSaavn",
}

// Amount extraction patterns
const AMOUNT_PATTERNS = [
  /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
  /(?:debited|spent|charged|paid)\s+(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  /([\d,]+(?:\.\d{1,2})?)\s*(?:Rs|INR|₹)/i,
  /(?:amount|amt)\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
]

// Date extraction patterns
const DATE_PATTERNS = [
  /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
  /(\d{1,2}[-\s](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\s]\d{2,4})/i,
  /on\s+(\d{1,2}[-\/]\w+[-\/]?\d{0,4})/i,
]

// Account number patterns (last 4 digits)
const ACCOUNT_PATTERNS = [
  /(?:A\/c|Ac|Account|Card|CC)\s*(?:No\.?|ending|XX|xx|\*+)?\s*(\d{4})/i,
  /(?:ending|last\s*4)\s*(\d{4})/i,
  /\*+(\d{4})/,
  /XX+(\d{4})/i,
]

// Merchant extraction patterns
const MERCHANT_PATTERNS = [
  /(?:to|at|for|Info:?\s*(?:UPI\/)?)\s*([A-Za-z0-9*._\s]+?)(?:\s*(?:on|Avl|Bal|\.|\n|$))/i,
  /(?:UPI|IMPS|NEFT)\/([A-Za-z0-9*._\s]+?)(?:\/|\s*$)/i,
  /(?:VPA|payee)\s*:?\s*([A-Za-z0-9@._-]+)/i,
]

function parseAmount(text: string): number | null {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      const cleaned = match[1].replace(/,/g, "")
      const num = parseFloat(cleaned)
      if (num > 0 && num < 100000) return num
    }
  }
  return null
}

function parseDate(text: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      try {
        const d = new Date(match[1])
        if (!isNaN(d.getTime())) return d.toISOString().split("T")[0]
      } catch {}
      // Try manual parse for DD-Mon-YY format
      const parts = match[1].match(/(\d{1,2})[-\s](\w+)[-\s]?(\d{2,4})?/)
      if (parts) {
        const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
        const day = parseInt(parts[1])
        const mon = months[parts[2].toLowerCase().slice(0, 3)]
        let year = parts[3] ? parseInt(parts[3]) : new Date().getFullYear()
        if (year < 100) year += 2000
        if (mon !== undefined && day > 0 && day <= 31) {
          return new Date(year, mon, day).toISOString().split("T")[0]
        }
      }
    }
  }
  return null
}

function parseAccount(text: string): string {
  for (const pattern of ACCOUNT_PATTERNS) {
    const match = text.match(pattern)
    if (match) return match[1]
  }
  return "XXXX"
}

function parseMerchant(text: string): string | null {
  for (const pattern of MERCHANT_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      let merchant = match[1].trim()
      // Clean up common noise
      merchant = merchant.replace(/\s+/g, " ").replace(/[*_]+/g, "").trim()
      if (merchant.length > 2 && merchant.length < 50) return merchant
    }
  }
  return null
}

function normalizeMerchant(raw: string): string {
  const lower = raw.toLowerCase().replace(/[^a-z0-9]/g, "")
  for (const [key, name] of Object.entries(KNOWN_MERCHANTS)) {
    if (lower.includes(key.replace(/[^a-z0-9]/g, ""))) return name
  }
  // Capitalize first letter of each word
  return raw.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")
}

function isDebit(text: string): boolean {
  return /debit|spent|charged|paid|purchase|withdrawn|sent/i.test(text)
}

/**
 * Parse a single SMS message into a transaction.
 */
export function parseSms(text: string): SmsTransaction | null {
  const amount = parseAmount(text)
  if (!amount) return null

  const merchant = parseMerchant(text)
  if (!merchant) return null

  const date = parseDate(text) || new Date().toISOString().split("T")[0]
  const account = parseAccount(text)
  const type = isDebit(text) ? "debit" : "credit"

  // Skip credits (salary, refunds)
  if (type === "credit") return null

  return {
    amount,
    merchant: normalizeMerchant(merchant),
    date,
    type,
    account,
    raw: text,
  }
}

/**
 * Parse multiple SMS messages and detect recurring subscriptions.
 */
export function detectSubscriptionsFromSms(smsTexts: string[]): DetectedSmsSubscription[] {
  // Parse all SMS into transactions
  const transactions: SmsTransaction[] = []
  for (const text of smsTexts) {
    const parsed = parseSms(text)
    if (parsed) transactions.push(parsed)
  }

  if (transactions.length === 0) return []

  // Group by merchant + similar amount (±10%)
  const groups: Record<string, SmsTransaction[]> = {}
  for (const txn of transactions) {
    let matched = false
    for (const key of Object.keys(groups)) {
      const existing = groups[key][0]
      if (
        existing.merchant === txn.merchant &&
        Math.abs(existing.amount - txn.amount) / existing.amount < 0.1
      ) {
        groups[key].push(txn)
        matched = true
        break
      }
    }
    if (!matched) {
      groups[`${txn.merchant}_${txn.amount}`] = [txn]
    }
  }

  // Filter: only groups with 2+ occurrences are likely subscriptions
  const subscriptions: DetectedSmsSubscription[] = []
  for (const [, txns] of Object.entries(groups)) {
    if (txns.length < 2) continue

    // Sort by date
    txns.sort((a, b) => a.date.localeCompare(b.date))

    // Detect billing cycle from intervals
    const intervals: number[] = []
    for (let i = 1; i < txns.length; i++) {
      const d1 = new Date(txns[i - 1].date)
      const d2 = new Date(txns[i].date)
      const days = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
      if (days > 0) intervals.push(days)
    }

    const avgInterval = intervals.length > 0
      ? intervals.reduce((a, b) => a + b, 0) / intervals.length
      : 30

    let billingCycle: "monthly" | "quarterly" | "yearly" = "monthly"
    if (avgInterval > 80 && avgInterval < 100) billingCycle = "quarterly"
    else if (avgInterval > 350) billingCycle = "yearly"

    // Confidence based on occurrences and interval consistency
    const intervalVariance = intervals.length > 1
      ? intervals.reduce((sum, i) => sum + Math.abs(i - avgInterval), 0) / intervals.length
      : 10
    const confidence = Math.min(1, (txns.length * 0.2) + (intervalVariance < 5 ? 0.4 : intervalVariance < 10 ? 0.2 : 0))

    subscriptions.push({
      name: txns[0].merchant,
      amount: txns[0].amount,
      currency: "INR",
      billingCycle,
      occurrences: txns.length,
      lastDate: txns[txns.length - 1].date,
      confidence,
    })
  }

  // Sort by confidence descending
  return subscriptions.sort((a, b) => b.confidence - a.confidence)
}

/**
 * Split a bulk SMS paste into individual messages.
 * Handles common export formats (newline-separated, timestamp-prefixed).
 */
export function splitSmsMessages(bulk: string): string[] {
  // Try splitting by common SMS export patterns
  const lines = bulk.split(/\n{2,}/) // Double newline = new message
  if (lines.length > 1) return lines.filter(l => l.trim().length > 20)

  // Try splitting by timestamp patterns
  const timestamped = bulk.split(/(?=\d{1,2}[-\/]\w+[-\/]\d{2,4}\s+\d{1,2}:\d{2})/)
  if (timestamped.length > 1) return timestamped.filter(l => l.trim().length > 20)

  // Try splitting by sender ID patterns (AD-HDFCBK, VM-SBIINB, etc.)
  const bySender = bulk.split(/(?=[A-Z]{2}-[A-Z]+\s)/)
  if (bySender.length > 1) return bySender.filter(l => l.trim().length > 20)

  // Single message or unsplittable — return as array of lines
  return bulk.split("\n").filter(l => l.trim().length > 30)
}
