/**
 * MCP (Model Context Protocol) Server for Unsubscribely.
 *
 * Production-grade implementation of the MCP specification (JSON-RPC 2.0)
 * exposing subscription management capabilities as tools that any
 * MCP-compatible AI agent (Claude, ChatGPT, custom agents) can use.
 *
 * Spec: https://modelcontextprotocol.io/specification
 * Transport: HTTP (Streamable HTTP transport) + SSE for notifications
 *
 * Features:
 * - Bearer token authentication with scoped permissions
 * - Rate limiting (per-token, sliding window)
 * - Request audit logging to Supabase
 * - 12 tools covering full subscription lifecycle
 * - 4 resources for data access
 * - 3 prompts for guided workflows
 * - Proper MCP error codes
 * - Batch request support (JSON-RPC 2.0)
 * - Session management with capability negotiation
 * - Pagination for large result sets
 *
 * Supported methods:
 * - initialize: Capability negotiation + session creation
 * - notifications/initialized: Client acknowledgment
 * - notifications/cancelled: Request cancellation
 * - tools/list: Discover available tools
 * - tools/call: Execute a tool
 * - resources/list: List available data resources
 * - resources/read: Read a specific resource
 * - prompts/list: List available prompts
 * - prompts/get: Get a specific prompt with arguments
 * - ping: Health check
 */

import { createHash, randomUUID } from "node:crypto"

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PROTOCOL_VERSION = "2025-06-18"
const SERVER_NAME = "unsubscribely-mcp"
const SERVER_VERSION = "2.0.0"

// ─── Authentication & Rate Limiting ──────────────────────────────────────────

const MCP_AUTH_TOKENS = new Map() // token -> { user_id, scopes, created_at }
const RATE_LIMITS = new Map()    // token -> { requests: [{ts}], window_ms, max_requests }
const SESSIONS = new Map()       // session_id -> { token, created_at, last_active, request_count }

const RATE_LIMIT_WINDOW_MS = 60_000  // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30   // 30 requests per minute per token
const SESSION_TIMEOUT_MS = 30 * 60_000 // 30 minutes idle timeout

// Periodic session cleanup (every 5 minutes)
setInterval(() => {
  const now = Date.now()
  for (const [id, session] of SESSIONS) {
    if (now - session.last_active > SESSION_TIMEOUT_MS) SESSIONS.delete(id)
  }
  // Also clean stale rate limit entries
  for (const [id, bucket] of RATE_LIMITS) {
    if (bucket.requests.length === 0 || now - bucket.requests[bucket.requests.length - 1] > RATE_LIMIT_WINDOW_MS * 2) {
      RATE_LIMITS.delete(id)
    }
  }
}, 5 * 60_000)

// Scopes define what tools a token can access
const SCOPES = {
  "read": ["list_subscriptions", "get_spending_summary", "get_vault_status", "list_upcoming_renewals", "get_agent_status", "get_payment_history", "get_subscription_health", "verify_cancellation_proof"],
  "write": ["trigger_cancellation", "pause_subscription"],
  "admin": ["trigger_vault_release", "kill_vault"],
  "all": "*",
}

/**
 * Validate a Bearer token and return the associated user context.
 * Tokens are stored in Supabase `mcp_api_tokens` table.
 * Falls back to env-based token for simple setups.
 */
async function authenticateRequest(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { authenticated: false, error: "Missing or invalid Authorization header" }
  }
  const token = authHeader.slice(7).trim()
  if (!token) return { authenticated: false, error: "Empty token" }

  // Check env-based master token first (simple single-user setup)
  const masterToken = process.env.MCP_AUTH_TOKEN
  if (masterToken && token === masterToken) {
    return {
      authenticated: true,
      user_id: process.env.MCP_DEFAULT_USER_ID || null,
      scopes: ["all"],
      token_id: "master",
    }
  }

  // Check cached tokens
  if (MCP_AUTH_TOKENS.has(token)) {
    const cached = MCP_AUTH_TOKENS.get(token)
    if (Date.now() - cached.cached_at < 300_000) { // 5 min cache
      return { authenticated: true, ...cached }
    }
    MCP_AUTH_TOKENS.delete(token) // expired cache
  }

  // Look up in Supabase
  try {
    const tokenHash = createHash("sha256").update(token).digest("hex")
    const data = await sbFetch(`mcp_api_tokens?token_hash=eq.${tokenHash}&is_active=eq.true&select=id,user_id,scopes,expires_at,name`)
    if (!data || data.length === 0) {
      return { authenticated: false, error: "Invalid or expired token" }
    }
    const record = data[0]
    if (record.expires_at && new Date(record.expires_at) < new Date()) {
      return { authenticated: false, error: "Token expired" }
    }
    const result = {
      user_id: record.user_id,
      scopes: record.scopes || ["read"],
      token_id: record.id,
      name: record.name,
      cached_at: Date.now(),
    }
    MCP_AUTH_TOKENS.set(token, result)

    // Update last_used_at (non-blocking)
    sbFetch(`mcp_api_tokens?id=eq.${record.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_used_at: new Date().toISOString() }),
    }).catch(() => {})

    return { authenticated: true, ...result }
  } catch (err) {
    // If table doesn't exist yet, allow unauthenticated access with read-only
    if (err.message?.includes("404") || err.message?.includes("relation")) {
      return { authenticated: true, user_id: null, scopes: ["read"], token_id: "fallback" }
    }
    return { authenticated: false, error: `Auth lookup failed: ${err.message}` }
  }
}

/**
 * Check if a token has permission to use a specific tool.
 */
function hasPermission(scopes, toolName) {
  if (!scopes || scopes.length === 0) return false
  if (scopes.includes("all")) return true
  for (const scope of scopes) {
    const allowedTools = SCOPES[scope]
    if (!allowedTools) continue
    if (allowedTools === "*") return true
    if (allowedTools.includes(toolName)) return true
  }
  return false
}

/**
 * Rate limit check. Returns { allowed: true } or { allowed: false, retry_after_ms }.
 */
function checkRateLimit(tokenId) {
  const now = Date.now()
  if (!RATE_LIMITS.has(tokenId)) {
    RATE_LIMITS.set(tokenId, { requests: [now] })
    return { allowed: true }
  }
  const bucket = RATE_LIMITS.get(tokenId)
  // Slide window: remove requests older than window
  bucket.requests = bucket.requests.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS)
  if (bucket.requests.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldest = bucket.requests[0]
    const retryAfter = RATE_LIMIT_WINDOW_MS - (now - oldest)
    return { allowed: false, retry_after_ms: retryAfter }
  }
  bucket.requests.push(now)
  return { allowed: true }
}

// ─── Audit Logging ───────────────────────────────────────────────────────────

async function logMCPRequest({ method, toolName, tokenId, userId, duration_ms, success, error_msg }) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/mcp_request_logs`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        method,
        tool_name: toolName || null,
        token_id: tokenId || null,
        user_id: userId || null,
        duration_ms: duration_ms || null,
        success: success !== false,
        error_message: error_msg || null,
        created_at: new Date().toISOString(),
      }),
    })
  } catch {
    // Non-blocking — don't fail requests if logging fails
  }
}

// ─── Supabase Helper ─────────────────────────────────────────────────────────

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`)
  }
  if (res.status === 204) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function sbPatch(path, body) {
  return sbFetch(path, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(body),
  })
}


// ─── Tool Definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "list_subscriptions",
    description: "List all subscriptions for a user with their status, cost, billing cycle, next payment date, and vault info. Supports filtering by status and pagination.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "The user's UUID from Supabase auth" },
        status_filter: { type: "string", enum: ["active", "cancelled", "paused", "trial", "all"], description: "Filter by subscription status. Default: all" },
        limit: { type: "number", description: "Max results to return (1-50). Default: 20" },
        offset: { type: "number", description: "Offset for pagination. Default: 0" },
        sort_by: { type: "string", enum: ["name", "amount", "next_billing_date", "created_at"], description: "Sort field. Default: next_billing_date" },
      },
      required: ["user_id"],
    },
  },
  {
    name: "get_spending_summary",
    description: "Get a comprehensive spending analysis: total monthly/yearly cost, most expensive subscription, category breakdown, overlap detection (duplicate services in same category), and month-over-month trend.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "The user's UUID" },
        include_cancelled: { type: "boolean", description: "Include cancelled subscriptions in savings calculation. Default: false" },
      },
      required: ["user_id"],
    },
  },
  {
    name: "get_vault_status",
    description: "Check the escrow vault status for a specific subscription. Shows if ALGO funds are locked, released, or killed (returned to user). Includes on-chain transaction IDs, timestamps, and vault contract details.",
    inputSchema: {
      type: "object",
      properties: {
        subscription_id: { type: "string", description: "The subscription UUID to check vaults for" },
        include_history: { type: "boolean", description: "Include full vault history (all past vaults). Default: false" },
      },
      required: ["subscription_id"],
    },
  },
  {
    name: "list_upcoming_renewals",
    description: "List subscriptions that will renew within a specified number of days. Includes vault status and estimated ALGO cost for each.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "The user's UUID" },
        days_ahead: { type: "number", description: "How many days ahead to look (1-90). Default: 7" },
      },
      required: ["user_id"],
    },
  },
  {
    name: "trigger_cancellation",
    description: "Initiate the cancellation flow for a subscription. Marks it for cancellation — the autonomous agent will attempt browser-based cancellation or provide guided instructions via Telegram. Any locked vault will be killed to return ALGO to the user.",
    inputSchema: {
      type: "object",
      properties: {
        subscription_id: { type: "string", description: "The subscription UUID to cancel" },
        user_id: { type: "string", description: "The user's UUID for authorization" },
        reason: { type: "string", description: "Optional reason for cancellation (stored for analytics)" },
      },
      required: ["subscription_id", "user_id"],
    },
  },
  {
    name: "verify_cancellation_proof",
    description: "Verify an on-chain cancellation proof by its Algorand transaction ID. Returns the immutable proof data including timestamp, subscription hash, method used, and confirmation round.",
    inputSchema: {
      type: "object",
      properties: {
        txid: { type: "string", description: "Algorand transaction ID of the cancellation proof" },
      },
      required: ["txid"],
    },
  },
  {
    name: "get_agent_status",
    description: "Get the current status of the autonomous subscription agent: last run time, vaults processed, mode (on-chain/simulation), health metrics, and recent action log.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "The user's UUID" },
        include_actions: { type: "boolean", description: "Include last 10 agent actions. Default: true" },
      },
      required: ["user_id"],
    },
  },
  {
    name: "trigger_vault_release",
    description: "Manually trigger an on-chain vault release for a specific subscription. This sends the locked ALGO to the service provider. Only works on vaults with status 'locked' and vault_type 'agent' or 'agent_v2'. Requires admin scope.",
    inputSchema: {
      type: "object",
      properties: {
        vault_id: { type: "string", description: "The vault UUID to release" },
        user_id: { type: "string", description: "The user's UUID for authorization" },
      },
      required: ["vault_id", "user_id"],
    },
  },
  {
    name: "kill_vault",
    description: "Kill (delete) a vault on-chain, returning all locked ALGO to the user's wallet. This is irreversible — the vault's smart contract is deleted from Algorand. Requires admin scope.",
    inputSchema: {
      type: "object",
      properties: {
        vault_id: { type: "string", description: "The vault UUID to kill" },
        user_id: { type: "string", description: "The user's UUID for authorization" },
        reason: { type: "string", description: "Reason for killing the vault" },
      },
      required: ["vault_id", "user_id"],
    },
  },
  {
    name: "pause_subscription",
    description: "Pause or unpause a subscription. When paused, the agent will not release vault payments and no renewal alerts will be sent. The vault remains locked.",
    inputSchema: {
      type: "object",
      properties: {
        subscription_id: { type: "string", description: "The subscription UUID" },
        user_id: { type: "string", description: "The user's UUID for authorization" },
        action: { type: "string", enum: ["pause", "unpause"], description: "Whether to pause or unpause" },
        resume_date: { type: "string", description: "ISO date to auto-resume (optional, only for pause)" },
      },
      required: ["subscription_id", "user_id", "action"],
    },
  },
  {
    name: "get_payment_history",
    description: "Get the on-chain payment history for a user — all vault releases and kills with transaction IDs, amounts, and timestamps. Useful for building financial reports or verifying payment records.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "The user's UUID" },
        limit: { type: "number", description: "Max results (1-100). Default: 20" },
        subscription_id: { type: "string", description: "Filter to a specific subscription (optional)" },
      },
      required: ["user_id"],
    },
  },
  {
    name: "get_subscription_health",
    description: "Get a health score and risk assessment for a specific subscription. Analyzes payment reliability, vault status, days until renewal, and cancellation risk signals.",
    inputSchema: {
      type: "object",
      properties: {
        subscription_id: { type: "string", description: "The subscription UUID" },
        user_id: { type: "string", description: "The user's UUID for authorization" },
      },
      required: ["subscription_id", "user_id"],
    },
  },
]


// ─── Resource Definitions ────────────────────────────────────────────────────

const RESOURCES = [
  {
    uri: "unsubscribely://subscriptions/{user_id}",
    name: "User Subscriptions",
    description: "All subscription data for a user including payment history and vault associations",
    mimeType: "application/json",
  },
  {
    uri: "unsubscribely://vaults/{user_id}",
    name: "User Escrow Vaults",
    description: "All Algorand escrow vaults with their on-chain status, app IDs, and transaction history",
    mimeType: "application/json",
  },
  {
    uri: "unsubscribely://agent-actions/{user_id}",
    name: "Agent Action History",
    description: "Log of all autonomous agent actions (releases, kills, alerts, errors)",
    mimeType: "application/json",
  },
  {
    uri: "unsubscribely://spending-report/{user_id}",
    name: "Monthly Spending Report",
    description: "Aggregated monthly spending data with category breakdown and trends",
    mimeType: "application/json",
  },
]

// ─── Prompt Definitions ──────────────────────────────────────────────────────

const PROMPTS = [
  {
    name: "subscription_audit",
    description: "Analyze a user's subscriptions to find savings opportunities, overlaps, and unused services. Returns a structured audit report.",
    arguments: [
      { name: "user_id", description: "The user's UUID", required: true },
    ],
  },
  {
    name: "cancellation_guide",
    description: "Generate step-by-step cancellation instructions for a specific subscription service, including what to expect and how to verify.",
    arguments: [
      { name: "subscription_name", description: "Name of the service to cancel (e.g. 'Netflix', 'Spotify')", required: true },
    ],
  },
  {
    name: "vault_explainer",
    description: "Explain how Algorand escrow vaults work in Unsubscribely — the lock/release/kill lifecycle, on-chain verification, and how the autonomous agent manages them.",
    arguments: [],
  },
]


// ─── Tool Handlers ───────────────────────────────────────────────────────────

async function executeTool(name, args) {
  switch (name) {
    case "list_subscriptions": {
      const limit = Math.min(Math.max(args.limit || 20, 1), 50)
      const offset = Math.max(args.offset || 0, 0)
      const sortBy = args.sort_by || "next_billing_date"
      let query = `subscriptions?user_id=eq.${args.user_id}&select=id,name,status,amount,currency,billing_cycle,next_billing_date,category,source,alert_enabled,alert_days,created_at&order=${sortBy}.asc&limit=${limit}&offset=${offset}`
      if (args.status_filter && args.status_filter !== "all") query += `&status=eq.${args.status_filter}`
      const subs = await sbFetch(query)

      // Enrich with vault info
      if (subs && subs.length > 0) {
        const subIds = subs.map(s => s.id)
        const vaults = await sbFetch(`escrow_vaults?subscription_id=in.(${subIds.join(",")})&select=subscription_id,status,amount`).catch(() => [])
        const vaultMap = {}
        if (Array.isArray(vaults)) {
          vaults.forEach(v => {
            if (!vaultMap[v.subscription_id]) vaultMap[v.subscription_id] = []
            vaultMap[v.subscription_id].push({ status: v.status, amount: v.amount })
          })
        }
        subs.forEach(s => { s.vaults = vaultMap[s.id] || [] })
      }

      // Get total count for pagination
      const countRes = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${args.user_id}&select=id`, {
        method: "HEAD",
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "count=exact" },
      })
      const totalCount = parseInt(countRes.headers.get("content-range")?.split("/")?.[1] || "0") || subs?.length || 0

      return JSON.stringify({
        subscriptions: subs || [],
        pagination: { total: totalCount, limit, offset, has_more: offset + limit < totalCount },
      }, null, 2)
    }

    case "get_spending_summary": {
      const subs = await sbFetch(`subscriptions?user_id=eq.${args.user_id}&status=eq.active&select=id,name,amount,currency,billing_cycle,category,created_at`)
      if (!subs || subs.length === 0) return JSON.stringify({ total_monthly: 0, active_count: 0, message: "No active subscriptions found" })

      const monthly = subs.reduce((sum, s) => {
        const amt = s.amount || 0
        if (s.billing_cycle === "monthly") return sum + amt
        if (s.billing_cycle === "yearly") return sum + amt / 12
        if (s.billing_cycle === "quarterly") return sum + amt / 3
        if (s.billing_cycle === "weekly") return sum + amt * 4.33
        return sum
      }, 0)

      // Category breakdown
      const categories = {}
      subs.forEach(s => {
        const cat = s.category || "Other"
        if (!categories[cat]) categories[cat] = { count: 0, monthly_total: 0, services: [] }
        categories[cat].count++
        categories[cat].services.push(s.name)
        const amt = s.amount || 0
        if (s.billing_cycle === "monthly") categories[cat].monthly_total += amt
        else if (s.billing_cycle === "yearly") categories[cat].monthly_total += amt / 12
        else if (s.billing_cycle === "quarterly") categories[cat].monthly_total += amt / 3
        else if (s.billing_cycle === "weekly") categories[cat].monthly_total += amt * 4.33
      })

      const sorted = [...subs].sort((a, b) => (b.amount || 0) - (a.amount || 0))

      // Overlap detection
      const OVERLAP_GROUPS = [
        { label: "music streaming", members: ["spotify", "apple music", "youtube music", "tidal", "deezer", "gaana", "jiosaavn"] },
        { label: "video streaming", members: ["netflix", "amazon prime", "disney+", "hulu", "hbo", "max", "hotstar", "jiocinema"] },
        { label: "cloud storage", members: ["icloud", "google one", "dropbox", "onedrive"] },
        { label: "AI tools", members: ["chatgpt", "claude", "copilot", "midjourney", "perplexity", "gemini"] },
        { label: "note-taking", members: ["notion", "evernote", "obsidian", "bear"] },
      ]
      const overlaps = []
      for (const group of OVERLAP_GROUPS) {
        const matches = subs.filter(s => group.members.some(m => s.name.toLowerCase().includes(m)))
        if (matches.length >= 2) {
          const combinedMonthly = matches.reduce((s, m) => {
            const amt = m.amount || 0
            if (m.billing_cycle === "yearly") return s + amt / 12
            return s + amt
          }, 0)
          overlaps.push({
            category: group.label,
            services: matches.map(m => ({ name: m.name, amount: m.amount, currency: m.currency })),
            combined_monthly: Math.round(combinedMonthly * 100) / 100,
            potential_savings: Math.round((combinedMonthly - Math.min(...matches.map(m => m.amount || 0))) * 100) / 100,
          })
        }
      }

      // Savings from cancelled subs
      let cancelled_savings = null
      if (args.include_cancelled) {
        const cancelled = await sbFetch(`subscriptions?user_id=eq.${args.user_id}&status=eq.cancelled&select=name,amount,currency,cancelled_at`)
        if (cancelled && cancelled.length > 0) {
          const totalSaved = cancelled.reduce((s, c) => s + (c.amount || 0), 0)
          cancelled_savings = {
            count: cancelled.length,
            total_monthly_saved: Math.round(totalSaved * 100) / 100,
            services: cancelled.map(c => ({ name: c.name, amount: c.amount, cancelled_at: c.cancelled_at })),
          }
        }
      }

      return JSON.stringify({
        total_monthly: Math.round(monthly * 100) / 100,
        yearly_projection: Math.round(monthly * 12 * 100) / 100,
        daily_cost: Math.round((monthly / 30) * 100) / 100,
        active_count: subs.length,
        currency: subs[0]?.currency || "USD",
        most_expensive: sorted[0] ? { name: sorted[0].name, amount: sorted[0].amount, billing_cycle: sorted[0].billing_cycle } : null,
        cheapest: sorted[sorted.length - 1] ? { name: sorted[sorted.length - 1].name, amount: sorted[sorted.length - 1].amount } : null,
        categories,
        overlaps: overlaps.length > 0 ? overlaps : null,
        cancelled_savings,
      }, null, 2)
    }

    case "get_vault_status": {
      let query = `escrow_vaults?subscription_id=eq.${args.subscription_id}&select=id,status,amount,vault_type,app_id,escrow_address,created_at,released_at,killed_at,txn_id&order=created_at.desc`
      if (!args.include_history) query += "&limit=1"
      const vaults = await sbFetch(query)

      const activeVault = vaults?.find(v => v.status === "locked") || null
      const totalReleased = vaults?.filter(v => v.status === "released").reduce((s, v) => s + Number(v.amount), 0) || 0
      const totalKilled = vaults?.filter(v => v.status === "killed").reduce((s, v) => s + Number(v.amount), 0) || 0

      return JSON.stringify({
        current_vault: activeVault,
        has_active_vault: !!activeVault,
        total_locked_algo: activeVault ? Number(activeVault.amount) : 0,
        total_released_algo: totalReleased,
        total_returned_algo: totalKilled,
        vault_count: vaults?.length || 0,
        history: args.include_history ? vaults : undefined,
      }, null, 2)
    }

    case "list_upcoming_renewals": {
      const days = Math.min(Math.max(args.days_ahead || 7, 1), 90)
      const today = new Date().toISOString().slice(0, 10)
      const future = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
      const subs = await sbFetch(`subscriptions?user_id=eq.${args.user_id}&status=eq.active&next_billing_date=gte.${today}&next_billing_date=lte.${future}&select=id,name,amount,currency,next_billing_date,billing_cycle&order=next_billing_date.asc`)

      // Enrich with vault status
      if (subs && subs.length > 0) {
        const subIds = subs.map(s => s.id)
        const vaults = await sbFetch(`escrow_vaults?subscription_id=in.(${subIds.join(",")})&status=eq.locked&select=subscription_id,amount,app_id`).catch(() => [])
        const vaultMap = {}
        if (Array.isArray(vaults)) vaults.forEach(v => { vaultMap[v.subscription_id] = v })
        subs.forEach(s => {
          const vault = vaultMap[s.id]
          s.vault_locked = !!vault
          s.vault_algo = vault ? Number(vault.amount) : 0
          s.days_until_renewal = Math.ceil((new Date(s.next_billing_date).getTime() - Date.now()) / 86400000)
        })
      }

      const totalDue = subs?.reduce((s, sub) => s + (sub.amount || 0), 0) || 0
      const totalAlgoLocked = subs?.reduce((s, sub) => s + (sub.vault_algo || 0), 0) || 0

      return JSON.stringify({
        upcoming: subs || [],
        count: subs?.length || 0,
        total_due: Math.round(totalDue * 100) / 100,
        total_algo_locked: totalAlgoLocked,
        window_days: days,
        currency: subs?.[0]?.currency || "USD",
      }, null, 2)
    }

    case "trigger_cancellation": {
      const subs = await sbFetch(`subscriptions?id=eq.${args.subscription_id}&user_id=eq.${args.user_id}&select=id,name,status,amount,currency`)
      if (!subs || subs.length === 0) return JSON.stringify({ error: "Subscription not found or unauthorized", code: "NOT_FOUND" })
      if (subs[0].status === "cancelled") return JSON.stringify({ error: "Subscription is already cancelled", code: "ALREADY_CANCELLED" })

      // Insert cancellation alert
      await fetch(`${SUPABASE_URL}/rest/v1/agent_renewal_alerts`, {
        method: "POST",
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          subscription_id: args.subscription_id,
          user_decision: "cancel",
          alert_sent_at: new Date().toISOString(),
          alert_type: "mcp",
          decided_at: new Date().toISOString(),
        }),
      })

      // Log the action
      await logMCPRequest({ method: "tools/call", toolName: "trigger_cancellation", userId: args.user_id, success: true })

      return JSON.stringify({
        success: true,
        subscription: { name: subs[0].name, amount: subs[0].amount, currency: subs[0].currency },
        message: `Cancellation initiated for ${subs[0].name}. The autonomous agent will attempt browser-based cancellation on the next tick (within 30 minutes). If automated cancellation fails, guided instructions will be sent via Telegram.`,
        reason: args.reason || null,
        next_steps: [
          "Agent will attempt automated browser cancellation",
          "If that fails, guided instructions sent via Telegram",
          "Reply DONE in Telegram when manually cancelled",
          "Vault will be killed (ALGO returned) once confirmed",
        ],
      }, null, 2)
    }

    case "verify_cancellation_proof": {
      try {
        const { verifyCancellationProof } = await import("./skills/cancellation-proof.mjs")
        const proof = await verifyCancellationProof(args.txid)
        if (proof) {
          return JSON.stringify({
            verified: true,
            proof,
            blockchain: "Algorand",
            network: proof.network || "testnet",
            message: "This cancellation proof is valid and immutably recorded on the Algorand blockchain. It cannot be altered or deleted.",
            explorer_url: `https://${proof.network === "mainnet" ? "" : "testnet."}explorer.perawallet.app/tx/${args.txid}/`,
          }, null, 2)
        }
        return JSON.stringify({ verified: false, message: "No valid cancellation proof found for this transaction ID.", txid: args.txid })
      } catch (err) {
        return JSON.stringify({ error: err.message, code: "VERIFICATION_FAILED" })
      }
    }

    case "get_agent_status": {
      const includeActions = args.include_actions !== false
      const actionsLimit = includeActions ? 10 : 0
      const actions = actionsLimit > 0
        ? await sbFetch(`agent_actions?user_id=eq.${args.user_id}&select=created_at,status,payload&order=created_at.desc&limit=${actionsLimit}`)
        : []

      const lastRun = actions?.[0]
      const successCount = actions?.filter(a => a.status === "success").length || 0
      const errorCount = actions?.filter(a => a.status === "error").length || 0

      // Get vault stats
      const vaults = await sbFetch(`escrow_vaults?user_id=eq.${args.user_id}&select=status,amount`).catch(() => [])
      const lockedVaults = Array.isArray(vaults) ? vaults.filter(v => v.status === "locked") : []
      const totalLocked = lockedVaults.reduce((s, v) => s + Number(v.amount), 0)

      return JSON.stringify({
        agent_active: true,
        agent_version: SERVER_VERSION,
        last_run: lastRun?.created_at || null,
        last_status: lastRun?.status || "idle",
        check_interval: "30 minutes",
        health: {
          success_rate: actions?.length > 0 ? Math.round((successCount / actions.length) * 100) : 100,
          recent_successes: successCount,
          recent_errors: errorCount,
          vaults_managed: lockedVaults.length,
          total_algo_locked: totalLocked,
        },
        capabilities: [
          "vault_release (on-chain ALGO payment)",
          "vault_kill (return ALGO to user)",
          "telegram_alerts (pre-renewal notifications)",
          "browser_cancel (Playwright-based auto-cancel)",
          "guided_cancel (step-by-step instructions)",
          "cancellation_proofs (on-chain attestation)",
          "self_healing (auto-diagnosis on failure)",
        ],
        recent_actions: includeActions ? actions : undefined,
      }, null, 2)
    }

    case "trigger_vault_release": {
      // Verify vault belongs to user and is locked
      const vaults = await sbFetch(`escrow_vaults?id=eq.${args.vault_id}&user_id=eq.${args.user_id}&status=eq.locked&select=id,app_id,amount,vault_type,escrow_address,subscription_id`)
      if (!vaults || vaults.length === 0) return JSON.stringify({ error: "Vault not found, not owned by user, or not in locked state", code: "NOT_FOUND" })

      const vault = vaults[0]
      if (!vault.app_id || Number(vault.app_id) <= 0) {
        return JSON.stringify({ error: "Vault has no valid on-chain app_id", code: "INVALID_VAULT" })
      }

      try {
        const { releaseVault } = await import("./skills/release-vault.mjs")
        const txid = await releaseVault(vault)

        // Update DB
        await sbPatch(`escrow_vaults?id=eq.${vault.id}`, {
          status: "released",
          released_at: new Date().toISOString(),
          txn_id: txid,
        })

        return JSON.stringify({
          success: true,
          txid,
          amount_algo: Number(vault.amount),
          message: `Vault released on-chain. ${vault.amount} ALGO sent to recipient.`,
          explorer_url: `https://testnet.explorer.perawallet.app/tx/${txid}/`,
        }, null, 2)
      } catch (err) {
        return JSON.stringify({ error: `Release failed: ${err.message}`, code: "RELEASE_FAILED" })
      }
    }

    case "kill_vault": {
      const vaults = await sbFetch(`escrow_vaults?id=eq.${args.vault_id}&user_id=eq.${args.user_id}&status=eq.locked&select=id,app_id,amount,vault_type,subscription_id`)
      if (!vaults || vaults.length === 0) return JSON.stringify({ error: "Vault not found, not owned by user, or not in locked state", code: "NOT_FOUND" })

      const vault = vaults[0]
      if (!vault.app_id || Number(vault.app_id) <= 0) {
        return JSON.stringify({ error: "Vault has no valid on-chain app_id", code: "INVALID_VAULT" })
      }

      try {
        const { killVaultOnChain } = await import("./skills/release-vault.mjs")
        const txid = await killVaultOnChain(vault)

        await sbPatch(`escrow_vaults?id=eq.${vault.id}`, {
          status: "killed",
          killed_at: new Date().toISOString(),
          txn_id: txid,
        })

        // Also cancel the subscription
        if (vault.subscription_id) {
          await sbPatch(`subscriptions?id=eq.${vault.subscription_id}`, {
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancellation_method: "mcp_kill",
          })
        }

        return JSON.stringify({
          success: true,
          txid,
          amount_returned: Number(vault.amount),
          message: `Vault killed on-chain. ${vault.amount} ALGO returned to your wallet. The smart contract has been permanently deleted.`,
          reason: args.reason || null,
          explorer_url: `https://testnet.explorer.perawallet.app/tx/${txid}/`,
        }, null, 2)
      } catch (err) {
        return JSON.stringify({ error: `Kill failed: ${err.message}`, code: "KILL_FAILED" })
      }
    }

    case "pause_subscription": {
      const subs = await sbFetch(`subscriptions?id=eq.${args.subscription_id}&user_id=eq.${args.user_id}&select=id,name,status`)
      if (!subs || subs.length === 0) return JSON.stringify({ error: "Subscription not found or unauthorized", code: "NOT_FOUND" })

      const sub = subs[0]
      if (args.action === "pause") {
        if (sub.status === "paused") return JSON.stringify({ error: "Subscription is already paused", code: "ALREADY_PAUSED" })
        await sbPatch(`subscriptions?id=eq.${args.subscription_id}`, {
          status: "paused",
          paused_at: new Date().toISOString(),
          resume_date: args.resume_date || null,
        })
        return JSON.stringify({
          success: true,
          subscription: sub.name,
          action: "paused",
          resume_date: args.resume_date || null,
          message: `${sub.name} paused. No vault payments will be released until unpaused.${args.resume_date ? ` Will auto-resume on ${args.resume_date}.` : ""}`,
        }, null, 2)
      } else {
        if (sub.status !== "paused") return JSON.stringify({ error: "Subscription is not paused", code: "NOT_PAUSED" })
        await sbPatch(`subscriptions?id=eq.${args.subscription_id}`, {
          status: "active",
          paused_at: null,
          resume_date: null,
        })
        return JSON.stringify({
          success: true,
          subscription: sub.name,
          action: "unpaused",
          message: `${sub.name} resumed. Vault payments will release normally on the next billing date.`,
        }, null, 2)
      }
    }

    case "get_payment_history": {
      const limit = Math.min(Math.max(args.limit || 20, 1), 100)
      let query = `agent_actions?user_id=eq.${args.user_id}&status=eq.success&select=id,created_at,status,payload&order=created_at.desc&limit=${limit}`
      if (args.subscription_id) {
        query = `agent_actions?user_id=eq.${args.user_id}&subscription_id=eq.${args.subscription_id}&status=eq.success&select=id,created_at,status,payload&order=created_at.desc&limit=${limit}`
      }
      const actions = await sbFetch(query).catch(() => [])

      const payments = (actions || []).map(a => ({
        date: a.created_at,
        subscription: a.payload?.subscription_name || "Unknown",
        amount_algo: a.payload?.amount || null,
        txid: a.payload?.txid || null,
        mode: a.payload?.mode || "unknown",
        action: a.payload?.action || "release",
      }))

      const totalAlgo = payments.reduce((s, p) => s + (p.amount_algo || 0), 0)

      return JSON.stringify({
        payments,
        total_count: payments.length,
        total_algo_transacted: Math.round(totalAlgo * 10000) / 10000,
        message: payments.length === 0 ? "No on-chain payment history found. Payments are recorded when vaults are released." : undefined,
      }, null, 2)
    }

    case "get_subscription_health": {
      const subs = await sbFetch(`subscriptions?id=eq.${args.subscription_id}&user_id=eq.${args.user_id}&select=id,name,status,amount,currency,billing_cycle,next_billing_date,created_at,alert_enabled`)
      if (!subs || subs.length === 0) return JSON.stringify({ error: "Subscription not found", code: "NOT_FOUND" })

      const sub = subs[0]
      const vaults = await sbFetch(`escrow_vaults?subscription_id=eq.${args.subscription_id}&select=status,amount,created_at,released_at`).catch(() => [])
      const actions = await sbFetch(`agent_actions?subscription_id=eq.${args.subscription_id}&select=status,created_at&order=created_at.desc&limit=10`).catch(() => [])

      // Calculate health score (0-100)
      let score = 70 // base score
      const hasVault = Array.isArray(vaults) && vaults.some(v => v.status === "locked")
      const successfulReleases = Array.isArray(actions) ? actions.filter(a => a.status === "success").length : 0
      const failedReleases = Array.isArray(actions) ? actions.filter(a => a.status === "error").length : 0
      const daysUntilRenewal = sub.next_billing_date ? Math.ceil((new Date(sub.next_billing_date).getTime() - Date.now()) / 86400000) : null

      if (hasVault) score += 15 // vault locked = good
      if (sub.alert_enabled) score += 5
      if (successfulReleases > 0) score += 10
      if (failedReleases > 0) score -= failedReleases * 5
      if (sub.status === "paused") score -= 10
      if (daysUntilRenewal !== null && daysUntilRenewal <= 1 && !hasVault) score -= 20 // renewal imminent, no vault

      score = Math.max(0, Math.min(100, score))

      const risks = []
      if (!hasVault && sub.status === "active") risks.push("No active vault — payment may not be automated")
      if (daysUntilRenewal !== null && daysUntilRenewal <= 3) risks.push(`Renewal in ${daysUntilRenewal} day(s)`)
      if (failedReleases > 2) risks.push("Multiple failed releases — may need manual intervention")
      if (!sub.alert_enabled) risks.push("Alerts disabled — you won't get pre-renewal notifications")

      return JSON.stringify({
        subscription: { name: sub.name, status: sub.status, amount: sub.amount, currency: sub.currency },
        health_score: score,
        health_label: score >= 80 ? "Healthy" : score >= 50 ? "Needs Attention" : "At Risk",
        days_until_renewal: daysUntilRenewal,
        has_active_vault: hasVault,
        payment_reliability: actions?.length > 0 ? Math.round((successfulReleases / actions.length) * 100) : null,
        risks,
        recommendations: risks.length > 0 ? risks.map(r => `Fix: ${r}`) : ["All good — subscription is well-managed"],
      }, null, 2)
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}`, code: "UNKNOWN_TOOL" })
  }
}


// ─── Resource Handlers ───────────────────────────────────────────────────────

async function readResource(uri) {
  const subMatch = uri.match(/unsubscribely:\/\/subscriptions\/(.+)/)
  if (subMatch) {
    const userId = subMatch[1]
    const subs = await sbFetch(`subscriptions?user_id=eq.${userId}&select=*&order=created_at.desc`)
    return JSON.stringify(subs || [], null, 2)
  }

  const vaultMatch = uri.match(/unsubscribely:\/\/vaults\/(.+)/)
  if (vaultMatch) {
    const userId = vaultMatch[1]
    const vaults = await sbFetch(`escrow_vaults?user_id=eq.${userId}&select=*&order=created_at.desc`)
    return JSON.stringify(vaults || [], null, 2)
  }

  const actionMatch = uri.match(/unsubscribely:\/\/agent-actions\/(.+)/)
  if (actionMatch) {
    const userId = actionMatch[1]
    const actions = await sbFetch(`agent_actions?user_id=eq.${userId}&select=*&order=created_at.desc&limit=50`)
    return JSON.stringify(actions || [], null, 2)
  }

  const reportMatch = uri.match(/unsubscribely:\/\/spending-report\/(.+)/)
  if (reportMatch) {
    const userId = reportMatch[1]
    const subs = await sbFetch(`subscriptions?user_id=eq.${userId}&status=eq.active&select=name,amount,currency,billing_cycle,category`)
    if (!subs || subs.length === 0) return JSON.stringify({ message: "No active subscriptions" })

    const monthly = subs.reduce((sum, s) => {
      const amt = s.amount || 0
      if (s.billing_cycle === "monthly") return sum + amt
      if (s.billing_cycle === "yearly") return sum + amt / 12
      if (s.billing_cycle === "quarterly") return sum + amt / 3
      if (s.billing_cycle === "weekly") return sum + amt * 4.33
      return sum
    }, 0)

    const categories = {}
    subs.forEach(s => {
      const cat = s.category || "Other"
      categories[cat] = (categories[cat] || 0) + (s.amount || 0)
    })

    return JSON.stringify({
      generated_at: new Date().toISOString(),
      total_monthly: Math.round(monthly * 100) / 100,
      yearly_projection: Math.round(monthly * 12 * 100) / 100,
      active_count: subs.length,
      currency: subs[0]?.currency || "USD",
      by_category: categories,
      subscriptions: subs.map(s => ({ name: s.name, amount: s.amount, cycle: s.billing_cycle })),
    }, null, 2)
  }

  return JSON.stringify({ error: "Resource not found", uri })
}

// ─── Prompt Handlers ─────────────────────────────────────────────────────────

async function getPrompt(name, args) {
  switch (name) {
    case "subscription_audit": {
      const userId = args?.user_id
      if (!userId) return { error: "user_id is required" }

      const subs = await sbFetch(`subscriptions?user_id=eq.${userId}&status=eq.active&select=name,amount,currency,billing_cycle,category,next_billing_date,created_at`)
      const vaults = await sbFetch(`escrow_vaults?user_id=eq.${userId}&select=subscription_id,status,amount`).catch(() => [])

      const subList = (subs || []).map(s => `- ${s.name}: ${s.currency} ${s.amount}/${s.billing_cycle} (category: ${s.category || "Other"}, next: ${s.next_billing_date})`).join("\n")
      const vaultList = Array.isArray(vaults) ? vaults.filter(v => v.status === "locked").map(v => `- ${v.subscription_id}: ${v.amount} ALGO locked`).join("\n") : "None"

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Perform a subscription audit for this user. Analyze their spending, find overlaps, identify unused or overpriced services, and suggest optimizations.\n\nActive Subscriptions:\n${subList || "None"}\n\nLocked Vaults:\n${vaultList}\n\nProvide:\n1. Total monthly/yearly spend\n2. Category breakdown\n3. Overlap detection (multiple services in same category)\n4. Cost optimization suggestions\n5. Risk assessment (subscriptions without vaults, upcoming renewals)\n6. Recommended actions (cancel, downgrade, consolidate)`,
            },
          },
        ],
      }
    }

    case "cancellation_guide": {
      const serviceName = args?.subscription_name
      if (!serviceName) return { error: "subscription_name is required" }

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Generate step-by-step cancellation instructions for ${serviceName}. Include:\n1. Direct URL to the cancellation page\n2. Step-by-step instructions with expected UI elements\n3. Common retention offers they might show (and how to decline)\n4. How to verify the cancellation was successful\n5. What to expect after cancellation (grace period, data retention)\n6. Alternative: how to downgrade instead of fully cancelling\n\nNote: After cancelling, the user should reply "done" in their Telegram bot to confirm and trigger the vault kill (returning their ALGO).`,
            },
          },
        ],
      }
    }

    case "vault_explainer": {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Explain how Algorand escrow vaults work in Unsubscribely:\n\n1. **Lock**: User creates a vault by deploying an Algorand smart contract (application). They deposit ALGO equal to their subscription cost. The vault is "locked" — funds can only be released by the authorized agent wallet.\n\n2. **Release**: When a subscription payment is due, the autonomous agent calls the vault's release() method on-chain. This sends the locked ALGO to the service provider's address. A new vault can then be created for the next billing cycle.\n\n3. **Kill (Cancel)**: If the user decides to cancel, the agent calls DeleteApplication on the vault contract. This permanently deletes the smart contract and returns ALL remaining ALGO to the vault creator (the user). An on-chain cancellation proof is also written.\n\n4. **Agent Role**: The agent wallet (a separate Algorand account) is authorized on each vault contract. It runs every 30 minutes, checking which vaults are due for release. It sends Telegram alerts before releasing, giving users a chance to cancel.\n\n5. **On-Chain Proofs**: Every release and kill generates an Algorand transaction ID that serves as an immutable receipt. Cancellation proofs are written as zero-ALGO self-transfers with structured JSON notes.\n\nKey properties:\n- Non-custodial: Only the vault contract holds funds, not Unsubscribely\n- Transparent: All transactions visible on Algorand explorer\n- Reversible: User can always kill a vault to get funds back\n- Automated: Agent handles the release schedule without manual intervention`,
            },
          },
        ],
      }
    }

    default:
      return { error: `Unknown prompt: ${name}` }
  }
}


// ─── MCP JSON-RPC Handler ────────────────────────────────────────────────────

/**
 * Process a single MCP JSON-RPC request.
 * Returns the response object or null (for notifications).
 */
async function processRequest(body, authContext) {
  const { method, params, id } = body

  switch (method) {
    case "initialize": {
      const sessionId = randomUUID()
      SESSIONS.set(sessionId, {
        token: authContext?.token_id,
        created_at: Date.now(),
        last_active: Date.now(),
        request_count: 0,
      })
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
            prompts: { listChanged: false },
          },
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION,
          },
          _meta: {
            session_id: sessionId,
            authenticated: authContext?.authenticated || false,
            scopes: authContext?.scopes || [],
            rate_limit: { max_requests: RATE_LIMIT_MAX_REQUESTS, window_seconds: RATE_LIMIT_WINDOW_MS / 1000 },
          },
        },
      }
    }

    case "notifications/initialized":
    case "notifications/cancelled":
      // Notifications don't get responses
      return null

    case "ping":
      return { jsonrpc: "2.0", id, result: {} }

    case "tools/list": {
      // Filter tools based on user's scopes
      const visibleTools = authContext?.scopes?.includes("all")
        ? TOOLS
        : TOOLS.filter(t => hasPermission(authContext?.scopes || ["read"], t.name))
      return { jsonrpc: "2.0", id, result: { tools: visibleTools } }
    }

    case "tools/call": {
      const { name, arguments: args } = params || {}
      if (!name) {
        return { jsonrpc: "2.0", id, error: { code: -32602, message: "Missing tool name" } }
      }

      // Permission check
      if (!hasPermission(authContext?.scopes || [], name)) {
        return {
          jsonrpc: "2.0", id,
          error: { code: -32600, message: `Permission denied: your token does not have access to tool '${name}'. Required scope: ${Object.entries(SCOPES).find(([_, tools]) => Array.isArray(tools) && tools.includes(name))?.[0] || "admin"}` },
        }
      }

      // User ID enforcement: if token is scoped to a user, enforce it
      if (authContext?.user_id && args?.user_id && args.user_id !== authContext.user_id) {
        return {
          jsonrpc: "2.0", id,
          error: { code: -32600, message: "Permission denied: cannot access another user's data with this token" },
        }
      }

      // If token has a user_id and tool requires one, inject it
      const effectiveArgs = { ...args }
      if (authContext?.user_id && !effectiveArgs.user_id) {
        effectiveArgs.user_id = authContext.user_id
      }

      const startTime = Date.now()
      let toolResult
      try {
        toolResult = await executeTool(name, effectiveArgs)
      } catch (err) {
        toolResult = JSON.stringify({ error: err.message, code: "INTERNAL_ERROR" })
      }
      const duration = Date.now() - startTime

      // Audit log
      logMCPRequest({
        method: "tools/call",
        toolName: name,
        tokenId: authContext?.token_id,
        userId: effectiveArgs.user_id || authContext?.user_id,
        duration_ms: duration,
        success: !toolResult.includes('"error"'),
        error_msg: toolResult.includes('"error"') ? JSON.parse(toolResult).error : null,
      }).catch(() => {})

      const isError = toolResult.includes('"error"') && !toolResult.includes('"verified"')
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: toolResult }],
          isError,
          _meta: { duration_ms: duration, tool: name },
        },
      }
    }

    case "resources/list":
      return { jsonrpc: "2.0", id, result: { resources: RESOURCES } }

    case "resources/read": {
      const { uri } = params || {}
      if (!uri) return { jsonrpc: "2.0", id, error: { code: -32602, message: "Missing resource URI" } }

      // Enforce user_id from token if present
      if (authContext?.user_id) {
        const uriUserId = uri.match(/\/([^/]+)$/)?.[1]
        if (uriUserId && uriUserId !== authContext.user_id) {
          return { jsonrpc: "2.0", id, error: { code: -32600, message: "Permission denied: cannot read another user's resources" } }
        }
      }

      const content = await readResource(uri)
      return {
        jsonrpc: "2.0",
        id,
        result: {
          contents: [{ uri, mimeType: "application/json", text: content }],
        },
      }
    }

    case "prompts/list":
      return { jsonrpc: "2.0", id, result: { prompts: PROMPTS } }

    case "prompts/get": {
      const { name, arguments: promptArgs } = params || {}
      if (!name) return { jsonrpc: "2.0", id, error: { code: -32602, message: "Missing prompt name" } }

      const promptResult = await getPrompt(name, promptArgs || {})
      if (promptResult.error) {
        return { jsonrpc: "2.0", id, error: { code: -32602, message: promptResult.error } }
      }
      return { jsonrpc: "2.0", id, result: promptResult }
    }

    default:
      return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } }
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Handle an incoming MCP HTTP request.
 * Supports single requests and batch (array of requests).
 *
 * @param {object} body - Parsed JSON body (single request or array)
 * @param {object} [authContext] - Authentication context from middleware
 * @returns {object|object[]|null} JSON-RPC response(s)
 */
export async function handleMCPRequest(body, authContext) {
  // Batch support: JSON-RPC 2.0 allows arrays of requests
  if (Array.isArray(body)) {
    if (body.length === 0) {
      return { jsonrpc: "2.0", error: { code: -32600, message: "Empty batch" } }
    }
    if (body.length > 10) {
      return { jsonrpc: "2.0", error: { code: -32600, message: "Batch too large (max 10 requests)" } }
    }
    const results = await Promise.all(body.map(req => processRequest(req, authContext)))
    return results.filter(r => r !== null) // Remove notification responses
  }

  return processRequest(body, authContext)
}

/**
 * Full HTTP handler for the /mcp endpoint.
 * Handles auth, rate limiting, CORS, and request processing.
 *
 * @param {IncomingMessage} req
 * @param {ServerResponse} res
 */
export async function handleMCPHTTP(req, res) {
  // CORS headers for browser-based MCP clients
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-MCP-Session")
  res.setHeader("Access-Control-Expose-Headers", "X-MCP-Session, X-RateLimit-Remaining, X-RateLimit-Reset")

  if (req.method === "OPTIONS") {
    res.writeHead(204)
    return res.end()
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" })
    return res.end(JSON.stringify({ error: "Method not allowed. Use POST." }))
  }

  // Authentication
  const authHeader = req.headers.authorization
  const authContext = await authenticateRequest(authHeader)

  // Allow unauthenticated initialize (so clients can discover capabilities)
  // but require auth for everything else
  let body
  try {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    body = JSON.parse(Buffer.concat(chunks).toString())
  } catch (err) {
    res.writeHead(400, { "Content-Type": "application/json" })
    return res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } }))
  }

  const method = Array.isArray(body) ? body[0]?.method : body?.method
  const isInitialize = method === "initialize" || method === "ping"

  if (!isInitialize && !authContext.authenticated) {
    res.writeHead(401, { "Content-Type": "application/json" })
    return res.end(JSON.stringify({
      jsonrpc: "2.0",
      id: body?.id || null,
      error: { code: -32000, message: authContext.error || "Authentication required. Provide a Bearer token in the Authorization header." },
    }))
  }

  // Rate limiting (skip for initialize/ping)
  if (!isInitialize && authContext.token_id) {
    const rateCheck = checkRateLimit(authContext.token_id)
    if (!rateCheck.allowed) {
      res.setHeader("X-RateLimit-Remaining", "0")
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(rateCheck.retry_after_ms / 1000)))
      res.setHeader("Retry-After", String(Math.ceil(rateCheck.retry_after_ms / 1000)))
      res.writeHead(429, { "Content-Type": "application/json" })
      return res.end(JSON.stringify({
        jsonrpc: "2.0",
        id: body?.id || null,
        error: { code: -32000, message: `Rate limit exceeded. Retry after ${Math.ceil(rateCheck.retry_after_ms / 1000)} seconds.` },
      }))
    }
  }

  // Process the request
  const result = await handleMCPRequest(body, authContext)

  if (result === null) {
    // Notification — no response body
    res.writeHead(204)
    return res.end()
  }

  res.writeHead(200, { "Content-Type": "application/json" })
  res.end(JSON.stringify(result))
}
