/**
 * Unsubscribely Autonomous A2A Agent
 * Releases locked escrow vaults on-chain when subscriptions are due.
 *
 * Reads due vaults from Supabase, signs release() via agent wallet,
 * submits on-chain via Algorand, then syncs status back to DB.
 */

import algosdk from "algosdk"

const SUPABASE_URL    = process.env.SUPABASE_URL    || "https://ipnywrvwszqlaykbkske.supabase.co"
const SUPABASE_ANON   = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlwbnl3cnZ3c3pxbGF5a2Jrc2tlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTg0NDksImV4cCI6MjA4ODQ3NDQ0OX0.xUcUpKQ52PVFGAjKokKDwhf9p8RZYmEOgMmu7HAm-sk"
const AGENT_MNEMONIC  = process.env.AGENT_WALLET_MNEMONIC
const ALGOD_URL       = process.env.ALGOD_URL || "https://testnet-api.algonode.cloud"
const NETWORK         = process.env.ALGO_NETWORK || "testnet"

// ARC-4 method selector for release()void
const RELEASE_SELECTOR = new Uint8Array([0x07, 0x6b, 0xbd, 0x4d])

async function supabaseGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
  })
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

async function releaseOnChain(algodClient, agentAccount, appId) {
  const params = await algodClient.getTransactionParams().do()
  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender: agentAccount.addr,
    suggestedParams: { ...params, fee: 2000, flatFee: true },
    appIndex: appId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [RELEASE_SELECTOR],
  })
  const signed = txn.signTxn(agentAccount.sk)
  const { txId } = await algodClient.sendRawTransaction(signed).do()
  await algosdk.waitForConfirmation(algodClient, txId, 4)
  return txId
}

async function main() {
  console.log("=== Unsubscribely Autonomous Agent ===")
  console.log(`Network : ${NETWORK}`)
  console.log(`Time    : ${new Date().toISOString()}`)

  if (!AGENT_MNEMONIC) {
    console.error("AGENT_WALLET_MNEMONIC not set — add it as a GitHub secret")
    process.exit(1)
  }

  const agentAccount = algosdk.mnemonicToSecretKey(AGENT_MNEMONIC)
  console.log(`Agent   : ${agentAccount.addr}`)

  const algodClient = new algosdk.Algodv2("", ALGOD_URL, "")

  // Check agent wallet balance
  try {
    const info = await algodClient.accountInformation(agentAccount.addr).do()
    const balance = Number(info.amount) / 1e6
    console.log(`Balance : ${balance} ALGO`)
    if (balance < 0.1) {
      console.warn("Warning: Agent wallet balance low — fund at https://bank.testnet.algorand.network/")
    }
  } catch (e) {
    console.warn("Could not fetch agent balance:", e.message)
  }

  // Try fetching due vaults from Supabase (requires RLS-compatible anon access)
  const today = new Date().toISOString().split("T")[0]
  console.log(`\nChecking subscriptions due on or before ${today}...`)

  let vaults = []

  const subs = await supabaseGet(
    `subscriptions?status=eq.active&next_billing_date=lte.${today}&select=id,name,user_id`
  )

  if (Array.isArray(subs) && subs.length > 0) {
    console.log(`Found ${subs.length} due subscription(s) via DB`)
    const subIds = subs.map(s => s.id).join(",")
    const dbVaults = await supabaseGet(
      `escrow_vaults?status=eq.locked&vault_type=eq.standard&subscription_id=in.(${subIds})&select=id,app_id,app_address,subscription_id,user_id,amount`
    )
    if (Array.isArray(dbVaults)) vaults = dbVaults
  } else {
    console.log("DB query returned no rows (RLS may restrict anon access) — checking VAULT_APP_IDS fallback")
  }

  // Fallback: release specific app IDs passed via env (comma-separated)
  if (vaults.length === 0 && process.env.VAULT_APP_IDS) {
    const ids = process.env.VAULT_APP_IDS.split(",").map(s => s.trim()).filter(Boolean)
    vaults = ids.map(app_id => ({ id: `manual-${app_id}`, app_id, subscription_id: null, user_id: null }))
    console.log(`Using ${vaults.length} vault(s) from VAULT_APP_IDS env: ${process.env.VAULT_APP_IDS}`)
  }

  if (vaults.length === 0) {
    console.log("No locked standard vaults to release today.")
    return
  }
  console.log(`Found ${vaults.length} vault(s) to release\n`)

  const subsArray = Array.isArray(subs) ? subs : []
  let released = 0, failed = 0
  for (const vault of vaults) {
    const sub = subsArray.find(s => s.id === vault.subscription_id)
    console.log(`→ Vault ${vault.id} | App #${vault.app_id} | ${sub?.name ?? "?"}`)
    try {
      const txId = await releaseOnChain(algodClient, agentAccount, Number(vault.app_id))
      console.log(`  ✓ Released on-chain: ${txId}`)
      console.log(`  🔗 https://lora.algokit.io/${NETWORK}/transaction/${txId}`)

      // Sync status back to Supabase
      const status = await supabasePatch(
        `escrow_vaults?id=eq.${vault.id}`,
        { status: "released", released_at: new Date().toISOString(), txn_id: txId }
      )
      console.log(`  DB sync: ${status === 204 ? "ok" : `status ${status} (RLS may block — vault will sync on next app visit)`}`)
      released++
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`)
      failed++
    }
  }

  console.log(`\n=== Done: ${released} released, ${failed} failed ===`)
}

main().catch(err => { console.error(err); process.exit(1) })
