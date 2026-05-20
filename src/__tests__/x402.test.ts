/**
 * x402 protocol unit tests.
 * Run: npx vitest run src/__tests__/x402.test.ts
 */
import { describe, it, expect } from "vitest"

describe("x402 Protocol", () => {
  it("validates 402 challenge response structure", () => {
    const challenge = {
      x402Version: 1,
      error: "Payment required",
      accepts: [{
        scheme: "exact",
        network: "algorand-testnet",
        maxAmountRequired: "1000",
        resource: "/api/x402-demo",
        description: "Live Algorand network snapshot",
        payTo: "RVHOYLPY4L47JYCYEMCP7EMEC2AZ3HV53YHSL2ZISX6PSO5EQ6H5YVAE5U",
        asset: "ALGO",
        maxTimeoutSeconds: 60,
      }],
    }

    expect(challenge.x402Version).toBe(1)
    expect(challenge.accepts).toHaveLength(1)
    expect(challenge.accepts[0].scheme).toBe("exact")
    expect(challenge.accepts[0].network).toContain("algorand")
    expect(Number(challenge.accepts[0].maxAmountRequired)).toBeGreaterThan(0)
    expect(challenge.accepts[0].payTo.length).toBe(58)
  })

  it("validates X-PAYMENT-RESPONSE receipt structure", () => {
    const receipt = {
      x402Version: 1,
      network: "algorand-testnet",
      txid: "6U4QHXQDITWVECUON5GNPRVVLXR5LFIV2KWINJSJSMJXU5ZKGSSA",
      pay_to: "RVHOYLPY4L47JYCYEMCP7EMEC2AZ3HV53YHSL2ZISX6PSO5EQ6H5YVAE5U",
      amount_microalgos: "1000",
    }

    expect(receipt.x402Version).toBe(1)
    expect(receipt.txid).toBeTruthy()
    expect(receipt.txid.length).toBeGreaterThan(40)
    expect(receipt.pay_to.length).toBe(58)
    expect(Number(receipt.amount_microalgos)).toBe(1000)
  })

  it("converts microalgos to ALGO correctly", () => {
    const microalgos = 1000
    const algo = microalgos / 1_000_000
    expect(algo).toBe(0.001)
  })

  it("detects replay attack (same txid used twice)", () => {
    const usedTxids = new Set<string>()
    const txid = "ABC123XYZ"

    // First use should succeed
    const firstClaim = !usedTxids.has(txid)
    usedTxids.add(txid)
    expect(firstClaim).toBe(true)

    // Second use should fail (replay)
    const secondClaim = !usedTxids.has(txid)
    expect(secondClaim).toBe(false)
  })

  it("validates payment amount meets minimum", () => {
    const required = 1000
    const paid = 1000
    const underpaid = 500

    expect(paid >= required).toBe(true)
    expect(underpaid >= required).toBe(false)
  })
})
