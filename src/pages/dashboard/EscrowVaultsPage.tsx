import { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "@/lib/auth-context"
import { useAlgorand } from "@/lib/algorand/context"
import { supabase } from "@/integrations/supabase/client"
import { WalletConnect } from "@/components/algorand/WalletConnect"
import { EscrowVaultCard } from "@/components/algorand/EscrowVaultCard"
import { CreateVaultModal } from "@/components/algorand/CreateVaultModal"
import { VaultHealthBanner } from "@/components/algorand/VaultHealthBanner"
import { VAULT_TYPE_LABELS, getNetworkConfig, type VaultType } from "@/lib/algorand/constants"
import { RiAddLine, RiShieldLine, RiLockLine, RiAlarmWarningLine, RiFilterLine } from "@remixicon/react"
import algosdk from "algosdk"
import { toast } from "sonner"

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
  if ("agent" in state) return "standard"
  if ("co_signer" in state) return "multi_sig"
  if ("arbitrator" in state) return "dispute"
  if ("unlock_time" in state) return "time_locked"
  if ("asa_id" in state) return "asa"
  return "standard"
}

export default function EscrowVaultsPage() {
  const { user } = useAuth()
  const { walletAddress, algodClient, network } = useAlgorand()
  const [vaults, setVaults] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filterType, setFilterType] = useState<VaultType | "all">("all")
  const healedRef = useRef(false)

  const fetchVaults = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    const { data } = await supabase
      .from("escrow_vaults" as any)
      .select("*, subscription:subscriptions(name, logo)")
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
          try {
            const acct = await algodClient.accountInformation(appAddress).do() as any
            balance = Number(acct.amount ?? 0)
          } catch {}

          const algoAmount = Math.max(0, (balance - 100_000) / 1_000_000)
          const statusVal = Number(state["status"] ?? 0)
          const dbStatus = statusVal === 1 ? "released" : statusVal === 2 ? "killed" : "locked"

          await supabase.from("escrow_vaults" as any).insert({
            user_id: user.id,
            algorand_address: walletAddress,
            amount: algoAmount,
            currency: "ALGO",
            status: dbStatus,
            app_id: Number(app.id),
            app_address: appAddress,
            vault_type: vaultType,
            escrow_address: typeof state["recipient"] === "string" ? state["recipient"] : null,
            co_signer_address: vaultType === "multi_sig" && typeof state["co_signer"] === "string" ? state["co_signer"] : null,
            arbitrator_address: vaultType === "dispute" && typeof state["arbitrator"] === "string" ? state["arbitrator"] : null,
            asset_id: vaultType === "asa" && typeof state["asa_id"] === "number" ? state["asa_id"] : null,
            unlock_time: vaultType === "time_locked" && typeof state["unlock_time"] === "number" && state["unlock_time"] > 0
              ? new Date(Number(state["unlock_time"]) * 1000).toISOString()
              : null,
          } as any)
          recovered++
        } catch {}
      }

      if (recovered > 0) {
        toast.success(`Recovered ${recovered} vault${recovered > 1 ? "s" : ""} from chain`, {
          description: "Found on-chain contracts not yet in your vault list — added automatically.",
          duration: 6000,
        })
        await fetchVaults()
      }
    } catch {}
  }, [user, walletAddress, algodClient, network, fetchVaults])

  useEffect(() => {
    if (!user) return
    fetchVaults().then((loaded) => {
      if (!healedRef.current && walletAddress) {
        healedRef.current = true
        autoHealOrphanedVaults(loaded ?? [])
      }
    })
  }, [user, walletAddress, fetchVaults, autoHealOrphanedVaults])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel("escrow_vaults_realtime")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "escrow_vaults", filter: `user_id=eq.${user.id}` }, () => {
        fetchVaults()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, fetchVaults])

  const filteredVaults = filterType === "all" ? vaults : vaults.filter((v) => v.vault_type === filterType)

  const stats = {
    total: vaults.length,
    locked: vaults.filter((v) => v.status === "locked").length,
    killed: vaults.filter((v) => v.status === "killed").length,
    totalLocked: vaults
      .filter((v) => v.status === "locked")
      .reduce((sum, v) => sum + Number(v.amount), 0),
  }

  const vaultTypesInUse = [...new Set(vaults.map((v) => v.vault_type || "standard"))] as VaultType[]

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Escrow Vaults</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lock subscription payments in secure Algorand vaults with kill switch control
        </p>
      </div>

      <div className="mb-6">
        <WalletConnect />
      </div>

      <VaultHealthBanner />

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RiShieldLine className="size-4" />
            <span className="text-xs font-medium">Total Vaults</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RiLockLine className="size-4" />
            <span className="text-xs font-medium">Locked</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{stats.locked}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-destructive">
            <RiAlarmWarningLine className="size-4" />
            <span className="text-xs font-medium">Killed</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{stats.killed}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-primary">
            <RiLockLine className="size-4" />
            <span className="text-xs font-medium">Total Locked</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{stats.totalLocked.toFixed(4)} ALGO</p>
        </div>
      </div>

      {/* Actions & Filter */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Your Vaults</h2>
          {vaultTypesInUse.length > 1 && (
            <div className="flex items-center gap-1 ml-3">
              <RiFilterLine className="size-3.5 text-muted-foreground" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as VaultType | "all")}
                className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
              >
                <option value="all">All Types</option>
                {vaultTypesInUse.map((type) => (
                  <option key={type} value={type}>{VAULT_TYPE_LABELS[type]}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <span title={!walletAddress ? "Connect your Pera or Defly wallet first to create a vault" : undefined}>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={!walletAddress}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <RiAddLine className="size-4" />
          Create Vault
        </button>
        </span>
      </div>

      {/* Vault List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filteredVaults.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center">
          <RiShieldLine className="mx-auto size-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-sm font-medium text-foreground">
            {vaults.length > 0 ? "No vaults match this filter" : "No vaults yet"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {walletAddress
              ? "Create your first escrow vault to lock a subscription payment"
              : "Connect your wallet (Pera, Defly, or Lute) to create escrow vaults"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVaults.map((vault) => (
            <EscrowVaultCard key={vault.id} vault={vault} onUpdate={fetchVaults} />
          ))}
        </div>
      )}

      <CreateVaultModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={fetchVaults}
      />
    </div>
  )
}
