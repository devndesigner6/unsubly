import { useEffect, useState } from "react"
import { RiStoreLine, RiExternalLinkLine, RiRefreshLine, RiRobotLine, RiFileCopyLine, RiCheckLine, RiAddLine, RiCloseLine } from "@remixicon/react"
import { toast } from "sonner"
import { microalgosToAlgo } from "@/lib/algorand/constants"
import { useAlgorand } from "@/lib/algorand/context"
import { registerService } from "@/lib/algorand/contract"
import { Button } from "@/components/Button"
import algosdk from "algosdk"
import { motion } from "motion/react"

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

import type { AlgorandNetwork } from "@/lib/algorand/constants"

const explorerApp = (id: number, network: AlgorandNetwork) =>
  network === "mainnet"
    ? `https://allo.info/application/${id}`
    : `https://testnet.explorer.perawallet.app/application/${id}/`
const explorerAddr = (a: string, network: AlgorandNetwork) =>
  network === "mainnet"
    ? `https://allo.info/address/${a}`
    : `https://testnet.explorer.perawallet.app/address/${a}/`

export default function ServiceRegistryPage() {
  const [data, setData] = useState<RegistryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ service_id: "", name: "", price_algo: "", cycle_days: "30" })
  const { walletAddress, algodClient, peraWallet, network } = useAlgorand()
  const signTransaction = async (txn: algosdk.Transaction): Promise<Uint8Array[]> =>
    peraWallet.signTransaction([[{ txn }]])

  const submitRegistration = async () => {
    if (!walletAddress) return toast.error("Connect your wallet first")
    if (!data?.registry_app_id) return toast.error("Registry not deployed")
    const id = form.service_id.trim()
    const name = form.name.trim()
    const priceAlgo = Number(form.price_algo)
    const cycle = Number(form.cycle_days)
    if (!id || !name) return toast.error("service_id and name are required")
    if (id.length > 64) return toast.error("service_id must be ≤ 64 chars")
    if (name.length > 64) return toast.error("name must be ≤ 64 chars")
    if (!Number.isFinite(priceAlgo) || priceAlgo <= 0) return toast.error("Price must be > 0 ALGO")
    if (!Number.isInteger(cycle) || cycle < 1 || cycle > 3650) return toast.error("Cycle must be 1–3650 days")

    setSubmitting(true)
    try {
      const txid = await registerService(
        algodClient,
        walletAddress,
        data.registry_app_id,
        {
          service_id: id, name,
          price_microalgos: Math.round(priceAlgo * 1_000_000),
          cycle_days: cycle,
        },
        signTransaction,
      )
      toast.success("Service published on-chain", { description: `Txn ${txid.slice(0, 8)}…` })
      setForm({ service_id: "", name: "", price_algo: "", cycle_days: "30" })
      setShowForm(false)
      await fetchRegistry()
    } catch (err: any) {
      toast.error("Registration failed", { description: err?.message || String(err) })
    } finally {
      setSubmitting(false)
    }
  }

  const fetchRegistry = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/agent/registry?network=${network}`)
      const json: RegistryResponse = await res.json()
      setData(json)
    } catch (err: any) {
      toast.error("Failed to load registry", { description: err?.message })
      setData({ registry_app_id: null, services: [], error: err?.message })
    } finally {
      setIsLoading(false)
    }
  }

  // Refetch whenever the user toggles networks so the page reflects the live chain.
  useEffect(() => { fetchRegistry() }, [network]) // eslint-disable-line react-hooks/exhaustive-deps

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    toast.success(`${label} copied`)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-background overflow-hidden flex flex-col">
      <div className="flex-1 flex flex-col p-4 sm:p-6 min-h-0 overflow-y-auto space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between shrink-0">
        <div className="min-w-0 relative overflow-hidden">
          <span className="ghost-text">A2A</span>
          <svg className="absolute -z-10 -top-4 -right-4 opacity-[0.03] text-foreground pointer-events-none" width="160" height="160" viewBox="0 0 48 48" fill="currentColor">
            <circle cx="12" cy="12" r="3" /><circle cx="36" cy="12" r="3" /><circle cx="12" cy="36" r="3" /><circle cx="36" cy="36" r="3" /><circle cx="24" cy="24" r="4" />
            <line x1="12" y1="12" x2="24" y2="24" stroke="currentColor" strokeWidth="1.5" /><line x1="36" y1="12" x2="24" y2="24" stroke="currentColor" strokeWidth="1.5" /><line x1="12" y1="36" x2="24" y2="24" stroke="currentColor" strokeWidth="1.5" /><line x1="36" y1="36" x2="24" y2="24" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <h1 className="font-display text-3xl sm:text-4xl text-foreground tracking-tight">
            Service Registry
          </h1>
          <p className="font-display italic mt-1.5 text-xs text-muted-foreground max-w-2xl">
            Subscription services published to the Algorand blockchain. Autonomous payment agents (A2A)
            discover offerings here without ever calling a centralized API.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={showForm ? "secondary" : "primary"}
            onClick={() => setShowForm((v) => !v)}
            disabled={!data?.registry_app_id}
          >
            {showForm
              ? <><RiCloseLine className="mr-1.5 size-4" />Cancel</>
              : <><RiAddLine className="mr-1.5 size-4" />Publish service</>}
          </Button>
          <button
            onClick={fetchRegistry}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50"
          >
            <RiRefreshLine className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-primary/30 bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Publish a service to the registry</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Your wallet ({walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : "not connected"})
              becomes the on-chain provider. Only you can update this listing later.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-muted-foreground">
              Service ID (unique slug, ≤ 64 chars)
              <input
                value={form.service_id}
                onChange={(e) => setForm({ ...form, service_id: e.target.value })}
                placeholder="e.g. acme-pro-monthly"
                className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Display name (≤ 64 chars)
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Acme Pro"
                className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Price (ALGO per cycle)
              <input
                type="number" step="0.001" min="0.001"
                value={form.price_algo}
                onChange={(e) => setForm({ ...form, price_algo: e.target.value })}
                placeholder="9.99"
                className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Billing cycle (days, 1–3650)
              <input
                type="number" min="1" max="3650" step="1"
                value={form.cycle_days}
                onChange={(e) => setForm({ ...form, cycle_days: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </label>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setShowForm(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={submitRegistration} disabled={submitting || !walletAddress}>
              {submitting ? "Submitting…" : "Sign & publish on-chain"}
            </Button>
          </div>
        </div>
      )}

      {/* Registry contract banner — only show after loading */}
      {!isLoading && data?.registry_app_id ? (
        <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-foreground">Live on Algorand {network}</span>
          </div>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">Registry App ID:</span>
          <code className="text-xs font-mono-pixel text-foreground">{data.registry_app_id}</code>
          <button
            onClick={() => copy(String(data.registry_app_id), "App ID")}
            className="text-muted-foreground hover:text-foreground"
            title="Copy App ID"
          >
            {copied === "App ID" ? <RiCheckLine className="size-3.5 text-green-500" /> : <RiFileCopyLine className="size-3.5" />}
          </button>
          <a
            href={explorerApp(data.registry_app_id, network)}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View on Explorer <RiExternalLinkLine className="size-3" />
          </a>
        </div>
      ) : !isLoading && network === "mainnet" ? (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-foreground">
          <p className="font-medium text-foreground">Service Registry is testnet-only for now</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The registry contract has not yet been deployed on Algorand MainNet. Switch to TestNet
            in Settings to browse and publish services.
          </p>
        </div>
      ) : !isLoading ? (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-foreground">
          <p className="font-medium text-foreground">Registry not deployed</p>
          <p className="mt-1 text-xs text-muted-foreground">{data?.message ?? "Deploy the smart contracts to populate this page."}</p>
        </div>
      ) : null}

      {/* Services */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 animate-pulse">
              <div className="flex items-center justify-between mb-3">
                <div className="h-4 w-32 rounded bg-muted dark:bg-white/[0.08]" />
                <div className="h-5 w-14 rounded-full bg-muted dark:bg-white/[0.08]" />
              </div>
              <div className="h-3 w-20 rounded bg-muted dark:bg-white/[0.08] mb-4" />
              <div className="h-6 w-28 rounded bg-muted dark:bg-white/[0.08] mb-2" />
              <div className="h-3 w-24 rounded bg-muted dark:bg-white/[0.08]" />
            </div>
          ))}
        </div>
      ) : data?.services && data.services.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.services.map((s, i) => (
            <motion.div
              key={s.service_id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
              className="rounded-xl border border-border bg-card p-4 space-y-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground truncate">{s.name || s.service_id}</h3>
                  <code className="text-[10px] font-mono-pixel text-muted-foreground truncate block">{s.service_id}</code>
                </div>
                <span className="shrink-0 rounded-full bg-foreground/10 text-foreground text-[10px] font-medium px-2 py-0.5">
                  ARC-56
                </span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold font-mono-pixel text-foreground">
                  {microalgosToAlgo(s.price_microalgos).toFixed(4)}
                </span>
                <span className="text-xs text-muted-foreground">ALGO / {s.cycle_days}d</span>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Provider</p>
                <div className="flex items-center gap-1.5">
                  <code className="text-[11px] font-mono-pixel text-foreground truncate flex-1">
                    {s.provider.slice(0, 10)}…{s.provider.slice(-8)}
                  </code>
                  <a
                    href={explorerAddr(s.provider, network)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RiExternalLinkLine className="size-3.5" />
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <RiRobotLine className="size-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">No services registered yet</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            When merchants publish a service to the registry contract, it will appear here for autonomous
            agents (and you) to discover.
          </p>
        </div>
      )}
    </div>
    </div>
  )
}
