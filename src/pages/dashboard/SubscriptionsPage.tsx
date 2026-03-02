import { useAuth } from "@/lib/auth-context"
import { fetchSubscriptions, deleteSubscription } from "@/lib/supabase-queries"
import { fetchProfile } from "@/lib/supabase-queries"
import { formatCurrency } from "@/lib/currency"
import { cx } from "@/lib/utils"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Link } from "react-router-dom"
import {
  RiAddLine, RiDeleteBinLine, RiEditLine, RiLoader4Line,
  RiSearchLine, RiAlertLine, RiFileListLine,
  RiPlayCircleLine, RiPauseCircleLine, RiCloseCircleLine, RiTimerFlashLine,
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
    if (!confirm("Are you sure you want to delete this subscription?")) return
    try {
      setDeleting(id)
      await deleteSubscription(id)
      setSubscriptions((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete")
    } finally {
      setDeleting(null)
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
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <RiLoader4Line className="size-10 animate-spin text-blue-500" />
          <p className="text-gray-500 dark:text-gray-400">Loading subscriptions...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-900/20">
          <RiAlertLine className="mx-auto mb-4 size-12 text-red-400" />
          <p className="text-lg font-medium text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-gray-200 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 dark:border-gray-800">
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
            <Button asChild className="bg-white text-blue-700 hover:bg-blue-50 shadow-lg">
              <Link to="/subscriptions/new">
                <RiAddLine className="mr-2 size-4" />
                Add Subscription
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-3 sm:p-6 lg:p-8">
        {/* Search */}
        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
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
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
            <RiFileListLine className="mx-auto mb-4 size-12 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
              {searchQuery ? "No matches found" : "No subscriptions yet"}
            </h3>
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
                  className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="flex items-start justify-between">
                    <Link to={`/subscriptions/${sub.id}`} className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-50">{sub.name}</h3>
                      <p className="mt-0.5 text-xs text-gray-500">{sub.category || "Uncategorized"}</p>
                    </Link>
                    <div className="flex items-center gap-1">
                      <StatusIcon className="size-4 text-gray-400" />
                      <span className="text-xs text-gray-500">{status.label}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-50">
                        {formatCurrency(sub.amount, sub.currency || currency)}
                      </p>
                      <p className="text-xs capitalize text-gray-500">{sub.billing_cycle}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/subscriptions/${sub.id}`}>
                          <RiEditLine className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(sub.id)}
                        disabled={deleting === sub.id}
                      >
                        {deleting === sub.id ? (
                          <RiLoader4Line className="size-4 animate-spin" />
                        ) : (
                          <RiDeleteBinLine className="size-4 text-red-500" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
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
