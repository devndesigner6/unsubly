/**
 * USDCa (USDC on Algorand) client helpers.
 *
 * USDCa is a stablecoin ASA — same wire interface as any Algorand asset.
 * Two operations users typically need:
 *   1. opt-in (a 0-amount transfer to themselves) — required before any
 *      address can hold a non-zero balance of the ASA
 *   2. transfer — send N micro-USDC to a recipient
 *
 * These helpers stay UI-agnostic; pass in any algosdk wallet sign function.
 *
 * Asset IDs are sourced from constants.ts (USDCA_ASSET_ID), which is itself
 * env-overridable so a different stable could be plugged in.
 */

import algosdk from "algosdk"
import { USDCA_ASSET_ID, type AlgorandNetwork } from "./constants"

type SignFn = (txn: algosdk.Transaction) => Promise<Uint8Array[]>

/** USDCa has 6 decimals, just like USDC. */
export const USDCA_DECIMALS = 6
export const MICRO_USDCA_PER_USDCA = 10 ** USDCA_DECIMALS

export function usdcaToMicro(amount: number): bigint {
  return BigInt(Math.round(amount * MICRO_USDCA_PER_USDCA))
}

export function microToUsdca(micro: bigint | number): number {
  const n = typeof micro === "bigint" ? Number(micro) : micro
  return n / MICRO_USDCA_PER_USDCA
}

export function getUsdcaAssetId(network: AlgorandNetwork): number {
  return USDCA_ASSET_ID[network]
}

/** Returns true if the address has already opted into USDCa on `network`. */
export async function isOptedInToUsdca(
  algodClient: algosdk.Algodv2,
  address: string,
  network: AlgorandNetwork,
): Promise<boolean> {
  const targetId = BigInt(getUsdcaAssetId(network))
  const acct = await algodClient.accountInformation(address).do() as any
  const assets = acct?.assets ?? acct?.["assets"] ?? []
  for (const a of assets) {
    const aid = a?.assetId ?? a?.["asset-id"]
    if (aid !== undefined && BigInt(aid) === targetId) return true
  }
  return false
}

/** Sends a 0-amount self transfer to opt the wallet into USDCa. */
export async function optInToUsdca(
  algodClient: algosdk.Algodv2,
  address: string,
  network: AlgorandNetwork,
  signTransaction: SignFn,
): Promise<string> {
  const params = await algodClient.getTransactionParams().do()
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: address,
    receiver: address,
    amount: 0,
    assetIndex: getUsdcaAssetId(network),
    suggestedParams: params,
  })
  const signed = await signTransaction(txn)
  const sendRes = await algodClient.sendRawTransaction(signed[0]).do() as any
  const txid = sendRes.txId ?? sendRes.txid
  await algosdk.waitForConfirmation(algodClient, txid, 4)
  return txid
}

/** Transfers `microAmount` micro-USDCa from `address` to `recipient`. */
export async function transferUsdca(
  algodClient: algosdk.Algodv2,
  address: string,
  recipient: string,
  microAmount: bigint,
  network: AlgorandNetwork,
  signTransaction: SignFn,
): Promise<string> {
  if (microAmount <= 0n) throw new Error("transferUsdca: amount must be > 0")
  const params = await algodClient.getTransactionParams().do()
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: address,
    receiver: recipient,
    amount: microAmount,
    assetIndex: getUsdcaAssetId(network),
    suggestedParams: params,
  })
  const signed = await signTransaction(txn)
  const sendRes = await algodClient.sendRawTransaction(signed[0]).do() as any
  const txid = sendRes.txId ?? sendRes.txid
  await algosdk.waitForConfirmation(algodClient, txid, 4)
  return txid
}
