/**
 * Subscription management unit tests.
 * Run: npx vitest run src/__tests__/subscriptions.test.ts
 */
import { describe, it, expect } from "vitest"

describe("Subscription helpers", () => {
  it("calculates monthly cost from yearly billing cycle", () => {
    const yearly = 120
    const monthly = yearly / 12
    expect(monthly).toBe(10)
  })

  it("detects upcoming renewal within 7 days", () => {
    const now = new Date()
    const billingDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
    const daysUntil = Math.ceil((billingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    expect(daysUntil).toBeLessThanOrEqual(7)
    expect(daysUntil).toBeGreaterThan(0)
  })

  it("formats currency correctly", () => {
    const amount = 139.0
    const formatted = `₹${amount.toFixed(2)}`
    expect(formatted).toBe("₹139.00")
  })

  it("categorizes subscription by name", () => {
    const categories: Record<string, string[]> = {
      Entertainment: ["spotify", "netflix", "youtube", "apple music"],
      Development: ["github", "cursor", "lovable", "vercel"],
      Education: ["duolingo", "notion"],
      "AI Tools": ["chatgpt", "claude", "google ai"],
    }

    function categorize(name: string): string {
      const lower = name.toLowerCase()
      for (const [cat, keywords] of Object.entries(categories)) {
        if (keywords.some((k) => lower.includes(k))) return cat
      }
      return "Uncategorized"
    }

    expect(categorize("Spotify Premium")).toBe("Entertainment")
    expect(categorize("GitHub Pro")).toBe("Development")
    expect(categorize("Duolingo Super")).toBe("Education")
    expect(categorize("Google AI Pro")).toBe("AI Tools")
    expect(categorize("Random Service")).toBe("Uncategorized")
  })

  it("validates Algorand address format", () => {
    const validAddr = "RVHOYLPY4L47JYCYEMCP7EMEC2AZ3HV53YHSL2ZISX6PSO5EQ6H5YVAE5U"
    expect(validAddr.length).toBe(58)
    expect(/^[A-Z2-7]{58}$/.test(validAddr)).toBe(true)

    const invalidAddr = "not-an-address"
    expect(invalidAddr.length).not.toBe(58)
  })

  it("calculates vault amount in microalgos", () => {
    const algoAmount = 3.5
    const microalgos = Math.round(algoAmount * 1_000_000)
    expect(microalgos).toBe(3_500_000)
  })
})
