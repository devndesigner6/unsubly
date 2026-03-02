import { useState, useEffect, useMemo, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/Button"
import { Badge } from "@/components/Badge"
import { Input } from "@/components/Input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/Select"
import { formatCurrency } from "@/lib/currency"
import { cx } from "@/lib/utils"
import {
  RiAddLine, RiDeleteBinLine, RiEditLine, RiLoader4Line, RiSearchLine,
  RiAlertLine, RiPlayCircleLine, RiPauseCircleLine, RiCloseCircleLine,
  RiTimerFlashLine, RiFileListLine, RiWalletLine, RiCalendarLine,
} from "@remixicon/react"

interface Subscription {
  id: string
  name: string
  amount: number
  currency: string
  billing_cycle: string
  next_billing_date: string
  status: string
  category: string | null
  description: string | null
}

const statusConfig: Record<string, { variant: "success" | "warning" | "neutral" | "default"; label: string; icon: any }> = {
  active: { variant: "success", label: "Active", icon: RiPlayCircleLine },
  trial: { variant: "warning", label: "Trial", icon: RiTimerFlashLine },
  cancelled: { variant: "neutral", label: "Cancelled", icon: RiCloseCircleLine },
  paused: { variant: "default", label: "Paused", icon: RiPauseCircleLine },
}

export default function Subscriptions() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [subs, setSubs] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [deleting, setDeleting] = useState<string | null>(null)
  const currency = profile?.currency || "USD"

  useEffect(() => {
    if (!user) return
    supabase
      .from("subscriptions")
      .select("*")
      .order("next_billing_date", { ascending: true })
      .then(({ data }) => {
        setSubs((data as Subscription[]) || [])
        setLoading(false)
      })
  }, [user])

  async function handleDelete(id: string) {
    if (!confirm("Delete this subscription?")) return
    setDeleting(id)
    await supabase.from("subscriptions").delete().eq("id", id)
    setSubs((prev) => prev.filter((s) => s.id !== id))
    setDeleting(null)
  }

  const filtered = useMemo(() => {
    return subs.filter((s) => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || s.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [subs, searchQuery, statusFilter])

  const monthlyTotal = useMemo(() => {
    return filtered.reduce((sum, s) => {
      if (s.status === "cancelled") return sum
      const amt = Number(s.amount)
      if (s.billing_cycle === "monthly") return sum + amt
      if (s.billing_cycle === "yearly") return sum + amt / 12
      if (s.billing_cycle === "quarterly") return sum + amt / 3
      if (s.billing_cycle === "weekly") return sum + amt * 4.33
      return sum
    }, 0)
  }, [filtered])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <RiLoader4Line className="size-10 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-gray-200 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 dark:border-gray-800">
        <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 text-white">
              <div className="flex size-12 items-center justify-center rounded-xl bg-white/10">
                <RiFileListLine className="size-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Subscriptions</h1>
                <p className="text-sm text-blue-100">Manage all your subscriptions</p>
              </div>
            </div>
            <Button asChild className="bg-white text-blue-700 shadow-lg hover:bg-blue-50">
              <Link to="/subscriptions/new"><RiAddLine className="mr-2 size-4" />Add Subscription</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        {/* Metrics */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500">Total</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{filtered.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500">Monthly Cost</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(monthlyTotal, currency)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500">Yearly Cost</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(monthlyTotal * 12, currency)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <RiSearchLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <Input type="search" placeholder="Search subscriptions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="[&>input]:pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <RiFileListLine className="mx-auto size-12 text-gray-300" />
              <p className="mt-4 text-gray-500">No subscriptions found</p>
              <Button asChild className="mt-4"><Link to="/subscriptions/new">Add your first subscription</Link></Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((sub) => {
                const config = statusConfig[sub.status] || statusConfig.active
                return (
                  <div key={sub.id} className="flex items-center justify-between p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <div className="flex items-center gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white">{sub.name}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant={config.variant}>{config.label}</Badge>
                          {sub.category && <span className="text-xs text-gray-500">{sub.category}</span>}
                          <span className="text-xs text-gray-400">{sub.billing_cycle}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(Number(sub.amount), sub.currency || currency)}</p>
                        <p className="text-xs text-gray-500">{new Date(sub.next_billing_date).toLocaleDateString()}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(sub.id)} isLoading={deleting === sub.id}>
                        <RiDeleteBinLine className="size-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
