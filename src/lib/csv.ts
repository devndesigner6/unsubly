export interface CSVSubscription {
  name: string
  description?: string
  amount: number
  currency: string
  billingCycle: string
  nextBillingDate: string
  startDate: string
  status: string
  category?: string
  url?: string
  notes?: string
  alertDays: number
  alertEnabled: boolean
}

export function parseCSV(csvContent: string): CSVSubscription[] {
  const lines = csvContent.trim().split("\n")
  if (lines.length < 2) {
    throw new Error("CSV must have a header row and at least one data row")
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())

  const subscriptions: CSVSubscription[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = parseCSVLine(line)
    const row: Record<string, string> = {}

    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || ""
    })

    const subscription: CSVSubscription = {
      name: row.name || "",
      description: row.description || undefined,
      amount: parseFloat(row.amount) || 0,
      currency: row.currency || "USD",
      billingCycle: row.billingcycle || "monthly",
      nextBillingDate: row.nextbillingdate || new Date().toISOString(),
      startDate: row.startdate || new Date().toISOString(),
      status: row.status || "active",
      category: row.category || undefined,
      url: row.url || undefined,
      notes: row.notes || undefined,
      alertDays: parseInt(row.alertdays) || 3,
      alertEnabled: row.alertenabled !== "false",
    }

    if (subscription.name && subscription.amount > 0) {
      subscriptions.push(subscription)
    }
  }

  return subscriptions
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += char
    }
  }
  result.push(current)

  return result
}

export function generateCSV(
  subscriptions: Record<string, any>[],
): string {
  const headers = [
    "name",
    "description",
    "amount",
    "currency",
    "billing_cycle",
    "next_billing_date",
    "start_date",
    "status",
    "category",
    "url",
    "notes",
    "alert_days",
    "alert_enabled",
  ]

  const rows = subscriptions.map((sub) => {
    return headers
      .map((header) => {
        const value = sub[header]
        if (value === undefined || value === null) return ""
        const stringValue = String(value)
        if (stringValue.includes(",") || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      })
      .join(",")
  })

  return [headers.join(","), ...rows].join("\n")
}

