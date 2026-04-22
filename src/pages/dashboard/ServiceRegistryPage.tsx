import { useEffect, useState } from "react"
import { RiStoreLine, RiExternalLinkLine, RiRefreshLine, RiRobotLine, RiFileCopyLine, RiCheckLine } from "@remixicon/react"
import { toast } from "sonner"
import { microalgosToAlgo } from "@/lib/algorand/constants"

interface ServiceEntry {
  service_id: string
  provider: string
  price_microalgos: number
  cycle_days: number
  name: string
}

interface RegistryResponse {
  registry_app_id: number | null
  services: ServiceEntry[]
  count?: number
  message?: string
  error?: string
}

const NETWORK = (import.meta.env.VITE_ALGORAND_NETWORK as string) || "testnet"
const explorerApp = (id: number) =>
  NETWORK === "mainnet"
    ? `https://allo.info/application/${id}`
    : `https://testnet.explorer.perawallet.app/application/${id}/`
const explorerAddr = (a: string) =>
  NETWORK === "mainnet"
    ? `https://allo.info/address/${a}`
    : `https://testnet.explorer.perawallet.app/address/${a}/`

export default function ServiceRegistryPage() {
  const [data, setData] = useState<RegistryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  const fetchRegistry = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/agent/registry")
      const json: RegistryResponse = await res.json()
      setData(json)
    } catch (err: any) {
      toast.error("Failed to load registry", { description: err?.message })
      setData({ registry_app_id: null, services: [], error: err?.message })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchRegistry() }, [])

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    toast.success(`${label} copied`)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <RiStoreLine className="size-6 text-primary" />
            On-Chain Service Registry
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Subscription services published to the Algorand blockchain. Autonomous payment agents (A2A)
            discover offerings here without ever calling a centralized API.
          </p>
        </div>
        <button
          onClick={fetchRegistry}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50"
        >
          <RiRefreshLine className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Registry contract banner */}
      {data?.registry_app_id ? (
        <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-foreground">Live on Algorand {NETWORK}</span>
          </div>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">Registry App ID:</span>
          <code className="text-xs font-mono text-foreground">{data.registry_app_id}</code>
          <button
            onClick={() => copy(String(data.registry_app_id), "App ID")}
            className="text-muted-foreground hover:text-foreground"
            title="Copy App ID"
          >
            {copied === "App ID" ? <RiCheckLine className="size-3.5 text-green-500" /> : <RiFileCopyLine className="size-3.5" />}
          </button>
          <a
            href={explorerApp(data.registry_app_id)}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View on Explorer <RiExternalLinkLine className="size-3" />
          </a>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-foreground">
          <p className="font-medium text-amber-700 dark:text-amber-400">Registry not deployed</p>
          <p className="mt-1 text-xs text-muted-foreground">{data?.message ?? "Deploy the smart contracts to populate this page."}</p>
        </div>
      )}

      {/* Services */}
      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading registry…
        </div>
      ) : data?.services && data.services.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.services.map((s) => (
            <div key={s.service_id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground truncate">{s.name || s.service_id}</h3>
                  <code className="text-[10px] font-mono text-muted-foreground truncate block">{s.service_id}</code>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 text-primary text-[10px] font-medium px-2 py-0.5">
                  ARC-56
                </span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-foreground">
                  {microalgosToAlgo(s.price_microalgos).toFixed(4)}
                </span>
                <span className="text-xs text-muted-foreground">ALGO / {s.cycle_days}d</span>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Provider</p>
                <div className="flex items-center gap-1.5">
                  <code className="text-[11px] font-mono text-foreground truncate flex-1">
                    {s.provider.slice(0, 10)}…{s.provider.slice(-8)}
                  </code>
                  <a
                    href={explorerAddr(s.provider)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary"
                  >
                    <RiExternalLinkLine className="size-3.5" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <RiRobotLine className="size-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No services registered yet</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            When merchants publish a service to the registry contract, it will appear here for autonomous
            agents (and you) to discover.
          </p>
        </div>
      )}
    </div>
  )
}
