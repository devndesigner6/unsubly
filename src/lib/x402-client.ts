/**
 * x402 client — Algorand-native HTTP 402 payment flow.
 *
 * Replaces the EVM-only x402-fetch library with a native Algorand
 * implementation that:
 *   1. Receives a 402 with paymentRequirements (payTo, maxAmountRequired).
 *   2. Builds an Algorand Payment txn via algosdk.
 *   3. Signs with the user's connected wallet (Pera / Defly / Lute).
 *   4. Submits on-chain and retries the request with X-PAYMENT header.
 *   5. Returns the response + X-PAYMENT-RESPONSE receipt.
 *
 * Reference: https://x402.org
 */

import algosdk from "algosdk"

function extractTxId(response: unknown): string {
  if (typeof response === "string") return response
  const r = response as Record<string, unknown>
  return String(r?.txid ?? r?.txId ?? r?.["txId"] ?? "")
}

interface PaymentRequirement {
  payTo: string
  maxAmountRequired: string
  network: string
  resource?: string
  description?: string
}

interface X402Challenge {
  x402Version: number
  error: string
  accepts: PaymentRequirement[]
}

interface AlgorandSigner {
  addr: string
  signTxn: (txn: Uint8Array) => Uint8Array
}

interface TransactionSigner {
  (txnGroup: algosdk.Transaction[], indexesToSign: number[]): Promise<Uint8Array[]>
}

interface X402WalletConfig {
  senderAddress: string
  signer: TransactionSigner
  algodClient: algosdk.Algodv2
}

/**
 * Lower-level: handle a 402 challenge by building, signing, and submitting
 * an Algorand Payment txn, then retrying the original request.
 */
async function handleChallenge(
  url: string,
  init: RequestInit,
  challenge: X402Challenge,
  wallet: X402WalletConfig,
): Promise<{ response: Response; paymentTxid: string }> {
  const req = challenge.accepts[0]
  if (!req?.payTo || !req?.maxAmountRequired) {
    throw new Error("x402: 402 response missing payTo or maxAmountRequired")
  }

  const amount = Number(req.maxAmountRequired)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`x402: invalid payment amount: ${req.maxAmountRequired}`)
  }

  // Build the payment txn
  const params = await wallet.algodClient.getTransactionParams().do()
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: wallet.senderAddress,
    receiver: req.payTo,
    amount,
    suggestedParams: { ...params, fee: 1000, flatFee: true },
  })

  // Sign via the wallet adapter's signer (Pera/Defly/Lute)
  const signedArr = await wallet.signer([txn], [0])
  const signedTxn = signedArr[0]

  // Submit on-chain
  const sendRes = await wallet.algodClient.sendRawTransaction(signedTxn).do()
  const txId = extractTxId(sendRes)
  await algosdk.waitForConfirmation(wallet.algodClient, txId, 4)

  // Base64-encode the signed txn for the X-PAYMENT header
  const signedB64 = Buffer.from(signedTxn).toString("base64")

  // Retry the original request with payment proof
  const retryInit: RequestInit = {
    ...init,
    headers: { ...init.headers, "X-PAYMENT": signedB64 },
  }
  const response = await fetch(url, retryInit)

  return { response, paymentTxid: txId }
}

/**
 * Fetch with automatic x402 payment handling (Algorand-native).
 *
 * If the endpoint returns 402, this function handles the payment challenge
 * transparently and returns the final response.
 *
 * @returns The parsed JSON body, the payment receipt (if any), and the
 *          payment txid (if a payment was made).
 */
export async function fetchWithX402<T = unknown>(
  url: string,
  init: RequestInit,
  wallet: X402WalletConfig,
): Promise<{ data: T; paymentReceipt: string | null; paymentTxid: string | null }> {
  // First attempt
  const firstRes = await fetch(url, init)

  if (firstRes.status !== 402) {
    if (!firstRes.ok) {
      const body = await firstRes.text()
      throw new Error(`x402 request failed (${firstRes.status}): ${body}`)
    }
    const data = (await firstRes.json()) as T
    const paymentReceipt = firstRes.headers.get("X-PAYMENT-RESPONSE")
    return { data, paymentReceipt, paymentTxid: null }
  }

  // Handle 402 challenge
  const challengeBody = (await firstRes.json()) as X402Challenge
  const { response, paymentTxid } = await handleChallenge(url, init, challengeBody, wallet)

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`x402 request failed after payment (${response.status}): ${body}`)
  }

  const data = (await response.json()) as T
  const paymentReceipt = response.headers.get("X-PAYMENT-RESPONSE")
  return { data, paymentReceipt, paymentTxid }
}

/**
 * Create an X402WalletConfig from the useWallet hook's signer and address.
 * This is the bridge between the wallet adapter and the x402 client.
 */
export function createX402Wallet(
  senderAddress: string,
  signer: TransactionSigner,
  algodClient: algosdk.Algodv2,
): X402WalletConfig {
  return { senderAddress, signer, algodClient }
}
