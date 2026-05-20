import { useState, useEffect, useCallback } from "react"
import { Link } from "react-router-dom"
import { useAlgorand } from "@/lib/algorand/context"
import {
  shortenAddress, getLoraTransactionUrl, getLoraApplicationUrl, getLoraAddressUrl,
  microalgosToAlgo, VAULT_TYPE_LABELS, type VaultType,
} from "@/lib/algorand/constants"
import { releaseEscrowFunds, releaseAgentVaultV2, killEscrowContract, deleteEscrowContract, fundEscrowContract } from "@/lib/algorand/contract"
import {
  RiLockLine, RiLockUnlockLine, RiShieldLine, RiExternalLinkLine,
  RiAlarmWarningLine, RiDeleteBinLine, RiTimeLine,
  RiGroupLine, RiCoinLine, RiRefreshLine, RiAddLine,
  RiArrowDownSLine, RiArrowUpSLine, RiBookmarkLine, RiBookmarkFill,
  RiRobot2Line,
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
  subscription?: { name: string; logo: string | null; next_billing_date?: string | null } | null
}

interface EscrowVaultCardProps {
  vault: EscrowVault
  onUpdate: () => void
}

const VAULT_TYPE_ICON: Record<string, typeof RiLockLine> = {
  standard:    RiLockLine,
  agent:       RiRobot2Line,
  agent_v2:    RiRobot2Line,
  time_locked: RiTimeLine,
  multi_sig:   RiGroupLine,
  dispute:     RiShieldLine,
  asa:         RiCoinLine,
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return "just now"
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

function timeUntilRelease(nextBillingDate: string | null | undefined): string | null {
  if (!nextBillingDate) return null
  const diff = new Date(nextBillingDate).getTime() - Date.now()
  if (diff <= 0) return "Due today"
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  if (days > 0) return `Releases in ${days}d`
  if (hours > 0) return `Releases in ${hours}h`
  return "Releases soon"
}

function timeLockProgress(createdAt: string, unlockTime: string): number {
  const start = new Date(createdAt).getTime()
  const end = new Date(unlockTime).getTime()
  const now = Date.now()
  if (now >= end) return 100
  if (now <= start) return 0
  return Math.round(((now - start) / (end - start)) * 100)
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
  const typeLabel = VAULT_TYPE_LABELS[vType] ?? "Vault"
  const TypeIcon = VAULT_TYPE_ICON[vType] || RiLockLine

  const fetchOnChainBalance = useCallback(async () => {
    if (!vault.app_address || !isSmartContract) return
    setLoadingBalance(true)
    try {
      const info = await algodClient.accountInformation(vault.app_address).do() as any
      setOnChainBalance(Number(info.amount ?? info["amount"] ?? 0))
    } catch {
      setOnChainBalance(null)
    } finally {
      setLoadingBalance(false)
    }
  }, [algodClient, vault.app_address, isSmartContract])

  useEffect(() => { fetchOnChainBalance() }, [fetchOnChainBalance])

  const signTransaction = async (txn: algosdk.Transaction | algosdk.Transaction[]): Promise<Uint8Array[]> => {
    if (Array.isArray(txn)) {
      // Group signing — send all txns in one Pera popup to avoid 4100 error
      return await peraWallet.signTransaction([txn.map(t => ({ txn: t }))])
    }
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
        .update({ status: "locked", txn_id: txnId } as any).eq("id", vault.id)
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
    } finally { setIsProcessing(false); setAction("") }
  }

  const handleRelease = async () => {
    if (!walletAddress || !user || !vault.app_id) return
    setIsProcessing(true)
    setAction("Releasing funds on-chain… (sign in your wallet)")
    try {
      const isV2 = vType === "agent_v2"
      const amountMicro = Math.round(Number(vault.amount || 0) * 1_000_000)
      const txnId = isV2
        ? await releaseAgentVaultV2(algodClient, walletAddress, vault.app_id, amountMicro, signTransaction)
        : await releaseEscrowFunds(algodClient, walletAddress, vault.app_id, signTransaction)
      const { error: upErr } = await supabase.from("escrow_vaults" as any)
        .update({ status: "released", txn_id: txnId, released_at: new Date().toISOString() } as any)
        .eq("id", vault.id)
      if (upErr) toast.warning("Released on-chain but DB update failed", { description: upErr.message })
      await supabase.from("onchain_payments" as any).insert({
        user_id: user.id, subscription_id: vault.subscription_id, algorand_txn_id: txnId,
        amount: vault.amount, sender_address: vault.app_address || walletAddress,
        recipient_address: vault.escrow_address || walletAddress,
        note: `Payment released from ${typeLabel} contract (App ${vault.app_id})`,
      } as any)
      setReleasedTxnId(txnId)
      toast.success("Funds released!", {
        description: (
          <span>{vault.amount} ALGO sent. <a href={getLoraTransactionUrl(txnId, network)} target="_blank" rel="noopener noreferrer" className="underline font-medium">View on Lora ↗</a></span>
        ) as any,
        duration: 8000,
      })
      onUpdate()
    } catch (err: any) {
      toast.error("Release failed", { description: err?.message?.includes("4100") || err?.message?.toLowerCase().includes("pending")
        ? "Pera Wallet has a pending request. Open Pera on your phone, reject any pending transaction, then try again."
        : err?.message || "Transaction failed" })
    } finally { setIsProcessing(false); setAction("") }
  }

  const handleKillSwitch = async () => {
    if (!walletAddress || !user || !vault.app_id) return
    setConfirmAction(null)
    setIsProcessing(true)
    setAction("Activating kill switch on-chain…")
    try {
      const txnId = await killEscrowContract(algodClient, walletAddress, vault.app_id, signTransaction)
      const { error: upErr } = await supabase.from("escrow_vaults" as any)
        .update({ status: "killed", kill_switch_active: true, txn_id: txnId, released_at: new Date().toISOString() } as any)
        .eq("id", vault.id)
      if (upErr) toast.warning("Killed on-chain but DB update failed", { description: upErr.message })
      await supabase.from("onchain_payments" as any).insert({
        user_id: user.id, subscription_id: vault.subscription_id, algorand_txn_id: txnId,
        amount: 0, sender_address: vault.app_address || walletAddress, recipient_address: walletAddress,
        note: `Kill switch activated on ${typeLabel} contract (App ${vault.app_id})`,
      } as any)
      toast.success("Kill switch activated", { description: "Funds returned to your wallet" })
      onUpdate()
    } catch (err: any) {
      toast.error("Kill switch failed", { description: err?.message || "Transaction failed" })
    } finally { setIsProcessing(false); setAction("") }
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
    } finally { setIsProcessing(false); setAction("") }
  }

  const activeTxnId = releasedTxnId || (vault.status !== "locked" ? vault.txn_id : null)

  const statusLabel = vault.status.charAt(0).toUpperCase() + vault.status.slice(1)
  const isLocked = vault.status === "locked"

  const balanceDisplay = isSmartContract && onChainBalance !== null
    ? microalgosToAlgo(onChainBalance).toFixed(4)
    : Number(vault.amount).toFixed(4)

  // Tag pills, keep to 2 like the reference
  const pills: string[] = [typeLabel, network === "mainnet" ? "MainNet" : "TestNet"]

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-controls={`vault-details-${vault.id}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, a, input, [role='dialog']")) return
        setExpanded((x) => !x)
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if ((e.target as HTMLElement).closest("button, a, input")) return
          e.preventDefault()
          setExpanded((x) => !x)
        }
      }}
      className="flex min-h-[360px] cursor-pointer flex-col rounded-2xl bg-card text-card-foreground border border-border shadow-[0_4px_24px_-12px_rgba(0,0,0,0.18)] dark:shadow-none transition-shadow hover:shadow-[0_8px_28px_-10px_rgba(0,0,0,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
    >
      {/* Top: logo + status pill */}
      <div className="flex items-start justify-between gap-3 p-5 pb-4">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted overflow-hidden shrink-0">
          {vault.subscription?.logo ? (
            <img src={vault.subscription.logo} alt={vault.subscription.name} className="size-full object-cover" />
          ) : (vType === "agent" || vType === "agent_v2") ? (
            <>
              <img src="/openclaw.svg" alt="OpenClaw Agent" className="size-5 object-contain dark:hidden" />
              <img src="/openclaw-dark.svg" alt="OpenClaw Agent" className="size-5 object-contain hidden dark:block" />
            </>
          ) : (
            <TypeIcon className="size-5 text-foreground" />
          )}
        </div>

        <span
          title={`Vault status: ${statusLabel}`}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${
            isLocked
              ? "border border-border bg-background text-muted-foreground"
              : "bg-muted text-foreground"
          }`}
        >
          {statusLabel}
          {isLocked
            ? <RiBookmarkLine className="size-3" />
            : <RiBookmarkFill className="size-3" />}
        </span>
      </div>

      {/* Middle: meta + title + pills */}
      <div className="px-5">
        <div className="text-xs">
          <span className="font-medium text-foreground">{typeLabel}</span>{" "}
          <span className="text-muted-foreground">{relativeTime(vault.created_at)}</span>
        </div>
        <h3 className="mt-1 text-[17px] font-bold text-foreground leading-snug line-clamp-2">
          {vault.subscription?.name || "Subscription Vault"}
        </h3>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {pills.map((p) => (
            <span key={p} className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80">
              {p}
            </span>
          ))}
        </div>

        {/* Time until next release — only for locked agent vaults with a linked subscription */}
        {isLocked && (vType === "agent" || vType === "agent_v2") && vault.subscription?.next_billing_date && (
          <div className="mt-3 flex items-center gap-2">
            <img src="/openclaw.svg" alt="OpenClaw" className="size-3.5 rounded-sm object-contain dark:hidden" />
            <img src="/openclaw-dark.svg" alt="OpenClaw" className="size-3.5 rounded-sm object-contain hidden dark:block" />
            <span className="text-xs font-medium text-foreground">
              {timeUntilRelease(vault.subscription.next_billing_date)}
            </span>
          </div>
        )}

        {/* Time-lock progress bar */}
        {isLocked && vType === "time_locked" && vault.unlock_time && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Lock progress</span>
              <span>Unlocks {new Date(vault.unlock_time).toLocaleDateString()}</span>
            </div>
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-foreground/60 transition-all"
                style={{ width: `${timeLockProgress(vault.created_at, vault.unlock_time)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Spacer to keep footer at bottom even when content is short */}
      <div className="min-h-[80px] flex-1" />

      {/* Status / action banners */}
      {action && (
        <div className="mx-5 mb-3 rounded-md bg-muted/60 border border-border px-3 py-2">
          <p className="text-xs text-foreground font-medium animate-pulse">{action}</p>
        </div>
      )}
      {confirmAction && (
        <div className="mx-5 mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-3">
          <p className="text-xs font-medium text-destructive mb-2">
            {confirmAction === "kill"
              ? "Are you sure? This returns all funds to your wallet."
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
        <div className="mx-5 mb-3 rounded-lg border border-border bg-muted/40 p-3 space-y-2">
          <p className="text-xs font-medium text-foreground">Add ALGO to vault on-chain</p>
          <div className="flex gap-2">
            <input
              type="number" min="0.001" step="0.001" placeholder="Amount (ALGO)"
              value={fundAmount} onChange={e => setFundAmount(e.target.value)}
              className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
            />
            <button onClick={handleFund} disabled={!fundAmount || parseFloat(fundAmount) <= 0}
              className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50">
              Send
            </button>
            <button onClick={() => { setShowFundModal(false); setFundAmount("") }}
              className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-foreground">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Divider + footer (price + CTA) */}
      <div className="mx-5 border-t border-border" />
      <div className="flex items-end justify-between gap-3 p-5 pt-4">
        <div className="min-w-0">
          <div
            className="flex items-baseline gap-1 cursor-help"
            title={isSmartContract ? "Live on-chain balance (click refresh icon to update)" : "Vault amount"}
          >
            <span className="text-lg font-bold text-foreground tabular-nums">{balanceDisplay}</span>
            <span className="text-xs font-medium text-muted-foreground">{vault.currency}</span>
            {isSmartContract && (
              <button
                onClick={() => fetchOnChainBalance()}
                disabled={loadingBalance}
                className="ml-1 text-muted-foreground hover:text-foreground"
                title="Refresh on-chain balance"
                aria-label="Refresh on-chain balance"
              >
                <RiRefreshLine className={`size-3 ${loadingBalance ? "animate-spin" : ""}`} />
              </button>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
            {network === "mainnet" ? "Algorand MainNet" : "Algorand TestNet"}
          </p>
        </div>

        {/* Primary CTA */}
        {isLocked && isSmartContract ? (
          <button
            onClick={handleRelease}
            disabled={isProcessing || !walletAddress}
            title="Release escrowed funds to the recipient on-chain"
            className="rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
          >
            {isProcessing ? "Processing…" : "Release"}
          </button>
        ) : activeTxnId ? (
          <a
            href={getLoraTransactionUrl(activeTxnId, network)}
            target="_blank"
            rel="noopener noreferrer"
            title="Open this transaction on Lora explorer"
            className="inline-flex items-center gap-1 rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background transition-colors hover:bg-foreground/90"
          >
            View on Lora <RiExternalLinkLine className="size-3" />
          </a>
        ) : (
          <button
            onClick={() => setExpanded(true)}
            title="Show vault details"
            className="rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background hover:bg-foreground/90"
          >
            Details
          </button>
        )}
      </div>

      {/* Expanded panel, pushes following grid rows down */}
      {expanded && (
        <div id={`vault-details-${vault.id}`} role="region" aria-label="Vault details"
          className="border-t border-border px-5 py-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Stat label="Network" value={network === "mainnet" ? "MainNet" : "TestNet"} />
            <Stat label="Currency" value={vault.currency} />
            <Stat label="Status" value={statusLabel} />
          </div>

          {isSmartContract && (
            <div className="rounded-lg bg-background border border-border p-3 space-y-1.5 text-xs">
              <Row label="App ID" value={
                <a href={getLoraApplicationUrl(vault.app_id!, network)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono font-medium text-foreground hover:underline">
                  #{vault.app_id} <RiExternalLinkLine className="size-3" />
                </a>
              } />
              {vault.app_address && (
                <Row label="App address" value={
                  <a href={getLoraAddressUrl(vault.app_address, network)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono font-medium text-foreground hover:underline">
                    {shortenAddress(vault.app_address, 6)} <RiExternalLinkLine className="size-3" />
                  </a>
                } />
              )}
              {vault.escrow_address && (
                <Row label="Recipient" value={
                  <span className="font-mono font-medium text-foreground">{shortenAddress(vault.escrow_address, 6)}</span>
                } />
              )}
            </div>
          )}

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
            <p className="text-xs text-muted-foreground">
              Autonomous agent will release this vault on the billing date.
            </p>
          )}

          {vault.released_at && (
            <p className="text-xs text-muted-foreground">
              {vault.status === "killed" ? "Killed" : "Released"} on {new Date(vault.released_at).toLocaleString()}
            </p>
          )}

          {/* Secondary actions */}
          {isLocked && isSmartContract && !confirmAction && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => setShowFundModal(true)}
                disabled={isProcessing || !walletAddress}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                <RiAddLine className="size-3.5" /> Fund
              </button>
              <button
                onClick={() => setConfirmAction("kill")}
                disabled={isProcessing}
                className="inline-flex items-center gap-1 rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                <RiAlarmWarningLine className="size-3.5" /> Kill
              </button>
            </div>
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
            <div className="rounded-md bg-muted/60 border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">Legacy vault (no on-chain contract)</p>
            </div>
          )}

          <Link to={`/escrow-vaults/${vault.id}`}
            className="block text-center text-xs font-medium text-foreground hover:underline">
            Open full details →
          </Link>
        </div>
      )}

    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background border border-border px-2.5 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-foreground">{value}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      {value}
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
