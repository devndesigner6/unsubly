/**
 * Skill: check-guardrails
 * Reads subscription_guardrails table and decides if a vault should be released.
 * Returns { allowed: true } or { allowed: false, reason: string }
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function checkGuardrails(subscriptionId, vaultAmount) {
  if (!subscriptionId) return { allowed: true }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/subscription_guardrails?subscription_id=eq.${subscriptionId}&select=*`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      }
    )

    if (!res.ok) {
      // Table may not exist yet — allow release
      console.warn(`[check-guardrails] Could not read guardrails: ${res.status}`)
      return { allowed: true }
    }

    const rows = await res.json()
    const g = Array.isArray(rows) && rows.length > 0 ? rows[0] : null

    if (!g) return { allowed: true }

    const today = new Date().toISOString().slice(0, 10)

    // Budget cap check
    if (g.budget_cap != null && Number(vaultAmount) > Number(g.budget_cap)) {
      return {
        allowed: false,
        reason: `Amount ${vaultAmount} ALGO exceeds budget cap ${g.budget_cap} ALGO`,
      }
    }

    // Trial end date check
    if (g.trial_end_date && g.trial_end_date > today) {
      return {
        allowed: false,
        reason: `Trial ends on ${g.trial_end_date} — not releasing until trial period ends`,
      }
    }

    // Pause before paid renewal
    if (g.pause_before_paid_renewal) {
      return {
        allowed: false,
        reason: `Vault paused before first paid renewal — user must confirm manually`,
      }
    }

    return { allowed: true }
  } catch (err) {
    console.warn(`[check-guardrails] Error reading guardrails: ${err.message}`)
    return { allowed: true } // fail open — don't block releases on DB errors
  }
}
