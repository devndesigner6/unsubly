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
  RiCoinLine, RiShareLine, RiCheckLine, RiFileCopyLine,
} from "@remixicon/react"
import { toast } from "sonner"

export default function OnChainResumePage() {
  const { user } = useAuth()
  const { walletAddress, network } = useAlgorand()
  const [payments, setPayments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [isSharing, setIsSharing] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      setIsLoading(true)
      const [paymentsRes, shareRes] = await Promise.all([
        supabase.from("onchain_payments" as any).select("*, subscription:subscriptions(name, logo)").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("resume_shares" as any).select("*").eq("user_id", user.id).eq("is_active", true).maybeSingle(),
      ])
      if (paymentsRes.data) setPayments(paymentsRes.data as any[])
      if (shareRes.data) setShareToken((shareRes.data as any).share_token)
      setIsLoading(false)
    }
    fetchData()
  }, [user])

  const handleCreateShare = async () => {
    if (!user) return
    setIsSharing(true)
    try {
      const { data, error } = await supabase.from("resume_shares" as any)
        .insert({ user_id: user.id } as any)
        .select("share_token")
        .single()
      if (error) throw error
      setShareToken((data as any).share_token)
      toast.success("Share link created!")
    } catch (err: any) {
      toast.error("Failed to create share link", { description: err?.message })
    } finally {
      setIsSharing(false)
    }
  }

  const handleDeactivateShare = async () => {
    if (!user) return
    try {
      const { error } = await supabase.from("resume_shares" as any).update({ is_active: false } as any).eq("user_id", user.id).eq("is_active", true)
      if (error) throw error
      setShareToken(null)
      toast.info("Share link deactivated")
    } catch (err: any) {
      toast.error("Failed to deactivate link", { description: err?.message })
    }
  }

  const shareUrl = shareToken ? `${window.location.origin}/resume/${shareToken}` : null

  const handleCopy = () => {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    toast.success("Link copied!")
    setTimeout(() => setCopied(false), 2000)
  }

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

      <WalletRequired feature="On-Chain Resume">
        <div className="mb-6">
          <WalletConnect />
        </div>

      {/* Share Controls */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <RiShareLine className="size-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Public Resume Link</span>
          </div>
          {!shareToken ? (
            <button
              onClick={handleCreateShare}
              disabled={isSharing}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSharing ? "Creating..." : "Generate Link"}
            </button>
          ) : (
            <button
              onClick={handleDeactivateShare}
              className="rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
            >
              Deactivate
            </button>
          )}
        </div>
        {shareUrl && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="flex-1 rounded-lg border border-input bg-muted px-3 py-1.5 text-xs font-mono text-foreground"
            />
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              {copied ? <RiCheckLine className="size-3.5" /> : <RiFileCopyLine className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
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
                href={getAddressExplorerUrl(walletAddress, network)}
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
  )
}
