/**
 * x402 client — Algorand-native implementation.
 *
 * Replaces the broken EVM-only x402-fetch library with a direct
 * Algorand implementation using algosdk.
 *
 * Flow:
 *   1. Call endpoint normally
 *   2. If 402 → parse payTo + amount from response
 *   3. Build Algorand Payment txn, sign with connected wallet
 *   4. Retry with X-PAYMENT: <base64 signed txn>
 *   5. Return data + X-PAYMENT-RESPONSE receipt header
 */

import algosdk from "algosdk"

export interface X402Result<T = unknown> {
  data: T
  paymentReceipt: string | null
}

/**
 * Fetch a URL, automatically handling HTTP 402 by paying on Algorand.
 *
 * @param url - The endpoint to call
 * @param init - Standard fetch RequestInit
 * @param algodClient - Algorand algod client
 * @param signerAddress - The wallet address that will sign the payment
 * @param signTransaction - Function that signs a transaction (from wallet context)
 */
export async function fetchWithAlgorandX402<T = unknown>(
  url: string,
  init: RequestInit,
  algodClient: algosdk.Algodv2,
  signerAddress: string,
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array[]>
): Promise<X402Result<T>> {

  // First attempt — no payment header
  let res = await fetch(url, init)

  // Not a payment challenge — return as-is
  if (res.status !== 402) {
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Request failed (${res.status}): ${body}`)
    }
    const data = (await res.json()) as T
    return { data, paymentReceipt: null }
  }

  // Parse 402 challenge
  const challenge = await res.json() as {
    accepts?: Array<{
      payTo: string
      maxAmountRequired: string
      network: string
      description?: string
    }>
  }

  const requirement = challenge?.accepts?.[0]
  if (!requirement?.payTo || !requirement?.maxAmountRequired) {
    throw new Error("402 response missing payment requirements")
  }

  const payTo  = requirement.payTo
  const amount = Number(requirement.maxAmountRequired)

  if (!algosdk.isValidAddress(payTo)) {
    throw new Error(`Invalid payTo address in 402 response: ${payTo}`)
  }

  // Build Algorand payment transaction
  const params = await algodClient.getTransactionParams().do()
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: signerAddress,
    receiver: payTo,
    amount: amount,
    suggestedParams: params,
  })

  // Sign with connected wallet
  const signedBytes = await signTransaction(txn)
  const b64 = Buffer.from(signedBytes[0]).toString("base64")

  // Retry with payment proof
  res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> || {}),
      "X-PAYMENT": b64,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`x402 payment rejected (${res.status}): ${body}`)
  }

  const data = (await res.json()) as T
  const paymentReceipt = res.headers.get("X-PAYMENT-RESPONSE")

  return { data, paymentReceipt }
}

