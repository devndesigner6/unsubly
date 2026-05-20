/**
 * NFDomains (NFD) integration — resolve Algorand addresses to .algo names.
 * API docs: https://api.nf.domains
 *
 * Used to display human-readable names instead of raw 58-char addresses
 * throughout the dashboard, vault cards, and Telegram notifications.
 */

const NFD_API = "https://api.nf.domains"
const CACHE = new Map<string, { name: string | null; avatar: string | null; verified: boolean; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export interface NFDData {
  name: string | null
  avatar: string | null
  verified: boolean
}

/**
 * Resolve an Algorand address to its NFD (.algo) name + metadata.
 * Returns null name if no NFD is registered for this address.
 * Results are cached for 5 minutes.
 */
export async function resolveNFD(address: string): Promise<string | null> {
  const data = await resolveNFDFull(address)
  return data.name
}

export async function resolveNFDFull(address: string): Promise<NFDData> {
  if (!address || address.length !== 58) return { name: null, avatar: null, verified: false }

  // Check cache
  const cached = CACHE.get(address)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return { name: cached.name, avatar: cached.avatar, verified: cached.verified }

  try {
    const res = await fetch(`${NFD_API}/nfd/lookup?address=${address}&view=brief`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      CACHE.set(address, { name: null, avatar: null, verified: false, ts: Date.now() })
      return { name: null, avatar: null, verified: false }
    }

    const data = await res.json()
    const entry = data?.[address]
    const name = entry?.name || null
    const avatar = entry?.properties?.userDefined?.avatar || entry?.properties?.verified?.avatar || null
    const verified = !!(entry?.properties?.verified?.caAlgo)

    CACHE.set(address, { name, avatar, verified, ts: Date.now() })
    return { name, avatar, verified }
  } catch {
    CACHE.set(address, { name: null, avatar: null, verified: false, ts: Date.now() })
    return { name: null, avatar: null, verified: false }
  }
}

/**
 * Get the display name for an address.
 */
export async function getDisplayName(address: string): Promise<string> {
  const nfd = await resolveNFD(address)
  if (nfd) return nfd
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * React hook-friendly synchronous lookup (returns cached value or null).
 */
export function getCachedNFD(address: string): string | null {
  const cached = CACHE.get(address)
  return cached?.name || null
}
