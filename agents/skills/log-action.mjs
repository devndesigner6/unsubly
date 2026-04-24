/**
 * Skill: log-action
 *
 * Writes an entry to the agent_actions table in Supabase.
 * Uses the service role key to bypass RLS.
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
 * @param {object} params
 * @param {string} params.actionType — e.g. "auto_release", "x402_payment", "guardrail_block", "notification"
 * @param {string} [params.vaultId]
 * @param {string} [params.subscriptionId]
 * @param {string} params.userId
 * @param {string} [params.txid]
 * @param {string} [params.status] — "success" | "simulation" | "error" | "skipped"
 * @param {object} [params.payload] — arbitrary JSON metadata
 */
export async function logAction({
  actionType,
  vaultId = null,
  subscriptionId = null,
  userId,
  txid = null,
  status = "success",
  payload = {},
}) {
  const sb = getClient()

  const { error } = await sb.from("agent_actions").insert({
    action_type: actionType,
    vault_id: vaultId,
    subscription_id: subscriptionId,
    user_id: userId,
    txid,
    status,
    payload: {
      ...payload,
      agent_address: process.env.AGENT_WALLET_ADDRESS || null,
      timestamp: new Date().toISOString(),
    },
  })

  if (error) {
    console.error(`[log-action] Failed to write agent_actions: ${error.message}`)
    throw error
  }
}
