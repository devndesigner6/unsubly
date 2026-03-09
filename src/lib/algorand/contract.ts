/**
 * Algorand Smart Contract Operations
 * Uses AlgoKit utils patterns with raw algosdk for Pera Wallet compatibility
 * Supports 5 vault types: Standard, Time-Locked, Multi-Sig, Dispute, ASA
 */
import algosdk from "algosdk"
import { supabase } from "@/integrations/supabase/client"
import type { VaultType } from "./constants"
import { createARC2Note, createARC3Metadata } from "./algokit"
import type { AlgorandNetwork } from "./constants"

interface CompiledContract {
  approval: string
  clear: string
  globalSchema: { numUints: number; numByteSlices: number }
  localSchema: { numUints: number; numByteSlices: number }
}

function extractTxId(response: any): string {
  if (typeof response === "string") return response
  return String(response?.txid ?? response?.txId ?? response?.["txId"] ?? "")
}

/**
 * Fetch compiled TEAL contract from edge function
 */
export async function fetchCompiledContract(type: VaultType = "standard"): Promise<CompiledContract> {
  const { data, error } = await supabase.functions.invoke("algorand-compile", { body: { type } })
  if (error) throw new Error(`Failed to compile contract: ${error.message}`)
  if (!data?.approval || !data?.clear) throw new Error("Invalid contract compilation response")
  return data as CompiledContract
}

interface DeployResult {
  appId: number
  appAddress: string
  txnId: string
}

/**
 * Core deployment function with ARC-2 note support
 */
async function deployContract(
  algodClient: algosdk.Algodv2,
  senderAddress: string,
  appArgs: Uint8Array[],
  contract: CompiledContract,
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
  vaultType: VaultType = "standard",
): Promise<DeployResult> {
  const approvalBytes = new Uint8Array(atob(contract.approval).split("").map((c) => c.charCodeAt(0)))
  const clearBytes = new Uint8Array(atob(contract.clear).split("").map((c) => c.charCodeAt(0)))
  const params = await algodClient.getTransactionParams().do()

  // ARC-2 compliant deployment note
  const note = createARC2Note("unsubscribely", {
    action: "deploy",
    vault_type: vaultType,
    version: "1.0.0",
  })

  const txn = algosdk.makeApplicationCreateTxnFromObject({
    sender: senderAddress,
    suggestedParams: params,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    approvalProgram: approvalBytes,
    clearProgram: clearBytes,
    numGlobalInts: contract.globalSchema.numUints,
    numGlobalByteSlices: contract.globalSchema.numByteSlices,
    numLocalInts: contract.localSchema.numUints,
    numLocalByteSlices: contract.localSchema.numByteSlices,
    appArgs,
    note,
  })

  const signedTxns = await signTransaction(txn)
  const sendResponse = await algodClient.sendRawTransaction(signedTxns[0]).do()
  const txid = extractTxId(sendResponse)
  const result = await algosdk.waitForConfirmation(algodClient, txid, 4)
  const appId = Number((result as any).applicationIndex ?? (result as any)["application-index"] ?? 0)
  if (appId === 0) throw new Error("Failed to retrieve application ID")
  const appAddress = String(algosdk.getApplicationAddress(appId))
  return { appId, appAddress, txnId: txid }
}

// ─── Vault Deployment Functions ───

export async function deployEscrowContract(
  algodClient: algosdk.Algodv2, senderAddress: string, recipientAddress: string,
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<DeployResult> {
  const contract = await fetchCompiledContract("standard")
  const recipientBytes = algosdk.decodeAddress(recipientAddress).publicKey
  return deployContract(algodClient, senderAddress, [recipientBytes], contract, signTransaction, "standard")
}

export async function deployTimeLockContract(
  algodClient: algosdk.Algodv2, senderAddress: string, recipientAddress: string,
  unlockTimestamp: number, signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<DeployResult> {
  const contract = await fetchCompiledContract("time_locked")
  const recipientBytes = algosdk.decodeAddress(recipientAddress).publicKey
  const timeBytes = algosdk.encodeUint64(unlockTimestamp)
  return deployContract(algodClient, senderAddress, [recipientBytes, timeBytes], contract, signTransaction, "time_locked")
}

export async function deployMultiSigContract(
  algodClient: algosdk.Algodv2, senderAddress: string, recipientAddress: string,
  coSignerAddress: string, signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<DeployResult> {
  const contract = await fetchCompiledContract("multi_sig")
  const recipientBytes = algosdk.decodeAddress(recipientAddress).publicKey
  const coSignerBytes = algosdk.decodeAddress(coSignerAddress).publicKey
  return deployContract(algodClient, senderAddress, [recipientBytes, coSignerBytes], contract, signTransaction, "multi_sig")
}

export async function deployDisputeContract(
  algodClient: algosdk.Algodv2, senderAddress: string, recipientAddress: string,
  arbitratorAddress: string, signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<DeployResult> {
  const contract = await fetchCompiledContract("dispute")
  const recipientBytes = algosdk.decodeAddress(recipientAddress).publicKey
  const arbitratorBytes = algosdk.decodeAddress(arbitratorAddress).publicKey
  return deployContract(algodClient, senderAddress, [recipientBytes, arbitratorBytes], contract, signTransaction, "dispute")
}

export async function deployASAContract(
  algodClient: algosdk.Algodv2, senderAddress: string, recipientAddress: string,
  assetId: number, signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<DeployResult> {
  const contract = await fetchCompiledContract("asa")
  const recipientBytes = algosdk.decodeAddress(recipientAddress).publicKey
  const assetIdBytes = algosdk.encodeUint64(assetId)
  return deployContract(algodClient, senderAddress, [recipientBytes, assetIdBytes], contract, signTransaction, "asa")
}

// ─── Funding ───

export async function fundEscrowContract(
  algodClient: algosdk.Algodv2, senderAddress: string, appAddress: string,
  amountMicroAlgos: number, signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<string> {
  const params = await algodClient.getTransactionParams().do()
  const note = createARC2Note("unsubscribely", { action: "fund", app_address: appAddress })
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: senderAddress, receiver: appAddress,
    amount: amountMicroAlgos + 100_000, suggestedParams: params, note,
  })
  const signedTxns = await signTransaction(txn)
  const sendResponse = await algodClient.sendRawTransaction(signedTxns[0]).do()
  const txid = extractTxId(sendResponse)
  await algosdk.waitForConfirmation(algodClient, txid, 4)
  return txid
}

// ─── App Calls ───

async function callApp(
  algodClient: algosdk.Algodv2, senderAddress: string, appId: number,
  appArgs: Uint8Array[], signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
  action: string, extraFee = false,
): Promise<string> {
  const params = await algodClient.getTransactionParams().do()
  const note = createARC2Note("unsubscribely", { action, app_id: appId })
  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender: senderAddress, appIndex: appId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    suggestedParams: extraFee ? { ...params, fee: 2000, flatFee: true } : params,
    appArgs, note,
  })
  const signedTxns = await signTransaction(txn)
  const sendResponse = await algodClient.sendRawTransaction(signedTxns[0]).do()
  const txid = extractTxId(sendResponse)
  await algosdk.waitForConfirmation(algodClient, txid, 4)
  return txid
}

export async function releaseEscrowFunds(
  algodClient: algosdk.Algodv2, senderAddress: string, appId: number,
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<string> {
  return callApp(algodClient, senderAddress, appId, [new TextEncoder().encode("release")], signTransaction, "release", true)
}

export async function killEscrowContract(
  algodClient: algosdk.Algodv2, senderAddress: string, appId: number,
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<string> {
  return callApp(algodClient, senderAddress, appId, [new TextEncoder().encode("kill")], signTransaction, "kill", true)
}

export async function approveMultiSig(
  algodClient: algosdk.Algodv2, senderAddress: string, appId: number,
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<string> {
  return callApp(algodClient, senderAddress, appId, [new TextEncoder().encode("approve")], signTransaction, "approve", true)
}

export async function optinASA(
  algodClient: algosdk.Algodv2, senderAddress: string, appId: number,
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<string> {
  return callApp(algodClient, senderAddress, appId, [new TextEncoder().encode("optin")], signTransaction, "optin", true)
}

export async function deleteEscrowContract(
  algodClient: algosdk.Algodv2, senderAddress: string, appId: number,
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<string> {
  const params = await algodClient.getTransactionParams().do()
  const note = createARC2Note("unsubscribely", { action: "delete", app_id: appId })
  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender: senderAddress, appIndex: appId,
    onComplete: algosdk.OnApplicationComplete.DeleteApplicationOC,
    suggestedParams: params, note,
  })
  const signedTxns = await signTransaction(txn)
  const sendResponse = await algodClient.sendRawTransaction(signedTxns[0]).do()
  const txid = extractTxId(sendResponse)
  await algosdk.waitForConfirmation(algodClient, txid, 4)
  return txid
}

// ─── NFT Receipt Minting (ARC-3) ───

export async function mintNFTReceipt(
  algodClient: algosdk.Algodv2, senderAddress: string, vaultAppId: number,
  amount: number, recipientAddress: string, vaultType: VaultType,
  network: AlgorandNetwork,
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<{ assetId: number; txnId: string }> {
  const params = await algodClient.getTransactionParams().do()

  const metadata = createARC3Metadata({
    appId: vaultAppId,
    amount,
    recipient: recipientAddress,
    vaultType,
    network,
  })

  const note = new TextEncoder().encode(JSON.stringify(metadata))
  const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender: senderAddress, suggestedParams: params,
    total: 1, decimals: 0, defaultFrozen: false,
    unitName: "RCPT", assetName: `Receipt-${vaultAppId}`,
    assetURL: `https://unsubscribely.com/receipt/${vaultAppId}#arc3`,
    note,
  })
  const signedTxns = await signTransaction(txn)
  const sendResponse = await algodClient.sendRawTransaction(signedTxns[0]).do()
  const txid = extractTxId(sendResponse)
  const result = await algosdk.waitForConfirmation(algodClient, txid, 4)
  const assetId = Number((result as any)["asset-index"] ?? (result as any).assetIndex ?? 0)
  return { assetId, txnId: txid }
}

// ─── ASA Transfer ───

export async function sendASAToApp(
  algodClient: algosdk.Algodv2, senderAddress: string, appAddress: string,
  assetId: number, amount: number,
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<string> {
  const params = await algodClient.getTransactionParams().do()
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: senderAddress, receiver: appAddress,
    assetIndex: assetId, amount, suggestedParams: params,
  })
  const signedTxns = await signTransaction(txn)
  const sendResponse = await algodClient.sendRawTransaction(signedTxns[0]).do()
  const txid = extractTxId(sendResponse)
  await algosdk.waitForConfirmation(algodClient, txid, 4)
  return txid
}
