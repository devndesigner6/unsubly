import { useEffect, useState } from "react"
import { RiHistoryLine, RiLoader4Line, RiExternalLinkLine } from "@remixicon/react"
import { useAlgorand } from "@/lib/algorand/context"
import { getVaultBillingHistory, type BillingRecord } from "@/lib/algorand/contract"
import { microalgosToAlgo } from "@/lib/algorand/constants"

interface Props {
  appId: number
  vaultType: string
}

/**
 * On-chain billing history reader for AgentEscrowVaultV2 vaults.
 * Each release writes a permanent BillingRecord into Box Storage; this tab
 * surfaces those records as an immutable audit trail.
 */
export function VaultMemoryTab({ appId, vaultType }: Props) {
  const { algodClient } = useAlgorand()
  const [records, setRecords] = useState<BillingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      try {
        const r = await getVaultBillingHistory(algodClient, appId)
        if (!cancelled) setRecords(r)
      } catch (err: any) {
        if (!cancelled) setError(err?.message || String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [algodClient, appId])

  const isV2 = vaultType === "agent_v2" || vaultType === "agent"
  if (!isV2) {
    return (
      <div className="rounded border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        On-chain billing history is only available on Agent Escrow Vault v2.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <RiHistoryLine className="size-4" /> On-chain billing history
        </h3>
        <a
          href={`https://lora.algokit.io/testnet/application/${appId}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          title="View boxes in Lora explorer"
        >
          Boxes <RiExternalLinkLine className="size-3" />
        </a>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <RiLoader4Line className="mr-2 size-4 animate-spin" /> Reading boxes…
        </div>
      ) : error ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Could not read on-chain history: {error}
        </div>
      ) : records.length === 0 ? (
        <div className="rounded border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No releases yet. Once the agent (or you) releases funds, each cycle
          appears here as a permanent on-chain record.
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded border border-border">
          {records.map((r) => (
            <li key={r.cycle} className="flex items-center gap-4 p-3 text-sm">
              <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">#{r.cycle}</span>
              <span className="flex-1 text-foreground">
                {microalgosToAlgo(r.amount)} ALGO
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(r.timestamp * 1000).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
