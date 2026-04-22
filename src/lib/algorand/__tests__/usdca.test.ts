import { describe, it, expect } from "vitest"
import { usdcaToMicro, microToUsdca, getUsdcaAssetId, MICRO_USDCA_PER_USDCA } from "../usdca"

describe("USDCa unit conversions", () => {
  it("rounds-trips small amounts exactly", () => {
    expect(usdcaToMicro(1)).toBe(BigInt(MICRO_USDCA_PER_USDCA))
    expect(usdcaToMicro(0.000001)).toBe(1n)
    expect(microToUsdca(1_000_000n)).toBe(1)
  })

  it("returns the canonical USDC asset ids per network", () => {
    expect(getUsdcaAssetId("testnet")).toBe(10458941)
    expect(getUsdcaAssetId("mainnet")).toBe(31566704)
  })

  it("handles fractional input via rounding", () => {
    // 0.123456789 USDCa → 123_456 micro (truncate at 6 decimals)
    expect(usdcaToMicro(0.123456789)).toBe(123457n) // .789 rounds up
  })
})
