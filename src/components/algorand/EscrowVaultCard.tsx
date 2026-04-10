import { useState, useEffect, useCallback } from "react"
import { Link } from "react-router-dom"
import { useAlgorand } from "@/lib/algorand/context"
import {
  shortenAddress, getLoraTransactionUrl, getLoraApplicationUrl,
  microalgosToAlgo, VAULT_TYPE_LABELS, type VaultType,
} from "@/lib/algorand/constants"
import { releaseEscrowFunds, killEscrowContract, deleteEscrowContract, fundEscrowContract } from "@/lib/algorand/contract"
import {
  RiLockLine, RiLockUnlockLine, RiShieldLine, RiExternalLinkLine,
  RiAlarmWarningLine, RiDeleteBinLine, RiCodeLine, RiTimeLine,
  RiGroupLine, RiCoinLine, RiCheckLine, RiRefreshLine, RiAddLine,
} from "@remixicon/react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"

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

const VAULT_TYPE_ICON: Record<string, typeof RiLockLine> = {
  standard: RiLockLine,
  time_locked: RiTimeLine,
  multi_sig: RiGroupLine,
  dispute: RiShieldLine,
  asa: RiCoinLine,
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

  const isSmartContract = !!vault.app_id
  const vType = (vault.vault_type || "standard") as VaultType

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

  const VTypeIcon = VAULT_TYPE_ICON[vType] || RiShieldLine

  const statusColors: Record<string, string> = {
    locked: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    released: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    killed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    pending: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  }

  const statusIcons: Record<string, typeof RiLockLine> = {
    locked: RiLockLine,
    released: RiLockUnlockLine,
    killed: RiAlarmWarningLine,
    pending: RiShieldLine,
  }

  const StatusIcon = statusIcons[vault.status] || RiShieldLine

  const signTransaction = async (txn: any): Promise<Uint8Array[]> => {
    return await peraWallet.signTransaction([[{ txn }]])
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
        note: `Payment released from ${VAULT_TYPE_LABELS[vType]} contract (App ${vault.app_id})`,
      } as any)
      setReleasedTxnId(txnId)
      toast.success("Funds released!", {
        description: (
          <span>
            {vault.amount} ALGO sent.{" "}
            <a
              href={getLoraTransactionUrl(txnId, network)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
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
        note: `Kill switch activated on ${VAULT_TYPE_LABELS[vType]} contract (App ${vault.app_id})`,
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
          description: "The on-chain contract could not be deleted (wallet mismatch or already settled). Your 0.1 ALGO min-balance remains on-chain.",
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
    <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {vault.subscription?.logo ? (
            <img src={vault.subscription.logo} alt={vault.subscription.name} className="size-10 rounded-lg object-cover" />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <VTypeIcon className="size-5 text-primary" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {vault.subscription?.name || "Subscription Vault"}
            </h3>
            <div className="flex items-center gap-1.5">
              {isSmartContract && onChainBalance !== null ? (
                <p className="text-xs font-medium text-foreground">
                  {microalgosToAlgo(onChainBalance).toFixed(6)} ALGO
                  <span className="ml-1 text-primary/70 font-normal">(on-chain)</span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {vault.amount} {vault.currency}
                </p>
              )}
              {isSmartContract && (
                <button
                  onClick={() => fetchOnChainBalance()}
                  disabled={loadingBalance}
                  className="text-muted-foreground hover:text-primary transition-colors"
                  title="Refresh on-chain balance"
                >
                  <RiRefreshLine className={`size-3 ${loadingBalance ? "animate-spin" : ""}`} />
                </button>
              )}
            </div>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[vault.status]}`}>
          <StatusIcon className="size-3" />
          {vault.status.charAt(0).toUpperCase() + vault.status.slice(1)}
        </span>
      </div>

      {isSmartContract && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-primary">
          <RiCodeLine className="size-3" />
          <span className="font-medium">{VAULT_TYPE_LABELS[vType]} Contract</span>
          <span className="text-muted-foreground">•</span>
          <a
            href={getLoraApplicationUrl(vault.app_id!, network)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 text-primary hover:text-primary/80"
          >
            App #{vault.app_id} <RiExternalLinkLine className="size-2.5" />
          </a>
        </div>
      )}

      {/* Type-specific info */}
      {vType === "time_locked" && vault.unlock_time && (
        <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <RiTimeLine className="size-3" />
          Unlocks: {new Date(vault.unlock_time).toLocaleString()}
        </div>
      )}
      {vType === "multi_sig" && vault.co_signer_address && (
        <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <RiGroupLine className="size-3" />
          Co-signer: {shortenAddress(vault.co_signer_address)}
        </div>
      )}
      {vType === "dispute" && vault.arbitrator_address && (
        <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <RiShieldLine className="size-3" />
          Arbitrator: {shortenAddress(vault.arbitrator_address)}
        </div>
      )}
      {vType === "asa" && vault.asset_id && (
        <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <RiCoinLine className="size-3" />
          ASA ID: {vault.asset_id}
        </div>
      )}

      {/* Lora release banner — shown immediately after release or for already-released vaults */}
      {(vault.status === "released" || releasedTxnId) && activeTxnId && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 dark:border-green-800/40 dark:bg-green-900/20">
          <RiCheckLine className="mt-0.5 size-3.5 shrink-0 text-green-600 dark:text-green-400" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-green-800 dark:text-green-300">
              Funds released on-chain
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <a
                href={getLoraTransactionUrl(activeTxnId, network)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-0.5 font-semibold text-green-700 hover:text-green-900 dark:text-green-400 dark:hover:text-green-200"
              >
                View on Lora <RiExternalLinkLine className="size-3" />
              </a>
              <span className="text-green-600/50 dark:text-green-500/50">|</span>
              <span className="font-mono text-green-600 dark:text-green-500">
                {shortenAddress(activeTxnId, 6)}
              </span>
            </div>
          </div>
        </div>
      )}

      {action && (
        <div className="mt-3 rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
          <p className="text-xs text-primary font-medium animate-pulse">{action}</p>
        </div>
      )}

      {confirmAction && (
        <div className="mt-3 rounded-md bg-destructive/5 border border-destructive/20 px-3 py-3">
          <p className="text-xs text-destructive font-medium mb-2">
            {confirmAction === "kill"
              ? "Are you sure? This will return all funds to your wallet and cannot be undone."
              : "Are you sure? This will delete the contract from the blockchain."}
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmAction === "kill" ? handleKillSwitch : handleDelete}
              className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmAction(null)}
              className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {vault.status === "locked" && isSmartContract && !confirmAction && (
        <div className="mt-4 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={handleRelease}
              disabled={isProcessing || !walletAddress}
              className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isProcessing ? "Processing…" : "Release Payment"}
            </button>
            <button
              onClick={() => setShowFundModal(true)}
              disabled={isProcessing || !walletAddress}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <RiAddLine className="size-3.5" />
              Fund
            </button>
            <button
              onClick={() => setConfirmAction("kill")}
              disabled={isProcessing}
              className="flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              <RiAlarmWarningLine className="size-3.5" />
              Kill
            </button>
          </div>
        </div>
      )}

      {showFundModal && (
        <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <p className="text-xs font-medium text-foreground">Add ALGO to vault on-chain</p>
          <div className="flex gap-2">
            <input
              type="number"
              min="0.001"
              step="0.001"
              placeholder="Amount (ALGO)"
              value={fundAmount}
              onChange={e => setFundAmount(e.target.value)}
              className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={handleFund}
              disabled={!fundAmount || parseFloat(fundAmount) <= 0}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              Send
            </button>
            <button
              onClick={() => { setShowFundModal(false); setFundAmount("") }}
              className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {vault.status === "locked" && !isSmartContract && (
        <div className="mt-3 rounded-md bg-muted/50 border border-border px-3 py-2">
          <p className="text-xs text-muted-foreground">Legacy vault (no on-chain contract)</p>
        </div>
      )}

      {(vault.status === "released" || vault.status === "killed") && isSmartContract && !confirmAction && (
        <div className="mt-3">
          <button
            onClick={() => setConfirmAction("delete")}
            disabled={isProcessing || !walletAddress}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <RiDeleteBinLine className="size-3.5" />
            Delete Contract (reclaim MBR)
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Created {new Date(vault.created_at).toLocaleDateString()}
          {vault.released_at && ` • ${vault.status === "killed" ? "Killed" : "Released"} ${new Date(vault.released_at).toLocaleDateString()}`}
        </span>
        <Link to={`/escrow-vaults/${vault.id}`} className="font-medium text-primary hover:text-primary/80 transition-colors">
          Details →
        </Link>
      </div>
    </div>
  )
}
