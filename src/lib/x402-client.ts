/**
 * x402 client wrapper — agentic commerce HTTP 402 payment flow.
 *
 * Wraps `fetch` so any call to a 402-paywalled endpoint will:
 *   1. Receive a 402 with a paymentRequirements descriptor.
 *   2. Sign + submit the payment using the configured wallet.
 *   3. Re-issue the request with an X-PAYMENT header so the server unlocks.
 *
 * For agents calling AI / data services that follow the x402 protocol, this
 * is what makes the call truly "agentic commerce" instead of a plain REST call.
 *
 * Reference: https://github.com/coinbase/x402
 */

import { wrapFetchWithPayment } from "x402-fetch"

let _wrappedFetch: typeof fetch | null = null

/**
 * Returns a fetch-compatible function that auto-handles HTTP 402 challenges.
 * Pass it the wallet account (algosdk-style or viem-style) the agent should
 * spend from. The first call lazy-initializes the wrapper.
 */
export function getX402Fetch(walletAccount: unknown): typeof fetch {
  if (_wrappedFetch) return _wrappedFetch
  // x402-fetch accepts a viem-like account; for Algorand-only flows the
  // payment scheme is configured server-side and this still permits the
  // agent to receive the 402 challenge metadata for downstream handling.
  _wrappedFetch = wrapFetchWithPayment(fetch, walletAccount as never) as typeof fetch
  return _wrappedFetch
}

/**
 * Lower-level helper for endpoints that may or may not require payment.
 * Returns the parsed JSON body and, when applicable, the payment receipt
 * the server included in the X-PAYMENT-RESPONSE header.
 */
export async function fetchWithX402<T = unknown>(
  url: string,
  init: RequestInit,
  walletAccount: unknown,
): Promise<{ data: T; paymentReceipt: string | null }> {
  const f = getX402Fetch(walletAccount)
  const res = await f(url, init)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`x402 request failed (${res.status}): ${body}`)
  }
  const data = (await res.json()) as T
  const paymentReceipt = res.headers.get("X-PAYMENT-RESPONSE")
  return { data, paymentReceipt }
}
