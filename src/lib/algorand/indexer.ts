/**
 * Algorand Indexer client helpers.
 *
 * The frontend currently reads payment history from Supabase
 * (onchain_payments). That table only contains txns the app itself made
 *, it misses any direct transfers to/from a vault address. The Indexer
 * is the source-of-truth for ALL on-chain activity.
 *
 * Use these helpers anywhere you want true on-chain history rather than
 * the app's internal log.
 */

import algosdk from "algosdk"
import { getNetworkConfig, type AlgorandNetwork } from "./constants"

export interface IndexerTxn {
  id: string
  round: number
  roundTime: number
  type: string
  sender: string
  receiver?: string
  amount?: bigint
  assetId?: number
  appId?: number
  note?: string
}

export function getIndexerClient(network: AlgorandNetwork): algosdk.Indexer {
  const cfg = getNetworkConfig(network)
  return new algosdk.Indexer(cfg.algodToken, cfg.indexerServer, cfg.indexerPort)
}

function decodeNote(noteB64?: string): string | undefined {
  if (!noteB64) return undefined
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(noteB64), c => c.charCodeAt(0)))
  } catch { return undefined }
}

function normalize(raw: any): IndexerTxn {
  const id = raw.id ?? raw["id"]
  const round = Number(raw["confirmed-round"] ?? raw.confirmedRound ?? 0)
  const roundTime = Number(raw["round-time"] ?? raw.roundTime ?? 0)
  const type = String(raw["tx-type"] ?? raw.txType ?? "")
  const pay = raw["payment-transaction"] ?? raw.paymentTransaction
  const axfer = raw["asset-transfer-transaction"] ?? raw.assetTransferTransaction
  const appcall = raw["application-transaction"] ?? raw.applicationTransaction
  return {
    id: String(id),
    round, roundTime, type,
    sender: String(raw.sender),
    receiver: pay?.receiver ?? axfer?.receiver,
    amount: pay?.amount !== undefined ? BigInt(pay.amount)
          : axfer?.amount !== undefined ? BigInt(axfer.amount)
          : undefined,
    assetId: axfer ? Number(axfer["asset-id"] ?? axfer.assetId) : undefined,
    appId: appcall ? Number(appcall["application-id"] ?? appcall.applicationId) : undefined,
    note: decodeNote(raw.note),
  }
}

/** All txns where `address` is sender or receiver, newest first. */
export async function listAddressTxns(
  network: AlgorandNetwork, address: string, limit = 50,
): Promise<IndexerTxn[]> {
  const idx = getIndexerClient(network)
  const res = await idx.searchForTransactions()
    .address(address)
    .limit(limit)
    .do() as any
  const txns = res?.transactions ?? res?.["transactions"] ?? []
  return txns.map(normalize)
}

/** All txns issued against (calling, or paying into) a given app id. */
export async function listAppTxns(
  network: AlgorandNetwork, appId: number, limit = 50,
): Promise<IndexerTxn[]> {
  const idx = getIndexerClient(network)
  const res = await idx.searchForTransactions()
    .applicationID(appId)
    .limit(limit)
    .do() as any
  const txns = res?.transactions ?? res?.["transactions"] ?? []
  return txns.map(normalize)
}
