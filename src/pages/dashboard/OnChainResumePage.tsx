import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { useAlgorand } from "@/lib/algorand/context"
import { supabase } from "@/integrations/supabase/client"
import { WalletConnect } from "@/components/algorand/WalletConnect"
import { WalletRequired } from "@/components/algorand/WalletRequired"
import { OnChainResumeCard } from "@/components/algorand/OnChainResumeCard"
import { getAddressExplorerUrl } from "@/lib/algorand/constants"
import {
  RiFileListLine, RiExternalLinkLine, RiShieldCheckLine,
  RiCoinLine, RiCheckLine, RiBrainLine,
} from "@remixicon/react"
import { toast } from "sonner"
import { motion } from "motion/react"

export default function OnChainResumePage() {
  const { user } = useAuth()
  const { walletAddress, network } = useAlgorand()
  const [payments, setPayments] = useState<any[]>([])
  const [vaultTxns, setVaultTxns] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      setIsLoading(true)
      const [paymentsRes, vaultsRes] = await Promise.all([
        supabase.from("onchain_payments" as any).select("*, subscription:subscriptions(name, logo)").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("escrow_vaults" as any).select("id, app_id, status, amount, txn_id, released_at, killed_at, created_at, subscription:subscriptions(name)").eq("user_id", user.id).not("txn_id", "is", null).order("released_at", { ascending: false }).limit(10),
      ])
      if (paymentsRes.data) setPayments(paymentsRes.data as any[])
      if (vaultsRes.data) setVaultTxns(vaultsRes.data as any[])
      setIsLoading(false)
    }
    fetchData()
  }, [user])

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const totalTransactions = payments.length

  const generateAISummary = async () => {
    setGeneratingSummary(true)
    setSummaryError(null)
    try {
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("name, status, amount, currency, billing_cycle, created_at")
        .eq("user_id", user!.id)
      
      const context = {
        totalPayments: totalTransactions,
        totalAlgoPaid: totalPaid.toFixed(4),
        subscriptions: subs?.map(s => `${s.name} (${s.status}, ${s.currency} ${s.amount}/${s.billing_cycle})`) || [],
        walletAddress: walletAddress?.slice(0, 8) + "...",
        network,
        memberSince: subs?.[0]?.created_at ? new Date(subs[0].created_at).toLocaleDateString() : "recently",
      }

      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch("/api/ai-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ context }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.summary) setAiSummary(data.summary)
        else setSummaryError("No summary generated. Try again.")
      } else {
        const errData = await res.json().catch(() => ({}))
        setSummaryError(errData.error || `Server error (${res.status})`)
      }
    } catch (err) {
      setSummaryError("Failed to connect to AI service")
    } finally {
      setGeneratingSummary(false)
    }
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-background overflow-hidden flex flex-col">
      <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 min-h-0 overflow-y-auto">
      <div className="mb-6 shrink-0 relative overflow-hidden">
        <span className="ghost-text">PROOF</span>
        <svg className="absolute -z-10 -top-4 -right-4 opacity-[0.03] text-foreground pointer-events-none" width="140" height="170" viewBox="0 0 48 56" fill="currentColor">
          <path d="M24 4L8 12V24C8 37 15 47 24 50C33 47 40 37 40 24V12L24 4Z" />
        </svg>
        <h1 className="font-display text-3xl sm:text-4xl text-foreground tracking-tight">On-Chain Resume</h1>
        <p className="font-display italic mt-1.5 text-xs text-muted-foreground">
          Your verified, tamper-proof payment history on the Algorand blockchain
        </p>
      </div>

      <WalletRequired feature="On-Chain Resume">
        <div className="mb-6">
          <WalletConnect />
        </div>

      {/* Live Agent Proof - shows vault transactions with explorer links */}
      {vaultTxns.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <RiCheckLine className="size-4 text-emerald-500" />
            <h3 className="text-sm font-semibold text-foreground">Live Agent Proof</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
              {vaultTxns.length} verified
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            On-chain transactions proving the autonomous agent released or killed vaults.
          </p>
          <div className="space-y-2">
            {vaultTxns.slice(0, 5).map((v: any) => (
              <div key={v.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-background px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                      v.status === "released" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600" :
                      v.status === "killed" ? "bg-red-50 dark:bg-red-500/10 text-red-500" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {v.status}
                    </span>
                    <span className="text-xs text-foreground font-medium truncate">
                      {(v.subscription as any)?.name || "Vault"}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono-pixel">
                      {v.amount} ALGO
                    </span>
                  </div>
                  <code className="text-[10px] text-muted-foreground/70 font-mono truncate block mt-0.5">
                    {v.txn_id}
                  </code>
                </div>
                <a
                  href={`https://testnet.explorer.perawallet.app/tx/${v.txn_id}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 shrink-0 ml-2 text-[10px] font-medium text-foreground border border-border rounded-full px-2.5 py-1 hover:bg-muted transition-colors"
                >
                  Explorer <RiExternalLinkLine className="size-3" />
                </a>
              </div>
            ))}
          </div>
          {/* Agent wallet link */}
          <div className="mt-3 pt-3 border-t border-border/50">
            <a
              href={`https://testnet.explorer.perawallet.app/accounts/RVHOYLPY4L47JYCYEMCP7EMEC2AZ3HV53YHSL2ZISX6PSO5EQ6H5YVAE5U/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Agent wallet: RVHOYLPY...YVAE5U
              <RiExternalLinkLine className="size-3" />
            </a>
          </div>
        </motion.div>
      )}

      {/* AI Financial Summary */}
      {/* Resume Header */}
      {walletAddress && (
        <div className="mb-6 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex size-11 items-center justify-center rounded-xl border border-border">
              <RiShieldCheckLine className="size-5 text-foreground" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Verified Payment Identity</h2>
              <a
                href={getAddressExplorerUrl(walletAddress, network)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-mono transition-colors"
              >
                {walletAddress}
                <RiExternalLinkLine className="size-3" />
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-card/60 p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <RiCoinLine className="size-3.5" />
                <span className="text-xs">Total Transacted</span>
              </div>
              <p className="mt-1 text-xl font-bold font-mono-pixel text-foreground">{totalPaid.toFixed(4)} ALGO</p>
            </div>
            <div className="rounded-lg bg-card/60 p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <RiFileListLine className="size-3.5" />
                <span className="text-xs">Transactions</span>
              </div>
              <p className="mt-1 text-xl font-bold font-mono-pixel text-foreground">{totalTransactions}</p>
            </div>
          </div>
        </div>
      )}

      {/* Payment History */}
      <h2 className="mb-4 text-lg font-semibold text-foreground">Payment History</h2>
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : payments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center">
          <RiFileListLine className="mx-auto size-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-sm font-medium text-foreground">
            {!walletAddress ? "Connect your wallet to view payment history" : "No on-chain payments yet"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {!walletAddress
              ? "Connect your Pera or Defly wallet in Settings to see your verified on-chain payment history"
              : "Create an escrow vault and release a payment to start building your resume"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <OnChainResumeCard key={payment.id} payment={payment} network={network} />
          ))}
        </div>
      )}
      </WalletRequired>
    </div>
    </div>
  )
}
