import { useAuth } from "@/lib/auth-context"
import { fetchSubscriptions, deleteSubscription, createSubscription } from "@/lib/supabase-queries"
import { fetchProfile } from "@/lib/supabase-queries"
import { formatCurrency } from "@/lib/currency"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Link } from "react-router-dom"
import { generateCSV, parseCSV } from "@/lib/csv"
import { toast } from "sonner"
import {
  RiAddLine, RiDeleteBinLine, RiEditLine, RiLoader4Line,
  RiSearchLine, RiAlertLine, RiFileListLine,
  RiPlayCircleLine, RiPauseCircleLine, RiCloseCircleLine, RiTimerFlashLine,
  RiDownloadLine, RiUploadLine,
} from "@remixicon/react"
import { useState, useEffect, useMemo, useRef } from "react"

const statusConfig: Record<string, { label: string; icon: any }> = {
  active: { label: "Active", icon: RiPlayCircleLine },
  trial: { label: "Trial", icon: RiTimerFlashLine },
  cancelled: { label: "Cancelled", icon: RiCloseCircleLine },
  paused: { label: "Paused", icon: RiPauseCircleLine },
}

export default function SubscriptionsPage() {
  const { user } = useAuth()
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [currency, setCurrency] = useState("USD")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  async function loadData() {
    try {
      setLoading(true)
      const [subs, profile] = await Promise.all([
        fetchSubscriptions(user!.id),
        fetchProfile(user!.id),
      ])
      setSubscriptions(subs)
      setCurrency(profile?.currency || "USD")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      setDeleting(id)
      await deleteSubscription(id)
      setSubscriptions((prev) => prev.filter((s) => s.id !== id))
      setDeleteConfirmId(null)
      toast.success("Subscription deleted")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete subscription")
    } finally {
      setDeleting(null)
    }
  }

  function handleExport() {
    const csv = generateCSV(subscriptions)
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "subscriptions.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setImporting(true)
    try {
      const text = await file.text()
      const parsed = parseCSV(text)
      for (const sub of parsed) {
        await createSubscription({
          user_id: user.id,
          name: sub.name,
          description: sub.description || null,
          amount: sub.amount,
          currency: sub.currency,
          billing_cycle: sub.billingCycle as any,
          next_billing_date: sub.nextBillingDate.split("T")[0],
          start_date: sub.startDate.split("T")[0],
          status: sub.status as any,
          category: sub.category || null,
          url: sub.url || null,
          notes: sub.notes || null,
          alert_days: sub.alertDays,
          alert_enabled: sub.alertEnabled,
        })
      }
      await loadData()
      toast.success(`Imported ${parsed.length} subscription${parsed.length !== 1 ? "s" : ""}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed")
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const filtered = useMemo(() => {
    if (!searchQuery) return subscriptions
    return subscriptions.filter((s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [subscriptions, searchQuery])

  const monthlyTotal = useMemo(() => {
    return filtered.reduce((sum, sub) => {
      const amt = sub.amount || 0
      if (sub.billing_cycle === "monthly") return sum + amt
      if (sub.billing_cycle === "yearly") return sum + amt / 12
      if (sub.billing_cycle === "quarterly") return sum + amt / 3
      if (sub.billing_cycle === "weekly") return sum + amt * 4.33
      return sum
    }, 0)
  }, [filtered])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <RiLoader4Line className="size-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading subscriptions...</p>
        </div>
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
      {/* Header */}
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800">
        <div className="relative mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-white">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm sm:size-12">
                  <RiFileListLine className="size-5 sm:size-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl">Subscriptions</h1>
                  <p className="mt-0.5 text-sm text-blue-100">
                    {subscriptions.length} total · {formatCurrency(monthlyTotal, currency)}/mo
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImport}
              />
              <Button
                variant="secondary"
                className="bg-white/10 text-white hover:bg-white/20 border-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                {importing ? (
                  <RiLoader4Line className="mr-2 size-4 animate-spin" />
                ) : (
                  <RiUploadLine className="mr-2 size-4" />
                )}
                Import CSV
              </Button>
              <Button
                variant="secondary"
                className="bg-white/10 text-white hover:bg-white/20 border-0"
                onClick={handleExport}
                disabled={subscriptions.length === 0}
              >
                <RiDownloadLine className="mr-2 size-4" />
                Export CSV
              </Button>
              <Button asChild className="bg-white text-blue-700 hover:bg-blue-50 shadow-lg">
                <Link to="/subscriptions/new">
                  <RiAddLine className="mr-2 size-4" />
                  Add Subscription
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-3 sm:p-6 lg:p-8">
        {/* Search */}
        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search subscriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <RiFileListLine className="mx-auto mb-4 size-12 text-muted-foreground/40" />
            <h3 className="text-lg font-semibold text-foreground">
              {searchQuery ? "No matches found" : "No subscriptions yet"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchQuery ? "Try a different search term" : "Add your first subscription to get started"}
            </p>
            {!searchQuery && (
              <Button asChild className="mt-4">
                <Link to="/subscriptions/new">
                  <RiAddLine className="mr-2 size-4" />
                  Add your first subscription
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((sub) => {
              const status = statusConfig[sub.status] || statusConfig.active
              const StatusIcon = status.icon
              return (
                <div
                  key={sub.id}
                  className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <Link to={`/subscriptions/${sub.id}`} className="flex-1">
                      <h3 className="font-semibold text-foreground">{sub.name}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">{sub.category || "Uncategorized"}</p>
                    </Link>
                    <div className="flex items-center gap-1">
                      <StatusIcon className="size-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{status.label}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-lg font-bold text-foreground">
                        {formatCurrency(sub.amount, sub.currency || currency)}
                      </p>
                      <p className="text-xs capitalize text-muted-foreground">{sub.billing_cycle}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/subscriptions/${sub.id}`}>
                          <RiEditLine className="size-4" />
                        </Link>
                      </Button>
                      {deleteConfirmId === sub.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(sub.id)}
                            disabled={deleting === sub.id}
                          >
                            {deleting === sub.id ? <RiLoader4Line className="size-3 animate-spin" /> : "Delete"}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmId(sub.id)}
                        >
                          <RiDeleteBinLine className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Next: {new Date(sub.next_billing_date).toLocaleDateString()}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}