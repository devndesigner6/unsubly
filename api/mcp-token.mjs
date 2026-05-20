/**
 * POST /api/mcp-token
 *
 * Generate or list MCP API tokens for the authenticated user.
 * These tokens allow external AI agents (Claude, ChatGPT) to access
 * the user's subscription data via the MCP protocol.
 *
 * Actions:
 * - POST { action: "create", name, scopes } → creates a new token
 * - POST { action: "list" } → lists all active tokens
 * - POST { action: "revoke", token_id } → revokes a token
 */

import { createClient } from "@supabase/supabase-js"
import { createHash, randomBytes } from "node:crypto"

function getServiceClient() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

async function getAuthedUser(req) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) return null
  const token = authHeader.slice(7)
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null
  const client = createClient(url, key, { auth: { persistSession: false } })
  const { data: { user }, error } = await client.auth.getUser(token)
  if (error || !user) return null
  return user
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405
    return res.end(JSON.stringify({ error: "Method not allowed" }))
  }

  const user = await getAuthedUser(req)
  if (!user) {
    res.statusCode = 401
    return res.end(JSON.stringify({ error: "Unauthorized" }))
  }

  const sb = getServiceClient()
  if (!sb) {
    res.statusCode = 500
    return res.end(JSON.stringify({ error: "Server misconfigured" }))
  }

  let body = {}
  try {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    body = JSON.parse(Buffer.concat(chunks).toString())
  } catch {}

  const { action } = body

  if (action === "create") {
    const name = body.name || "Default Token"
    const scopes = body.scopes || ["read"]
    const validScopes = ["read", "write", "admin", "all"]
    const filteredScopes = scopes.filter(s => validScopes.includes(s))
    if (filteredScopes.length === 0) {
      res.statusCode = 400
      return res.end(JSON.stringify({ error: "Invalid scopes. Valid: read, write, admin, all" }))
    }

    // Max 5 active tokens per user
    const { data: existing } = await sb
      .from("mcp_api_tokens")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
    if (existing && existing.length >= 5) {
      res.statusCode = 400
      return res.end(JSON.stringify({ error: "Maximum 5 active tokens. Revoke an existing one first." }))
    }

    // Generate a secure random token
    const rawToken = `umcp_${randomBytes(32).toString("hex")}`
    const tokenHash = createHash("sha256").update(rawToken).digest("hex")

    // Expire in 90 days by default
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

    const { error } = await sb.from("mcp_api_tokens").insert({
      user_id: user.id,
      name,
      token_hash: tokenHash,
      scopes: filteredScopes,
      expires_at: expiresAt,
    })

    if (error) {
      // Table might not exist yet
      if (error.message?.includes("relation") || error.code === "42P01") {
        res.statusCode = 500
        return res.end(JSON.stringify({ error: "MCP tokens table not set up. Run the migration first." }))
      }
      res.statusCode = 500
      return res.end(JSON.stringify({ error: error.message }))
    }

    res.statusCode = 200
    res.setHeader("Content-Type", "application/json")
    return res.end(JSON.stringify({
      token: rawToken,
      name,
      scopes: filteredScopes,
      expires_at: expiresAt,
      warning: "Save this token now — it cannot be retrieved again.",
      usage: {
        header: `Authorization: Bearer ${rawToken}`,
        endpoint: `${process.env.OPENCLAW_RAILWAY_URL || "https://unsubscribely-agent-agent-production.up.railway.app"}/mcp`,
        example_curl: `curl -X POST ${process.env.OPENCLAW_RAILWAY_URL || "https://unsubscribely-agent-agent-production.up.railway.app"}/mcp -H "Authorization: Bearer ${rawToken}" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
      },
    }))
  }

  if (action === "list") {
    const { data, error } = await sb
      .from("mcp_api_tokens")
      .select("id, name, scopes, is_active, expires_at, last_used_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      if (error.message?.includes("relation") || error.code === "42P01") {
        res.statusCode = 200
        return res.end(JSON.stringify({ tokens: [], message: "MCP tokens table not set up yet." }))
      }
      res.statusCode = 500
      return res.end(JSON.stringify({ error: error.message }))
    }

    res.statusCode = 200
    res.setHeader("Content-Type", "application/json")
    return res.end(JSON.stringify({ tokens: data || [] }))
  }

  if (action === "revoke") {
    const { token_id } = body
    if (!token_id) {
      res.statusCode = 400
      return res.end(JSON.stringify({ error: "token_id required" }))
    }

    const { error } = await sb
      .from("mcp_api_tokens")
      .update({ is_active: false })
      .eq("id", token_id)
      .eq("user_id", user.id)

    if (error) {
      res.statusCode = 500
      return res.end(JSON.stringify({ error: error.message }))
    }

    res.statusCode = 200
    res.setHeader("Content-Type", "application/json")
    return res.end(JSON.stringify({ success: true, message: "Token revoked" }))
  }

  res.statusCode = 400
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify({ error: "Invalid action. Use: create, list, revoke" }))
}
