import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { useAlgorand } from "@/lib/algorand/context"
import { supabase } from "@/integrations/supabase/client"
import { WalletConnect } from "@/components/algorand/WalletConnect"
import { OnChainResumeCard } from "@/components/algorand/OnChainResumeCard"
import { getAddressExplorerUrl } from "@/lib/algorand/constants"
import {
  RiFileListLine,
  RiExternalLinkLine,
  RiShieldCheckLine,
  RiCoinLine,
} from "@remixicon/react"

export default function OnChainResumePage() {
  const { user } = useAuth()
  const { walletAddress } = useAlgorand()
  const [payments, setPayments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchPayments = async () => {
      setIsLoading(true)
      const { data } = await supabase
        .from("onchain_payments" as any)
        .select("*, subscription:subscriptions(name, logo)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
      if (data) setPayments(data as any[])
      setIsLoading(false)
    }
    fetchPayments()
  }, [user])

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const totalTransactions = payments.length

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">On-Chain Financial Resume</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your verified, tamper-proof payment history on the Algorand blockchain
        </p>
      </div>

      {/* Wallet */}
      <div className="mb-6">
        <WalletConnect />
      </div>

      {/* Resume Header */}
      {walletAddress && (
        <div className="mb-8 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/20">
              <RiShieldCheckLine className="size-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Verified Payment Identity</h2>
              <a
                href={getAddressExplorerUrl(walletAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline font-mono"
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
              <p className="mt-1 text-xl font-bold text-foreground">{totalPaid.toFixed(4)} ALGO</p>
            </div>
            <div className="rounded-lg bg-card/60 p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <RiFileListLine className="size-3.5" />
                <span className="text-xs">Transactions</span>
              </div>
              <p className="mt-1 text-xl font-bold text-foreground">{totalTransactions}</p>
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
          <h3 className="mt-4 text-sm font-medium text-foreground">No on-chain payments yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create an escrow vault and release a payment to start building your resume
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <OnChainResumeCard key={payment.id} payment={payment} />
          ))}
        </div>
      )}
    </div>
  )
}
