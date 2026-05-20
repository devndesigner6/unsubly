import { useState, useEffect } from "react"
import { resolveNFDFull, type NFDData } from "@/lib/algorand/nfd"

/**
 * React hook to resolve an Algorand address to its NFD (.algo) name + metadata.
 * Returns name, avatar URL, and verified status.
 */
export function useNFD(address: string | null): string | null {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    if (!address) { setName(null); return }
    let cancelled = false
    resolveNFDFull(address).then((data) => {
      if (!cancelled) setName(data.name)
    })
    return () => { cancelled = true }
  }, [address])

  return name
}

/**
 * Extended hook that returns full NFD data (name + avatar + verified).
 */
export function useNFDFull(address: string | null): NFDData {
  const [data, setData] = useState<NFDData>({ name: null, avatar: null, verified: false })

  useEffect(() => {
    if (!address) { setData({ name: null, avatar: null, verified: false }); return }
    let cancelled = false
    resolveNFDFull(address).then((d) => {
      if (!cancelled) setData(d)
    })
    return () => { cancelled = true }
  }, [address])

  return data
}
