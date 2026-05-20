import { useState, useEffect } from "react"
import { getAlgoUsdPrice, type AlgorandNetwork } from "@/lib/algorand/gora-oracle"

/**
 * Hook to get live ALGO/USD price from Gora Oracle.
 * Refreshes every 60 seconds.
 */
export function useAlgoPrice(network: AlgorandNetwork = "testnet") {
  const [price, setPrice] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const fetchPrice = async () => {
      try {
        const p = await getAlgoUsdPrice(network)
        if (!cancelled) {
          setPrice(p)
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }

    fetchPrice()
    const interval = setInterval(fetchPrice, 60_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [network])

  return { price, loading }
}
