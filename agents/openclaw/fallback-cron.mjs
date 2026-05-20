/**
 * Fallback Cron — deterministic, no LLM.
 * Runs monitor-vaults.mjs 15 minutes after Nanobot.
 * If Nanobot already processed (lock exists), this skips via idempotency.
 */
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const INTERVAL_MS = Number(process.env.FALLBACK_INTERVAL_MS || 30 * 60 * 1000)
const OFFSET_MS = Number(process.env.FALLBACK_OFFSET_MS || 15 * 60 * 1000)

let running = false

function runMonitor() {
  if (running) return
  running = true
  const start = Date.now()
  console.log(`[fallback] tick at ${new Date().toISOString()}`)

  const child = spawn("node", ["monitor-vaults.mjs"], {
    cwd: __dirname,
    env: process.env,
    stdio: "pipe",
    timeout: 240000,
  })

  let stdout = ""
  let stderr = ""
  child.stdout.on("data", (d) => { stdout += d.toString() })
  child.stderr.on("data", (d) => { stderr += d.toString() })

  child.on("close", (code) => {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    if (code === 0) {
      try {
        const lines = stdout.trim().split("\n")
        const lastLine = lines[lines.length - 1]
        if (lastLine.startsWith("{")) {
          const r = JSON.parse(lastLine)
          console.log(`[fallback] done in ${elapsed}s — released=${r.released || 0}`)
        } else {
          console.log(`[fallback] done in ${elapsed}s`)
        }
      } catch {
        console.log(`[fallback] done in ${elapsed}s`)
      }
    } else {
      console.error(`[fallback] failed (code ${code}) in ${elapsed}s: ${stderr.slice(0, 200)}`)
    }
    running = false
  })

  child.on("error", (err) => {
    console.error(`[fallback] spawn error: ${err.message}`)
    running = false
  })
}

export function startFallbackCron() {
  console.log(`[fallback] offset=${OFFSET_MS / 1000}s, interval=${INTERVAL_MS / 1000}s`)
  setTimeout(() => {
    runMonitor()
    setInterval(runMonitor, INTERVAL_MS)
  }, OFFSET_MS)
}
