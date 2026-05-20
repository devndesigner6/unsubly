import { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "@/lib/auth-context"
import { useAlgorand } from "@/lib/algorand/context"
import { supabase } from "@/integrations/supabase/client"
import { WalletConnect } from "@/components/algorand/WalletConnect"
import { WalletRequired } from "@/components/algorand/WalletRequired"
import { CreateVaultModal } from "@/components/algorand/CreateVaultModal"
import { VAULT_TYPE_LABELS, getNetworkConfig, type VaultType } from "@/lib/algorand/constants"
import { RiArrowLeftLine, RiArrowRightLine, RiExternalLinkLine, RiExchangeLine, RiAddLine } from "@remixicon/react"
import algosdk from "algosdk"
import { toast } from "sonner"
import { useAlgoPrice } from "@/hooks/useAlgoPrice"
import { algoToUsd } from "@/lib/algorand/gora-oracle"
import { Link } from "react-router-dom"
import { motion } from "motion/react"

function decodeGlobalState(raw: any[]): Record<string, string | number> {
  const result: Record<string, string | number> = {}
  for (const item of raw) {
    const key = atob(item.key)
    if (item.value.type === 1) {
      const bytes = Uint8Array.from(atob(item.value.bytes), c => c.charCodeAt(0))
      result[key] = bytes.length === 32 ? String(algosdk.encodeAddress(bytes)) : item.value.bytes
    } else {
      result[key] = Number(item.value.uint)
    }
  }
  return result
}

function vaultTypeFromState(state: Record<string, string | number>): VaultType {
  if ("agent" in state && "cycle_index" in state) return "agent_v2"
  if ("agent" in state) return "agent"
  if ("co_signer" in state) return "multi_sig"
  if ("arbitrator" in state) return "dispute"
  if ("unlock_time" in state) return "time_locked"
  if ("asa_id" in state) return "asa"
  return "standard"
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function daysUntil(dateStr: string | null): string | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return "Due now"
  const days = Math.ceil(diff / 86400000)
  if (days === 1) return "Due tomorrow"
  return `Due in ${days}d`
}

/* ─── Geometric SVG Icons per vault type (reference: radial lines, striped spheres, organic geometry) ─── */
function VaultIcon({ type, size = 48 }: { type: VaultType; size?: number }) {
  const s = size
  const icons: Record<string, React.ReactNode> = {
    // Agent v2 — Radial sunburst (like Diatom Studios — lines radiating from center)
    agent_v2: (
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="4" fill="currentColor" />
        {Array.from({ length: 16 }).map((_, i) => {
          const angle = (i * 22.5) * Math.PI / 180
          const x1 = 24 + Math.cos(angle) * 8
          const y1 = 24 + Math.sin(angle) * 8
          const x2 = 24 + Math.cos(angle) * 19
          const y2 = 24 + Math.sin(angle) * 19
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        })}
      </svg>
    ),
    // Agent — Same radial pattern
    agent: (
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="4" fill="currentColor" />
        {Array.from({ length: 16 }).map((_, i) => {
          const angle = (i * 22.5) * Math.PI / 180
          const x1 = 24 + Math.cos(angle) * 8
          const y1 = 24 + Math.sin(angle) * 8
          const x2 = 24 + Math.cos(angle) * 19
          const y2 = 24 + Math.sin(angle) * 19
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        })}
      </svg>
    ),
    // Standard — Hexagon solid (bold geometric)
    standard: (
      <svg width={s} height={s} viewBox="0 0 48 48" fill="currentColor">
        <path d="M24 4L42 14V34L24 44L6 34V14L24 4Z" />
      </svg>
    ),
    // Time-locked — Concentric rings (like target/Oxyma)
    time_locked: (
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none" stroke="currentColor">
        <circle cx="24" cy="24" r="20" strokeWidth="2" />
        <circle cx="24" cy="24" r="14" strokeWidth="2" />
        <circle cx="24" cy="24" r="8" strokeWidth="2" />
        <circle cx="24" cy="24" r="3" fill="currentColor" stroke="none" />
      </svg>
    ),
    // Multi-sig — Three overlapping circles (Sony Music style)
    multi_sig: (
      <svg width={s} height={s} viewBox="0 0 48 48" fill="currentColor" opacity="0.85">
        <circle cx="17" cy="20" r="9" />
        <circle cx="31" cy="20" r="9" />
        <circle cx="24" cy="30" r="9" />
      </svg>
    ),
    // Dispute — Asterisk/snowflake (like the cross-pattern in reference)
    dispute: (
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <line x1="24" y1="6" x2="24" y2="42" />
        <line x1="6" y1="24" x2="42" y2="24" />
        <line x1="11" y1="11" x2="37" y2="37" />
        <line x1="37" y1="11" x2="11" y2="37" />
      </svg>
    ),
    // ASA Token — Interlocking rings (chain link)
    asa: (
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="18" cy="24" r="10" />
        <circle cx="30" cy="24" r="10" />
      </svg>
    ),
    // Cancellation Insurance — Shield outline with dot
    cancellation_insurance: (
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
        <path d="M24 4L8 12V22C8 33 15 42.5 24 46C33 42.5 40 33 40 22V12L24 4Z" />
        <circle cx="24" cy="24" r="4" fill="currentColor" stroke="none" />
      </svg>
    ),
  }
  return <>{icons[type] || icons.standard}</>
}

export default function EscrowVaultsPage() {
  const { user } = useAuth()
  const { walletAddress, algodClient, network } = useAlgorand()
  const [vaults, setVaults] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filterType, setFilterType] = useState<"all" | "locked" | "released" | "killed">("all")
  const [showGrid, setShowGrid] = useState(false)
  const healedRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { price: algoUsdPrice } = useAlgoPrice(network as "testnet" | "mainnet")

  const fetchVaults = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    const { data } = await supabase
      .from("escrow_vaults" as any)
      .select("*, subscription:subscriptions(name, logo, next_billing_date)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    if (data) setVaults(data as any[])
    setIsLoading(false)
    return data as any[] | null
  }, [user])

  const autoHealOrphanedVaults = useCallback(async (knownVaults: any[]) => {
    if (!user || !walletAddress) return
    try {
      const cfg = getNetworkConfig(network)
      const idxUrl = cfg.indexerServer
      const resp = await fetch(`${idxUrl}/v2/accounts/${walletAddress}/created-apps?limit=50`)
      if (!resp.ok) return
      const { apps } = await resp.json()
      if (!apps || apps.length === 0) return
      const knownAppIds = new Set(knownVaults.map((v: any) => Number(v.app_id)).filter(Boolean))
      const orphans = (apps as any[]).filter((a: any) => !knownAppIds.has(Number(a.id)))
      if (orphans.length === 0) return
      let recovered = 0
      for (const app of orphans) {
        try {
          const appInfo = await algodClient.getApplicationByID(Number(app.id)).do() as any
          const rawState = appInfo.params?.globalState ?? appInfo.params?.["global-state"] ?? []
          if (!Array.isArray(rawState) || rawState.length === 0) continue
          const state = decodeGlobalState(rawState)
          if (!("creator" in state) || !("recipient" in state)) continue
          const vaultType = vaultTypeFromState(state)
          const appAddress = String(algosdk.getApplicationAddress(Number(app.id)))
          let balance = 0
          try { const acct = await algodClient.accountInformation(appAddress).do() as any; balance = Number(acct.amount ?? 0) } catch {}
          const algoAmount = Math.max(0, (balance - 100_000) / 1_000_000)
          const statusVal = Number(state["status"] ?? 0)
          const dbStatus = statusVal === 1 ? "released" : statusVal === 2 ? "killed" : "locked"
          await supabase.from("escrow_vaults" as any).insert({
            user_id: user.id, algorand_address: walletAddress, amount: algoAmount, currency: "ALGO",
            status: dbStatus, app_id: Number(app.id), app_address: appAddress, vault_type: vaultType,
            escrow_address: typeof state["recipient"] === "string" ? state["recipient"] : null,
          } as any)
          recovered++
        } catch {}
      }
      if (recovered > 0) { toast.success(`Recovered ${recovered} vault${recovered > 1 ? "s" : ""} from chain`); await fetchVaults() }
    } catch {}
  }, [user, walletAddress, algodClient, network, fetchVaults])

  useEffect(() => {
    if (!user) return
    fetchVaults().then((loaded) => {
      if (!healedRef.current && walletAddress) { healedRef.current = true; autoHealOrphanedVaults(loaded ?? []) }
    })
  }, [user, walletAddress, fetchVaults, autoHealOrphanedVaults])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel("escrow_vaults_realtime")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "escrow_vaults", filter: `user_id=eq.${user.id}` }, () => fetchVaults())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, fetchVaults])

  const filteredVaults = filterType === "all" ? vaults : vaults.filter((v) => v.status === filterType)
  const stats = {
    total: vaults.length,
    locked: vaults.filter((v) => v.status === "locked").length,
    released: vaults.filter((v) => v.status === "released").length,
    killed: vaults.filter((v) => v.status === "killed").length,
    totalLocked: vaults.filter((v) => v.status === "locked").reduce((sum, v) => sum + Number(v.amount), 0),
  }

  const scrollLeft = () => scrollRef.current?.scrollBy({ left: -240, behavior: "smooth" })
  const scrollRight = () => scrollRef.current?.scrollBy({ left: 240, behavior: "smooth" })

  const tinymanUrl = network === "mainnet" ? "https://app.tinyman.org/#/swap?asset_in=0" : "https://testnet.tinyman.org/#/swap?asset_in=0"

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-background overflow-hidden flex flex-col">
      <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8 py-4 min-h-0">

        <WalletRequired feature="Escrow Vaults">
          {/* Wallet bar — compact */}
          <div className="shrink-0 mb-4">
            <WalletConnect />
          </div>

          {/* Header row: Heading left, pills + SHOW MORE right */}
          <div className="flex items-start justify-between shrink-0 mb-4">
            <div className="relative overflow-hidden">
              <span className="ghost-text">VAULT</span>
              <svg className="absolute -z-10 -top-4 -right-4 opacity-[0.03] text-foreground pointer-events-none" width="160" height="160" viewBox="0 0 48 48" fill="currentColor">
                <path d="M24 4L42 14V34L24 44L6 34V14L24 4Z" />
              </svg>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] text-foreground tracking-tight leading-none">
                Escrow Vaults
              </h1>
              <p className="font-display italic text-xs text-muted-foreground mt-1.5">
                {stats.total} vault{stats.total !== 1 ? "s" : ""} · {stats.locked} locked · {stats.totalLocked.toFixed(4)} ALGO
                {algoUsdPrice && stats.totalLocked > 0 && ` ≈ ${algoToUsd(stats.totalLocked, algoUsdPrice)}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Filter pills */}
              <div className="flex items-center gap-1">
                {(["all", "locked", "released", "killed"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterType(f)}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all duration-200 ${
                      filterType === f
                        ? "bg-foreground text-background"
                        : "border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                    }`}
                  >
                    {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              {/* SHOW MORE toggle */}
              {vaults.length > 0 && (
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <span>{showGrid ? "CAROUSEL" : "SHOW MORE"}</span>
                  <RiArrowRightLine className="size-3 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}
            </div>
          </div>

          {/* Cards area */}
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredVaults.length === 0 && vaults.length === 0 ? (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center flex flex-col items-center">
                <div className="text-foreground/20">
                  <VaultIcon type="standard" size={56} />
                </div>
                <p className="text-sm font-medium text-foreground mt-4">No vaults yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {walletAddress ? "Create your first escrow vault to get started." : "Connect your wallet to begin."}
                </p>
                {walletAddress && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-4 py-2 text-xs font-medium hover:bg-foreground/90 transition-colors"
                  >
                    <RiAddLine className="size-3.5" />
                    Create Vault
                  </button>
                )}
              </div>
            </div>
          ) : showGrid ? (
            /* Grid view — all vaults */
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {/* + Create card FIRST */}
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
                  <CreateCard onClick={() => setShowCreateModal(true)} disabled={!walletAddress} />
                </motion.div>
                {filteredVaults.map((vault, i) => (
                  <motion.div key={vault.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: i * 0.04 }}>
                    <VaultCard vault={vault} algoUsdPrice={algoUsdPrice} />
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            /* Carousel view — horizontal scroll */
            <div className="flex-1 flex flex-col min-h-0">
              <div
                ref={scrollRef}
                className="flex-1 flex gap-3 overflow-x-auto items-stretch scrollbar-hide"
                style={{ scrollSnapType: "x mandatory" }}
              >
                {/* + Create card FIRST in carousel */}
                <CreateCard onClick={() => setShowCreateModal(true)} disabled={!walletAddress} carousel />
                {filteredVaults.map((vault) => (
                  <VaultCard key={vault.id} vault={vault} algoUsdPrice={algoUsdPrice} carousel />
                ))}
              </div>

              {/* Bottom row: Tinyman left, arrows right */}
              <div className="flex items-center justify-between mt-3 shrink-0">
                {walletAddress ? (
                  <div className="flex items-center gap-2">
                    <RiExchangeLine className="size-3.5 text-muted-foreground" />
                    <div>
                      <p className="text-[11px] text-foreground font-medium">Swap to ALGO</p>
                      <p className="text-[9px] text-muted-foreground">Fund vaults via Tinyman DEX</p>
                    </div>
                    <a
                      href={tinymanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Open <RiExternalLinkLine className="size-2.5" />
                    </a>
                  </div>
                ) : <div />}

                {/* Navigation arrows */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={scrollLeft}
                    className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all duration-200"
                    aria-label="Scroll left"
                  >
                    <RiArrowLeftLine className="size-3.5" />
                  </button>
                  <button
                    onClick={scrollRight}
                    className="flex size-8 items-center justify-center rounded-full bg-gold text-background hover:bg-gold-hover transition-all duration-200"
                    aria-label="Scroll right"
                  >
                    <RiArrowRightLine className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tinyman in grid view too */}
          {showGrid && walletAddress && (
            <div className="mt-3 shrink-0 flex items-center gap-2">
              <RiExchangeLine className="size-3.5 text-muted-foreground" />
              <p className="text-[11px] text-foreground font-medium">Swap to ALGO</p>
              <p className="text-[9px] text-muted-foreground">· Tinyman DEX</p>
              <a
                href={tinymanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Open <RiExternalLinkLine className="size-2.5" />
              </a>
            </div>
          )}

          <CreateVaultModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onCreated={async () => { const loaded = await fetchVaults(); if (walletAddress) await autoHealOrphanedVaults(loaded ?? []) }}
          />
        </WalletRequired>
      </div>
    </div>
  )
}

/* ─── Vault Card Component ─── */
function VaultCard({ vault, algoUsdPrice, carousel }: { vault: any; algoUsdPrice: number | null; carousel?: boolean }) {
  const sub = vault.subscription
  const subName = sub?.name || "Unlinked"
  const due = daysUntil(sub?.next_billing_date)
  const isLocked = vault.status === "locked"
  const isKilled = vault.status === "killed"

  return (
    <Link
      to={`/escrow-vaults/${vault.id}`}
      className={`
        ${carousel ? "snap-start shrink-0 w-[180px] sm:w-[200px]" : "w-full"}
        rounded-2xl border border-border bg-card p-4 flex flex-col justify-between
        ${isLocked ? "hover:shadow-[0_0_20px_hsl(var(--accent-gold)/0.15)]" : isKilled ? "hover:shadow-[0_8px_24px_-8px_rgba(239,68,68,0.15)]" : "hover:shadow-lg"}
        hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden
      `}
      style={{ minHeight: carousel ? "300px" : "260px" }}
    >
      {/* Top: status indicator + time ago */}
      <div className="flex items-center justify-between">
        <span className={`size-2 rounded-full ${isLocked ? "bg-foreground" : isKilled ? "bg-red-500" : "bg-muted-foreground/30"}`} />
        <span className="text-[9px] text-muted-foreground font-mono-pixel">{timeAgo(vault.created_at)}</span>
      </div>

      {/* Center: geometric icon based on vault type */}
      <div className="flex-1 flex items-center justify-center py-5">
        <div className="text-foreground/70 group-hover:text-foreground group-hover:scale-105 transition-all duration-300">
          <VaultIcon type={vault.vault_type as VaultType} size={44} />
        </div>
      </div>

      {/* Bottom: vault info */}
      <div>
        <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
          {VAULT_TYPE_LABELS[vault.vault_type as VaultType] || "Standard"}
        </p>
        <p className="text-sm font-bold text-foreground mt-0.5 truncate">{subName}</p>
        <p className="text-base font-bold font-mono-pixel text-foreground mt-1">
          {Number(vault.amount).toFixed(4)} <span className="text-[10px] font-normal text-muted-foreground">ALGO</span>
        </p>
        {algoUsdPrice && Number(vault.amount) > 0 && (
          <p className="text-[10px] text-muted-foreground">≈ {algoToUsd(Number(vault.amount), algoUsdPrice)}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium font-mono-pixel ${
            isLocked ? "bg-gold/10 text-gold border border-gold/20" : isKilled ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-muted text-muted-foreground"
          }`}>
            {vault.status}
          </span>
          {due && isLocked && <span className="text-[9px] text-accent-gold font-mono-pixel">{due}</span>}
        </div>
      </div>

      {/* Hover pill */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <span className="inline-flex items-center gap-0.5 rounded-full bg-background/90 backdrop-blur-sm border border-border px-2 py-0.5 text-[9px] font-medium text-foreground shadow-sm">
          View <RiArrowRightLine className="size-2.5" />
        </span>
      </div>
    </Link>
  )
}

/* ─── Create Vault "+" Card — FIRST in carousel ─── */
function CreateCard({ onClick, disabled, carousel }: { onClick: () => void; disabled: boolean; carousel?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${carousel ? "snap-start shrink-0 w-[180px] sm:w-[200px]" : "w-full"}
        rounded-2xl border-2 border-dashed border-foreground/20 bg-card/40 p-4
        flex flex-col items-center justify-center gap-3
        hover:border-foreground/50 hover:bg-card transition-all duration-300
        disabled:opacity-40 disabled:cursor-not-allowed group
      `}
      style={{ minHeight: carousel ? "300px" : "260px" }}
    >
      {/* Blob plus — organic geometric shape */}
      <div className="relative group-hover:scale-110 transition-transform duration-300">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="text-foreground">
          {/* Organic blob background */}
          <path
            d="M28 6C35 6 41 9 45 14C49 19 52 24 52 28C52 34 49 39 45 43C41 47 35 50 28 50C21 50 15 47 11 43C7 39 4 34 4 28C4 22 7 17 11 13C15 9 21 6 28 6Z"
            fill="currentColor"
            opacity="0.06"
            className="group-hover:opacity-12 transition-opacity duration-300"
          />
          {/* Bold plus */}
          <rect x="25" y="16" width="6" height="24" rx="3" fill="currentColor" opacity="0.6" className="group-hover:opacity-100 transition-opacity" />
          <rect x="16" y="25" width="24" height="6" rx="3" fill="currentColor" opacity="0.6" className="group-hover:opacity-100 transition-opacity" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-xs font-medium text-foreground">Create Vault</p>
        <p className="text-[9px] text-muted-foreground mt-0.5">Lock ALGO in escrow</p>
      </div>
    </button>
  )
}
