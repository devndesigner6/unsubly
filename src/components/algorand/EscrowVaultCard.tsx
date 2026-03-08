import { useState } from "react"
import { useAlgorand } from "@/lib/algorand/context"
import { shortenAddress, getAlgoExplorerUrl, algoToMicroalgos } from "@/lib/algorand/constants"
import {
  RiLockLine,
  RiLockUnlockLine,
  RiShieldLine,
  RiExternalLinkLine,
  RiAlarmWarningLine,
} from "@remixicon/react"
import algosdk from "algosdk"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/lib/auth-context"

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
  subscription?: { name: string; logo: string | null } | null
}

interface EscrowVaultCardProps {
  vault: EscrowVault
  onUpdate: () => void
}

export function EscrowVaultCard({ vault, onUpdate }: EscrowVaultCardProps) {
  const { user } = useAuth()
  const { walletAddress, signAndSendTransaction, algodClient } = useAlgorand()
  const [isProcessing, setIsProcessing] = useState(false)

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

  const handleKillSwitch = async () => {
    if (!user) return
    setIsProcessing(true)
    try {
      // Update vault status to killed
      await supabase
        .from("escrow_vaults" as any)
        .update({ 
          status: "killed", 
          kill_switch_active: true,
          released_at: new Date().toISOString() 
        } as any)
        .eq("id", vault.id)

      // If there's a real transaction, send a 0-ALGO "kill" transaction with a note
      if (walletAddress) {
        try {
          const params = await algodClient.getTransactionParams().do()
          const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: walletAddress,
            receiver: walletAddress,
            amount: 0,
            suggestedParams: params,
            note: new TextEncoder().encode(
              JSON.stringify({
                app: "unsubscribely",
                action: "kill_switch",
                vault_id: vault.id,
                subscription: vault.subscription?.name || "unknown",
                timestamp: Date.now(),
              })
            ),
          })
          const txnId = await signAndSendTransaction(txn)
          
          // Record on-chain
          await supabase.from("onchain_payments" as any).insert({
            user_id: user.id,
            subscription_id: vault.subscription_id,
            algorand_txn_id: txnId,
            amount: 0,
            sender_address: walletAddress,
            recipient_address: walletAddress,
            note: `Kill switch activated for ${vault.subscription?.name || "subscription"}`,
          } as any)
        } catch (err) {
          console.error("On-chain kill switch failed, but vault is locked:", err)
        }
      }

      onUpdate()
    } catch (err) {
      console.error("Kill switch error:", err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRelease = async () => {
    if (!walletAddress || !user) return
    setIsProcessing(true)
    try {
      const params = await algodClient.getTransactionParams().do()
      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: walletAddress,
        receiver: vault.escrow_address || walletAddress,
        amount: algoToMicroalgos(vault.amount),
        suggestedParams: params,
        note: new TextEncoder().encode(
          JSON.stringify({
            app: "unsubscribely",
            action: "release_payment",
            vault_id: vault.id,
            subscription: vault.subscription?.name || "unknown",
            timestamp: Date.now(),
          })
        ),
      })

      const txnId = await signAndSendTransaction(txn)

      // Update vault
      await supabase
        .from("escrow_vaults" as any)
        .update({
          status: "released",
          txn_id: txnId,
          released_at: new Date().toISOString(),
        } as any)
        .eq("id", vault.id)

      // Record on-chain payment
      await supabase.from("onchain_payments" as any).insert({
        user_id: user.id,
        subscription_id: vault.subscription_id,
        algorand_txn_id: txnId,
        amount: vault.amount,
        sender_address: walletAddress,
        recipient_address: vault.escrow_address || walletAddress,
        note: `Payment released for ${vault.subscription?.name || "subscription"}`,
      } as any)

      onUpdate()
    } catch (err) {
      console.error("Release payment error:", err)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {vault.subscription?.logo ? (
            <img
              src={vault.subscription.logo}
              alt={vault.subscription.name}
              className="size-10 rounded-lg object-cover"
            />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <RiShieldLine className="size-5 text-primary" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {vault.subscription?.name || "Subscription Vault"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {vault.amount} {vault.currency}
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[vault.status]}`}>
          <StatusIcon className="size-3" />
          {vault.status.charAt(0).toUpperCase() + vault.status.slice(1)}
        </span>
      </div>

      {vault.txn_id && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Txn: {shortenAddress(vault.txn_id, 8)}</span>
          <a
            href={getAlgoExplorerUrl(vault.txn_id)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80"
          >
            <RiExternalLinkLine className="size-3" />
          </a>
        </div>
      )}

      {vault.status === "locked" && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleRelease}
            disabled={isProcessing || !walletAddress}
            className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isProcessing ? "Processing..." : "Release Payment"}
          </button>
          <button
            onClick={handleKillSwitch}
            disabled={isProcessing}
            className="flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
          >
            <RiAlarmWarningLine className="size-3.5" />
            Kill Switch
          </button>
        </div>
      )}

      <div className="mt-3 text-xs text-muted-foreground">
        Created {new Date(vault.created_at).toLocaleDateString()}
        {vault.released_at && ` • ${vault.status === "killed" ? "Killed" : "Released"} ${new Date(vault.released_at).toLocaleDateString()}`}
      </div>
    </div>
  )
}
