import { useEffect, useState } from "react"
import { RiCloseLine, RiStoreLine, RiLoader4Line, RiSearchLine, RiArrowRightLine } from "@remixicon/react"
import { microalgosToAlgo } from "@/lib/algorand/constants"
import { useAlgorand } from "@/lib/algorand/context"

export interface RegistryService {
  service_id: string
  provider: string
  price_microalgos: number
  cycle_days: number
  name: string
}

interface PickerProps {
  onClose: () => void
  onPick: (s: RegistryService) => void
}

/**
 * Modal that fetches the on-chain Service Registry (via `/api/agent/registry`)
 * and lets the user pick a published service to pre-fill a subscription form.
 *
 * The registry is the source of truth, picking from it links the user's
 * subscription to a real on-chain merchant offering, instead of free-text.
 */
export default function RegistryPickerModal({ onClose, onPick }: PickerProps) {
  const { network } = useAlgorand()
  const [services, setServices] = useState<RegistryService[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState("")

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/agent/registry?network=${network}`)
        const json = await res.json()
        if (!alive) return
        // Server response shapes (all currently HTTP 200 except 5xx):
        //   undeployed   → { registry_app_id: null, services: [], message: "...not deployed..." }
        //   deployed     → { registry_app_id: <num>, services: [...], count, total, ... }
        //   server error → { error: "..." }  (often non-200)
        // Order matters: check "undeployed" BEFORE the services array, otherwise
        // an undeployed registry is misclassified as an empty-but-deployed list.
        if (!res.ok) {
          setError(json?.error || json?.message || `Failed to load registry (HTTP ${res.status})`)
        } else if (json?.registry_app_id == null) {
          setError(`No service registry deployed on ${network}. Switch networks to discover services.`)
        } else if (Array.isArray(json?.services)) {
          setServices(json.services)
        } else {
          setError(json?.error || json?.message || "Failed to load registry")
        }
      } catch (e: any) {
        if (alive) setError(e?.message || "Failed to load registry")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [network])

  const filtered = q.trim()
    ? services.filter(s =>
        s.name.toLowerCase().includes(q.toLowerCase()) ||
        s.service_id.toLowerCase().includes(q.toLowerCase()))
    : services

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl bg-card border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
              <RiStoreLine className="size-5" /> Pick from Service Registry
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              On-chain merchant offerings. Picking one prefills this form.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <RiCloseLine className="size-5" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="relative">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              autoFocus
              placeholder="Search services…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 pt-3">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <RiLoader4Line className="size-5 animate-spin mr-2" /> Loading…
            </div>
          ) : error ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-6 text-center">
              <p className="text-sm font-medium text-foreground">Registry unavailable</p>
              <p className="mt-1 text-xs text-muted-foreground">{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
              No services match "{q}".
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((s) => (
                <li key={s.service_id}>
                  <button
                    onClick={() => onPick(s)}
                    className="group flex w-full items-center gap-3 rounded-lg border border-border bg-background p-3 text-left hover:border-foreground/30 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">{s.name || s.service_id}</p>
                      <p className="text-[11px] font-mono text-muted-foreground truncate">{s.service_id}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground tabular-nums">
                        {microalgosToAlgo(s.price_microalgos).toFixed(2)} ALGO
                      </p>
                      <p className="text-[11px] text-muted-foreground">/ {s.cycle_days}d</p>
                    </div>
                    <RiArrowRightLine className="size-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/** Map registry cycle_days → app billing_cycle enum + fallback. */
export function cycleDaysToBillingCycle(days: number): string {
  if (days <= 7) return "weekly"
  if (days <= 31) return "monthly"
  if (days <= 95) return "quarterly"
  return "yearly"
}
