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
  RiDownloadLine, RiUploadLine, RiSparklingLine,
  RiGlobalLine, RiSmartphoneLine,
} from "@remixicon/react"
import { useState, useEffect, useMemo, useRef } from "react"
import { ConfirmInline } from "@/components/micro/ConfirmInline"
import { SmartImportModal } from "@/components/subscriptions/SmartImportModal"
import { SmsImportModal } from "@/components/subscriptions/SmsImportModal"
import { getGuardrails, assessRenewalRisk, type SubscriptionGuardrails } from "@/lib/budget"
import { supabase } from "@/integrations/supabase/client"
import { usePageTitle } from "@/hooks/usePageTitle"
import { Skeleton } from "@/components/ui/Skeleton"
import { findSubscription, getFaviconUrl } from "@/data/subscriptionCatalog"
import { usePlan } from "@/hooks/usePlan"
import { UpgradeModal } from "@/components/UpgradeModal"

function ServiceIcon({ name, className = "size-8" }: { name: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  const entry = findSubscription(name)
  const domain = entry?.domain

  if (!domain || failed) {
    return (
      <div className={`${className} flex items-center justify-center rounded-lg bg-muted`}>
        <RiGlobalLine className="size-4 text-muted-foreground" />
      </div>
    )
  }

  return (
    <img
      src={getFaviconUrl(domain)}
      alt={name}
      className={`${className} rounded-lg object-contain bg-white p-1 border border-border`}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  )
}

const statusConfig: Record<string, { label: string; icon: any }> = {
  active: { label: "Active", icon: RiPlayCircleLine },
  trial: { label: "Trial", icon: RiTimerFlashLine },
  cancelled: { label: "Cancelled", icon: RiCloseCircleLine },
  paused: { label: "Paused", icon: RiPauseCircleLine },
}

export default function SubscriptionsPage() {
  usePageTitle("Subscriptions")
  const { user, isGoogleUser } = useAuth()
  const { canAddSub, isPro } = usePlan()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [showSmartImport, setShowSmartImport] = useState(false)
  const [showSmsImport, setShowSmsImport] = useState(false)
  const [currency, setCurrency] = useState("USD")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("name")
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [guardrailsMap, setGuardrailsMap] = useState<Record<string, SubscriptionGuardrails>>({})
  const [pendingCancelIds, setPendingCancelIds] = useState<Set<string>>(new Set())
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

      // Batch load guardrails for all subscriptions in a single query
      if (subs.length > 0) {
        const subIds = subs.map((s: any) => s.id)
        const { data: guardrailRows } = await supabase
          .from("subscription_guardrails")
          .select("subscription_id, budget_cap, trial_end_date, pause_before_paid_renewal")
          .in("subscription_id", subIds)
        const guardrailEntries = subs.map((s: any) => {
          const row = (guardrailRows || []).find((g: any) => g.subscription_id === s.id)
          return [s.id, {
            budgetCap: row?.budget_cap ?? null,
            trialEndDate: row?.trial_end_date ?? null,
            pauseBeforePaidRenewal: Boolean(row?.pause_before_paid_renewal),
          }] as const
        })
        setGuardrailsMap(Object.fromEntries(guardrailEntries))
      }

      // Load pending cancellation alerts
      if (subs.length > 0) {
        const subIds = subs.map((s: any) => s.id)
        const { data: alerts } = await supabase
          .from("agent_renewal_alerts")
          .select("subscription_id, user_decision")
          .in("subscription_id", subIds)
          .eq("user_decision", "cancel")
        const pendingSet = new Set<string>(
          (alerts || []).map((a: any) => a.subscription_id)
        )
        setPendingCancelIds(pendingSet)
      }
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
    let result = subscriptions
    if (searchQuery) {
      result = result.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.description ?? "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    if (statusFilter !== "all") {
      result = result.filter(s => s.status === statusFilter)
    }
    result = [...result].sort((a, b) => {
      if (sortBy === "amount_desc") return (b.amount || 0) - (a.amount || 0)
      if (sortBy === "amount_asc") return (a.amount || 0) - (b.amount || 0)
      if (sortBy === "date") return new Date(a.next_billing_date).getTime() - new Date(b.next_billing_date).getTime()
      return a.name.localeCompare(b.name)
    })
    return result
  }, [subscriptions, searchQuery, statusFilter, sortBy])

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
      <div className="min-h-screen bg-background">
        {/* Skeleton header */}
        <div className="border-b border-border bg-muted/50 px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto max-w-7xl flex items-center gap-3">
            <Skeleton className="size-10 rounded-xl" />
            <div>
              <Skeleton className="h-6 w-40 mb-1.5" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl p-3 sm:p-6 lg:p-8">
          {/* Skeleton search bar */}
          <Skeleton className="h-10 w-full rounded-lg mb-6" />
          {/* Skeleton cards grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="size-9 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-28 mb-1.5" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <Skeleton className="h-5 w-20 mb-1" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <Skeleton className="h-8 w-16 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
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
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-muted sm:size-12">
                  <RiFileListLine className="size-5 text-foreground sm:size-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground sm:text-2xl lg:text-3xl">Subscriptions</h1>
                  <p className="mt-0.5 text-sm text-muted-foreground">
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
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                title="Import a subscriptions CSV exported from Unsubscribely"
              >
                {importing ? (
                  <RiLoader4Line className="size-4 animate-spin sm:mr-2" />
                ) : (
                  <RiUploadLine className="size-4 sm:mr-2" />
                )}
                <span className="hidden sm:inline">Import CSV</span>
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowSmartImport(true)}
                title="Detect subscriptions from a pasted email or bank statement"
              >
                <RiSparklingLine className="size-4 sm:mr-2" />
                <span className="hidden sm:inline">Smart import</span>
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowSmsImport(true)}
                title="Detect subscriptions from Indian bank SMS messages"
              >
                <RiSmartphoneLine className="size-4 sm:mr-2" />
                <span className="hidden sm:inline">SMS import</span>
              </Button>
              <Button
                variant="secondary"
                onClick={handleExport}
                disabled={subscriptions.length === 0}
                title="Export subscriptions as CSV"
              >
                <RiDownloadLine className="size-4 sm:mr-2" />
                <span className="hidden sm:inline">Export CSV</span>
              </Button>
              <Button asChild={canAddSub} onClick={canAddSub ? undefined : () => setShowUpgradeModal(true)}>
                {canAddSub ? (
                  <Link to="/subscriptions/new">
                    <RiAddLine className="size-4 sm:mr-2" />
                    <span className="hidden sm:inline">Add Subscription</span>
                  </Link>
                ) : (
                  <span>
                    <RiAddLine className="size-4 sm:mr-2" />
                    <span className="hidden sm:inline">Add Subscription</span>
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-3 sm:p-6 lg:p-8">
        {/* Search + Filter + Sort */}
        <div className="mb-4 sm:mb-6 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search subscriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 sm:h-10"
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-11 sm:h-10 flex-1 sm:flex-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="h-11 sm:h-10 flex-1 sm:flex-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="name">A–Z</option>
              <option value="date">By Date</option>
              <option value="amount_desc">$ High–Low</option>
              <option value="amount_asc">$ Low–High</option>
            </select>
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
              {searchQuery
                ? "Try a different search term"
                : isGoogleUser
                  ? "We scanned your Gmail — no subscription receipts found. Add manually or try scanning again."
                  : "Add your first subscription to get started"}
            </p>
            {!searchQuery && isGoogleUser && (
              <Button
                variant="secondary"
                className="mt-4"
                onClick={async () => {
                  const { data: { session } } = await (await import("@/integrations/supabase/client")).supabase.auth.getSession()
                  if (!session?.access_token) return
                  // Reset the done flag so the dashboard will re-scan on next load
                  localStorage.removeItem(`ub:gmail_imported:${user?.id}`)
                  localStorage.setItem(`ub:gmail_import_pending:${user?.id}`, "1")
                  window.location.href = "/dashboard"
                }}
              >
                Scan Gmail again
              </Button>
            )}
            {!searchQuery && !isGoogleUser && (
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
              const guardrails = guardrailsMap[sub.id] || { budgetCap: null, trialEndDate: null, pauseBeforePaidRenewal: false }
              const risk = assessRenewalRisk({
                amount: sub.amount,
                currency: sub.currency,
                nextBillingDate: sub.next_billing_date,
                status: sub.status,
                guardrails,
              })
              const riskBadge = risk.level === "danger"
                ? { label: risk.reasons[0] || "At risk", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" }
                : risk.level === "warn"
                  ? { label: risk.reasons[0] || "Renews soon", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" }
                  : null
              const isPendingCancel = pendingCancelIds.has(sub.id)
              return (
                <div
                  key={sub.id}
                  className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <ServiceIcon name={sub.name} className="size-9 shrink-0 mt-0.5" />
                      <Link to={`/subscriptions/${sub.id}`} className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate" title={sub.name}>{sub.name}</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">{sub.category || "Uncategorized"}</p>
                      </Link>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1">
                        <StatusIcon className="size-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{status.label}</span>
                      </div>
                      {/* Source badge */}
                      {sub.source === "gmail" && (
                        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-white/5 dark:text-white/70">
                          Gmail
                        </span>
                      )}
                      {/* Pending cancellation badge — only show if not already cancelled */}
                      {isPendingCancel && sub.status !== "cancelled" && (
                        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          Pending cancellation
                        </span>
                      )}
                      {riskBadge && !isPendingCancel && (
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium truncate max-w-[120px] ${riskBadge.cls}`}>
                          {riskBadge.label}
                        </span>
                      )}
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
                        <Link to={`/subscriptions/${sub.id}`} title="Edit subscription">
                          <RiEditLine className="size-4" />
                        </Link>
                      </Button>
                      <ConfirmInline
                        busy={deleting === sub.id}
                        onConfirm={() => handleDelete(sub.id)}
                        trashLabel="Delete subscription"
                        confirmLabel="Confirm delete"
                        cancelLabel="Keep subscription"
                      />
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

      <SmartImportModal
        open={showSmartImport}
        onClose={() => setShowSmartImport(false)}
        onImported={loadData}
      />
      <SmsImportModal
        open={showSmsImport}
        onClose={() => setShowSmsImport(false)}
        onImported={loadData}
      />
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        trigger="Add more than 10 subscriptions"
      />
    </div>
  )
}