import algosdk from "algosdk"
import { supabase } from "@/integrations/supabase/client"
import type { VaultType } from "./constants"

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

export async function fetchCompiledContract(type: VaultType = "standard"): Promise<CompiledContract> {
  const { data, error } = await supabase.functions.invoke("algorand-compile", { body: { type } })
  if (error) throw new Error(`Failed to compile contract: ${error.message}`)
  if (!data?.approval || !data?.clear) throw new Error("Invalid contract compilation response")
  return data as CompiledContract
}

interface DeployResult { appId: number; appAddress: string; txnId: string }

async function deployContract(
  algodClient: algosdk.Algodv2,
  senderAddress: string,
  appArgs: Uint8Array[],
  contract: CompiledContract,
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<DeployResult> {
  const approvalBytes = new Uint8Array(atob(contract.approval).split("").map((c) => c.charCodeAt(0)))
  const clearBytes = new Uint8Array(atob(contract.clear).split("").map((c) => c.charCodeAt(0)))
  const params = await algodClient.getTransactionParams().do()

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

export async function deployEscrowContract(
  algodClient: algosdk.Algodv2, senderAddress: string, recipientAddress: string,
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<DeployResult> {
  const contract = await fetchCompiledContract("standard")
  const recipientBytes = algosdk.decodeAddress(recipientAddress).publicKey
  return deployContract(algodClient, senderAddress, [recipientBytes], contract, signTransaction)
}

export async function deployTimeLockContract(
  algodClient: algosdk.Algodv2, senderAddress: string, recipientAddress: string,
  unlockTimestamp: number, signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<DeployResult> {
  const contract = await fetchCompiledContract("time_locked")
  const recipientBytes = algosdk.decodeAddress(recipientAddress).publicKey
  const timeBytes = algosdk.encodeUint64(unlockTimestamp)
  return deployContract(algodClient, senderAddress, [recipientBytes, timeBytes], contract, signTransaction)
}

export async function deployMultiSigContract(
  algodClient: algosdk.Algodv2, senderAddress: string, recipientAddress: string,
  coSignerAddress: string, signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<DeployResult> {
  const contract = await fetchCompiledContract("multi_sig")
  const recipientBytes = algosdk.decodeAddress(recipientAddress).publicKey
  const coSignerBytes = algosdk.decodeAddress(coSignerAddress).publicKey
  return deployContract(algodClient, senderAddress, [recipientBytes, coSignerBytes], contract, signTransaction)
}

export async function deployDisputeContract(
  algodClient: algosdk.Algodv2, senderAddress: string, recipientAddress: string,
  arbitratorAddress: string, signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<DeployResult> {
  const contract = await fetchCompiledContract("dispute")
  const recipientBytes = algosdk.decodeAddress(recipientAddress).publicKey
  const arbitratorBytes = algosdk.decodeAddress(arbitratorAddress).publicKey
  return deployContract(algodClient, senderAddress, [recipientBytes, arbitratorBytes], contract, signTransaction)
}

export async function deployASAContract(
  algodClient: algosdk.Algodv2, senderAddress: string, recipientAddress: string,
  assetId: number, signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<DeployResult> {
  const contract = await fetchCompiledContract("asa")
  const recipientBytes = algosdk.decodeAddress(recipientAddress).publicKey
  const assetIdBytes = algosdk.encodeUint64(assetId)
  return deployContract(algodClient, senderAddress, [recipientBytes, assetIdBytes], contract, signTransaction)
}

export async function fundEscrowContract(
  algodClient: algosdk.Algodv2, senderAddress: string, appAddress: string,
  amountMicroAlgos: number, signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<string> {
  const params = await algodClient.getTransactionParams().do()
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: senderAddress, receiver: appAddress,
    amount: amountMicroAlgos + 100_000, suggestedParams: params,
  })
  const signedTxns = await signTransaction(txn)
  const sendResponse = await algodClient.sendRawTransaction(signedTxns[0]).do()
  const txid = extractTxId(sendResponse)
  await algosdk.waitForConfirmation(algodClient, txid, 4)
  return txid
}

async function callApp(
  algodClient: algosdk.Algodv2, senderAddress: string, appId: number,
  appArgs: Uint8Array[], signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
  extraFee = false,
): Promise<string> {
  const params = await algodClient.getTransactionParams().do()
  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender: senderAddress, appIndex: appId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    suggestedParams: extraFee ? { ...params, fee: 2000, flatFee: true } : params,
    appArgs,
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
  return callApp(algodClient, senderAddress, appId, [new TextEncoder().encode("release")], signTransaction, true)
}

export async function killEscrowContract(
  algodClient: algosdk.Algodv2, senderAddress: string, appId: number,
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<string> {
  return callApp(algodClient, senderAddress, appId, [new TextEncoder().encode("kill")], signTransaction, true)
}

export async function approveMultiSig(
  algodClient: algosdk.Algodv2, senderAddress: string, appId: number,
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<string> {
  return callApp(algodClient, senderAddress, appId, [new TextEncoder().encode("approve")], signTransaction, true)
}

export async function optinASA(
  algodClient: algosdk.Algodv2, senderAddress: string, appId: number,
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<string> {
  return callApp(algodClient, senderAddress, appId, [new TextEncoder().encode("optin")], signTransaction, true)
}

export async function deleteEscrowContract(
  algodClient: algosdk.Algodv2, senderAddress: string, appId: number,
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<string> {
  const params = await algodClient.getTransactionParams().do()
  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender: senderAddress, appIndex: appId,
    onComplete: algosdk.OnApplicationComplete.DeleteApplicationOC,
    suggestedParams: params,
  })
  const signedTxns = await signTransaction(txn)
  const sendResponse = await algodClient.sendRawTransaction(signedTxns[0]).do()
  const txid = extractTxId(sendResponse)
  await algosdk.waitForConfirmation(algodClient, txid, 4)
  return txid
}

export async function mintNFTReceipt(
  algodClient: algosdk.Algodv2, senderAddress: string, vaultAppId: number,
  amount: number, recipientAddress: string,
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>,
): Promise<{ assetId: number; txnId: string }> {
  const params = await algodClient.getTransactionParams().do()
  const metadata = {
    standard: "arc3", name: `Payment Receipt - App ${vaultAppId}`,
    description: `Escrow vault payment of ${amount} ALGO`,
    properties: { app_id: vaultAppId, amount, recipient: recipientAddress, timestamp: new Date().toISOString() },
  }
  const note = new TextEncoder().encode(JSON.stringify(metadata))
  const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender: senderAddress, suggestedParams: params,
    total: 1, decimals: 0, defaultFrozen: false,
    unitName: "RCPT", assetName: `Receipt-${vaultAppId}`,
    note,
  })
  const signedTxns = await signTransaction(txn)
  const sendResponse = await algodClient.sendRawTransaction(signedTxns[0]).do()
  const txid = extractTxId(sendResponse)
  const result = await algosdk.waitForConfirmation(algodClient, txid, 4)
  const assetId = Number((result as any)["asset-index"] ?? (result as any).assetIndex ?? 0)
  return { assetId, txnId: txid }
}

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
