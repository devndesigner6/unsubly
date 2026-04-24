/**
 * Skill: check-guardrails
 *
 * Reads the subscription_guardrails table to determine whether a vault
 * release should be blocked. Returns a decision object:
 *
 *   { allowed: true }
 *   { allowed: false, reason: "budget_cap_exceeded" | "trial_active" | "paused", detail: "..." }
 */

import { createClient } from "@supabase/supabase-js"

let _client = null
function getClient() {
  if (_client) return _client
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
  _client = createClient(url, key, { auth: { persistSession: false } })
  return _client
}

/**
 * @param {string} subscriptionId
 * @param {number} vaultAmount  — ALGO amount the vault will release
 * @returns {Promise<{allowed: boolean, reason?: string, detail?: string}>}
 */
export async function checkGuardrails(subscriptionId, vaultAmount) {
  const sb = getClient()

  const { data: guard, error } = await sb
    .from("subscription_guardrails")
    .select("budget_cap, trial_end_date, pause_before_paid_renewal")
    .eq("subscription_id", subscriptionId)
    .maybeSingle()

  if (error) {
    console.warn(`[check-guardrails] DB error for ${subscriptionId}: ${error.message}`)
    // Fail open — missing guardrails table should not block releases
    return { allowed: true }
  }

  // No guardrails row means no restrictions
  if (!guard) return { allowed: true }

  // Budget cap check
  if (guard.budget_cap != null && vaultAmount > Number(guard.budget_cap)) {
    return {
      allowed: false,
      reason: "budget_cap_exceeded",
      detail: `Vault amount ${vaultAmount} ALGO exceeds budget cap ${guard.budget_cap} ALGO`,
    }
  }

  // Trial end date check
  if (guard.trial_end_date) {
    const trialEnd = new Date(guard.trial_end_date + "T23:59:59Z")
    if (trialEnd > new Date()) {
      return {
        allowed: false,
        reason: "trial_active",
        detail: `Trial period active until ${guard.trial_end_date}`,
      }
    }
  }

  // Pause before paid renewal
  if (guard.pause_before_paid_renewal) {
    return {
      allowed: false,
      reason: "paused",
      detail: "User has enabled pause-before-paid-renewal — awaiting confirmation",
    }
  }

  return { allowed: true }
}
