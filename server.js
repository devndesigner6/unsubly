const http = require("http")
const fs = require("fs")
const path = require("path")

const DIST = path.join(__dirname, "dist")
const PORT = process.env.PORT || 3000

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

const server = http.createServer(function (req, res) {
  let urlPath = req.url.split("?")[0]
  if (urlPath === "/") urlPath = "/index.html"

  const filePath = path.join(DIST, urlPath)

  // Security: prevent directory traversal
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403)
    res.end()
    return
  }

  function tryFile(fp) {
    try {
      const stat = fs.statSync(fp)
      if (stat.isFile()) {
        const ext = path.extname(fp).toLowerCase()
        const mime = MIME[ext] || "application/octet-stream"
        const isAsset = fp.includes(path.sep + "assets" + path.sep)
        res.writeHead(200, {
          "Content-Type": mime,
          "Cache-Control": isAsset ? "public, max-age=31536000, immutable" : "no-cache",
        })
        fs.createReadStream(fp).pipe(res)
        return true
      }
    } catch (_) {}
    return false
  }

  // 1. Try exact file
  if (tryFile(filePath)) return
  // 2. Try with .html extension
  if (tryFile(filePath + ".html")) return
  // 3. Try index.html inside directory
  if (tryFile(path.join(filePath, "index.html"))) return

  // 4. SPA fallback — serve index.html for all unknown routes
  const index = path.join(DIST, "index.html")
  try {
    fs.statSync(index)
    res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-cache" })
    fs.createReadStream(index).pipe(res)
  } catch (_) {
    res.writeHead(404)
    res.end("Not found — run npm run build first")
  }
})

server.listen(PORT, "0.0.0.0", function () {
  console.log("Server running on http://0.0.0.0:" + PORT)
})
