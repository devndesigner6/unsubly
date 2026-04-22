import { describe, it, expect } from "vitest"
import { withX402 } from "../x402-algorand.mjs"

function mockRes() {
  const headers = {}
  let body = "", statusCode = 200
  return {
    statusCode,
    setHeader: (k, v) => { headers[k] = v },
    end: (b) => { body = b },
    get _body() { return body },
    get _headers() { return headers },
    get _status() { return this.statusCode },
  }
}

describe("withX402", () => {
  it("returns 500 if payTo is missing", async () => {
    const handler = withX402({ payTo: "", priceMicroalgos: 1000, network: "algorand-testnet" }, async () => {})
    const res = mockRes()
    await handler({ headers: {}, url: "/x" }, res)
    expect(res._status).toBe(500)
    const body = JSON.parse(res._body)
    expect(body.error).toMatch(/payTo/)
  })

  it("returns 402 with paymentRequirements when no X-PAYMENT header is present", async () => {
    const handler = withX402({
      payTo: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBBBBB",
      priceMicroalgos: 5000,
      network: "algorand-testnet",
      description: "test endpoint",
    }, async () => {})
    const res = mockRes()
    await handler({ headers: { host: "example.com" }, url: "/foo" }, res)
    expect(res._status).toBe(402)
    const body = JSON.parse(res._body)
    expect(body.x402Version).toBe(1)
    expect(body.accepts[0].maxAmountRequired).toBe("5000")
    expect(body.accepts[0].network).toBe("algorand-testnet")
    expect(body.accepts[0].asset).toBe("ALGO")
  })

  it("returns 402 with detail error on malformed X-PAYMENT", async () => {
    const handler = withX402({
      payTo: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBBBBB",
      priceMicroalgos: 1000,
      network: "algorand-testnet",
    }, async () => {})
    const res = mockRes()
    await handler({ headers: { "x-payment": "not-base64-data!@#$" }, url: "/x" }, res)
    expect(res._status).toBe(402)
  })
})
