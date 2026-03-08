import algosdk from "algosdk"
import { supabase } from "@/integrations/supabase/client"

interface CompiledContract {
  approval: string // base64
  clear: string // base64
  globalSchema: { numUints: number; numByteSlices: number }
  localSchema: { numUints: number; numByteSlices: number }
}

/**
 * Fetch compiled TEAL escrow contract from edge function
 */
export async function fetchCompiledContract(): Promise<CompiledContract> {
  const { data, error } = await supabase.functions.invoke("algorand-compile")
  if (error) throw new Error(`Failed to compile contract: ${error.message}`)
  if (!data || !data.approval || !data.clear) {
    throw new Error("Invalid contract compilation response")
  }
  return data as CompiledContract
}

/**
 * Deploy an escrow vault smart contract on Algorand testnet
 */
export async function deployEscrowContract(
  algodClient: algosdk.Algodv2,
  senderAddress: string,
  recipientAddress: string,
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>
): Promise<{ appId: number; appAddress: string; txnId: string }> {
  const contract = await fetchCompiledContract()

  const approvalBytes = new Uint8Array(
    atob(contract.approval)
      .split("")
      .map((c) => c.charCodeAt(0))
  )
  const clearBytes = new Uint8Array(
    atob(contract.clear)
      .split("")
      .map((c) => c.charCodeAt(0))
  )

  const params = await algodClient.getTransactionParams().do()
  const recipientBytes = algosdk.decodeAddress(recipientAddress).publicKey

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
    appArgs: [recipientBytes],
  })

  const signedTxns = await signTransaction(txn)
  const sendResponse = await algodClient.sendRawTransaction(signedTxns[0]).do()
  const txid = extractTxId(sendResponse)
  const result = await algosdk.waitForConfirmation(algodClient, txid, 4)

  // Handle bigint from algosdk v3
  const appId = Number((result as any).applicationIndex ?? (result as any)["application-index"] ?? 0)
  if (appId === 0) throw new Error("Failed to retrieve application ID from confirmed transaction")

  const appAddress = String(algosdk.getApplicationAddress(appId))

  return { appId, appAddress, txnId: txid }
}

/**
 * Fund the escrow contract app account with ALGO
 */
export async function fundEscrowContract(
  algodClient: algosdk.Algodv2,
  senderAddress: string,
  appAddress: string,
  amountMicroAlgos: number,
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>
): Promise<string> {
  const params = await algodClient.getTransactionParams().do()

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: senderAddress,
    receiver: appAddress,
    amount: amountMicroAlgos + 100_000, // extra for MBR
    suggestedParams: params,
  })

  const signedTxns = await signTransaction(txn)
  const sendResponse = await algodClient.sendRawTransaction(signedTxns[0]).do()
  const txid = extractTxId(sendResponse)
  await algosdk.waitForConfirmation(algodClient, txid, 4)
  return txid
}

/**
 * Call the escrow contract to release funds to recipient
 */
export async function releaseEscrowFunds(
  algodClient: algosdk.Algodv2,
  senderAddress: string,
  appId: number,
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>
): Promise<string> {
  const params = await algodClient.getTransactionParams().do()

  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender: senderAddress,
    appIndex: appId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    suggestedParams: { ...params, fee: 2000, flatFee: true },
    appArgs: [new TextEncoder().encode("release")],
  })

  const signedTxns = await signTransaction(txn)
  const sendResponse = await algodClient.sendRawTransaction(signedTxns[0]).do()
  const txid = extractTxId(sendResponse)
  await algosdk.waitForConfirmation(algodClient, txid, 4)
  return txid
}

/**
 * Call the escrow contract kill switch - returns funds to creator
 */
export async function killEscrowContract(
  algodClient: algosdk.Algodv2,
  senderAddress: string,
  appId: number,
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>
): Promise<string> {
  const params = await algodClient.getTransactionParams().do()

  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender: senderAddress,
    appIndex: appId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    suggestedParams: { ...params, fee: 2000, flatFee: true },
    appArgs: [new TextEncoder().encode("kill")],
  })

  const signedTxns = await signTransaction(txn)
  const sendResponse = await algodClient.sendRawTransaction(signedTxns[0]).do()
  const txid = extractTxId(sendResponse)
  await algosdk.waitForConfirmation(algodClient, txid, 4)
  return txid
}

/**
 * Delete the escrow contract after release/kill (reclaim MBR)
 */
export async function deleteEscrowContract(
  algodClient: algosdk.Algodv2,
  senderAddress: string,
  appId: number,
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>
): Promise<string> {
  const params = await algodClient.getTransactionParams().do()

  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender: senderAddress,
    appIndex: appId,
    onComplete: algosdk.OnApplicationComplete.DeleteApplicationOC,
    suggestedParams: params,
  })

  const signedTxns = await signTransaction(txn)
  const sendResponse = await algodClient.sendRawTransaction(signedTxns[0]).do()
  const txid = extractTxId(sendResponse)
  await algosdk.waitForConfirmation(algodClient, txid, 4)
  return txid
}

/**
 * Extract txid from sendRawTransaction response (handles v2 and v3 response formats)
 */
function extractTxId(response: any): string {
  if (typeof response === "string") return response
  return String(response?.txid ?? response?.txId ?? response?.["txId"] ?? "")
}
