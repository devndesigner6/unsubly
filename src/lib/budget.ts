/**
 * Client-side configuration for per-subscription guardrails. Stored in
 * localStorage to avoid coupling these hackathon features to a Supabase
 * migration. The same shape can later be moved into a `subscription_config`
 * table without changing any caller.
 */

export interface SubscriptionGuardrails {
  /** Maximum amount the agent is allowed to release per cycle (in the
   *  subscription's own currency). null = no cap. */
  budgetCap: number | null
  /** ISO date (YYYY-MM-DD) at which the trial ends. null = not on trial. */
  trialEndDate: string | null
  /** When true, agent must NOT release the first paid renewal automatically;
   *  the user has to confirm. */
  pauseBeforePaidRenewal: boolean
}

const KEY_PREFIX = "ub:guardrails:"

const DEFAULT: SubscriptionGuardrails = {
  budgetCap: null,
  trialEndDate: null,
  pauseBeforePaidRenewal: false,
}

export function getGuardrails(subscriptionId: string): SubscriptionGuardrails {
  if (typeof window === "undefined") return DEFAULT
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + subscriptionId)
    if (!raw) return DEFAULT
    const parsed = JSON.parse(raw) as Partial<SubscriptionGuardrails>
    return {
      budgetCap: typeof parsed.budgetCap === "number" ? parsed.budgetCap : null,
      trialEndDate: typeof parsed.trialEndDate === "string" ? parsed.trialEndDate : null,
      pauseBeforePaidRenewal: Boolean(parsed.pauseBeforePaidRenewal),
    }
  } catch {
    return DEFAULT
  }
}

export function setGuardrails(subscriptionId: string, g: SubscriptionGuardrails) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY_PREFIX + subscriptionId, JSON.stringify(g))
  } catch { /* storage full / unavailable */ }
}

export function clearGuardrails(subscriptionId: string) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(KEY_PREFIX + subscriptionId)
  } catch { /* noop */ }
}

export interface RenewalRisk {
  level: "ok" | "warn" | "danger"
  reasons: string[]
}

/**
 * Combine the subscription row with guardrails to produce a renewal risk
 * for the upcoming cycle. Pure, does no I/O.
 */
export function assessRenewalRisk(args: {
  amount: number
  currency: string | null
  nextBillingDate: string | null   // ISO YYYY-MM-DD
  status: string | null
  guardrails: SubscriptionGuardrails
  /** Today's date in YYYY-MM-DD; injected so callers control the clock. */
  today?: string
}): RenewalRisk {
  const reasons: string[] = []
  let level: RenewalRisk["level"] = "ok"

  const today = args.today || new Date().toISOString().slice(0, 10)
  const nbd = args.nextBillingDate

  // Trial ends within 3 days = danger. Surfaces "trial-to-paid" risk.
  if (args.guardrails.trialEndDate) {
    const days = daysBetween(today, args.guardrails.trialEndDate)
    if (days >= 0 && days <= 3) {
      level = "danger"
      reasons.push(`Trial ends in ${days} day${days === 1 ? "" : "s"}`)
    }
  }

  // Budget cap exceeded.
  if (args.guardrails.budgetCap != null && args.amount > args.guardrails.budgetCap) {
    level = "danger"
    reasons.push(`Cost ${args.amount} exceeds your cap ${args.guardrails.budgetCap}`)
  }

  // Renews within 3 days and trial is in effect.
  if (nbd && args.guardrails.trialEndDate && args.guardrails.pauseBeforePaidRenewal) {
    const daysToBill = daysBetween(today, nbd)
    if (daysToBill >= 0 && daysToBill <= 7) {
      if (level !== "danger") level = "warn"
      reasons.push("First paid renewal pending, manual approval required")
    }
  }

  // Renews within 7 days at all → soft warn.
  if (nbd && level === "ok") {
    const daysToBill = daysBetween(today, nbd)
    if (daysToBill >= 0 && daysToBill <= 7) {
      level = "warn"
      reasons.push(`Renews in ${daysToBill} day${daysToBill === 1 ? "" : "s"}`)
    }
  }

  return { level, reasons }
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso + "T00:00:00Z")
  const b = Date.parse(toIso + "T00:00:00Z")
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN
  return Math.round((b - a) / 86_400_000)
}
