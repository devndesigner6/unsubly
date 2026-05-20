/**
 * Per-subscription guardrails — stored in Supabase subscription_guardrails table.
 *
 * Previously stored in localStorage, which meant the OpenClaw agent (which reads
 * from the DB) never saw the user's settings. This version writes to and reads
 * from Supabase so the agent and the UI are always in sync.
 */

import { supabase } from "@/integrations/supabase/client"

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

const DEFAULT: SubscriptionGuardrails = {
  budgetCap: null,
  trialEndDate: null,
  pauseBeforePaidRenewal: false,
}

/**
 * Read guardrails for a subscription from Supabase.
 * Returns defaults if no row exists or on error.
 */
export async function getGuardrails(subscriptionId: string): Promise<SubscriptionGuardrails> {
  try {
    const { data, error } = await supabase
      .from("subscription_guardrails")
      .select("budget_cap, trial_end_date, pause_before_paid_renewal")
      .eq("subscription_id", subscriptionId)
      .maybeSingle()

    if (error || !data) return DEFAULT

    return {
      budgetCap: typeof data.budget_cap === "number" ? data.budget_cap : null,
      trialEndDate: typeof data.trial_end_date === "string" ? data.trial_end_date : null,
      pauseBeforePaidRenewal: Boolean(data.pause_before_paid_renewal),
    }
  } catch {
    return DEFAULT
  }
}

/**
 * Write guardrails for a subscription to Supabase (upsert).
 */
export async function setGuardrails(
  subscriptionId: string,
  g: SubscriptionGuardrails
): Promise<void> {
  try {
    await supabase
      .from("subscription_guardrails")
      .upsert(
        {
          subscription_id: subscriptionId,
          budget_cap: g.budgetCap,
          trial_end_date: g.trialEndDate,
          pause_before_paid_renewal: g.pauseBeforePaidRenewal,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "subscription_id" }
      )
  } catch {
    /* silently fail — guardrails are best-effort */
  }
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
