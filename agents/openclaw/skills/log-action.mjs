/**
 * Skill: log-action
 * Writes every agent action to the agent_actions table in Supabase.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function logAction({ vaultId, subscriptionId, userId, status, txid, mode, payload }) {
  try {
    // userId must be a valid UUID for the agent_actions table.
    // The Railway agent passes vault.user_id which is always a real UUID.
    // Guard against non-UUID strings (e.g. "openclaw-agent") that would fail Postgres.
    const isUUID = typeof userId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
    if (!isUUID) {
      console.warn(`[log-action] Skipping insert — userId "${userId}" is not a valid UUID`)
      return
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/agent_actions`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        action_type: "auto_release",
        vault_id: vaultId || null,
        subscription_id: subscriptionId || null,
        user_id: userId || "openclaw-agent",
        txid: txid || null,
        status: status || "unknown",
        payload: {
          mode: mode || "unknown",
          txid: txid || null,
          released_at: new Date().toISOString(),
          ...payload,
        },
      }),
    })

    if (!res.ok) {
      console.warn(`[log-action] Failed to log: ${res.status}`)
    }
  } catch (err) {
    console.warn(`[log-action] Error: ${err.message}`)
  }
}
