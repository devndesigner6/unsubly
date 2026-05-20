/**
 * Nanobot — Runs monitor-vaults.mjs on a schedule.
 * No LLM needed — the monitor is deterministic code.
 */
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const INTERVAL_MS = Number(process.env.NANOBOT_INTERVAL_MS || 30 * 60 * 1000)

function runMonitor() {
  return new Promise((resolve, reject) => {
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
      if (code === 0) resolve(stdout)
      else reject(new Error(`exit ${code}: ${stderr.slice(0, 300)}`))
    })
    child.on("error", reject)
  })
}

let running = false

async function tick() {
  if (running) return
  running = true
  const start = Date.now()
  console.log(`[nanobot] tick at ${new Date().toISOString()}`)

  try {
    const output = await runMonitor()
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)

    try {
      const lines = output.trim().split("\n")
      const lastLine = lines[lines.length - 1]
      if (lastLine.startsWith("{")) {
        const result = JSON.parse(lastLine)
        console.log(`[nanobot] done in ${elapsed}s — released=${result.released || 0}, skipped=${result.skipped || 0}`)
      } else {
        console.log(`[nanobot] done in ${elapsed}s`)
      }
    } catch {
      console.log(`[nanobot] done in ${elapsed}s`)
    }
  } catch (err) {
    console.error(`[nanobot] error: ${err.message}`)
  } finally {
    running = false
  }
}

export function startNanobot() {
  console.log(`[nanobot] interval=${INTERVAL_MS / 1000}s`)

  // First run 5s after startup
  setTimeout(tick, 5000)

  // Then every interval
  setInterval(tick, INTERVAL_MS)
}
