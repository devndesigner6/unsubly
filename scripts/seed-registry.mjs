#!/usr/bin/env node
//
// scripts/seed-registry.mjs
//
// One-shot script that populates the on-chain ServiceRegistry with a small
// set of sample listings, so the registry page and the picker modal show
// real data during demos / judging.
//
// Usage:
//   ALGO_NETWORK=testnet node scripts/seed-registry.mjs
//   ALGO_NETWORK=mainnet node scripts/seed-registry.mjs
//
// Required env:
//   AGENT_WALLET_MNEMONIC          25-word mnemonic of the wallet that signs
//                                  the registrations (also becomes "provider").
//   SERVICE_REGISTRY_APP_ID_TESTNET   (or SERVICE_REGISTRY_APP_ID legacy)
//   SERVICE_REGISTRY_APP_ID_MAINNET   when ALGO_NETWORK=mainnet
//
// Optional:
//   ALGOD_TESTNET_URL / ALGOD_MAINNET_URL  paid algod overrides
//   SEED_DRY_RUN=1                         print plan, do not send txns
//
import algosdk from "algosdk"

const NETWORK = (process.env.ALGO_NETWORK || "testnet").toLowerCase()
const DRY_RUN = process.env.SEED_DRY_RUN === "1"

const ALGOD_URL =
  NETWORK === "mainnet"
    ? (process.env.ALGOD_MAINNET_URL || "https://mainnet-api.algonode.cloud")
    : (process.env.ALGOD_TESTNET_URL || "https://testnet-api.algonode.cloud")

const APP_ID = Number(
  NETWORK === "mainnet"
    ? process.env.SERVICE_REGISTRY_APP_ID_MAINNET
    : (process.env.SERVICE_REGISTRY_APP_ID_TESTNET || process.env.SERVICE_REGISTRY_APP_ID),
)

const MNEMONIC = process.env.AGENT_WALLET_MNEMONIC

if (!APP_ID || Number.isNaN(APP_ID)) {
  console.error(`FATAL: ServiceRegistry app id for ${NETWORK} is not set`)
  process.exit(1)
}
if (!MNEMONIC) {
  console.error("FATAL: AGENT_WALLET_MNEMONIC must be set")
  process.exit(1)
}

const account = algosdk.mnemonicToSecretKey(MNEMONIC)
const sender = typeof account.addr === "string" ? account.addr : account.addr.toString()

const algod = new algosdk.Algodv2(process.env.ALGOD_TOKEN || "", ALGOD_URL, "")

// Same ABIMethod the front-end uses, kept in lock-step with src/lib/algorand/contract.ts
const REGISTER_METHOD = new algosdk.ABIMethod({
  name: "register",
  args: [
    { type: "string", name: "service_id" },
    { type: "uint64", name: "price_microalgos" },
    { type: "uint64", name: "cycle_days" },
    { type: "string", name: "name" },
  ],
  returns: { type: "void" },
})

function buildBoxName(serviceId) {
  const idBytes = new TextEncoder().encode(serviceId)
  const out = new Uint8Array(4 + 2 + idBytes.length)
  out.set([0x73, 0x76, 0x63, 0x3a], 0) // "svc:"
  out[4] = (idBytes.length >> 8) & 0xff
  out[5] = idBytes.length & 0xff
  out.set(idBytes, 6)
  return out
}

const SAMPLE_SERVICES = [
  { service_id: "spotify-premium",  name: "Spotify Premium Agent",   price_microalgos: 5_000_000,  cycle_days: 30 },
  { service_id: "netflix-standard", name: "Netflix Standard Agent",  price_microalgos: 15_000_000, cycle_days: 30 },
  { service_id: "chatgpt-plus",     name: "ChatGPT Plus Agent",      price_microalgos: 20_000_000, cycle_days: 30 },
  { service_id: "notion-pro",       name: "Notion Pro Agent",        price_microalgos: 10_000_000, cycle_days: 30 },
  { service_id: "github-pro",       name: "GitHub Pro Agent",        price_microalgos: 4_000_000,  cycle_days: 30 },
]

console.log(`=== ServiceRegistry seeder ===`)
console.log(`Network : ${NETWORK}`)
console.log(`Algod   : ${ALGOD_URL}`)
console.log(`App ID  : ${APP_ID}`)
console.log(`Sender  : ${sender}`)
console.log(`Mode    : ${DRY_RUN ? "DRY RUN" : "LIVE"}`)
console.log(``)

const acctInfo = await algod.accountInformation(sender).do()
const balanceAlgos = Number(acctInfo.amount) / 1_000_000
console.log(`Balance : ${balanceAlgos.toFixed(3)} ALGO`)
if (balanceAlgos < 2 && !DRY_RUN) {
  console.error(`Refusing to seed with less than 2 ALGO available. Fund ${sender} on ${NETWORK} and re-run.`)
  process.exit(1)
}

// Box storage requires the app's escrow account to hold the per-box min-balance
// itself. The contract does NOT inner-pay itself, so we top it up here from
// the seeder wallet before any register() calls. ~0.15 ALGO per box × 5 boxes
// + base account min = round up to 1 ALGO of headroom.
const APP_ADDRESS = algosdk.getApplicationAddress(APP_ID)
const APP_ADDR_STR = typeof APP_ADDRESS === "string" ? APP_ADDRESS : APP_ADDRESS.toString()
const appInfo = await algod.accountInformation(APP_ADDR_STR).do()
const appBalance = Number(appInfo.amount) / 1_000_000
console.log(`App acct: ${APP_ADDR_STR}`)
console.log(`App bal : ${appBalance.toFixed(3)} ALGO`)

const TARGET_APP_BALANCE = 1.0
if (appBalance < TARGET_APP_BALANCE && !DRY_RUN) {
  const topUpMicro = Math.ceil((TARGET_APP_BALANCE - appBalance) * 1_000_000)
  console.log(`Funding app account with ${(topUpMicro / 1_000_000).toFixed(3)} ALGO ...`)
  const params = await algod.getTransactionParams().do()
  const fundTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender,
    receiver: APP_ADDR_STR,
    amount: topUpMicro,
    suggestedParams: params,
  })
  const signed = fundTxn.signTxn(account.sk)
  const { txid } = await algod.sendRawTransaction(signed).do()
  await algosdk.waitForConfirmation(algod, txid, 4)
  console.log(`Funded. txid=${txid}`)
}
console.log(``)

let success = 0
let skipped = 0
let failed  = 0

for (const svc of SAMPLE_SERVICES) {
  const tag = `[${svc.service_id}]`
  try {
    if (DRY_RUN) {
      console.log(`${tag} would register: "${svc.name}" — ${svc.price_microalgos / 1_000_000} ALGO every ${svc.cycle_days}d`)
      success++
      continue
    }

    const params = await algod.getTransactionParams().do()
    const atc = new algosdk.AtomicTransactionComposer()
    atc.addMethodCall({
      appID: APP_ID,
      method: REGISTER_METHOD,
      methodArgs: [
        svc.service_id,
        BigInt(svc.price_microalgos),
        BigInt(svc.cycle_days),
        svc.name,
      ],
      sender,
      suggestedParams: params,
      boxes: [{ appIndex: APP_ID, name: buildBoxName(svc.service_id) }],
      signer: algosdk.makeBasicAccountTransactionSigner(account),
    })

    process.stdout.write(`${tag} sending... `)
    const result = await atc.execute(algod, 4)
    const txid = result.txIDs[0]
    console.log(`OK txid=${txid}`)
    success++
  } catch (err) {
    const msg = err?.message || String(err)
    // Re-registering by the same provider is a contract no-op; surface as skipped.
    if (/already|exists|provider/i.test(msg)) {
      console.log(`${tag} skipped (already registered)`)
      skipped++
    } else {
      console.error(`${tag} FAILED: ${msg}`)
      failed++
    }
  }
}

console.log(``)
console.log(`Done. success=${success} skipped=${skipped} failed=${failed}`)
process.exit(failed > 0 ? 2 : 0)
