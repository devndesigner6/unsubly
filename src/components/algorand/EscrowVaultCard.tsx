import { useState, useEffect, useCallback } from "react"
import { Link } from "react-router-dom"
import { useAlgorand } from "@/lib/algorand/context"
import {
  shortenAddress, getLoraTransactionUrl, getLoraApplicationUrl, getLoraAddressUrl,
  microalgosToAlgo, VAULT_TYPE_LABELS, type VaultType,
} from "@/lib/algorand/constants"
import { releaseEscrowFunds, killEscrowContract, deleteEscrowContract, fundEscrowContract } from "@/lib/algorand/contract"
import {
  RiLockLine, RiLockUnlockLine, RiShieldLine, RiExternalLinkLine,
  RiAlarmWarningLine, RiDeleteBinLine, RiTimeLine,
  RiGroupLine, RiCoinLine, RiCheckLine, RiRefreshLine, RiAddLine,
  RiArrowDownSLine, RiArrowUpSLine,
} from "@remixicon/react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import { VaultTypeIllustration } from "./VaultTypeIllustration"

interface EscrowVault {
  id: string
  subscription_id: string | null
  algorand_address: string
  amount: number
  currency: string
  status: string
  txn_id: string | null
  escrow_address: string | null
  kill_switch_active: boolean
  created_at: string
  released_at: string | null
  app_id?: number | null
  app_address?: string | null
  vault_type?: string
  unlock_time?: string | null
  co_signer_address?: string | null
  arbitrator_address?: string | null
  asset_id?: number | null
  subscription?: { name: string; logo: string | null } | null
}

interface EscrowVaultCardProps {
  vault: EscrowVault
  onUpdate: () => void
}

export function EscrowVaultCard({ vault, onUpdate }: EscrowVaultCardProps) {
  const { user } = useAuth()
  const { walletAddress, algodClient, peraWallet, network } = useAlgorand()
  const [isProcessing, setIsProcessing] = useState(false)
  const [action, setAction] = useState("")
  const [confirmAction, setConfirmAction] = useState<"kill" | "delete" | null>(null)
  const [releasedTxnId, setReleasedTxnId] = useState<string | null>(null)
  const [onChainBalance, setOnChainBalance] = useState<number | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [showFundModal, setShowFundModal] = useState(false)
  const [fundAmount, setFundAmount] = useState("")
  const [expanded, setExpanded] = useState(false)

  const isSmartContract = !!vault.app_id
  const vType = (vault.vault_type || "standard") as VaultType
  const typeLabel = VAULT_TYPE_LABELS[vType]

  const fetchOnChainBalance = useCallback(async () => {
    if (!vault.app_address || !isSmartContract) return
    setLoadingBalance(true)
    try {
      const info = await algodClient.accountInformation(vault.app_address).do() as any
      const µALGO = Number(info.amount ?? info["amount"] ?? 0)
      setOnChainBalance(µALGO)
    } catch {
      setOnChainBalance(null)
    } finally {
      setLoadingBalance(false)
    }
  }, [algodClient, vault.app_address, isSmartContract])

  useEffect(() => {
    fetchOnChainBalance()
  }, [fetchOnChainBalance])

  const signTransaction = async (txn: any): Promise<Uint8Array[]> => {
    return await peraWallet.signTransaction([[{ txn }]])
  }

  const handleFund = async () => {
    const algoAmt = parseFloat(fundAmount)
    if (!walletAddress || !vault.app_address || isNaN(algoAmt) || algoAmt <= 0) return
    setShowFundModal(false)
    setIsProcessing(true)
    setAction("Funding vault on-chain… (sign in your wallet)")
    try {
      const microAlgos = Math.floor(algoAmt * 1_000_000)
      const txnId = await fundEscrowContract(algodClient, walletAddress, vault.app_address, microAlgos, signTransaction)
      await supabase.from("escrow_vaults" as any)
        .update({ status: "locked", txn_id: txnId } as any)
        .eq("id", vault.id)
      await fetchOnChainBalance()
      setFundAmount("")
      toast.success(`${algoAmt} ALGO funded on-chain`, {
        description: (
          <a href={getLoraTransactionUrl(txnId, network)} target="_blank" rel="noopener noreferrer" className="underline font-medium">
            View on Lora ↗
          </a>
        ) as any,
        duration: 8000,
      })
      onUpdate()
    } catch (err: any) {
      toast.error("Fund failed", { description: err?.message || "Transaction failed" })
    } finally {
      setIsProcessing(false)
      setAction("")
    }
  }

  const handleRelease = async () => {
    if (!walletAddress || !user || !vault.app_id) return
    setIsProcessing(true)
    setAction("Releasing funds on-chain… (sign in your wallet)")
    try {
      const txnId = await releaseEscrowFunds(algodClient, walletAddress, vault.app_id, signTransaction)
      await supabase.from("escrow_vaults" as any)
        .update({ status: "released", txn_id: txnId, released_at: new Date().toISOString() } as any)
        .eq("id", vault.id)
      await supabase.from("onchain_payments" as any).insert({
        user_id: user.id, subscription_id: vault.subscription_id, algorand_txn_id: txnId,
        amount: vault.amount, sender_address: vault.app_address || walletAddress,
        recipient_address: vault.escrow_address || walletAddress,
        note: `Payment released from ${typeLabel} contract (App ${vault.app_id})`,
      } as any)
      setReleasedTxnId(txnId)
      toast.success("Funds released!", {
        description: (
          <span>
            {vault.amount} ALGO sent.{" "}
            <a href={getLoraTransactionUrl(txnId, network)} target="_blank" rel="noopener noreferrer" className="underline font-medium">
              View on Lora ↗
            </a>
          </span>
        ) as any,
        duration: 8000,
      })
      onUpdate()
    } catch (err: any) {
      toast.error("Release failed", { description: err?.message || "Transaction failed" })
    } finally {
      setIsProcessing(false)
      setAction("")
    }
  }

  const handleKillSwitch = async () => {
    if (!walletAddress || !user || !vault.app_id) return
    setConfirmAction(null)
    setIsProcessing(true)
    setAction("Activating kill switch on-chain…")
    try {
      const txnId = await killEscrowContract(algodClient, walletAddress, vault.app_id, signTransaction)
      await supabase.from("escrow_vaults" as any)
        .update({ status: "killed", kill_switch_active: true, txn_id: txnId, released_at: new Date().toISOString() } as any)
        .eq("id", vault.id)
      await supabase.from("onchain_payments" as any).insert({
        user_id: user.id, subscription_id: vault.subscription_id, algorand_txn_id: txnId,
        amount: 0, sender_address: vault.app_address || walletAddress, recipient_address: walletAddress,
        note: `Kill switch activated on ${typeLabel} contract (App ${vault.app_id})`,
      } as any)
      toast.success("Kill switch activated", { description: "Funds returned to your wallet" })
      onUpdate()
    } catch (err: any) {
      toast.error("Kill switch failed", { description: err?.message || "Transaction failed" })
    } finally {
      setIsProcessing(false)
      setAction("")
    }
  }

  const handleDelete = async () => {
    if (!walletAddress || !vault.app_id) return
    setConfirmAction(null)
    setIsProcessing(true)
    setAction("Deleting contract…")
    try {
      await deleteEscrowContract(algodClient, walletAddress, vault.app_id, signTransaction)
      await supabase.from("escrow_vaults" as any).delete().eq("id", vault.id)
      toast.success("Contract deleted", { description: "MBR reclaimed to your wallet" })
      onUpdate()
    } catch (err: any) {
      const msg: string = err?.message || ""
      const isAssertFail = msg.includes("assert") || msg.includes("logic eval") || msg.includes("opcodes")
      const isUserRejected = msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("cancel")
      if (isAssertFail) {
        await supabase.from("escrow_vaults" as any).delete().eq("id", vault.id)
        toast.warning("Removed from your vault list", {
          description: "The on-chain contract could not be deleted (wallet mismatch or already settled).",
          duration: 8000,
        })
        onUpdate()
      } else if (isUserRejected) {
        toast.info("Cancelled", { description: "Delete transaction was not signed." })
      } else {
        toast.error("Delete failed", { description: msg || "Transaction failed" })
      }
    } finally {
      setIsProcessing(false)
      setAction("")
    }
  }

  const activeTxnId = releasedTxnId || (vault.status !== "locked" ? vault.txn_id : null)

  return (
    <div className="rounded-3xl bg-card shadow-[0_8px_30px_-8px_rgba(0,0,0,0.12)] ring-1 ring-black/5 overflow-hidden flex flex-col transition-shadow hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.18)]">
      {/* Hero illustration */}
      <div className="relative p-3">
        <VaultTypeIllustration type={vType} status={vault.status} className="h-44 w-full" />
        {/* Floating CTA pill on hero (like reference "Directions" button) */}
        <div className="absolute bottom-5 right-5">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            aria-controls={`vault-details-${vault.id}`}
            className="rounded-full bg-black/55 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md ring-1 ring-white/15 transition-colors hover:bg-black/70"
          >
            {expanded ? "Collapse" : "Details"}
          </button>
        </div>
        {/* Type badge bottom-left of hero */}
        <div className="absolute bottom-5 left-5">
          <div className="text-white drop-shadow">
            <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
              {typeLabel}
            </p>
            <p className="text-base font-bold leading-tight">
              {vault.subscription?.name || "Subscription Vault"}
            </p>
          </div>
        </div>
      </div>

      {/* Compact body */}
      <div className="px-5 pb-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              {isSmartContract ? "On-chain balance" : "Amount"}
            </p>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="text-xl font-bold text-foreground tabular-nums">
                {isSmartContract && onChainBalance !== null
                  ? microalgosToAlgo(onChainBalance).toFixed(4)
                  : Number(vault.amount).toFixed(4)}
              </span>
              <span className="text-xs font-medium text-muted-foreground">{vault.currency}</span>
              {isSmartContract && (
                <button
                  onClick={() => fetchOnChainBalance()}
                  disabled={loadingBalance}
                  className="ml-1 text-muted-foreground hover:text-primary"
                  title="Refresh on-chain balance"
                >
                  <RiRefreshLine className={`size-3.5 ${loadingBalance ? "animate-spin" : ""}`} />
                </button>
              )}
            </div>
          </div>

          {/* Quick stats column */}
          <div className="text-right text-xs text-muted-foreground">
            <p>Created</p>
            <p className="mt-0.5 font-medium text-foreground">
              {new Date(vault.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </p>
          </div>
        </div>

        {/* Inline action row (locked vaults) */}
        {vault.status === "locked" && isSmartContract && !confirmAction && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleRelease}
              disabled={isProcessing || !walletAddress}
              className="flex-1 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
            >
              {isProcessing ? "Processing…" : "Release Payment"}
            </button>
            <button
              onClick={() => setShowFundModal(true)}
              disabled={isProcessing || !walletAddress}
              className="flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              <RiAddLine className="size-3.5" />
              Fund
            </button>
            <button
              onClick={() => setConfirmAction("kill")}
              disabled={isProcessing}
              className="flex items-center gap-1 rounded-lg bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              <RiAlarmWarningLine className="size-3.5" />
              Kill
            </button>
          </div>
        )}

        {/* Status banners */}
        {(vault.status === "released" || releasedTxnId) && activeTxnId && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs dark:border-emerald-900/40 dark:bg-emerald-900/20">
            <RiCheckLine className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <a href={getLoraTransactionUrl(activeTxnId, network)} target="_blank" rel="noopener noreferrer"
              className="font-semibold text-emerald-700 dark:text-emerald-300 hover:underline">
              View release on Lora ↗
            </a>
          </div>
        )}

        {action && (
          <div className="mt-3 rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
            <p className="text-xs text-primary font-medium animate-pulse">{action}</p>
          </div>
        )}

        {confirmAction && (
          <div className="mt-3 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-3">
            <p className="text-xs font-medium text-destructive mb-2">
              {confirmAction === "kill"
                ? "Are you sure? This returns all funds to your wallet and cannot be undone."
                : "Are you sure? This deletes the contract from the blockchain."}
            </p>
            <div className="flex gap-2">
              <button onClick={confirmAction === "kill" ? handleKillSwitch : handleDelete}
                className="rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground">
                Confirm
              </button>
              <button onClick={() => setConfirmAction(null)}
                className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-foreground">
                Cancel
              </button>
            </div>
          </div>
        )}

        {showFundModal && (
          <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Add ALGO to vault on-chain</p>
            <div className="flex gap-2">
              <input
                type="number" min="0.001" step="0.001" placeholder="Amount (ALGO)"
                value={fundAmount} onChange={e => setFundAmount(e.target.value)}
                className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
              />
              <button onClick={handleFund} disabled={!fundAmount || parseFloat(fundAmount) <= 0}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
                Send
              </button>
              <button onClick={() => { setShowFundModal(false); setFundAmount("") }}
                className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-foreground">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* === Inline expanded panel — pushes neighbors down via grid auto-rows === */}
        {expanded && (
          <div id={`vault-details-${vault.id}`} role="region" aria-label="Vault details" className="mt-5 border-t border-border pt-4 space-y-3">
            <div className="grid grid-cols-3 gap-3 text-xs">
              <Stat label="Network" value={network === "mainnet" ? "MainNet" : "TestNet"} />
              <Stat label="Currency" value={vault.currency} />
              <Stat label="Status" value={vault.status} capitalize />
            </div>

            {isSmartContract && (
              <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">App ID</span>
                  <a href={getLoraApplicationUrl(vault.app_id!, network)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono font-medium text-primary hover:underline">
                    #{vault.app_id} <RiExternalLinkLine className="size-3" />
                  </a>
                </div>
                {vault.app_address && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">App address</span>
                    <a href={getLoraAddressUrl(vault.app_address, network)} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono font-medium text-foreground hover:text-primary">
                      {shortenAddress(vault.app_address, 6)} <RiExternalLinkLine className="size-3" />
                    </a>
                  </div>
                )}
                {vault.escrow_address && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Recipient</span>
                    <span className="font-mono font-medium text-foreground">
                      {shortenAddress(vault.escrow_address, 6)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Type-specific real-data row */}
            {vType === "time_locked" && vault.unlock_time && (
              <DetailRow icon={RiTimeLine} label="Unlocks" value={new Date(vault.unlock_time).toLocaleString()} />
            )}
            {vType === "multi_sig" && vault.co_signer_address && (
              <DetailRow icon={RiGroupLine} label="Co-signer" value={shortenAddress(vault.co_signer_address)} />
            )}
            {vType === "dispute" && vault.arbitrator_address && (
              <DetailRow icon={RiShieldLine} label="Arbitrator" value={shortenAddress(vault.arbitrator_address)} />
            )}
            {vType === "asa" && vault.asset_id && (
              <DetailRow icon={RiCoinLine} label="ASA ID" value={String(vault.asset_id)} />
            )}
            {vType === "agent" && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs dark:border-emerald-900/40 dark:bg-emerald-900/20">
                <RiShieldLine className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-700 dark:text-emerald-300">
                  Autonomous agent will release this vault automatically on the billing date.
                </span>
              </div>
            )}

            {vault.released_at && (
              <p className="text-xs text-muted-foreground">
                {vault.status === "killed" ? "Killed" : "Released"} on {new Date(vault.released_at).toLocaleString()}
              </p>
            )}

            {(vault.status === "released" || vault.status === "killed") && isSmartContract && !confirmAction && (
              <button
                onClick={() => setConfirmAction("delete")}
                disabled={isProcessing || !walletAddress}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <RiDeleteBinLine className="size-3.5" />
                Delete contract (reclaim MBR)
              </button>
            )}

            {vault.status === "locked" && !isSmartContract && (
              <div className="rounded-md bg-muted/50 border border-border px-3 py-2">
                <p className="text-xs text-muted-foreground">Legacy vault (no on-chain contract)</p>
              </div>
            )}

            <Link to={`/escrow-vaults/${vault.id}`}
              className="block text-center text-xs font-medium text-primary hover:underline">
              Open full details →
            </Link>
          </div>
        )}

        {/* Expand chevron at bottom always */}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls={`vault-details-${vault.id}`}
          aria-label={expanded ? "Collapse vault details" : "Expand vault details"}
          className="mt-3 flex w-full items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <RiArrowUpSLine className="size-5" /> : <RiArrowDownSLine className="size-5" />}
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/40 px-2.5 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-xs font-semibold text-foreground ${capitalize ? "capitalize" : ""}`}>{value}</p>
    </div>
  )
}

function DetailRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="size-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}
