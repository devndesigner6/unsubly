/**
 * Unsubscribely Autonomous A2A Agent — v2
 *
 * Releases locked escrow vaults on-chain when subscriptions are due.
 * Supports both standard ALGO vaults and ASA token vaults.
 *
 * Network selection (ALGO_NETWORK env var):
 *   - "testnet"           → run testnet only (default, for back-compat)
 *   - "mainnet"           → run mainnet only
 *   - "testnet,mainnet"   → run both networks sequentially in one invocation
 *   - "all"               → alias for "testnet,mainnet"
 *
 * Per-network algod URL overrides:
 *   ALGOD_TESTNET_URL / ALGOD_MAINNET_URL (preferred)
 *   ALGOD_URL (legacy, applied to whichever single network is active)
 *
 * Reads due vaults from Supabase, signs release() via agent wallet,
 * submits on-chain via Algorand, then syncs status back to DB.
 */

import algosdk from "algosdk"

const NETWORK_ENV = (process.env.ALGO_NETWORK || "testnet").toLowerCase()
const NETWORKS = NETWORK_ENV === "all"
  ? ["testnet", "mainnet"]
  : NETWORK_ENV.split(",").map(s => s.trim()).filter(n => n === "testnet" || n === "mainnet")
if (NETWORKS.length === 0) NETWORKS.push("testnet")

function defaultAlgodFor(net) {
  return net === "mainnet"
    ? "https://mainnet-api.algonode.cloud"
    : "https://testnet-api.algonode.cloud"
}

function algodUrlFor(net) {
  // Per-network override → legacy single ALGOD_URL (only when running one net) → public default
  const perNet = net === "mainnet"
    ? process.env.ALGOD_MAINNET_URL
    : process.env.ALGOD_TESTNET_URL
  if (perNet) return perNet
  if (NETWORKS.length === 1 && process.env.ALGOD_URL) return process.env.ALGOD_URL
  return defaultAlgodFor(net)
}

const SUPABASE_URL   = process.env.SUPABASE_URL
const SUPABASE_ANON  = process.env.SUPABASE_ANON_KEY
const AGENT_MNEMONIC = process.env.AGENT_WALLET_MNEMONIC

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error("FATAL: SUPABASE_URL and SUPABASE_ANON_KEY must be set as environment variables / GitHub Action secrets")
  process.exit(1)
}

// ARC-4 method selectors (sha512_256 of signature, first 4 bytes)
const SEL_RELEASE = new Uint8Array([0x07, 0x6b, 0xbd, 0x4d]) // release()void
const SEL_RELEASE_V2 = new Uint8Array([0x61, 0x17, 0xcc, 0xb8]) // AgentEscrowVaultV2.release(uint64)uint64

function lowBalanceThresholdFor(net) {
  return net === "mainnet" ? 0.5 : 0.1
}
const MAX_RETRIES   = 3
const RETRY_DELAY_MS = 4_000

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function supabaseGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
  })
  if (!res.ok) throw new Error(`Supabase GET failed: ${res.status}`)
  return res.json()
}

async function supabasePatch(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  })
  return res.status
}

// ── Retry wrapper ─────────────────────────────────────────────────────────────
async function withRetry(label, fn, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === retries) throw err
      console.warn(`  [retry ${attempt}/${retries}] ${label}: ${err.message}`)
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt))
    }
  }
}

// ── On-chain: release standard ALGO vault ────────────────────────────────────
async function releaseAlgoVault(algodClient, agentAccount, appId) {
  const params = await algodClient.getTransactionParams().do()
  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender: agentAccount.addr,
    suggestedParams: { ...params, fee: 2000, flatFee: true },
    appIndex: Number(appId),
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [SEL_RELEASE],
  })
  const signed = txn.signTxn(agentAccount.sk)
  const { txId } = await algodClient.sendRawTransaction(signed).do()
  await algosdk.waitForConfirmation(algodClient, txId, 4)
  return txId
}

// ── On-chain: release AgentEscrowVaultV2 (release(uint64)uint64 + box ref) ──
async function releaseAgentVaultV2(algodClient, agentAccount, appId, amountAlgo) {
  const params = await algodClient.getTransactionParams().do()
  const amountMicro = Math.round(Number(amountAlgo || 0) * 1_000_000)
  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender: agentAccount.addr,
    suggestedParams: { ...params, fee: 2000, flatFee: true },
    appIndex: Number(appId),
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [SEL_RELEASE_V2, algosdk.encodeUint64(amountMicro)],
    boxes: [{ appIndex: Number(appId), name: new Uint8Array(0) }],
  })
  const signed = txn.signTxn(agentAccount.sk)
  const { txId } = await algodClient.sendRawTransaction(signed).do()
  await algosdk.waitForConfirmation(algodClient, txId, 4)
  return txId
}

// ── On-chain: opt-in agent wallet to an ASA (idempotent) ─────────────────────
async function optInToAsa(algodClient, agentAccount, asaId) {
  try {
    const info = await algodClient.accountInformation(agentAccount.addr).do()
    const assets = info.assets || []
    if (assets.some(a => Number(a["asset-id"]) === Number(asaId))) {
      console.log(`  ASA opt-in already present for asset ${asaId}`)
      return
    }
  } catch (_) {}

  const params = await algodClient.getTransactionParams().do()
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: agentAccount.addr,
    receiver: agentAccount.addr,
    amount: 0,
    assetIndex: Number(asaId),
    suggestedParams: params,
  })
  const signed = txn.signTxn(agentAccount.sk)
  const { txId } = await algodClient.sendRawTransaction(signed).do()
  await algosdk.waitForConfirmation(algodClient, txId, 4)
  console.log(`  ASA opt-in confirmed: ${txId}`)
}

// ── On-chain: release ASA vault ───────────────────────────────────────────────
async function releaseAsaVault(algodClient, agentAccount, appId, asaId) {
  if (asaId) await optInToAsa(algodClient, agentAccount, asaId)

  const params = await algodClient.getTransactionParams().do()
  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender: agentAccount.addr,
    suggestedParams: { ...params, fee: 3000, flatFee: true },
    appIndex: Number(appId),
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [SEL_RELEASE],
    ...(asaId ? { foreignAssets: [Number(asaId)] } : {}),
  })
  const signed = txn.signTxn(agentAccount.sk)
  const { txId } = await algodClient.sendRawTransaction(signed).do()
  await algosdk.waitForConfirmation(algodClient, txId, 4)
  return txId
}

// ── Fetch due vaults from Supabase ────────────────────────────────────────────
async function fetchDueVaults(today) {
  try {
    const subs = await supabaseGet(
      `subscriptions?status=eq.active&next_billing_date=lte.${today}&select=id,name,user_id`
    )
    if (Array.isArray(subs) && subs.length > 0) {
      console.log(`Found ${subs.length} due subscription(s) via DB`)
      const subIds = subs.map(s => s.id).join(",")
      const dbVaults = await supabaseGet(
        `escrow_vaults?status=eq.locked&subscription_id=in.(${subIds})&select=id,app_id,app_address,subscription_id,user_id,amount,vault_type,asa_id,network`
      )
      return { vaults: Array.isArray(dbVaults) ? dbVaults : [], subs }
    }
  } catch (err) {
    console.warn(`DB fetch warning: ${err.message}`)
  }
  console.log("DB query returned no rows (RLS may restrict anon access) — checking VAULT_APP_IDS fallback")
  return { vaults: [], subs: [] }
}

// ── Per-network release loop ─────────────────────────────────────────────────
async function runForNetwork(network, agentAccount, today, vaults, subs) {
  const algodUrl = algodUrlFor(network)
  console.log(`\n──────── Network: ${network} | Algod: ${algodUrl} ────────`)
  const algodClient = new algosdk.Algodv2("", algodUrl, "")
  const lowThreshold = lowBalanceThresholdFor(network)

  // Balance check (per network — agent address is the same on both chains but funded separately)
  try {
    const info = await algodClient.accountInformation(agentAccount.addr).do()
    const balance = Number(info.amount) / 1e6
    console.log(`  Balance: ${balance} ALGO`)
    const fundUrl = network === "mainnet"
      ? "https://www.algorand.foundation/"
      : "https://bank.testnet.algorand.network/"
    if (balance < lowThreshold) {
      console.warn(`  WARNING: Agent balance low on ${network} (< ${lowThreshold} ALGO). Fund at: ${fundUrl}`)
      console.warn(`::warning title=Low Agent Balance (${network})::Balance below threshold — fund the agent wallet`)
    }
    if (balance < 0.001) {
      console.warn(`  CRITICAL: Agent wallet nearly empty on ${network} (${balance} ALGO). Transactions will fail without fees.`)
      console.warn(`  Fund the agent wallet at: ${fundUrl}`)
      console.warn(`::warning title=Agent Wallet Empty (${network})::Fund the agent wallet to enable on-chain releases`)
    }
  } catch (e) {
    console.warn(`  Could not fetch agent balance on ${network}: ${e.message}`)
  }

  // Filter vaults to this network when the row carries explicit network metadata.
  // Vaults missing a `network` column are assumed to belong to the only network being run
  // (back-compat: pre-multi-network rows). When running both nets, we still attempt them
  // on each — the wrong-network attempt will TEAL-reject and be skipped gracefully.
  const networkVaults = vaults.filter(v => !v.network || v.network === network)
  if (networkVaults.length === 0) {
    console.log(`  No vaults targeted at ${network}.`)
    return { released: 0, failed: 0 }
  }

  return await processVaults(algodClient, agentAccount, network, networkVaults, subs)
}

async function processVaults(algodClient, agentAccount, network, vaults, subsArray) {
  let released = 0, failed = 0
  for (const vault of vaults) {
    const sub     = subsArray.find(s => s.id === vault.subscription_id)
    const isAsa     = vault.vault_type === "asa"
    const isAgentV2 = vault.vault_type === "agent_v2"
    const typeTag   = isAsa ? "[ASA]" : isAgentV2 ? "[AGENT v2]" : "[ALGO]"
    console.log(`  → ${typeTag} Vault ${vault.id} | App #${vault.app_id}${vault.asa_id ? ` | ASA #${vault.asa_id}` : ""} | ${sub?.name ?? "manual"}`)

    try {
      let txId
      if (isAsa) {
        txId = await withRetry(
          `ASA release App#${vault.app_id}`,
          () => releaseAsaVault(algodClient, agentAccount, vault.app_id, vault.asa_id)
        )
      } else if (isAgentV2) {
        txId = await withRetry(
          `AgentV2 release App#${vault.app_id}`,
          () => releaseAgentVaultV2(algodClient, agentAccount, vault.app_id, vault.amount)
        )
      } else {
        txId = await withRetry(
          `ALGO release App#${vault.app_id}`,
          () => releaseAlgoVault(algodClient, agentAccount, vault.app_id)
        )
      }

      console.log(`    ✓ Released: ${txId}`)
      console.log(`    🔗 https://lora.algokit.io/${network}/transaction/${txId}`)

      const dbStatus = await supabasePatch(
        `escrow_vaults?id=eq.${vault.id}`,
        { status: "released", released_at: new Date().toISOString(), txn_id: txId }
      )

      if (vault.subscription_id) {
        try {
          const subRows = await supabaseGet(
            `subscriptions?id=eq.${vault.subscription_id}&select=billing_cycle,next_billing_date`
          )
          const subRow = Array.isArray(subRows) ? subRows[0] : null
          const cycle = subRow?.billing_cycle || "monthly"
          const baseStr = subRow?.next_billing_date || new Date().toISOString().split("T")[0]
          const next = new Date(baseStr + "T00:00:00")
          switch (cycle) {
            case "weekly":    next.setDate(next.getDate() + 7); break
            case "quarterly": next.setMonth(next.getMonth() + 3); break
            case "yearly":    next.setFullYear(next.getFullYear() + 1); break
            case "monthly":
            default:          next.setMonth(next.getMonth() + 1); break
          }
          await supabasePatch(
            `subscriptions?id=eq.${vault.subscription_id}`,
            { next_billing_date: next.toISOString().split("T")[0], last_billed_at: new Date().toISOString() }
          )
        } catch (advErr) {
          console.warn(`    ⚠ Could not advance billing date: ${advErr.message}`)
        }
      }

      console.log(`    DB sync: ${dbStatus === 204 ? "ok" : `status ${dbStatus}`}`)
      released++
    } catch (err) {
      const msg = err.message || ""
      const isAuthError = msg.includes("assert") || msg.includes("TEAL") ||
        msg.includes("transaction rejected") || msg.includes("rejected by logic")
      if (isAuthError) {
        console.warn(`    ⚠ Skipped on ${network} (agent not authorized for this vault — release manually via Pera wallet): App #${vault.app_id}`)
        console.warn(`::warning title=Vault Skipped::App #${vault.app_id} on ${network} — agent address not authorized in contract`)
      } else {
        console.error(`    ✗ Failed on ${network} (all retries exhausted): ${msg}`)
        console.error(`::error title=Vault Release Failed::App #${vault.app_id} on ${network} — ${msg}`)
        failed++
      }
    }
  }
  return { released, failed }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now()
  console.log("=== Unsubscribely Autonomous Agent v2 ===")
  console.log(`Networks : ${NETWORKS.join(", ")}`)
  console.log(`Time     : ${new Date().toISOString()}`)
  console.log()

  if (!AGENT_MNEMONIC) {
    console.error("AGENT_WALLET_MNEMONIC not set — add it as a GitHub Actions secret")
    process.exit(1)
  }

  const agentAccount = algosdk.mnemonicToSecretKey(AGENT_MNEMONIC)
  console.log(`Agent    : ${agentAccount.addr}`)

  // Fetch due vaults ONCE (DB is shared across networks).
  const today = new Date().toISOString().split("T")[0]
  console.log(`\nChecking subscriptions due on or before ${today}...`)

  let { vaults, subs } = await fetchDueVaults(today)

  // Fallback: env-specified vault IDs
  if (vaults.length === 0 && process.env.VAULT_APP_IDS) {
    const ids = process.env.VAULT_APP_IDS.split(",").map(s => s.trim()).filter(Boolean)
    vaults = ids.map(app_id => ({
      id: `manual-${app_id}`, app_id,
      vault_type: "standard", asa_id: null,
      subscription_id: null, user_id: null,
    }))
    console.log(`Using ${vaults.length} vault(s) from VAULT_APP_IDS env`)
  }

  if (vaults.length === 0) {
    console.log("No locked vaults to release today.")
    console.log(`\nDone in ${Date.now() - startTime}ms`)
    return
  }

  const standardVaults = vaults.filter(v => v.vault_type !== "asa")
  const asaVaults      = vaults.filter(v => v.vault_type === "asa")
  console.log(`\nFound ${vaults.length} vault(s) to release`)
  if (standardVaults.length) console.log(`  Standard ALGO vaults : ${standardVaults.length}`)
  if (asaVaults.length)      console.log(`  ASA token vaults     : ${asaVaults.length}`)

  const subsArray = Array.isArray(subs) ? subs : []
  let totalReleased = 0, totalFailed = 0

  for (const network of NETWORKS) {
    const { released, failed } = await runForNetwork(network, agentAccount, today, vaults, subsArray)
    totalReleased += released
    totalFailed += failed
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n=== Summary: ${totalReleased} released, ${totalFailed} failed across [${NETWORKS.join(", ")}] | ${elapsed}s ===`)

  if (totalFailed > 0) {
    console.error(`::error title=Agent Run Failed::${totalFailed} vault(s) failed to release across [${NETWORKS.join(", ")}]`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error("Unhandled error:", err)
  process.exit(1)
})
