const http = require("http")
const fs   = require("fs")
const path = require("path")

const DIST = path.join(__dirname, "dist")
const PORT = process.env.PORT || 3000
const START_TIME = Date.now()

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

// ── Security headers applied to every response ──────────────────────────────
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
}

// ── Rate limiter (sliding window, per IP) ────────────────────────────────────
// 200 requests per 60-second window per IP.
const RATE_WINDOW_MS  = 60_000
const RATE_LIMIT      = 200
const rateLedger      = new Map() // ip → { count, windowStart }

function isRateLimited(ip) {
  const now  = Date.now()
  const entry = rateLedger.get(ip)

  if (!entry || now - entry.windowStart >= RATE_WINDOW_MS) {
    rateLedger.set(ip, { count: 1, windowStart: now })
    return false
  }

  entry.count++
  if (entry.count > RATE_LIMIT) return true
  return false
}

// Clean stale entries every 5 minutes so the Map doesn't grow forever
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of rateLedger.entries()) {
    if (now - entry.windowStart >= RATE_WINDOW_MS) rateLedger.delete(ip)
  }
}, 5 * 60_000)

// ── Helper: write headers + security headers ─────────────────────────────────
function respond(res, status, extraHeaders, body) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...extraHeaders })
  if (body !== undefined) res.end(body)
}

// ── Helper: get real client IP ───────────────────────────────────────────────
function getIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  )
}

// ── Server ───────────────────────────────────────────────────────────────────
const server = http.createServer(function (req, res) {
  const ip = getIP(req)

  // Rate limiting
  if (isRateLimited(ip)) {
    respond(res, 429, { "Content-Type": "application/json", "Retry-After": "60" },
      JSON.stringify({ error: "Too many requests. Please wait a moment." }))
    return
  }

  let urlPath = req.url.split("?")[0]

  // ── Health / monitoring endpoint ─────────────────────────────────────────
  if (urlPath === "/api/health") {
    const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000)
    const payload = {
      status: "ok",
      uptime: uptimeSeconds,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "unknown",
      node: process.version,
    }
    respond(res, 200, { "Content-Type": "application/json", "Cache-Control": "no-store" },
      JSON.stringify(payload))
    return
  }

  // ── Static file serving ──────────────────────────────────────────────────
  if (urlPath === "/") urlPath = "/index.html"
  const filePath = path.join(DIST, urlPath)

  // Directory traversal guard
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

server.listen(PORT, "0.0.0.0", function () {
  console.log(`Server running on http://0.0.0.0:${PORT}`)
  console.log(`Health check: http://0.0.0.0:${PORT}/api/health`)
})
