/**
 * Dual Agent Entrypoint — Nanobot (cron) + Fallback Cron + HTTP cancel endpoint.
 */
import { createServer } from "node:http"
import { startNanobot } from "./nanobot.mjs"
import { startFallbackCron } from "./fallback-cron.mjs"
import { guidedCancel } from "./skills/guided-cancel.mjs"
import { verifyCancellationProof } from "./skills/cancellation-proof.mjs"
import { handleMCPRequest, handleMCPHTTP } from "./mcp-server.mjs"
import { x402CancelHandler } from "./skills/x402-cancel-agent.mjs"

console.log("=== Unsubscribely Agent System ===")
console.log(`Time: ${new Date().toISOString()}`)
console.log(`Node: ${process.version}`)
console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "NOT SET"}`)
console.log(`TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? "set" : "NOT SET"}`)
console.log(`AGENT_WALLET_MNEMONIC: ${process.env.AGENT_WALLET_MNEMONIC ? "set" : "NOT SET"}`)
console.log(`SUBSCRIPTION_CREDS_KEY: ${process.env.SUBSCRIPTION_CREDS_KEY ? "set" : "NOT SET"}`)
console.log("==================================")

  // Start Nanobot — runs monitor immediately, then every 30m
startNanobot()

// Start Fallback Cron — runs 15m after startup, then every 30m
startFallbackCron()

// HTTP server: health check + cancel endpoints
const PORT = Number(process.env.PORT || 8080)
const server = createServer(async (req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
    res.end(JSON.stringify({ status: "ok", agent: "unsubscribely", uptime: Math.round(process.uptime()) }))
  } else if (req.url === "/api/cancel" && req.method === "POST") {
    // Verify request comes from our Vercel deployment
    const authHeader = req.headers.authorization
    const expectedToken = process.env.OPENCLAW_GATEWAY_TOKEN
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      res.writeHead(401, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Unauthorized" }))
      return
    }
    try {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const body = JSON.parse(Buffer.concat(chunks).toString())
      const { subscription_id, chat_id } = body
      if (!subscription_id || !chat_id) {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "subscription_id and chat_id required" }))
        return
      }
      guidedCancel(subscription_id, chat_id)
        .then(() => console.log(`[cancel] completed for ${subscription_id}`))
        .catch((err) => console.error(`[cancel] failed: ${err.message}`))
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ ok: true }))
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: err.message }))
    }
  } else if (req.url?.startsWith("/api/proof/") && req.method === "GET") {
    // Verify a cancellation proof by txid
    const txid = req.url.split("/api/proof/")[1]
    if (!txid) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "txid required" }))
      return
    }
    try {
      const proof = await verifyCancellationProof(txid)
      if (proof) {
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ verified: true, proof, txid }))
      } else {
        res.writeHead(404, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ verified: false, error: "Proof not found or invalid" }))
      }
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: err.message }))
    }
  } else if (req.url === "/api/x402-cancel" && req.method === "POST") {
    // x402-gated cancellation endpoint — agent-to-agent commerce
    // In production, this would be wrapped by x402 middleware.
    // For now, verify auth token and execute.
    const authHeader = req.headers.authorization
    const expectedToken = process.env.OPENCLAW_GATEWAY_TOKEN
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      res.writeHead(401, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Unauthorized" }))
      return
    }
    try {
      await x402CancelHandler(req, res, { txid: req.headers["x-payment-txid"] || "direct-call" })
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: err.message }))
    }
  } else if (req.url === "/api/v1/message" && req.method === "POST") {
    // Verify request comes from our Vercel deployment
    const authHeader = req.headers.authorization
    const expectedToken = process.env.OPENCLAW_GATEWAY_TOKEN
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      res.writeHead(401, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Unauthorized" }))
      return
    }
    try {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const body = JSON.parse(Buffer.concat(chunks).toString())
      const msg = body.message || ""
      const match = msg.match(/Cancel subscription ([0-9a-f-]{36}) for the user with Telegram chat (\d+)/i)
      if (match) {
        console.log(`[v1-message] cancel sub=${match[1]} chat=${match[2]}`)
        guidedCancel(match[1], match[2])
          .then(() => console.log(`[v1-message] completed`))
          .catch((err) => console.error(`[v1-message] failed: ${err.message}`))
      }
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ ok: true }))
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: err.message }))
    }
  } else if ((req.url === "/mcp" || req.url === "/mcp/v1") && (req.method === "POST" || req.method === "OPTIONS")) {
    // MCP (Model Context Protocol) endpoint — full auth, rate limiting, CORS
    // Supports both /mcp and /mcp/v1 for versioned access
    try {
      await handleMCPHTTP(req, res)
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: err.message } }))
    }
  } else if ((req.url === "/mcp/health" || req.url === "/mcp/v1/health") && req.method === "GET") {
    // MCP health/discovery endpoint
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    })
    res.end(JSON.stringify({
      name: "unsubscribely-mcp",
      version: "2.0.0",
      protocol: "mcp",
      protocol_version: "2025-06-18",
      transport: "http",
      auth: "bearer",
      endpoints: { mcp: "/mcp", versioned: "/mcp/v1", health: "/mcp/health" },
      capabilities: ["tools", "resources", "prompts"],
      tools_count: 12,
    }))
  } else {
    res.writeHead(404)
    res.end("not found")
  }
})
server.listen(PORT, () => console.log(`[http] listening on port ${PORT}`))

process.on("SIGINT", () => process.exit(0))
process.on("SIGTERM", () => process.exit(0))
