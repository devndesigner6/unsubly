import { describe, it, expect } from "vitest"
import { getIndexerClient } from "../indexer"

describe("indexer client", () => {
  it("constructs a testnet indexer client pointing at algonode", () => {
    const idx = getIndexerClient("testnet")
    // algosdk Indexer doesn't expose internals, but it should exist
    expect(idx).toBeDefined()
    expect(typeof idx.searchForTransactions).toBe("function")
  })

  it("constructs a mainnet indexer client", () => {
    const idx = getIndexerClient("mainnet")
    expect(idx).toBeDefined()
  })
})
