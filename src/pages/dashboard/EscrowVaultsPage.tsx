import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { useAlgorand } from "@/lib/algorand/context"
import { supabase } from "@/integrations/supabase/client"
import { WalletConnect } from "@/components/algorand/WalletConnect"
import { EscrowVaultCard } from "@/components/algorand/EscrowVaultCard"
import { CreateVaultModal } from "@/components/algorand/CreateVaultModal"
import { VaultHealthBanner } from "@/components/algorand/VaultHealthBanner"
import { VAULT_TYPE_LABELS, type VaultType } from "@/lib/algorand/constants"
import { RiAddLine, RiShieldLine, RiLockLine, RiAlarmWarningLine, RiFilterLine } from "@remixicon/react"

export default function EscrowVaultsPage() {
  const { user } = useAuth()
  const { walletAddress } = useAlgorand()
  const [vaults, setVaults] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filterType, setFilterType] = useState<VaultType | "all">("all")

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
  }, [user])

  useEffect(() => {
    fetchVaults()
  }, [fetchVaults])

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
