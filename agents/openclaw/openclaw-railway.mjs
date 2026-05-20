import fs from "node:fs"
import path from "node:path"
import { spawn, spawnSync } from "node:child_process"

const workspace = process.cwd()
const home = process.env.OPENCLAW_STATE_DIR || process.env.OPENCLAW_HOME || path.join(workspace, ".openclaw")
const configPath = process.env.OPENCLAW_CONFIG_PATH || path.join(home, "openclaw.json")
const cronName = process.env.OPENCLAW_CRON_NAME || "Unsubscribely vault monitor"
const cronEvery = process.env.OPENCLAW_MONITOR_EVERY || "5m"
const port = Number(process.env.OPENCLAW_GATEWAY_PORT || process.env.PORT || process.env.OPENCLAW_PORT || 8080)
const agentId = process.env.OPENCLAW_AGENT_ID || "unsubscribely"
const gatewayUrl = `ws://127.0.0.1:${port}`

process.env.OPENCLAW_HOME = home
process.env.OPENCLAW_STATE_DIR = home
process.env.OPENCLAW_CONFIG_PATH = configPath

// Force fresh state on every deploy — clear cached agent context
// so trimmed markdown files take effect
import { rmSync } from "node:fs"
try {
  rmSync(path.join(home, "agents"), { recursive: true, force: true })
  rmSync(path.join(home, "sessions"), { recursive: true, force: true })
  rmSync(path.join(home, "memory"), { recursive: true, force: true })
} catch {}


function bin(name) {
  return process.platform === "win32" ? `${name}.cmd` : name
}

function run(args, options = {}) {
  return spawnSync(bin("openclaw"), args, {
    cwd: workspace,
    env: process.env,
    encoding: "utf8",
    stdio: options.stdio || "pipe",
  })
}

function sleep(ms) {
  // Use synchronous sleep only inside spawnSync-based loops (waitForGatewayReady).
  // Atomics.wait blocks the event loop but is acceptable here since this is a
  // bootstrap script that runs once at startup before the gateway is ready.
  // The gateway child process runs in a separate process so it is not affected.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function ensureConfig() {
  fs.mkdirSync(path.dirname(configPath), { recursive: true })
  fs.mkdirSync(path.join(home, "cron"), { recursive: true })

  const cronJobsPath = path.join(home, "cron", "jobs.json")

  // Write the cron job directly into the jobs store before the gateway starts.
  // This avoids the CLI scope-upgrade issue entirely — no admin auth needed.
  // Always overwrite so format fixes take effect on redeploy.
  {
    const message = [
      "Run the Unsubscribely vault monitor now.",
      "Use the unsubscribely_vault_monitor skill.",
      "Execute exactly: npm run monitor:vaults",
      "Return only the final JSON summary and never print secrets.",
    ].join(" ")

    const cronJob = {
      version: 1,
      jobs: [
        {
          id: "unsubscribely-vault-monitor",
          kind: "cron",
          name: cronName,
          every: cronEvery,
          agentId,
          message,
          session: "isolated",
          tools: ["exec"],
          timeoutSeconds: 240,
          noDeliver: true,
          enabled: true,
          createdAt: new Date().toISOString(),
        },
      ],
    }
    fs.writeFileSync(cronJobsPath, JSON.stringify(cronJob, null, 2))
    console.log(`[openclaw-bootstrap] cron job written: ${cronJobsPath}`)
  }

  const config = {
    gateway: {
      mode: "local",
      // Trust Railway's internal proxy
      trustedProxies: ["100.64.0.0/10", "10.0.0.0/8", "172.16.0.0/12"],
    },
    agents: {
      defaults: {
        workspace,
        heartbeat: {
          every: process.env.OPENCLAW_HEARTBEAT_EVERY || "30m",
        },
      },
      list: [
        {
          id: agentId,
          workspace,
        },
      ],
    },
    cron: {
      enabled: true,
      store: path.join(home, "cron", "jobs.json"),
      maxConcurrentRuns: 1,
      retry: {
        maxAttempts: 2,
        backoffMs: [60000, 120000],
        retryOn: ["rate_limit", "overloaded", "network", "server_error"],
      },
      sessionRetention: "24h",
    },
  }

  // Model selection: prefer explicit OPENCLAW_MODEL, then auto-detect from available keys.
  // Groq is free and fast — preferred default. OpenAI as fallback if key is present.
  let resolvedModel = process.env.OPENCLAW_MODEL || process.env.OPENCLAW_PRIMARY_MODEL
  if (!resolvedModel) {
    if (process.env.GROQ_API_KEY) resolvedModel = "groq/llama-3.3-70b-versatile"
    else if (process.env.OPENAI_API_KEY) resolvedModel = "openai/gpt-4o-mini"
    else if (process.env.ANTHROPIC_API_KEY) resolvedModel = "anthropic/claude-3-haiku"
  }
  if (resolvedModel) {
    config.agents.defaults.model = { primary: resolvedModel }
    console.log(`[openclaw-bootstrap] using model: ${resolvedModel}`)
  }

  if (process.env.TELEGRAM_BOT_TOKEN && process.env.OPENCLAW_ENABLE_TELEGRAM_CHANNEL === "1") {
    config.channels = {
      telegram: {
        enabled: true,
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        dmPolicy: process.env.OPENCLAW_TELEGRAM_DM_POLICY || "pairing",
      },
    }
  } else {
    // Explicitly disable Telegram channel — the Vercel webhook handles all
    // Telegram messages. OpenClaw must not poll getUpdates or it conflicts.
    config.channels = {
      telegram: {
        enabled: false,
      },
    }
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  console.log(`[openclaw-bootstrap] config written: ${configPath}`)
}

// After config is written, patch allowedOrigins to include the Railway public URL
function patchAllowedOrigins() {
  try {
    const railwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL
    if (!railwayUrl) return
    const raw = fs.readFileSync(configPath, "utf8")
    const cfg = JSON.parse(raw)
    if (!cfg.gateway) cfg.gateway = {}
    if (!cfg.gateway.controlUi) cfg.gateway.controlUi = {}
    const origins = cfg.gateway.controlUi.allowedOrigins || []
    const publicOrigin = `https://${railwayUrl}`
    if (!origins.includes(publicOrigin)) {
      origins.push(publicOrigin)
      cfg.gateway.controlUi.allowedOrigins = origins
      fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2))
      console.log(`[openclaw-bootstrap] added ${publicOrigin} to allowedOrigins`)
    }
  } catch (err) {
    console.warn(`[openclaw-bootstrap] failed to patch allowedOrigins: ${err.message}`)
  }
}

function getGatewayAuthArgs() {
  return process.env.OPENCLAW_GATEWAY_TOKEN ? ["--token", process.env.OPENCLAW_GATEWAY_TOKEN] : []
}

function waitForGatewayReady() {
  const args = ["gateway", "health", "--url", gatewayUrl, ...getGatewayAuthArgs()]
  const startedAt = Date.now()
  const timeoutMs = 30_000

  while (Date.now() - startedAt < timeoutMs) {
    const health = run(args)
    if (health.status === 0) {
      console.log("[openclaw-bootstrap] gateway health check passed")
      return true
    }
    sleep(1000)
  }

  console.warn("[openclaw-bootstrap] gateway health check timed out")
  return false
}

function printOperationalHints() {
  const missing = []
  for (const key of ["SUPABASE_SERVICE_ROLE_KEY", "AGENT_WALLET_MNEMONIC"]) {
    if (!process.env[key]) missing.push(key)
  }
  if (!process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL) missing.push("SUPABASE_URL or VITE_SUPABASE_URL")
  if (missing.length) {
    console.warn(`[openclaw-bootstrap] monitor will fail until these Railway variables are set: ${missing.join(", ")}`)
  }
  if (!process.env.OPENCLAW_GATEWAY_TOKEN) {
    console.warn("[openclaw-bootstrap] OPENCLAW_GATEWAY_TOKEN is recommended on Railway because non-loopback Gateway binding requires auth.")
  }
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GOOGLE_API_KEY && !process.env.OPENROUTER_API_KEY && !process.env.GROQ_API_KEY) {
    console.warn("[openclaw-bootstrap] no model provider key detected; set GROQ_API_KEY (free) or OPENAI_API_KEY in Railway variables.")
  }
}

ensureConfig()
patchAllowedOrigins()
printOperationalHints()

const gatewayArgs = ["gateway", "run", "--allow-unconfigured", "--port", String(port), "--bind", "lan"]
if (process.env.OPENCLAW_GATEWAY_TOKEN) {
  gatewayArgs.push("--token", process.env.OPENCLAW_GATEWAY_TOKEN)
}

console.log(`[openclaw-bootstrap] starting: openclaw ${gatewayArgs.join(" ")}`)

const child = spawn(bin("openclaw"), gatewayArgs, {
  cwd: workspace,
  env: process.env,
  stdio: "inherit",
})

if (waitForGatewayReady()) {
  console.log("[openclaw-bootstrap] gateway ready — cron job pre-seeded at startup")
}

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`[openclaw-bootstrap] gateway exited with signal ${signal}`)
    process.exit(1)
  }
  process.exit(code ?? 0)
})

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal)
  })
}
