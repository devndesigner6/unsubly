/**
 * Unsubscribely OpenClaw Agent — Persistent Loop
 *
 * Runs every 5 minutes. For each due vault:
 *   1. Check idempotency (don't double-release)
 *   2. Check guardrails (budget cap, trial dates)
 *   3. Release on-chain via agent wallet
 *   4. Log to Supabase
 *   5. Notify user via Telegram
 *   6. Advance billing date
 *
 * Environment variables required:
 *   AGENT_WALLET_MNEMONIC      — 25-word Algorand mnemonic
 *   SUPABASE_URL               — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  — Service role key (bypasses RLS)
 *   TELEGRAM_BOT_TOKEN         — @devn1_bot token
 *   TELEGRAM_CHAT_ID           — Your Telegram chat ID
 *   ALGO_NETWORK               — "testnet" or "mainnet" (default: testnet)
 */

import { checkDueVaults }   from "./skills/check-due-vaults.mjs"
import { checkGuardrails }  from "./skills/check-guardrails.mjs"
import { releaseVault, checkAgentBalance } from "./skills/release-vault.mjs"
import { logAction }        from "./skills/log-action.mjs"
import { notifyUser }       from "./skills/notify-user.mjs"
import { advanceBilling }   from "./skills/advance-billing.mjs"

const TICK_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const NETWORK = (process.env.ALGO_NETWORK || "testnet").toLowerCase()

// In-memory idempotency store (backed by agent_run_locks table in DB)
const _releasedThisCycle = new Set()

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

async function acquireLock(vaultId, billingDate) {
  const lockKey = `${vaultId}:${billingDate ?? "no-date"}`
  if (_releasedThisCycle.has(lockKey)) return false

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/agent_run_locks`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ lock_key: lockKey, vault_id: vaultId }),
    })

    if (res.status === 409 || res.status === 201 || res.ok) {
      if (res.status === 409) return false // already locked
      _releasedThisCycle.add(lockKey)
      return true
    }
    // DB error — allow release rather than block
    console.warn(`[lock] DB insert returned ${res.status}, allowing release`)
    return true
  } catch (err) {
    console.warn(`[lock] Error acquiring lock: ${err.message}, allowing release`)
    return true
  }
}

async function releaseLock(vaultId, billingDate) {
  const lockKey = `${vaultId}:${billingDate ?? "no-date"}`
  _releasedThisCycle.delete(lockKey)
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/agent_run_locks?lock_key=eq.${encodeURIComponent(lockKey)}`,
      {
        method: "DELETE",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      }
    )
  } catch (_) {}
}

async function updateVaultStatus(vaultId, txid) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/escrow_vaults?id=eq.${vaultId}`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status: "released",
        released_at: new Date().toISOString(),
        txn_id: txid,
      }),
    })
  } catch (err) {
    console.warn(`[agent] Failed to update vault status: ${err.message}`)
  }
}

async function tick() {
  const startTime = Date.now()
  console.log(`\n[agent] ── Tick at ${new Date().toISOString()} ──`)

  // 1. Check agent wallet balance
  try {
    const { address, balance } = await checkAgentBalance()
    console.log(`[agent] Wallet: ${address} | Balance: ${balance.toFixed(4)} ALGO`)

    if (balance < 0.002) {
      const msg = `⚠️ Agent wallet nearly empty (${balance.toFixed(4)} ALGO). Vault releases will fail. Fund at: https://bank.testnet.algorand.network/`
      console.error(`[agent] CRITICAL: ${msg}`)
      await notifyUser(msg)
      return
    }

    if (balance < 0.1) {
      await notifyUser(`⚠️ Agent wallet balance low: ${balance.toFixed(4)} ALGO. Consider topping up.`)
    }
  } catch (err) {
    console.warn(`[agent] Could not check balance: ${err.message}`)
  }

  // 2. Get due vaults
  let vaults
  try {
    vaults = await checkDueVaults()
  } catch (err) {
    console.error(`[agent] Failed to fetch due vaults: ${err.message}`)
    await notifyUser(`❌ Agent error: Could not fetch due vaults\n${err.message}`)
    return
  }

  if (vaults.length === 0) {
    console.log(`[agent] No vaults due. Sleeping.`)
    return
  }

  console.log(`[agent] ${vaults.length} vault(s) to process`)

  // 3. Process each vault
  for (const vault of vaults) {
    const sub     = vault.subscription
    const subName = sub?.name ?? "Unknown subscription"
    const billingDate = sub?.next_billing_date ?? null

    console.log(`[agent] Processing vault ${vault.id} | ${subName} | type: ${vault.vault_type}`)

    // Only agent and agent_v2 vaults can be released by the agent
    const isAgentVault = vault.vault_type === "agent" || vault.vault_type === "agent_v2"
    if (!isAgentVault) {
      console.log(`[agent] Skipping vault ${vault.id} — type "${vault.vault_type}" requires creator signature`)
      await logAction({
        vaultId: vault.id,
        subscriptionId: vault.subscription_id,
        userId: vault.user_id,
        status: "skipped",
        mode: "skip",
        payload: { reason: `vault_type "${vault.vault_type}" requires creator signature` },
      })
      continue
    }

    // Idempotency check
    const gotLock = await acquireLock(vault.id, billingDate)
    if (!gotLock) {
      console.log(`[agent] Vault ${vault.id} already released this billing period — skipping`)
      continue
    }

    // Guardrails check
    const guardrail = await checkGuardrails(vault.subscription_id, vault.amount)
    if (!guardrail.allowed) {
      console.log(`[agent] Vault ${vault.id} blocked by guardrail: ${guardrail.reason}`)
      await logAction({
        vaultId: vault.id,
        subscriptionId: vault.subscription_id,
        userId: vault.user_id,
        status: "skipped",
        mode: "guardrail",
        payload: { reason: guardrail.reason },
      })
      await notifyUser(
        `⏸️ *${subName}* vault skipped\n\nReason: ${guardrail.reason}\n\nRelease manually from the dashboard if needed.`
      )
      await releaseLock(vault.id, billingDate) // release lock so next cycle can retry
      continue
    }

    // Release on-chain
    let txid = null
    try {
      txid = await releaseVault(vault)
      console.log(`[agent] ✓ Released vault ${vault.id} | txid: ${txid}`)

      // Update DB
      await updateVaultStatus(vault.id, txid)

      // Log success
      await logAction({
        vaultId: vault.id,
        subscriptionId: vault.subscription_id,
        userId: vault.user_id,
        status: "success",
        txid,
        mode: "on-chain",
        payload: {
          subscription_name: subName,
          amount: vault.amount,
          note: "On-chain release confirmed by OpenClaw agent",
        },
      })

      // Advance billing date
      if (sub?.billing_cycle && billingDate) {
        await advanceBilling(vault.subscription_id, sub.billing_cycle, billingDate)
      }

      // Notify user
      await notifyUser(
        `✅ *${subName}* payment released!\n\n💰 ${vault.amount} ALGO sent to recipient\n📅 Next billing date updated`,
        txid
      )

    } catch (err) {
      console.error(`[agent] ✗ Failed to release vault ${vault.id}: ${err.message}`)

      await logAction({
        vaultId: vault.id,
        subscriptionId: vault.subscription_id,
        userId: vault.user_id,
        status: "error",
        mode: "on-chain",
        payload: {
          subscription_name: subName,
          error: err.message,
        },
      })

      await notifyUser(
        `❌ *${subName}* vault release failed\n\nError: ${err.message}\n\nPlease release manually from the dashboard.`
      )

      // Release lock so next cycle can retry
      await releaseLock(vault.id, billingDate)
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`[agent] ── Tick complete in ${elapsed}s ──\n`)
}

// ── Startup ──────────────────────────────────────────────────────────────────

console.log("=== Unsubscribely OpenClaw Agent ===")
console.log(`Network  : ${NETWORK}`)
console.log(`Interval : every 5 minutes`)
console.log(`Time     : ${new Date().toISOString()}`)
console.log(`Telegram : ${process.env.TELEGRAM_BOT_TOKEN ? "configured (@devn1_bot)" : "not configured (console only)"}`)
console.log()

// Validate required env vars
const required = ["AGENT_WALLET_MNEMONIC", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
const missing  = required.filter(k => !process.env[k] && !process.env[k.replace("SUPABASE_URL", "VITE_SUPABASE_URL")])
if (missing.length > 0) {
  console.error(`FATAL: Missing required env vars: ${missing.join(", ")}`)
  process.exit(1)
}

// Notify startup
notifyUser(`🚀 Unsubscribely Agent started\nNetwork: ${NETWORK}\nChecking vaults every 5 minutes`)
  .catch(() => {})

// Run immediately then on interval
tick().catch(err => console.error("[agent] Unhandled tick error:", err))
setInterval(() => {
  tick().catch(err => console.error("[agent] Unhandled tick error:", err))
}, TICK_INTERVAL_MS)
