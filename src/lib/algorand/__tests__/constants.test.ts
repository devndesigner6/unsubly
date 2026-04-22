import { describe, it, expect } from "vitest"
import {
  microalgosToAlgo, algoToMicroalgos, shortenAddress,
  getNetworkConfig, getLoraTransactionUrl, MICROALGOS_PER_ALGO,
} from "../constants"

describe("microalgo conversions", () => {
  it("converts ALGO ↔ microALGO at 1e6 precision", () => {
    expect(algoToMicroalgos(1)).toBe(MICROALGOS_PER_ALGO)
    expect(microalgosToAlgo(MICROALGOS_PER_ALGO)).toBe(1)
    expect(algoToMicroalgos(0.000001)).toBe(1)
  })

  it("rounds fractional microalgos to integer (no silent truncation bugs)", () => {
    // 1.2345678 ALGO can't be represented in microalgos exactly, must round
    const result = algoToMicroalgos(1.2345678)
    expect(Number.isInteger(result)).toBe(true)
    expect(result).toBe(1234568)
  })
})

describe("shortenAddress", () => {
  it("formats long Algorand addresses", () => {
    const addr = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBBBBB"
    expect(shortenAddress(addr)).toBe("AAAAAA...BBBBBB")
  })
})

describe("getNetworkConfig", () => {
  it("returns testnet config by default", () => {
    const cfg = getNetworkConfig("testnet")
    expect(cfg.network).toBe("testnet")
    expect(cfg.algodServer).toMatch(/testnet/)
  })
  it("returns mainnet config", () => {
    const cfg = getNetworkConfig("mainnet")
    expect(cfg.network).toBe("mainnet")
    expect(cfg.algodServer).toMatch(/mainnet/)
  })
})

describe("Lora explorer URLs", () => {
  it("builds a transaction URL", () => {
    const url = getLoraTransactionUrl("XYZ", "testnet")
    expect(url).toBe("https://lora.algokit.io/testnet/transaction/XYZ")
  })
})
