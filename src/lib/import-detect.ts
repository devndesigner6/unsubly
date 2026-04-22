/**
 * Heuristics for turning unstructured text (an email body) or a generic
 * tabular dump (a bank statement CSV with arbitrary columns) into one or
 * more `DetectedSubscription` rows that can be sent through the existing
 * subscription form.
 *
 * Both detectors are deliberately conservative: false negatives are fine
 * (the user can keep typing), false positives are not (the user might
 * accept a subscription they don't actually have).
 */

export interface DetectedSubscription {
  name: string
  amount: number
  currency: string
  billingCycle: "monthly" | "yearly" | "weekly" | "daily" | "quarterly"
  nextBillingDate: string  // YYYY-MM-DD
  startDate: string
  status: "active" | "trial"
  notes?: string
  /** 0..1, used to sort suggestions in the UI. */
  confidence: number
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  "$": "USD", "£": "GBP", "€": "EUR", "₹": "INR", "¥": "JPY",
}
const CURRENCY_CODES = ["USD", "GBP", "EUR", "INR", "JPY", "CAD", "AUD", "CHF"]

const KNOWN_MERCHANTS = [
  "Netflix", "Spotify", "ChatGPT", "OpenAI", "Adobe", "Notion",
  "Figma", "GitHub", "Linear", "Slack", "Dropbox", "Apple", "Google",
  "Amazon Prime", "Disney", "Hulu", "HBO", "YouTube", "1Password",
  "Audible", "Substack", "Patreon", "Vercel", "Heroku", "AWS",
  "Microsoft", "Atlassian", "Zoom",
]

function todayIso(): string { return new Date().toISOString().slice(0, 10) }
function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function detectMerchant(text: string): { name: string; confidence: number } {
  for (const m of KNOWN_MERCHANTS) {
    const re = new RegExp(`\\b${m.replace(/\s+/g, "\\s+")}\\b`, "i")
    if (re.test(text)) return { name: m, confidence: 0.9 }
  }
  // Try "from <Brand>" / "by <Brand>" patterns.
  const m = text.match(/(?:from|by|,|by:)\s+([A-Z][A-Za-z0-9 .&]{2,30})/)
  if (m) return { name: m[1].trim(), confidence: 0.5 }
  return { name: "", confidence: 0 }
}

function detectAmount(text: string): { amount: number; currency: string; confidence: number } {
  // Match $12.99 / €9.99 / £4.50 etc.
  const sym = text.match(/([$£€₹¥])\s?([0-9]+(?:[.,][0-9]{1,2})?)/)
  if (sym) {
    const cur = CURRENCY_SYMBOLS[sym[1]]
    const amt = Number(sym[2].replace(",", "."))
    if (Number.isFinite(amt) && amt > 0) return { amount: amt, currency: cur, confidence: 0.85 }
  }
  // Match "12.99 USD" / "9.99 EUR".
  const code = text.match(new RegExp(`\\b([0-9]+(?:[.,][0-9]{1,2})?)\\s?(${CURRENCY_CODES.join("|")})\\b`, "i"))
  if (code) {
    const amt = Number(code[1].replace(",", "."))
    if (Number.isFinite(amt) && amt > 0) return { amount: amt, currency: code[2].toUpperCase(), confidence: 0.8 }
  }
  return { amount: 0, currency: "USD", confidence: 0 }
}

function detectCycle(text: string): "monthly" | "yearly" | "weekly" | "daily" | "quarterly" {
  const t = text.toLowerCase()
  if (/\byear(ly)?|annual(ly)?|per\s+year\b/.test(t)) return "yearly"
  if (/\bquarter(ly)?\b/.test(t)) return "quarterly"
  if (/\bweek(ly)?|per\s+week\b/.test(t)) return "weekly"
  if (/\bday(ly)?|per\s+day\b/.test(t)) return "daily"
  return "monthly"
}

function detectTrial(text: string): boolean {
  return /\b(free\s+trial|trial\s+ends|after\s+(?:your\s+)?trial)\b/i.test(text)
}

/**
 * Parse a single email body and return at most one detected subscription.
 * Returns null when nothing recognisable was found.
 */
export function detectFromEmail(emailText: string): DetectedSubscription | null {
  const text = emailText.replace(/\s+/g, " ").trim()
  if (text.length < 10) return null

  const { name, confidence: nameConf } = detectMerchant(text)
  const { amount, currency, confidence: amtConf } = detectAmount(text)
  if (amount === 0 && nameConf === 0) return null  // nothing useful

  const cycle = detectCycle(text)
  const trial = detectTrial(text)
  const start = todayIso()
  const next = addDaysIso(start, cycle === "weekly" ? 7 : cycle === "yearly" ? 365 : cycle === "quarterly" ? 90 : cycle === "daily" ? 1 : 30)

  return {
    name: name || "Unknown subscription",
    amount: amount || 0,
    currency: currency || "USD",
    billingCycle: cycle,
    nextBillingDate: next,
    startDate: start,
    status: trial ? "trial" : "active",
    notes: `Auto-detected from email${trial ? " (trial)" : ""}`,
    confidence: Math.max(nameConf, amtConf),
  }
}

/* ── Bank statement detector ────────────────────────────────────────────── */

export interface BankRow { date: string; description: string; amount: number; currency?: string }

/**
 * Parse a generic CSV (any column order) and return likely subscription
 * candidates by detecting recurring same-amount charges from the same
 * merchant on a near-monthly cadence.
 */
export function detectFromBankCsv(csvText: string): DetectedSubscription[] {
  const rows = parseGenericCsv(csvText)
  if (rows.length === 0) return []

  // Group by (merchant, rounded-amount).
  const groups = new Map<string, BankRow[]>()
  for (const r of rows) {
    if (r.amount >= 0) continue  // statements typically use NEGATIVE for outflows
    const merch = normaliseMerchant(r.description)
    const key = `${merch}::${Math.round(Math.abs(r.amount) * 100)}`
    const arr = groups.get(key) ?? []
    arr.push(r)
    groups.set(key, arr)
  }

  const out: DetectedSubscription[] = []
  for (const [key, arr] of groups) {
    if (arr.length < 2) continue  // need at least 2 occurrences
    arr.sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    const intervals: number[] = []
    for (let i = 1; i < arr.length; i++) {
      const d = (Date.parse(arr[i].date) - Date.parse(arr[i - 1].date)) / 86_400_000
      if (Number.isFinite(d)) intervals.push(d)
    }
    if (intervals.length === 0) continue
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
    let cycle: DetectedSubscription["billingCycle"] | null = null
    if (avg >= 25 && avg <= 35) cycle = "monthly"
    else if (avg >= 6 && avg <= 9) cycle = "weekly"
    else if (avg >= 85 && avg <= 95) cycle = "quarterly"
    else if (avg >= 360 && avg <= 370) cycle = "yearly"
    if (!cycle) continue

    const merchName = key.split("::")[0]
    const last = arr[arr.length - 1]
    const next = addDaysIso(last.date.slice(0, 10),
      cycle === "monthly" ? 30 : cycle === "weekly" ? 7 : cycle === "quarterly" ? 90 : 365)

    out.push({
      name: merchName,
      amount: Math.abs(last.amount),
      currency: last.currency || "USD",
      billingCycle: cycle,
      nextBillingDate: next,
      startDate: arr[0].date.slice(0, 10),
      status: "active",
      notes: `Detected from bank statement (${arr.length} matching charges)`,
      confidence: Math.min(1, 0.5 + 0.1 * arr.length),
    })
  }
  return out.sort((a, b) => b.confidence - a.confidence)
}

function parseGenericCsv(csv: string): BankRow[] {
  const lines = csv.replace(/\r/g, "").split("\n").filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const idxDate = header.findIndex((h) => /date|posted/.test(h))
  const idxDesc = header.findIndex((h) => /desc|merchant|payee|narration|details/.test(h))
  const idxAmt = header.findIndex((h) => /amount|debit|credit|value/.test(h))
  const idxCur = header.findIndex((h) => /currency|ccy/.test(h))
  if (idxDate < 0 || idxDesc < 0 || idxAmt < 0) return []
  const rows: BankRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i])
    const dateRaw = cells[idxDate]
    const date = normaliseDate(dateRaw)
    const description = cells[idxDesc] || ""
    const amount = Number((cells[idxAmt] || "0").replace(/[, ]/g, ""))
    if (!date || !description || !Number.isFinite(amount)) continue
    rows.push({
      date, description, amount,
      currency: idxCur >= 0 ? cells[idxCur] : undefined,
    })
  }
  return rows
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""; let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { inQuote = !inQuote; continue }
    if (c === "," && !inQuote) { out.push(cur); cur = ""; continue }
    cur += c
  }
  out.push(cur)
  return out
}

function normaliseDate(d: string): string | null {
  if (!d) return null
  const s = d.trim()
  // YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  // DD/MM/YYYY or MM/DD/YYYY (assume DD/MM since global)
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (m) {
    const yy = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${yy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
  }
  const t = Date.parse(s)
  if (Number.isFinite(t)) return new Date(t).toISOString().slice(0, 10)
  return null
}

function normaliseMerchant(desc: string): string {
  // Strip common prefixes/suffixes and reference numbers.
  const cleaned = desc
    .replace(/\b(POS|UPI|NEFT|ACH|DEBIT|CARD|PURCHASE|PAYMENT|RECURRING)\b/gi, " ")
    .replace(/\b\d{4,}\b/g, " ")
    .replace(/[^A-Za-z0-9 .&]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  // Take the first 3-4 word tokens, usually the merchant name.
  return cleaned.split(" ").slice(0, 4).join(" ")
}
