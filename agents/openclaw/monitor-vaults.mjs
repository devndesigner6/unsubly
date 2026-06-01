import { checkDueVaults } from "./skills/check-due-vaults.mjs"
import { checkGuardrails } from "./skills/check-guardrails.mjs"
import { releaseVault, checkAgentBalance, killVaultOnChain } from "./skills/release-vault.mjs"
import { logAction } from "./skills/log-action.mjs"
import { notifyUser } from "./skills/notify-user.mjs"
import { advanceBilling } from "./skills/advance-billing.mjs"
import { lookupService } from "./skills/lookup-service.mjs"
import { checkUpcomingRenewals } from "./skills/check-upcoming-renewals.mjs"
import { writeCancellationProof } from "./skills/cancellation-proof.mjs"

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const LOW_BALANCE_ALGO = 1.0

function requireEnv() {
  const missing = []
  if (!SUPABASE_URL) missing.push("SUPABASE_URL or VITE_SUPABASE_URL")
  if (!SERVICE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY")
  if (!process.env.AGENT_WALLET_MNEMONIC) missing.push("AGENT_WALLET_MNEMONIC")
  if (missing.length) throw new Error(`Missing required env vars: ${missing.join(", ")}`)
}

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${options.method || "GET"} ${path} failed: ${res.status} ${await res.text()}`)
  if (res.status === 204) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function acquireLock(vaultId, billingDate) {
  const lockKey = `${vaultId}:${billingDate ?? "no-date"}`
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

  if (res.status === 409) return false
  if (res.ok) return true

  console.warn(`[monitor] lock insert returned ${res.status}; allowing run to avoid silent outage`)
  return true
}

async function releaseLock(vaultId, billingDate) {
  const lockKey = `${vaultId}:${billingDate ?? "no-date"}`
  try {
    await sbFetch(`agent_run_locks?lock_key=eq.${encodeURIComponent(lockKey)}`, { method: "DELETE" })
  } catch (err) {
    console.warn(`[monitor] failed to release lock ${lockKey}: ${err.message}`)
  }
}

async function updateVaultReleased(vaultId, txid) {
  await sbFetch(`escrow_vaults?id=eq.${vaultId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status: "released",
      released_at: new Date().toISOString(),
      txn_id: txid,
    }),
  })
}

async function checkTrialDecision(vault, subName) {
  if (!vault.subscription_id) return "proceed"

  const guardrails = await sbFetch(
    `subscription_guardrails?subscription_id=eq.${vault.subscription_id}&select=require_confirmation,is_trial`
  ).catch(() => [])
  const guardrail = guardrails?.[0]
  if (!guardrail?.require_confirmation) return "proceed"

  const pending = await sbFetch(
    `agent_pending_decisions?vault_id=eq.${vault.id}&select=id,decision,expires_at&order=created_at.desc&limit=1`
  ).catch(() => [])
  const existing = pending?.[0]

  if (existing) {
    if (existing.decision === "pay") return "proceed"
    if (existing.decision === "cancel") return "cancel"
    if (new Date(existing.expires_at) < new Date()) {
      await sbFetch(`agent_pending_decisions?id=eq.${existing.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ decision: "timeout", decided_at: new Date().toISOString() }),
      })
      return "proceed"
    }
    return "wait"
  }

  const profiles = await sbFetch(`profiles?id=eq.${vault.user_id}&select=telegram_chat_id`).catch(() => [])
  const chatId = profiles?.[0]?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID || null

  await sbFetch("agent_pending_decisions", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      vault_id: vault.id,
      subscription_id: vault.subscription_id,
      user_id: vault.user_id,
      chat_id: chatId,
      expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
    }),
  })

  if (chatId && process.env.TELEGRAM_BOT_TOKEN) {
    // Don't send the old PAY/CANCEL message � the renewal alert system handles this now
    console.log(`[monitor] ${subName}: require_confirmation set, waiting for renewal alert decision`)
  }

  return "wait"
}

function isAgentVault(vault) {
  return ["agent", "agent_v2", "cancellation_insurance"].includes(vault.vault_type)
}

export async function runVaultMonitor() {
  requireEnv()
  const startedAt = Date.now()
  const summary = { checked: 0, released: 0, skipped: 0, errors: [] }

  const { address, balance } = await checkAgentBalance()
  console.log(`[monitor] OpenClaw worker wallet ${address} balance ${balance.toFixed(6)} ALGO`)
  if (balance < LOW_BALANCE_ALGO) {
    const message = `?? Agent wallet balance low (${balance.toFixed(4)} ALGO). Vault releases paused.\n\nFund at: https://bank.testnet.algorand.network/\nWallet: ${address}`
    await notifyUser(message, null, null, true) // urgent � always send low balance alerts
    summary.errors.push(message)
    return summary
  }

  const vaults = await checkDueVaults()
  summary.checked = vaults.length

  if (vaults.length === 0) {
    await checkUpcomingRenewals().catch((err) => console.warn(`[monitor] upcoming renewal check failed: ${err.message}`))
    await processCancelledVaults().catch((err) => console.warn(`[monitor] kill cancelled vaults failed: ${err.message}`))
    return summary
  }

  try {
    for (const vault of vaults) {
      const sub = vault.subscription || null
      const subName = sub?.name || "Unknown subscription"
      const billingDate = sub?.next_billing_date || null

      if (!isAgentVault(vault)) {
        summary.skipped++
        await logAction({
          vaultId: vault.id,
          subscriptionId: vault.subscription_id,
          userId: vault.user_id,
          status: "skipped",
          mode: "openclaw",
          payload: { reason: `vault_type ${vault.vault_type} requires creator signature`, runtime: "openclaw" },
        })
        continue
      }

      if (!vault.app_id || Number(vault.app_id) <= 0) {
        summary.skipped++
        await logAction({
          vaultId: vault.id,
          subscriptionId: vault.subscription_id,
          userId: vault.user_id,
          status: "skipped",
          mode: "openclaw",
          payload: { reason: `invalid app_id: ${vault.app_id}`, runtime: "openclaw" },
        })
        continue
      }

      const gotLock = await acquireLock(vault.id, billingDate)
      if (!gotLock) {
        summary.skipped++
        continue
      }

      try {
        const guardrail = await checkGuardrails(vault.subscription_id, vault.amount)
        if (!guardrail.allowed) {
          summary.skipped++
          await logAction({
            vaultId: vault.id,
            subscriptionId: vault.subscription_id,
            userId: vault.user_id,
            status: "skipped",
            mode: "guardrail",
            payload: { reason: guardrail.reason, runtime: "openclaw" },
          })
          await notifyUser(`${subName} vault skipped: ${guardrail.reason}`, null, vault.user_id)
          await releaseLock(vault.id, billingDate)
          continue
        }

        const decision = await checkTrialDecision(vault, subName)
        if (decision === "wait") {
          summary.skipped++
          await releaseLock(vault.id, billingDate)
          continue
        }
        if (decision === "cancel") {
          summary.skipped++
          await logAction({
            vaultId: vault.id,
            subscriptionId: vault.subscription_id,
            userId: vault.user_id,
            status: "skipped",
            mode: "user_cancelled",
            payload: { subscription_name: subName, runtime: "openclaw" },
          })
          await releaseLock(vault.id, billingDate)
          continue
        }

        const serviceInfo = vault.escrow_address ? await lookupService(vault.escrow_address) : null

        // ServiceRegistry verification + recipient existence check
        if (vault.escrow_address && !serviceInfo) {
          console.log(`[monitor] ${subName}: recipient ${vault.escrow_address?.slice(0, 8)}... NOT in ServiceRegistry`)
          await logAction({
            vaultId: vault.id,
            subscriptionId: vault.subscription_id,
            userId: vault.user_id,
            status: "warning",
            mode: "registry-check",
            payload: { reason: "Recipient not found in on-chain ServiceRegistry", recipient: vault.escrow_address, runtime: "openclaw" },
          })

          // Verify recipient address exists on-chain (prevent fund loss)
          try {
            const algodUrl = (process.env.ALGO_NETWORK || "testnet").includes("mainnet")
              ? "https://mainnet-api.algonode.cloud"
              : "https://testnet-api.algonode.cloud"
            const acctRes = await fetch(`${algodUrl}/v2/accounts/${vault.escrow_address}`)
            if (!acctRes.ok) {
              console.warn(`[monitor] ${subName}: recipient address does not exist on-chain - SKIPPING`)
              await notifyUser(`${subName}: recipient address not found on Algorand. Release blocked.`, null, vault.user_id, true)
              summary.skipped++
              await releaseLock(vault.id, billingDate)
              continue
            }
          } catch (err) {
            console.warn(`[monitor] ${subName}: could not verify recipient: ${err.message}`)
          }
        } else if (serviceInfo) {
          console.log(`[monitor] ${subName}: recipient verified in ServiceRegistry as "${serviceInfo.name}" (${serviceInfo.service_id})`)
        }

        // Check if user has a renewal alert � don't release if:
        // - user_decision is null (waiting for reply) � BUT auto-release after 24h
        // - user_decision is 'cancel' (user wants to cancel, waiting for DONE)
        // - NO alert exists ? create one and wait (never release without asking first)
        try {
          const alerts = await sbFetch(`agent_renewal_alerts?subscription_id=eq.${vault.subscription_id}&select=id,user_decision,alert_sent_at&order=created_at.desc&limit=1`)
          if (Array.isArray(alerts) && alerts.length > 0) {
            const alertDecision = alerts[0].user_decision
            const alertSentAt = alerts[0].alert_sent_at ? new Date(alerts[0].alert_sent_at) : null
            const hoursSinceAlert = alertSentAt ? (Date.now() - alertSentAt.getTime()) / 3_600_000 : 0

            if (alertDecision === null) {
              if (hoursSinceAlert > 24) {
                // Auto-release after 24h of no response
                console.log(`[monitor] ${subName}: no reply after ${Math.round(hoursSinceAlert)}h � auto-releasing`)
                await notifyUser(`${subName}: No reply received in 24h. Releasing vault payment automatically.`, null, vault.user_id, true)
              } else {
                console.log(`[monitor] ${subName}: waiting for user decision (${Math.round(hoursSinceAlert)}h ago) � skipping`)
                summary.skipped++
                await releaseLock(vault.id, billingDate)
                continue
              }
            } else if (alertDecision === "cancel") {
              console.log(`[monitor] ${subName}: user chose cancel, waiting for DONE � skipping`)
              summary.skipped++
              await releaseLock(vault.id, billingDate)
              continue
            }
            // decision === "keep" or "done" ? proceed with release
          } else {
            // NO alert exists for this subscription � create one and WAIT
            // Never release without asking the user first
            console.log(`[monitor] ${subName}: no renewal alert exists � creating one and waiting`)
            const profiles = await sbFetch(`profiles?id=eq.${vault.user_id}&select=telegram_chat_id`).catch(() => [])
            const chatId = profiles?.[0]?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID

            await sbFetch("agent_renewal_alerts", {
              method: "POST",
              headers: { Prefer: "return=minimal" },
              body: JSON.stringify({
                subscription_id: vault.subscription_id,
                vault_id: vault.id,
                alert_sent_at: new Date().toISOString(),
                alert_type: "today",
                user_decision: null,
              }),
            })

            // Send Telegram alert
            const amountStr = vault.amount ? `${vault.amount} ALGO` : "unknown"
            if (chatId && process.env.TELEGRAM_BOT_TOKEN) {
              const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
              await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `?? Due TODAY\n\n${subName} is due TODAY (${amountStr}).\n\nReply "keep ${subName.toLowerCase()}" to pay and continue\nReply "cancel ${subName.toLowerCase()}" to cancel and get ALGO back`,
                  disable_web_page_preview: true,
                }),
              }).catch(() => {})
            }

            summary.skipped++
            await releaseLock(vault.id, billingDate)
            continue
          }
        } catch (alertErr) {
          console.warn(`[monitor] renewal alert check failed for ${subName}: ${alertErr.message}`)
        }

        const txid = await releaseVault(vault)
        await updateVaultReleased(vault.id, txid)
        await logAction({
          vaultId: vault.id,
          subscriptionId: vault.subscription_id,
          userId: vault.user_id,
          status: "success",
          txid,
          mode: "openclaw-on-chain",
          payload: {
            subscription_name: subName,
            amount: vault.amount,
            service_registry: serviceInfo ? { name: serviceInfo.name, service_id: serviceInfo.service_id } : null,
            note: "On-chain release confirmed by real OpenClaw runtime",
            runtime: "openclaw",
          },
        })
        if (sub?.billing_cycle && billingDate) {
          await advanceBilling(vault.subscription_id, sub.billing_cycle, billingDate, vault.user_id)
        }
        await notifyUser(`${subName} payment released. ${vault.amount} ALGO sent to recipient.`, txid, vault.user_id, true)
        await releaseLock(vault.id, billingDate)
        summary.released++
      } catch (err) {
        summary.errors.push(`Vault ${vault.id}: ${err.message}`)
        await logAction({
          vaultId: vault.id,
          subscriptionId: vault.subscription_id,
          userId: vault.user_id,
          status: "error",
          mode: "openclaw-on-chain",
          payload: { subscription_name: subName, error: err.message, runtime: "openclaw" },
        })
        await notifyUser(`${subName} vault release failed: ${err.message}`, null, vault.user_id, true)

        // Self-healing: diagnose the failure and suggest a fix
        let fixPlan = ""
        const errMsg = err.message.toLowerCase()
        if (errMsg.includes("balance") || errMsg.includes("insufficient") || errMsg.includes("underflow")) {
          fixPlan = "\n\n?? Fix: Agent wallet has insufficient ALGO. Fund it with testnet ALGO at https://bank.testnet.algorand.network/"
        } else if (errMsg.includes("app_id") || errMsg.includes("application")) {
          fixPlan = "\n\n?? Fix: The vault's smart contract may have been deleted or is invalid. Try creating a new vault."
        } else if (errMsg.includes("unauthorized") || errMsg.includes("not authorized")) {
          fixPlan = "\n\n?? Fix: The agent wallet is not authorized on this vault. Ensure the vault was created with the agent address."
        } else if (errMsg.includes("network") || errMsg.includes("timeout") || errMsg.includes("ECONNREFUSED")) {
          fixPlan = "\n\n?? Fix: Network issue connecting to Algorand. Will retry on next tick (30 min)."
        } else {
          fixPlan = "\n\n?? The agent will retry on the next tick. If this persists, check the vault in the app."
        }
        if (fixPlan) {
          await notifyUser(`?? Self-diagnosis for ${subName}:${fixPlan}`, null, vault.user_id, false)
        }
        await releaseLock(vault.id, billingDate)
      }
    }
  } finally {
    // Always run renewal checks regardless of vault processing errors (#17 fix)
    await checkUpcomingRenewals().catch((err) => console.warn(`[monitor] upcoming renewal check failed: ${err.message}`))

    // Process cancelled vaults � kill them on-chain and return ALGO to user
    await processCancelledVaults().catch((err) => console.warn(`[monitor] kill cancelled vaults failed: ${err.message}`))
  }
  console.log(`[monitor] completed in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`)

  // Write tick summary to agent_actions for audit trail
  try {
    await logAction({
      vaultId: null,
      subscriptionId: null,
      userId: null,
      status: summary.errors.length > 0 ? "partial" : "success",
      mode: "tick-summary",
      payload: {
        runtime: "openclaw",
        duration_ms: Date.now() - startedAt,
        vaults_checked: summary.checked,
        vaults_released: summary.released,
        vaults_skipped: summary.skipped,
        errors: summary.errors.length,
        agent_balance: balance,
        timestamp: new Date().toISOString(),
      },
    })
  } catch {}

  return summary
}

/**
 * Find vaults marked as "killed" in DB but not yet killed on-chain (no txn_id on killed status).
 * Also find vaults where user_decision = 'done' (confirmed cancel).
 * Kill them on-chain and notify user of savings.
 */
async function processCancelledVaults() {
  // Find vaults that are marked killed in DB but have no kill txn recorded
  try {
    const vaults = await sbFetch(`escrow_vaults?status=eq.killed&txn_id=is.null&select=id,app_id,amount,user_id,subscription_id&limit=5`)
    if (!Array.isArray(vaults) || vaults.length === 0) return

    console.log(`[monitor] ${vaults.length} vault(s) to kill on-chain`)

    for (const vault of vaults) {
      try {
        if (!vault.app_id || Number(vault.app_id) <= 0) {
          // No on-chain contract � just mark as done in DB (vault was DB-only)
          console.log(`[monitor] vault ${vault.id} has no app_id � marking as done (no on-chain kill needed)`)
          await sbFetch(`escrow_vaults?id=eq.${vault.id}`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ txn_id: "no-contract", killed_at: new Date().toISOString() }),
          })
          const subs = await sbFetch(`subscriptions?id=eq.${vault.subscription_id}&select=name&limit=1`)
          const subName = Array.isArray(subs) && subs[0] ? subs[0].name : "Subscription"
          await notifyUser(`? ${subName} vault closed. No on-chain contract was deployed � nothing to return.`, null, vault.user_id, false)
          continue
        }

        const txid = await killVaultOnChain(vault)

        await sbFetch(`escrow_vaults?id=eq.${vault.id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ txn_id: txid, killed_at: new Date().toISOString() }),
        })

        const subs = await sbFetch(`subscriptions?id=eq.${vault.subscription_id}&select=name,amount,currency&limit=1`)
        const sub = Array.isArray(subs) ? subs[0] : null
        const subName = sub?.name || "Subscription"
        const amountStr = sub?.amount ? `${sub.currency || "USD"} ${Number(sub.amount).toFixed(2)}` : `${vault.amount} ALGO`

        await notifyUser(
          `? ${subName} vault killed on-chain! ${amountStr} returned to your wallet.\n\n?? You saved ${amountStr}/month.\n\nTx: ${txid}`,
          txid, vault.user_id, true
        )

        await logAction({
          vaultId: vault.id,
          subscriptionId: vault.subscription_id,
          userId: vault.user_id,
          status: "success",
          txid,
          mode: "kill",
          payload: { subscription_name: subName, action: "kill_vault", runtime: "openclaw" },
        })

        console.log(`[monitor] ? Killed vault ${vault.id} on-chain, txid: ${txid}`)

        // Write cancellation proof on-chain
        try {
          const proofResult = await writeCancellationProof({
            subscriptionName: subName,
            subscriptionId: vault.subscription_id,
            method: "guided",
            userId: vault.user_id,
          })
          console.log(`[monitor] ? Cancellation proof written: txid=${proofResult.txid}`)
          await notifyUser(
            `?? Cancellation proof recorded on Algorand.\nTx: ${proofResult.txid}\n\nThis is immutable proof that ${subName} was cancelled on ${new Date().toLocaleDateString()}.`,
            proofResult.txid, vault.user_id, false
          )
        } catch (proofErr) {
          console.warn(`[monitor] Cancellation proof failed (non-blocking): ${proofErr.message}`)
        }
      } catch (err) {
        // If agent is not authorized (only creator can kill), mark as processed anyway
        // The user already initiated the kill from the UI � the on-chain state may already be killed
        const errMsg = err.message.toLowerCase()
        if (errMsg.includes("not authorized") || errMsg.includes("only creator") || errMsg.includes("assert")) {
          console.warn(`[monitor] Agent not authorized to kill vault ${vault.id} on-chain (expected � user kills from UI). Marking as processed.`)
          await sbFetch(`escrow_vaults?id=eq.${vault.id}`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ txn_id: "user-killed", killed_at: new Date().toISOString() }),
          })
        } else {
          console.error(`[monitor] Failed to kill vault ${vault.id} on-chain: ${err.message}`)
        }
      }
    }
  } catch (err) {
    console.warn(`[monitor] processCancelledVaults query failed: ${err.message}`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runVaultMonitor()
    .then((summary) => {
      console.log(JSON.stringify({ ok: summary.errors.length === 0, ...summary }))
      process.exit(summary.errors.length ? 1 : 0)
    })
    .catch((err) => {
      console.error(`[monitor] fatal: ${err.stack || err.message}`)
      process.exit(1)
    })
}
