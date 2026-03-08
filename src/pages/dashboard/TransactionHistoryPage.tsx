import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import {
  RiLoader4Line, RiExchangeLine, RiSearchLine,
  RiExternalLinkLine, RiAlertLine,
} from "@remixicon/react"
import { useState, useEffect, useMemo } from "react"

interface OnchainPayment {
  id: string
  algorand_txn_id: string
  amount: number
  sender_address: string
  recipient_address: string | null
  note: string | null
  confirmed_at: string | null
  created_at: string
  block_round: number | null
  subscription_id: string | null
}

export default function TransactionHistoryPage() {
  const { user } = useAuth()
  const [payments, setPayments] = useState<OnchainPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!user) return
    loadPayments()
  }, [user])

  async function loadPayments() {
    try {
      setLoading(true)
      const { data, error: err } = await supabase
        .from("onchain_payments")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })

      if (err) throw err
      setPayments(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payments")
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    if (!search) return payments
    const q = search.toLowerCase()
    return payments.filter(
      (p) =>
        p.algorand_txn_id.toLowerCase().includes(q) ||
        p.sender_address.toLowerCase().includes(q) ||
        p.recipient_address?.toLowerCase().includes(q) ||
        p.note?.toLowerCase().includes(q)
    )
  }, [payments, search])

  function truncate(str: string, len = 12) {
    if (str.length <= len) return str
    return str.slice(0, 6) + "…" + str.slice(-6)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <RiLoader4Line className="size-10 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center p-8">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center">
          <RiAlertLine className="mx-auto mb-4 size-12 text-destructive" />
          <p className="text-lg font-medium text-destructive">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800">
        <div className="relative mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-white">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm sm:size-12">
                  <RiExchangeLine className="size-5 sm:size-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl">Transaction History</h1>
                  <p className="mt-0.5 text-sm text-emerald-100">
                    {payments.length} on-chain payment{payments.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-3 sm:p-6 lg:p-8">
        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by txn ID, address, or note..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <RiExchangeLine className="mx-auto mb-4 size-12 text-muted-foreground/40" />
            <h3 className="text-lg font-semibold text-foreground">
              {search ? "No matches found" : "No transactions yet"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {search ? "Try a different search" : "On-chain payments will appear here"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Txn ID</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">From</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">To</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Block</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Explorer</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">
                      {truncate(p.algorand_txn_id)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {p.amount} ALGO
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden sm:table-cell">
                      {truncate(p.sender_address)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden md:table-cell">
                      {p.recipient_address ? truncate(p.recipient_address) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {p.block_round ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(p.confirmed_at || p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`https://testnet.explorer.perawallet.app/tx/${p.algorand_txn_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <RiExternalLinkLine className="size-3.5" />
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}