#!/usr/bin/env node
/**
 * Unsubscribely OpenClaw Agent Loop
 *
 * Persistent process that replaces the GitHub Actions daily cron.
 * Runs a tick() every 5 minutes to check for due vaults, verify guardrails,
 * release escrow on-chain, log actions, notify users, and advance billing.
 *
 * Usage:
 *   node agents/agent-loop.mjs
 *
 * Required env vars:
 *   VITE_SUPABASE_URL          — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  — bypasses RLS for agent queries
 *   AGENT_WALLET_MNEMONIC      — 25-word Algorand mnemonic
 *
 * Optional:
 *   ALGOD_TESTNET_URL / ALGOD_MAINNET_URL — custom algod endpoints
 *   ALGOD_TOKEN                — algod auth token
 *   TELEGRAM_BOT_TOKEN         — for user notifications
 *   AGENT_TICK_INTERVAL_MS     — override default 5-minute interval
 *   AGENT_WALLET_ADDRESS       — logged in actions for audit trail
 */

import { createClient } from "@supabase/supabase-js"
import algosdk from "algosdk"
import { checkDueVaults } from "./skills/check-due-vaults.mjs"
import { checkGuardrails } from "./skills/check-guardrails.mjs"
import { releaseVault } from "./skills/release-vault.mjs"
import { logAction } from "./skills/log-action.mjs"
import { notifyUser, buildReleaseMessage } from "./skills/notify-user.mjs"
import { advanceBilling } from "./skills/advance-billing.mjs"

const TICK_INTERVAL = Number(process.env.AGENT_TICK_INTERVAL_MS) || 5 * 60 * 1000 // 5 minutes
const MAX_CONSECUTIVE_ERRORS = 10

// ── Idempotency lock ──────────────────────────────────────────────────────────

let _serviceClient = null
function getServiceClient() {
  if (_serviceClient) return _serviceClient
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  _serviceClient = createClient(url, key, { auth: { persistSession: false } })
  return _serviceClient
}

async function acquireRunLock(vaultId, billingDate) {
  const sb = getServiceClient()
  if (!sb) return true
  const lockKey = `${vaultId}:${billingDate ?? "no-date"}`
  const { error } = await sb.from("agent_run_locks").insert({ lock_key: lockKey, vault_id: vaultId })
  if (!error) return true
  if (error.code === "23505") return false
  console.warn(`[agent-loop] Lock insert warning: ${error.message}`)
  return true
}

async function releaseRunLock(vaultId, billingDate) {
  const sb = getServiceClient()
  if (!sb) return
  const lockKey = `${vaultId}:${billingDate ?? "no-date"}`
  await sb.from("agent_run_locks").delete().eq("lock_key", lockKey)
}

// ── Balance check ─────────────────────────────────────────────────────────────

async function checkAgentBalance() {
  const mnemonic = process.env.AGENT_WALLET_MNEMONIC
  if (!mnemonic) return null
  const account = algosdk.mnemonicToSecretKey(mnemonic.trim())
  const algodUrl = process.env.ALGOD_TESTNET_URL || process.env.ALGOD_URL || "https://testnet-api.algonode.cloud"
  const algod = new algosdk.Algodv2(process.env.ALGOD_TOKEN || "", algodUrl, "")
  try {
    const info = await algod.accountInformation(account.addr).do()
    return Number(info.amount) / 1e6
  } catch (e) {
    console.warn(`[agent-loop] Could not check agent balance: ${e.message}`)
    return null
  }
}

// ── Single tick ───────────────────────────────────────────────────────────────

async function tick() {
  const tickStart = Date.now()
  const tickId = `tick-${tickStart}`
  console.log(`\n[${new Date().toISOString()}] === TICK START (${tickId}) ===`)

  let stats = { checked: 0, released: 0, skipped: 0, blocked: 0, errors: 0 }

  try {
    // Check agent wallet balance
    const balance = await checkAgentBalance()
    if (balance !== null) {
      console.log(`  Agent balance: ${balance.toFixed(4)} ALGO`)
      if (balance < 0.1) {
        console.warn("  WARNING: Agent wallet balance low — releases may fail")
      }
    }

    // Step 1: Find due vaults
    const { vaults, subscriptions, today } = await checkDueVaults()
    stats.checked = vaults.length

    if (vaults.length === 0) {
      console.log(`  No due vaults found for ${today}`)
      console.log(`  TICK END — ${Date.now() - tickStart}ms`)
      return stats
    }

    console.log(`  Found ${vaults.length} vault(s) to process`)

    // Step 2: Process each vault
    for (const vault of vaults) {
      const sub = subscriptions.find((s) => s.id === vault.subscription_id)
      const subName = sub?.name ?? "Unknown"
      const vaultAmount = Number(vault.amount || 0)

      console.log(`\n  → Vault ${vault.id} | ${subName} | ${vaultAmount} ALGO | ${vault.vault_type}`)

      try {
        // Check guardrails
        if (vault.subscription_id) {
          const guardrailResult = await checkGuardrails(vault.subscription_id, vaultAmount)
          if (!guardrailResult.allowed) {
            console.log(`    BLOCKED: ${guardrailResult.reason} — ${guardrailResult.detail}`)

            await logAction({
              actionType: "guardrail_block",
              vaultId: vault.id,
              subscriptionId: vault.subscription_id,
              userId: vault.user_id || sub?.user_id,
              status: "skipped",
              payload: {
                subscription_name: subName,
                reason: guardrailResult.reason,
                detail: guardrailResult.detail,
              },
            })

            // Notify user about the block
            if (vault.user_id || sub?.user_id) {
              await notifyUser({
                userId: vault.user_id || sub.user_id,
                message: `Agent skipped *${subName}*: ${guardrailResult.detail}`,
              })
            }

            stats.blocked++
            continue
          }
        }

        // Idempotency check
        const gotLock = await acquireRunLock(vault.id, sub?.next_billing_date)
        if (!gotLock) {
          console.log("    SKIPPED: already released this billing period")
          stats.skipped++
          continue
        }

        // Release vault on-chain
        const isAgentVault = vault.vault_type === "agent" || vault.vault_type === "agent_v2"
        if (!vault.app_id || !isAgentVault) {
          console.log(`    SKIPPED: vault type "${vault.vault_type}" requires creator signature`)
          stats.skipped++
          continue
        }

        const result = await releaseVault(vault)
        console.log(`    RELEASED: ${result.txid} on ${result.network}`)

        // Update vault status in DB
        const sb = getServiceClient()
        if (sb) {
          await sb.from("escrow_vaults")
            .update({ status: "released", released_at: new Date().toISOString(), txn_id: result.txid })
            .eq("id", vault.id)
        }

        // Log the action
        await logAction({
          actionType: "auto_release",
          vaultId: vault.id,
          subscriptionId: vault.subscription_id,
          userId: vault.user_id || sub?.user_id,
          txid: result.txid,
          status: "success",
          payload: {
            subscription_name: subName,
            amount: vaultAmount,
            mode: result.mode,
            network: result.network,
          },
        })

        // Advance billing date
        if (sub) {
          const { nextBillingDate } = await advanceBilling(sub)
          console.log(`    Billing advanced to ${nextBillingDate}`)
        }

        // Notify user
        if (vault.user_id || sub?.user_id) {
          const msg = buildReleaseMessage({
            subscriptionName: subName,
            amount: vaultAmount,
            txid: result.txid,
            network: result.network,
          })
          await notifyUser({ userId: vault.user_id || sub.user_id, message: msg })
        }

        stats.released++
      } catch (err) {
        console.error(`    ERROR: ${err.message}`)

        // Release lock so next tick can retry
        await releaseRunLock(vault.id, sub?.next_billing_date)

        // Log the error
        try {
          await logAction({
            actionType: "auto_release",
            vaultId: vault.id,
            subscriptionId: vault.subscription_id,
            userId: vault.user_id || sub?.user_id,
            status: "error",
            payload: {
              subscription_name: subName,
              error: err.message,
            },
          })
        } catch { /* best-effort logging */ }

        stats.errors++
      }
    }
  } catch (err) {
    console.error(`  TICK ERROR: ${err.message}`)
    stats.errors++
  }

  const elapsed = ((Date.now() - tickStart) / 1000).toFixed(1)
  console.log(`\n  TICK END — ${stats.released} released, ${stats.skipped} skipped, ${stats.blocked} blocked, ${stats.errors} errors — ${elapsed}s`)
  return stats
}

// ── Main loop ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Unsubscribely OpenClaw Agent ===")
  console.log(`Tick interval : ${TICK_INTERVAL / 1000}s`)
  console.log(`Time          : ${new Date().toISOString()}`)

  // Validate required env vars
  const required = ["VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "AGENT_WALLET_MNEMONIC"]
  const missing = required.filter((k) => !process.env[k] && !process.env[k.replace("VITE_", "")])
  if (missing.length) {
    console.error(`FATAL: Missing env vars: ${missing.join(", ")}`)
    process.exit(1)
  }

  const account = algosdk.mnemonicToSecretKey(process.env.AGENT_WALLET_MNEMONIC.trim())
  console.log(`Agent wallet  : ${account.addr}`)
  console.log()

  let consecutiveErrors = 0

  // Graceful shutdown
  let shuttingDown = false
  const shutdown = (signal) => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`\n[${signal}] Shutting down gracefully...`)
    // Let the current tick finish (if running), then exit
    setTimeout(() => process.exit(0), 1000)
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))

  // Run first tick immediately
  while (!shuttingDown) {
    try {
      const stats = await tick()
      consecutiveErrors = stats.errors > 0 ? consecutiveErrors + 1 : 0
    } catch (err) {
      console.error(`[agent-loop] Unhandled tick error: ${err.message}`)
      consecutiveErrors++
    }

    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      console.error(`[agent-loop] ${MAX_CONSECUTIVE_ERRORS} consecutive errors — backing off to 30 min`)
      await sleep(30 * 60 * 1000)
      consecutiveErrors = 0
    } else {
      await sleep(TICK_INTERVAL)
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

main().catch((err) => {
  console.error("FATAL:", err)
  process.exit(1)
})
