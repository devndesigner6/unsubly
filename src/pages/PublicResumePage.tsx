import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { getLoraTransactionUrl, getLoraAddressUrl, shortenAddress } from "@/lib/algorand/constants"
import {
  RiShieldCheckLine, RiCoinLine, RiFileListLine,
  RiExternalLinkLine, RiCheckDoubleLine, RiLoader4Line,
  RiAlertLine, RiFlashlightLine,
} from "@remixicon/react"

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

export default function PublicResumePage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const network: "testnet" | "mainnet" =
    (localStorage.getItem("algorand_network") as "testnet" | "mainnet") || "testnet"

  useEffect(() => {
    if (!token) return
    const fetchResume = async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/public-resume?token=${encodeURIComponent(token)}`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
              "Content-Type": "application/json",
            },
          }
        )
        const result = await res.json()
        if (!res.ok) throw new Error(result?.error || `Server error ${res.status}`)
        if (result?.error) throw new Error(result.error)
        setData(result)
      } catch (err: any) {
        setError(err?.message || "Resume not found")
      } finally {
        setLoading(false)
      }
    }
    fetchResume()
  }, [token])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <RiLoader4Line className="size-10 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-8">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center max-w-md">
          <RiAlertLine className="mx-auto mb-4 size-12 text-destructive" />
          <h1 className="text-lg font-bold text-foreground">Resume Not Found</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error || "This resume link is invalid or has been deactivated."}</p>
        </div>
      </div>
    )
  }

  const totalPaid = (data.payments || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0)

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/20">
                <RiShieldCheckLine className="size-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">On-Chain Financial Resume</h1>
                <p className="text-xs text-muted-foreground">Verified payment history on Algorand blockchain</p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shrink-0 ${
              network === "mainnet"
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
            }`}>
              <RiFlashlightLine className="size-3" />
              Algorand {network === "mainnet" ? "Mainnet" : "Testnet"}
            </span>
          </div>

          {data.walletAddress && (
            <a
              href={getLoraAddressUrl(data.walletAddress, network)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono mb-4"
            >
              {data.walletAddress} <RiExternalLinkLine className="size-3" />
            </a>
          )}

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
              <p className="mt-1 text-xl font-bold text-foreground">{(data.payments || []).length}</p>
            </div>
          </div>
        </div>

        {/* Payments */}
        <h2 className="mb-4 text-lg font-semibold text-foreground">Payment History</h2>
        {(data.payments || []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center">
            <p className="text-sm text-muted-foreground">No payments recorded yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(data.payments || []).map((payment: any, idx: number) => (
              <div key={payment.algorand_txn_id || idx} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <RiCheckDoubleLine className="size-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate block">
                    {payment.note || "Payment"}
                  </span>
                  {payment.algorand_txn_id && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <a
                        href={getLoraTransactionUrl(payment.algorand_txn_id, network)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-0.5 text-xs text-primary hover:text-primary/80 font-mono"
                      >
                        {shortenAddress(payment.algorand_txn_id, 8)} <RiExternalLinkLine className="size-3" />
                      </a>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-foreground">{payment.amount} ALGO</span>
                  <p className="text-xs text-muted-foreground">{new Date(payment.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center text-xs text-muted-foreground">
          Powered by Algorand blockchain • All transactions are independently verifiable
        </div>
      </div>
    </div>
  )
}
