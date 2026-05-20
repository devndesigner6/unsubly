import http from "http"
import fs from "fs"
import path from "path"
import { fileURLToPath, pathToFileURL } from "url"

import {
  agentRunHandler,
  advanceBillingHandler,
  agentRegistryHandler,
  x402DemoHandler,
  chatHandler,
} from "./server/handlers.mjs"
import { telegramConnectHandler } from "./api/telegram-connect.mjs"
import { telegramWebhookHandler } from "./api/telegram-webhook.mjs"
import { gmailScanHandler } from "./api/gmail-scan.mjs"
import { saveCredentialsHandler } from "./api/save-credentials.mjs"
import dodoWebhookHandler from "./api/dodo-webhook.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const DIST = path.join(__dirname, "dist")
const PORT = process.env.PORT || 3000
const START_TIME = Date.now()
const TRUST_PROXY_HOPS = Number(process.env.TRUST_PROXY_HOPS || "1")

// ── MIME types ──────────────────────────────────────────────────────────────
const MIME = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".mjs":  "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".webp": "image/webp",
  ".txt":  "text/plain",
  ".webmanifest": "application/manifest+json",
}

// ── Security headers ────────────────────────────────────────────────────────
// CSP is intentionally permissive for the wallet/Algorand SDKs which load
// scripts from algonode.cloud and need inline styles for shadcn. Tighten
// further once a custom domain is in place.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.algonode.cloud https://*.supabase.co https://*.algorand.foundation https://api.groq.com wss://*.supabase.co",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ")

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy": CSP,
}

// ── Per-IP rate limiter ─────────────────────────────────────────────────────
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT     = 200
const rateLedger     = new Map()

function isRateLimited(ip) {
  const now = Date.now()
  const entry = rateLedger.get(ip)
  if (!entry || now - entry.windowStart >= RATE_WINDOW_MS) {
    rateLedger.set(ip, { count: 1, windowStart: now })
    return false
  }
  entry.count++
  return entry.count > RATE_LIMIT
}

setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of rateLedger.entries()) {
    if (now - entry.windowStart >= RATE_WINDOW_MS) rateLedger.delete(ip)
  }
}, 5 * 60_000)

function respond(res, status, extraHeaders, body) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...extraHeaders })
  if (body !== undefined) res.end(body)
}

/**
 * Get the real client IP, trusting only the FIRST `TRUST_PROXY_HOPS` entries
 * of X-Forwarded-For (the trusted proxy chain). Anything beyond that is
 * client-supplied and easily spoofed, so it's discarded.
 */
function getIP(req) {
  const xff = req.headers["x-forwarded-for"]
  if (xff && TRUST_PROXY_HOPS > 0) {
    const chain = String(xff).split(",").map((s) => s.trim()).filter(Boolean)
    // Walk back from the right (closest proxy) the number of hops we trust
    const trustedIdx = Math.max(0, chain.length - TRUST_PROXY_HOPS)
    return chain[trustedIdx] || req.socket?.remoteAddress || "unknown"
  }
  return req.socket?.remoteAddress || "unknown"
}

// ── Wrap an async handler so its errors don't crash the server ──────────────
function wrap(handler) {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (err) {
      console.error("[handler] uncaught:", err)
      if (!res.headersSent) {
        respond(res, 500, { "Content-Type": "application/json" },
          JSON.stringify({ error: "Internal server error" }))
      }
    }
  }
}

const apiRoutes = {
  "/api/ai-optimizer":       wrap(chatHandler),
  "/api/agent-run":          wrap(agentRunHandler),
  "/api/advance-billing":    wrap(advanceBillingHandler),
  "/api/agent/registry":     wrap(agentRegistryHandler),
  "/api/x402-demo":          wrap(x402DemoHandler),
  "/api/telegram-connect":   wrap(telegramConnectHandler),
  "/api/telegram-webhook":   wrap(telegramWebhookHandler),
  "/api/gmail-scan":         wrap(gmailScanHandler),
  "/api/save-credentials":   wrap(saveCredentialsHandler),
  "/api/dodo-webhook":       wrap(dodoWebhookHandler),
}

const server = http.createServer(async function (req, res) {
  const ip = getIP(req)

  if (isRateLimited(ip)) {
    respond(res, 429, { "Content-Type": "application/json", "Retry-After": "60" },
      JSON.stringify({ error: "Too many requests. Please wait a moment." }))
    return
  }

  let urlPath = req.url.split("?")[0]

  // ── Health endpoint ─────────────────────────────────────────────────────
  if (urlPath === "/api/health") {
    const uptime = Math.floor((Date.now() - START_TIME) / 1000)
    respond(res, 200, { "Content-Type": "application/json", "Cache-Control": "no-store" },
      JSON.stringify({
        status: "ok", uptime, timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "unknown", node: process.version,
      }))
    return
  }

  // ── API routes ──────────────────────────────────────────────────────────
  if (apiRoutes[urlPath]) {
    // Apply security headers but let the handler control content-type
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v)
    return apiRoutes[urlPath](req, res)
  }

  // ── Static file serving ─────────────────────────────────────────────────
  if (urlPath === "/") urlPath = "/index.html"
  const filePath = path.join(DIST, urlPath)
  if (!filePath.startsWith(DIST)) {
    respond(res, 403, {}, "Forbidden")
    return
  }

  function tryFile(fp) {
    try {
      const stat = fs.statSync(fp)
      if (stat.isFile()) {
        const ext = path.extname(fp).toLowerCase()
        const mime = MIME[ext] || "application/octet-stream"
        const isAsset = fp.includes(path.sep + "assets" + path.sep)
        respond(res, 200, {
          "Content-Type": mime,
          "Cache-Control": isAsset ? "public, max-age=31536000, immutable" : "no-cache",
        })
        fs.createReadStream(fp).pipe(res)
        return true
      }
    } catch (_) {}
    return false
  }

  if (tryFile(filePath)) return
  if (tryFile(filePath + ".html")) return
  if (tryFile(path.join(filePath, "index.html"))) return

  // SPA fallback
  const index = path.join(DIST, "index.html")
  try {
    fs.statSync(index)
    respond(res, 200, { "Content-Type": "text/html", "Cache-Control": "no-cache" })
    fs.createReadStream(index).pipe(res)
  } catch (_) {
    respond(res, 404, { "Content-Type": "text/plain" }, "Not found — run npm run build first")
  }
})

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`)
  console.log(`Health: http://0.0.0.0:${PORT}/api/health`)
  console.log(`Trusting ${TRUST_PROXY_HOPS} proxy hop(s) for client IP detection`)
})
