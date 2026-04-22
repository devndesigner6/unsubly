/**
 * Persistent rate limiter backed by Supabase.
 *
 * Replaces the previous "hope upstream returns 429" strategy with a real
 * sliding-ish window counter that survives process restarts and works
 * across multiple instances behind a load balancer.
 *
 * Falls back to "always allow" if the rate_limit_check RPC is missing
 * (e.g. you forgot to apply the migration) — but logs loudly so the
 * issue is impossible to miss.
 */

import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

let _client = null
function client() {
  if (_client) return _client
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return null
  }
  _client = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _client
}

let _missingFnWarned = false

/**
 * @returns {Promise<boolean>} true if the call is allowed, false if throttled
 */
export async function rateLimitAllow(bucket, key, limit, windowSeconds) {
  const c = client()
  if (!c) return true // dev: no service key configured → don't block
  const { data, error } = await c.rpc("rate_limit_check", {
    p_bucket: bucket,
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (error) {
    if (!_missingFnWarned) {
      console.error(
        "[rate-limit] Supabase RPC failed — apply migration " +
        "20260422000002_rate_limits.sql. Allowing request through. " +
        "Error:", error.message
      )
      _missingFnWarned = true
    }
    return true
  }
  return data === true
}
