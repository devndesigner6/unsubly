import { useAuth } from "@/lib/auth-context"
import { useAlgorand } from "@/lib/algorand/context"
import { fetchSubscriptions } from "@/lib/supabase-queries"
import { fetchProfile } from "@/lib/supabase-queries"
import { formatCurrency } from "@/lib/currency"
import { shortenAddress, getAddressExplorerUrl } from "@/lib/algorand/constants"
import { Button } from "@/components/Button"
import { Link } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import {
  RiAddLine, RiWalletLine,
  RiCalendarCheckLine, RiAlertLine, RiLoader4Line,
  RiPlayCircleLine,
  RiShieldLine, RiFileChartLine, RiLockLine,
  RiExternalLinkLine, RiRobotLine, RiCheckDoubleLine,
  RiRefreshLine, RiPulseLine, RiTimeLine, RiBrainLine,
  RiMailLine,
} from "@remixicon/react"
import { WalletSelectorModal } from "@/components/algorand/WalletSelectorModal"
import { useState, useEffect, useMemo, useRef } from "react"
import { WALLET_LOGOS, WALLET_LABELS } from "@/lib/algorand/walletLogos"
import { RollingNumber } from "@/components/micro/RollingNumber"
import { usePageTitle } from "@/hooks/usePageTitle"
import { useNFDFull } from "@/hooks/useNFD"
import { findSubscription, getFaviconUrl } from "@/data/subscriptionCatalog"
import { Skeleton } from "@/components/ui/Skeleton"

/** Category colors for the spending heatmap bar */
const CATEGORY_COLORS: Record<string, string> = {
  Entertainment: "bg-violet-500",
  Music: "bg-pink-500",
  Development: "bg-sky-500",
  Design: "bg-indigo-500",
  Productivity: "bg-emerald-500",
  Cloud: "bg-cyan-500",
  Marketing: "bg-orange-500",
  Finance: "bg-lime-500",
  Education: "bg-amber-500",
  Health: "bg-rose-500",
  Other: "bg-zinc-400",
}

/** Overlap groups — services that serve the same purpose */
const OVERLAP_GROUPS: { label: string; members: string[] }[] = [
  { label: "music streaming", members: ["spotify", "apple music", "youtube music", "amazon music", "tidal", "deezer", "gaana", "jiosaavn"] },
  { label: "video streaming", members: ["netflix", "amazon prime", "disney+", "hulu", "hbo max", "max", "paramount+", "peacock", "apple tv+", "hotstar", "jiocinema"] },
  { label: "cloud storage", members: ["icloud+", "icloud", "google one", "dropbox", "onedrive"] },
  { label: "AI assistants", members: ["chatgpt", "claude", "github copilot", "midjourney", "perplexity"] },
  { label: "note-taking", members: ["notion", "evernote", "obsidian"] },
]

/** Get favicon for a subscription by name */
function getSubFavicon(name: string): string | null {
  const entry = findSubscription(name)
  if (entry) return getFaviconUrl(entry.domain)
  return null
}

export default function DashboardPageContent() {
  usePageTitle("Dashboard")
  const { user, isGoogleUser, session } = useAuth()
  const { walletAddress, balance, isConnecting, isLoadingBalance, network, setShowWalletSelector, walletType, disconnectWallet } = useAlgorand()
  const nfdData = useNFDFull(walletAddress)
  const nfdName = nfdData.name
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vaultStats, setVaultStats] = useState<{ total: number; locked: number; killed: number; totalLocked: number; lockedSubIds: Set<string> }>({ total: 0, locked: 0, killed: 0, totalLocked: 0, lockedSubIds: new Set() })
  const [agentActions, setAgentActions] = useState<any[]>([])
  const [agentRunning, setAgentRunning] = useState(false)
  const [agentResult, setAgentResult] = useState<{ released: number; processed?: number; mode?: string; error?: string; onChainErrors?: string[]; alerts_sent?: number } | null>(null)
  const [countdown, setCountdown] = useState<string | null>(null)
  const [gmailImporting, setGmailImporting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchAgentActions() {
    if (!user) return
    const { data } = await supabase
      .from("agent_actions" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)
    if (data) setAgentActions(data as any[])
  }

  /**
   * Run Gmail import for first-time Google users.
   * Triggered 30 seconds after dashboard load if the pending flag is set.
   * Shows a loading toast, then a success/info toast with the count.
   */
  async function runGmailImport() {
    if (!user) return
    const flagKey = `ub:gmail_import_pending:${user.id}`
    if (!localStorage.getItem(flagKey)) return

    // Clear the flag immediately so we never run twice
    localStorage.removeItem(flagKey)

    // Get a fresh session token — context session may not have access_token on first load
    const { data: { session: freshSession } } = await supabase.auth.getSession()
    const accessToken = freshSession?.access_token
    if (!accessToken) {
      console.warn("[dashboard] Gmail import: no access token available")
      return
    }

    setGmailImporting(true)
    const toastId = toast.loading("Scanning your Gmail for subscriptions…", {
      description: "Checking the last 6 months of receipts and billing emails.",
      duration: 60_000,
    })

    try {
      const res = await fetch("/api/gmail-scan", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      })

      const contentType = res.headers.get("content-type") || ""
      if (!contentType.includes("application/json")) {
        toast.dismiss(toastId)
        toast.error("Gmail scan unavailable", { description: "The scan endpoint returned an unexpected response." })
        return
      }

      const data = await res.json()
      if (!res.ok) {
        toast.dismiss(toastId)
        toast.error("Gmail scan failed", { description: data.error || "Unknown error" })
        return
      }

      if (!data.subscriptions?.length) {
        toast.dismiss(toastId)
        toast.info("No subscriptions found in Gmail", {
          description: "We scanned your last 6 months of emails but couldn't detect any subscription receipts.",
          duration: 6000,
        })
        return
      }

      const detected: any[] = data.subscriptions

      // Fetch existing subscriptions to avoid duplicates
      const { data: existing } = await supabase
        .from("subscriptions")
        .select("name")
        .eq("user_id", user.id)

      const existingNames = new Set((existing || []).map((s: any) => s.name.toLowerCase()))
      const toInsert = detected.filter((s) => !existingNames.has(s.name.toLowerCase()))

      if (toInsert.length === 0) {
        toast.dismiss(toastId)
        toast.info("Your subscriptions are already up to date", {
          description: `Found ${detected.length} subscription${detected.length !== 1 ? "s" : ""} in Gmail — all already tracked.`,
          duration: 5000,
        })
        return
      }

      // Insert all new subscriptions
      for (const sub of toInsert) {
        const nextBillingDate = new Date()
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)
        await supabase.from("subscriptions").insert({
          user_id: user.id,
          name: sub.name,
          amount: sub.amount || 0,
          currency: sub.currency || "USD",
          billing_cycle: sub.billing_cycle || "monthly",
          next_billing_date: nextBillingDate.toISOString().split("T")[0],
          status: "active",
          source: "gmail",
          alert_days: 3,
          alert_enabled: true,
        })
      }

      // Refresh subscriptions list
      const refreshed = await fetchSubscriptions(user.id)
      setSubscriptions(refreshed)

      toast.dismiss(toastId)
      toast.success(
        `${toInsert.length} subscription${toInsert.length !== 1 ? "s" : ""} imported from your Google account`,
        {
          description: toInsert.map((s: any) => s.name).join(", "),
          duration: 8000,
          icon: "📬",
        }
      )
      // Mark as done so we never re-import on subsequent logins
      if (user) localStorage.setItem(`ub:gmail_imported:${user.id}`, "1")
    } catch (err) {
      toast.dismiss(toastId)
      console.warn("[dashboard] Gmail import failed:", err)
    } finally {
      setGmailImporting(false)
    }
  }

  async function runAgent() {
    if (!user || agentRunning) return
    setAgentRunning(true)
    setAgentResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error("Not authenticated")

      const res = await fetch("/api/agent-run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Agent run failed")

      setAgentResult({
        released: data.released ?? 0,
        processed: data.actions?.length ?? 0,
        mode: data.agent_mode,
        onChainErrors: data.errors?.length ? data.errors : undefined,
        alerts_sent: data.alerts_sent ?? 0,
      })
      await fetchAgentActions()
    } catch (err: any) {
      setAgentResult({ released: 0, error: err.message })
    } finally {
      setAgentRunning(false)
    }
  }

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const [subs, prof] = await Promise.all([
          fetchSubscriptions(user!.id),
          fetchProfile(user!.id),
        ])
        setSubscriptions(subs)
        setProfile(prof)

        const { data: vaults } = await supabase
          .from("escrow_vaults" as any)
          .select("status, amount, subscription_id")
          .eq("user_id", user!.id)
        if (vaults) {
          const v = vaults as any[]
          setVaultStats({
            total: v.length,
            locked: v.filter((x) => x.status === "locked").length,
            killed: v.filter((x) => x.status === "killed").length,
            totalLocked: v.filter((x) => x.status === "locked").reduce((s, x) => s + Number(x.amount), 0),
            lockedSubIds: new Set(v.filter((x) => x.status === "locked").map((x) => x.subscription_id).filter(Boolean)),
          })
        }

        // Silently advance any past-due billing dates so calendar + metrics stay current
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) {
            const advRes = await fetch("/api/advance-billing", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
            })
            const advData = await advRes.json().catch(() => ({}))
            if (advRes.ok && advData.advanced > 0) {
              const refreshed = await fetchSubscriptions(user!.id)
              setSubscriptions(refreshed)
            } else if (!advRes.ok) {
              // Surface the failure so users know dates may be stale.
              toast.error(advData.error || `Couldn't refresh billing dates (HTTP ${advRes.status})`, {
                description: "Calendar dates may be out of date. Try refreshing.",
              })
            }
          }
        } catch (e: any) {
          toast.error("Couldn't reach the billing service", {
            description: e?.message || "Calendar may show stale dates.",
          })
        }

        // Fetch autonomous agent actions
        await fetchAgentActions()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  // Gmail auto-import: runs 30 seconds after dashboard loads for first-time Google users.
  // Uses a ref to ensure it only fires once per mount even if user/isGoogleUser change.
  const gmailImportRan = useRef(false)
  useEffect(() => {
    if (!user || !isGoogleUser || gmailImportRan.current) return
    const flagKey = `ub:gmail_import_pending:${user.id}`
    if (!localStorage.getItem(flagKey)) return

    gmailImportRan.current = true
    const timer = setTimeout(() => {
      runGmailImport()
    }, 30_000)
    return () => clearTimeout(timer)
  }, [user, isGoogleUser])

  const currency = profile?.currency || "USD"
  const userName = profile?.name?.split(" ")[0] || user?.user_metadata?.full_name?.split(" ")[0] || "there"

  // Live countdown to next release — ticks every minute
  useEffect(() => {
    function updateCountdown() {
      const todayStr = new Date().toISOString().slice(0, 10)
      const upcoming = subscriptions
        .filter((s) => s?.status === "active" && s?.next_billing_date && s.next_billing_date > todayStr)
        .sort((a, b) => new Date(a.next_billing_date).getTime() - new Date(b.next_billing_date).getTime())
      const next = upcoming[0]
      if (!next) { setCountdown(null); return }
      const diff = new Date(next.next_billing_date).getTime() - Date.now()
      if (diff <= 0) { setCountdown("Due now"); return }
      const totalHrs = Math.floor(diff / 3_600_000)
      const mins = Math.floor((diff % 3_600_000) / 60_000)
      if (totalHrs >= 24) {
        const days = Math.floor(totalHrs / 24)
        const hrs = totalHrs % 24
        setCountdown(`Next payment in ${days}d ${hrs}h`)
      } else {
        setCountdown(`Next payment in ${totalHrs}h ${mins}m`)
      }
    }
    updateCountdown()
    const t = setInterval(updateCountdown, 60_000)
    return () => clearInterval(t)
  }, [subscriptions])
  const metrics = useMemo(() => {
    const active = subscriptions.filter((s) => s.status === "active")
    const monthly = subscriptions.reduce((sum, sub) => {
      const amt = sub.amount || 0
      if (sub.billing_cycle === "monthly") return sum + amt
      if (sub.billing_cycle === "yearly") return sum + amt / 12
      if (sub.billing_cycle === "quarterly") return sum + amt / 3
      if (sub.billing_cycle === "weekly") return sum + amt * 4.33
      return sum
    }, 0)

    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const upcomingSubs = subscriptions.filter((s) => {
      if (s.status !== "active" && s.status !== "trial") return false
      const billing = new Date(s.next_billing_date)
      billing.setHours(0, 0, 0, 0)
      const days = Math.ceil((billing.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return days >= 0 && days <= 7
    }).sort((a, b) => new Date(a.next_billing_date).getTime() - new Date(b.next_billing_date).getTime())

    return { total: subscriptions.length, active: active.length, monthly, upcoming: upcomingSubs.length, upcomingSubs }
  }, [subscriptions])

  const agentStats = useMemo(() => {
    try {
      const isOnChain = agentActions.some((a: any) => 
        a?.payload?.mode === "on-chain" || 
        a?.payload?.mode === "openclaw-on-chain" ||
        a?.status === "success"
      )
      const lastRunRaw = agentActions[0]?.created_at
      const lastRunAt = lastRunRaw ? new Date(lastRunRaw) : null
      const onChainCount = agentActions.filter((a: any) => a?.payload?.mode === "on-chain").length
      const today = new Date(); today.setHours(0,0,0,0)
      const dueToday = subscriptions.filter((s) => s?.status === "active" && s?.next_billing_date && new Date(s.next_billing_date) <= today).length
      const upcomingSorted = subscriptions
        .filter((s) => s?.status === "active" && s?.next_billing_date && new Date(s.next_billing_date) > today)
        .sort((a, b) => new Date(a.next_billing_date).getTime() - new Date(b.next_billing_date).getTime())
      const nextSub = upcomingSorted[0]
      const nextHrs = nextSub
        ? Math.max(1, Math.round((new Date(nextSub.next_billing_date).getTime() - Date.now()) / 3_600_000))
        : null
      const agentAddrRaw = agentActions.find((a: any) => a?.payload?.agent_address)?.payload?.agent_address
        ?? (import.meta.env.VITE_AGENT_WALLET_ADDRESS as string | undefined)
      const agentAddr = typeof agentAddrRaw === "string" && agentAddrRaw.length >= 12 ? agentAddrRaw : null
      return { isOnChain, lastRunAt, onChainCount, dueToday, nextSub, nextHrs, agentAddr }
    } catch {
      return { isOnChain: false, lastRunAt: null, onChainCount: 0, dueToday: 0, nextSub: null, nextHrs: null, agentAddr: null }
    }
  }, [agentActions, subscriptions])

  function getGreeting() {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  }

  // Refresh data without full page reload
  async function handleRefresh() {
    if (!user || refreshing) return
    setRefreshing(true)
    try {
      const [subs, prof] = await Promise.all([
        fetchSubscriptions(user.id),
        fetchProfile(user.id),
      ])
      setSubscriptions(subs)
      setProfile(prof)
      const { data: vaults } = await supabase
        .from("escrow_vaults" as any)
        .select("status, amount, subscription_id")
        .eq("user_id", user.id)
      if (vaults) {
        const v = vaults as any[]
        setVaultStats({
          total: v.length,
          locked: v.filter((x) => x.status === "locked").length,
          killed: v.filter((x) => x.status === "killed").length,
          totalLocked: v.filter((x) => x.status === "locked").reduce((s, x) => s + Number(x.amount), 0),
          lockedSubIds: new Set(v.filter((x) => x.status === "locked").map((x) => x.subscription_id).filter(Boolean)),
        })
      }
      await fetchAgentActions()
    } catch { /* silent */ } finally {
      setRefreshing(false)
    }
  }

  // Detect subscription overlaps (same category, multiple services)
  const overlaps = useMemo(() => {
    if (subscriptions.length < 2) return []
    const activeNames = subscriptions
      .filter((s) => s.status === "active" || s.status === "trial")
      .map((s) => ({ name: s.name.toLowerCase(), amount: s.amount || 0, currency: s.currency }))

    const found: { label: string; services: string[]; totalAmount: number }[] = []
    for (const group of OVERLAP_GROUPS) {
      const matches = activeNames.filter((s) => group.members.some((m) => s.name.includes(m)))
      if (matches.length >= 2) {
        found.push({
          label: group.label,
          services: matches.map((m) => m.name),
          totalAmount: matches.reduce((sum, m) => sum + m.amount, 0),
        })
      }
    }
    return found
  }, [subscriptions])

  // Spending heatmap segments
  const heatmapSegments = useMemo(() => {
    const active = subscriptions.filter((s) => s.status === "active" && s.amount > 0)
    if (active.length === 0) return []
    const total = active.reduce((sum, s) => sum + (s.amount || 0), 0)
    return active
      .sort((a, b) => (b.amount || 0) - (a.amount || 0))
      .map((s) => ({
        name: s.name,
        category: s.category || "Other",
        pct: ((s.amount || 0) / total) * 100,
        amount: s.amount,
      }))
  }, [subscriptions])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Skeleton hero */}
        <div className="border-b border-border bg-muted/50 dark:bg-white/[0.03] px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="mx-auto max-w-7xl p-3 sm:p-6 lg:p-8">
          {/* Skeleton stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <Skeleton className="h-3 w-20 mb-3" />
                <Skeleton className="h-7 w-16" />
              </div>
            ))}
          </div>
          {/* Skeleton heatmap */}
          <Skeleton className="mt-4 h-2 w-full rounded-full" />
          {/* Skeleton cards row */}
          <div className="mt-6 grid gap-5 lg:grid-cols-5">
            <Skeleton className="lg:col-span-3 h-[300px] rounded-[32px]" />
            <Skeleton className="lg:col-span-2 h-[300px] rounded-3xl" />
          </div>
          {/* Skeleton recent list */}
          <div className="mt-6 rounded-2xl border border-border bg-card">
            <div className="border-b border-border p-5">
              <Skeleton className="h-5 w-40" />
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 p-4 border-b border-border last:border-0">
                <Skeleton className="size-6 rounded" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-28 mb-1.5" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-16" />
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
          <Button variant="secondary" className="mt-4" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <WalletSelectorModal />
      {/* Hero Welcome */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground sm:text-sm">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl">
                {getGreeting()}, {userName}!
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground sm:mt-2 sm:text-base">
                {metrics.upcoming > 0
                  ? `You have ${metrics.upcoming} payment${metrics.upcoming > 1 ? "s" : ""} due this week`
                  : "No payments due this week, you're all caught up!"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Button asChild variant="secondary" className="text-sm sm:text-base">
                <Link to="/escrow-vaults">
                  <RiShieldLine className="mr-1.5 size-4 sm:mr-2" />
                  Escrow Vaults
                </Link>
              </Button>
              <Button asChild variant="secondary" className="text-sm sm:text-base">
                <Link to="/onchain-resume">
                  <RiFileChartLine className="mr-1.5 size-4 sm:mr-2" />
                  On-Chain Resume
                </Link>
              </Button>
              <Button asChild className="text-sm sm:text-base" data-tour="add-subscription">
                <Link to="/subscriptions/new">
                  <RiAddLine className="mr-1.5 size-4 sm:mr-2" />
                  Add Subscription
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 sm:mt-6 sm:gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 text-xs text-foreground sm:gap-2 sm:px-4 sm:py-2 sm:text-sm">
              <RiWalletLine className="size-3.5 sm:size-4" />
              <span className="font-medium">{formatCurrency(metrics.monthly, currency)}/mo</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 text-xs text-foreground sm:gap-2 sm:px-4 sm:py-2 sm:text-sm">
              <RiPlayCircleLine className="size-3.5 sm:size-4" />
              <span className="font-medium">{metrics.active} Active</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 text-xs text-foreground sm:gap-2 sm:px-4 sm:py-2 sm:text-sm">
              <RiCalendarCheckLine className="size-3.5 sm:size-4" />
              <span className="font-medium">{metrics.upcoming} due this week</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-3 sm:p-6 lg:p-8">
        {/* Stats Cards */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted-foreground">Overview</h2>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            title="Sync data"
          >
            <RiRefreshLine className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Syncing..." : "Sync"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[
            { label: "Total", fullLabel: "Total Subscriptions", value: metrics.total },
            { label: "Active", fullLabel: "Active", value: metrics.active },
            { label: "Monthly", fullLabel: "Monthly Spending", value: formatCurrency(metrics.monthly, currency) },
            { label: "Yearly", fullLabel: "Yearly Projection", value: formatCurrency(metrics.monthly * 12, currency) },
          ].map((card) => (
            <div key={card.fullLabel} className="rounded-xl border border-border bg-card p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">
                <span className="sm:hidden">{card.label}</span>
                <span className="hidden sm:inline">{card.fullLabel}</span>
              </p>
              <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-foreground">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Subscription Overlap Insight */}
        {overlaps.length > 0 && (
          <div className="mt-4 rounded-lg border border-border bg-card px-4 py-3">
            {overlaps.map((o, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Overlap:</span> You're paying for {o.services.length} {o.label} services ({formatCurrency(o.totalAmount, currency)}/mo combined)
              </p>
            ))}
          </div>
        )}

        {/* Upcoming Renewals Banner */}
        {subscriptions.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 sm:p-12 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <RiAddLine className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No subscriptions yet</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Add your first subscription to start tracking spending, get renewal alerts, and let the agent manage payments for you.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Button asChild>
                <Link to="/subscriptions/new">
                  <RiAddLine className="mr-2 size-4" />
                  Add Subscription
                </Link>
              </Button>
              {isGoogleUser && (
                <Button variant="secondary" onClick={runGmailImport} disabled={gmailImporting}>
                  {gmailImporting ? <RiLoader4Line className="mr-2 size-4 animate-spin" /> : <RiMailLine className="mr-2 size-4" />}
                  Import from Gmail
                </Button>
              )}
            </div>
          </div>
        ) : (
        <>
        {metrics.upcomingSubs.length > 0 && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5 dark:border-amber-800 dark:bg-amber-900/20">
            <div className="flex items-center gap-2 mb-3">
              <RiAlertLine className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {metrics.upcomingSubs.length === 1 ? "1 subscription" : `${metrics.upcomingSubs.length} subscriptions`} renewing within 7 days
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {metrics.upcomingSubs.map((sub) => {
                const billing = new Date(sub.next_billing_date)
                billing.setHours(0, 0, 0, 0)
                const now = new Date()
                now.setHours(0, 0, 0, 0)
                const daysLeft = Math.ceil((billing.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                const favicon = getSubFavicon(sub.name)
                return (
                  <Link
                    key={sub.id}
                    to={`/subscriptions/${sub.id}`}
                    className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs shadow-sm transition-colors hover:border-amber-400 dark:border-amber-700 dark:bg-amber-900/30"
                  >
                    {favicon && (
                      <img src={favicon} alt="" className="size-4 rounded object-contain shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                    )}
                    <span className="font-medium text-gray-900 dark:text-white/90">{sub.name}</span>
                    <span className="text-gray-500 dark:text-white/50">
                      {formatCurrency(sub.amount, currency)} · {daysLeft === 0 ? "Today" : daysLeft === 1 ? "Tomorrow" : `in ${daysLeft}d`}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Vault at risk banner — subscription due today with NO locked vault */}
        {(() => {
          const today = new Date(); today.setHours(0, 0, 0, 0)
          const atRisk = subscriptions.filter((s) => {
            if (s.status !== "active") return false
            const billing = new Date(s.next_billing_date); billing.setHours(0, 0, 0, 0)
            if (billing > today) return false
            // Only show if there's no locked vault for this subscription
            return !vaultStats.lockedSubIds.has(s.id)
          })
          if (atRisk.length === 0) return null
          return (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-900/20">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <RiAlertLine className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    {atRisk.length === 1
                      ? `${atRisk[0].name} is due today — no vault locked`
                      : `${atRisk.length} subscriptions due today — no vaults locked`}
                  </p>
                </div>
                <Link
                  to="/escrow-vaults"
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                >
                  Create vault →
                </Link>
              </div>
            </div>
          )
        })()}

        {/* Algorand (60%) + Agent (40%), side-by-side */}        <div className="mt-6 grid gap-5 lg:grid-cols-5">

          {/* === Card 1: Algorand wallet, Premium Banking style (60%) === */}
          {(() => {
            const activeLogo = walletType ? WALLET_LOGOS[walletType] : null
            const activeLabel = walletType ? WALLET_LABELS[walletType] : null
            return (
              <div className="lg:col-span-3 relative" data-tour="algorand-total">
                <div
                  className="relative overflow-hidden rounded-[24px] sm:rounded-[32px] bg-black p-4 sm:p-6 ring-1 ring-emerald-500/20 flex flex-col min-h-[260px] sm:min-h-[300px]"
                >
                  {/* Green metallic blob, top */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -top-2 -right-2 h-[58%] w-[92%]"
                    style={{
                      background:
                        "radial-gradient(ellipse 75% 95% at 70% 25%, #ecfccb 0%, #bef264 12%, #84cc16 32%, #22c55e 55%, #166534 80%, #052e16 100%)",
                      borderBottomLeftRadius: "65% 90%",
                      borderBottomRightRadius: "20% 35%",
                      filter: "saturate(1.1)",
                    }}
                  />
                  {/* Top-left specular highlight */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute left-10 top-6 h-12 w-12 rounded-full opacity-70"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 60%)",
                    }}
                  />
                  {/* Bottom green accent strip */}
                  <div className="pointer-events-none absolute inset-x-4 bottom-2 h-[3px] rounded-full bg-gradient-to-r from-lime-300 via-emerald-400 to-lime-300 opacity-90 blur-[0.5px]" />

                  {/* Top row: Bauhaus-style wallets icon + balance */}
                  <div className="relative flex items-start justify-between gap-4">
                    {/* Bauhaus-style blue tile with 3 wallet logos peeking out the top */}
                    <div className="relative shrink-0">
                      {/* Peeking logos behind the blue card */}
                      <div className="absolute -top-2.5 left-1/2 z-0 flex -translate-x-1/2 gap-0">
                        <div className="size-7 -mr-2 -rotate-12 rounded-md bg-white p-0.5 shadow-md ring-1 ring-black/10">
                          <img src={WALLET_LOGOS.defly} alt="Defly" className="size-full rounded object-contain" />
                        </div>
                        <div className={`size-8 z-10 rounded-md bg-white p-0.5 shadow-md ring-1 ring-black/10 ${activeLogo === WALLET_LOGOS.pera ? "ring-2 ring-emerald-400" : ""}`}>
                          <img src={WALLET_LOGOS.pera} alt="Pera" className="size-full rounded object-contain" />
                        </div>
                        <div className="size-7 -ml-2 rotate-12 rounded-md bg-white p-0.5 shadow-md ring-1 ring-black/10">
                          <img src={WALLET_LOGOS.lute} alt="Lute" className="size-full rounded object-contain" />
                        </div>
                      </div>
                      {/* Blue front card */}
                      <div className="relative z-10 flex h-[58px] w-[58px] flex-col items-center justify-end rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 pb-1.5 shadow-[0_6px_16px_-4px_rgba(37,99,235,0.6)] ring-1 ring-blue-400/50">
                        <div className="rounded-md bg-black/30 px-1.5 py-[1px] text-[8px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
                          {walletAddress ? "Linked" : "Wallets"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-baseline justify-end gap-1.5 text-white drop-shadow-sm">
                        <span className="text-3xl sm:text-4xl font-light tracking-tight tabular-nums">
                          {isLoadingBalance ? "…" : <RollingNumber value={balance} decimals={3} />}
                        </span>
                        <span className="text-sm font-medium opacity-90">ALGO</span>
                      </div>
                      <div className="mt-1 text-[10px] font-semibold tracking-[0.18em] uppercase text-white/85">
                        Total Balance
                      </div>
                    </div>
                  </div>

                  {/* Spacer to push content to dark zone */}
                  <div className="flex-1 min-h-[20px]" />

                  {/* Mid section in dark zone */}
                  <div className="relative">
                    <div className="text-xl sm:text-[22px] font-bold text-white leading-tight">
                      {walletAddress ? (activeLabel ?? "Algorand Wallet") : "No wallet connected"}
                    </div>
                    <div className="mt-0.5 text-sm text-white/55">
                      {walletAddress
                        ? <span className="flex items-center gap-1.5">
                            {network === "mainnet" ? "MainNet" : "TestNet"} · {nfdName || shortenAddress(walletAddress)}
                            {nfdData.verified && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded-full">
                                ✓ NFD
                              </span>
                            )}
                          </span>
                        : "Connect Pera, Defly or Lute"}
                    </div>

                    {walletAddress && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/85 ring-1 ring-white/10 backdrop-blur">
                          {vaultStats.total} vault{vaultStats.total !== 1 ? "s" : ""}
                        </span>
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/85 ring-1 ring-white/10 backdrop-blur">
                          {vaultStats.totalLocked.toFixed(2)} ALGO locked
                        </span>
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/85 ring-1 ring-white/10 backdrop-blur">
                          {vaultStats.killed} kill switch{vaultStats.killed !== 1 ? "es" : ""}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bottom row: action + toggle (toggle only when connected) */}
                  <div className="relative mt-5 flex items-end justify-between">
                    {walletAddress ? (
                      <a
                        href={getAddressExplorerUrl(walletAddress, network)}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/15 transition-colors"
                      >
                        View on Explorer <RiExternalLinkLine className="size-3.5" />
                      </a>
                    ) : (
                      <button
                        onClick={() => setShowWalletSelector(true)}
                        disabled={isConnecting}
                        data-tour="connect-wallet"
                        className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 transition-colors disabled:opacity-60"
                      >
                        {isConnecting ? "Connecting…" : "Connect wallet"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (walletAddress) {
                          void disconnectWallet()
                        } else {
                          setShowWalletSelector(true)
                        }
                      }}
                      disabled={isConnecting}
                      aria-label={walletAddress ? "Disconnect wallet" : "Connect wallet"}
                      title={walletAddress ? "Click to disconnect wallet" : "Click to connect wallet"}
                      className={[
                        "relative h-6 w-11 rounded-full p-0.5 transition-colors ring-1 disabled:opacity-60",
                        walletAddress
                          ? "bg-emerald-400 ring-emerald-300/60"
                          : "bg-red-500 ring-red-400/60",
                      ].join(" ")}
                    >
                      <div
                        className={[
                          "size-5 rounded-full bg-white shadow transition-transform",
                          walletAddress ? "translate-x-5" : "translate-x-0",
                        ].join(" ")}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* === Card 2: Autonomous Agent — Red/Black mockup === */}
          {(() => {
            const stamp = agentStats.lastRunAt ?? new Date()
            const tickHour = stamp.getHours()
            const tickMin = stamp.getMinutes().toString().padStart(2, "0")
            const tickAmPm = tickHour >= 12 ? "PM" : "AM"
            const tickHr12 = ((tickHour + 11) % 12) + 1
            const lastAction = agentActions[0]
            const isConnected = !!walletAddress

            return (
              <div className="lg:col-span-2 relative rounded-3xl overflow-hidden flex flex-col"
                style={{
                  background: "radial-gradient(ellipse 120% 80% at 15% 10%, #6b0f0f 0%, #2d0505 45%, #080808 100%)",
                  minHeight: "300px",
                  aspectRatio: "unset",
                }}>
                {/* Subtle red glow top-left */}
                <div aria-hidden className="pointer-events-none absolute top-0 left-0 w-40 h-40 rounded-full opacity-30"
                  style={{ background: "radial-gradient(circle, #dc2626 0%, transparent 70%)", transform: "translate(-20%, -20%)" }} />
                {/* Bottom red line */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-red-700/60 to-transparent" />

                <div className="relative flex flex-col flex-1 p-5 sm:p-6">

                  {/* ── DISCONNECTED STATE ── */}
                  {!isConnected && (
                    <div className="flex flex-col items-center justify-center flex-1 text-center py-4">
                      {/* Actual logo — no filter, use dark version on dark bg */}
                      <div className="size-16 rounded-2xl overflow-hidden bg-black/40 ring-1 ring-white/10 flex items-center justify-center mb-4">
                        <img src="/openclaw-dark.svg" alt="OpenClaw" className="size-12 object-contain" />
                      </div>
                      <h2 className="text-lg font-bold text-white">OpenClaw Agent</h2>
                      <p className="mt-2 text-sm text-white/60 max-w-[200px] leading-relaxed">
                        Watches your vaults every 5 minutes and releases payments autonomously on billing day.
                      </p>
                      <button
                        onClick={() => setShowWalletSelector(true)}
                        className="mt-5 rounded-full border border-white/20 bg-white/10 px-5 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
                      >
                        Connect wallet to activate
                      </button>
                    </div>
                  )}

                  {/* ── CONNECTED STATE ── */}
                  {isConnected && (
                    <>
                      {/* Top row: logo + tick */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="size-10 rounded-xl overflow-hidden bg-black/40 ring-1 ring-white/10 flex items-center justify-center">
                          <img src="/openclaw-dark.svg" alt="OpenClaw" className="size-7 object-contain" />
                        </div>
                        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 text-center">
                          <div className="bg-white/10 px-2.5 py-0.5 text-[8px] font-bold tracking-wider text-white/60">TICK</div>
                          <div className="px-2.5 py-0.5">
                            <div className="text-sm font-bold leading-tight text-white">{tickHr12}:{tickMin}</div>
                            <div className="text-[8px] leading-tight text-white/40">{tickAmPm}</div>
                          </div>
                        </div>
                      </div>

                      {/* Title */}
                      <h2 className="text-xl font-bold text-white leading-tight">Autonomous Agent</h2>
                      <p className="mt-0.5 text-xs text-white/50">
                        <span className="text-white/70">{agentStats.isOnChain ? "On-chain" : "Simulation"}</span>
                        <span className="mx-1 text-white/20">·</span>
                        {agentStats.lastRunAt ? `last tick ${agentStats.lastRunAt.toLocaleTimeString(undefined, {hour: "2-digit", minute: "2-digit"})}` : "idle"}
                      </p>

                      {/* Pills */}
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          agentStats.isOnChain ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
                        }`}>
                          <span className={`size-1.5 rounded-full ${agentStats.isOnChain ? "bg-emerald-400" : "bg-amber-400"}`} />
                          {agentStats.isOnChain ? "Live" : "Simulation"}
                        </span>
                        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/60">
                          {agentStats.onChainCount} on-chain
                        </span>
                        {lastAction?.payload?.subscription_name && (
                          <span className="max-w-[140px] truncate rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/60">
                            last: {lastAction.payload.subscription_name}
                          </span>
                        )}
                      </div>

                      {/* Due + countdown row */}
                      <div className="mt-4 flex items-center justify-between">
                        <div>
                          <span className={`text-xl font-bold ${agentStats.dueToday > 0 ? "text-amber-400" : "text-white"}`}>
                            {agentStats.dueToday}
                          </span>
                          <span className="ml-1 text-xs text-white/40">due now</span>
                        </div>
                        <div className="text-right">
                          {countdown ? (
                            <>
                              <p className="text-xs font-semibold text-white">{countdown}</p>
                              {agentStats.nextSub && <p className="text-[10px] text-white/40 truncate max-w-[110px]">{agentStats.nextSub.name}</p>}
                            </>
                          ) : agentStats.nextSub ? (
                            <>
                              <p className="text-xs font-medium text-white">
                                {agentStats.nextHrs != null && agentStats.nextHrs < 24 ? `Next in ${agentStats.nextHrs}h` : agentStats.nextHrs != null ? `Next in ${Math.round(agentStats.nextHrs / 24)}d` : "No upcoming"}
                              </p>
                              <p className="text-[10px] text-white/40 truncate max-w-[110px]">{agentStats.nextSub.name}</p>
                            </>
                          ) : (
                            <p className="text-xs text-white/30">no upcoming</p>
                          )}
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="mt-4 border-t border-white/10" />

                      {/* Trigger button */}
                      <div className="mt-4">
                        <button
                          onClick={runAgent}
                          disabled={agentRunning}
                          className="block w-full rounded-full bg-white px-4 py-2.5 text-center text-sm font-semibold text-black transition-transform hover:scale-[1.02] active:scale-[0.99] disabled:opacity-60"
                        >
                          {agentRunning ? "Checking…" : "Check vaults now"}
                        </button>
                        <p className="mt-1.5 text-center text-[10px] text-white/35">Agent checks automatically every 30 min</p>
                      </div>

                      {/* Result feedback */}
                      {agentResult && (
                        <div className={`mt-2.5 flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${
                          agentResult.error ? "bg-red-500/20 text-red-300"
                            : agentResult.mode === "db-only" && (agentResult.processed ?? 0) > 0 ? "bg-amber-500/20 text-amber-300"
                            : "bg-emerald-500/20 text-emerald-300"
                        }`}>
                          {agentResult.error
                            ? <><RiAlertLine className="size-3.5 mt-0.5 shrink-0" /><span>{agentResult.error.toLowerCase().includes("mnemonic") || agentResult.error.toLowerCase().includes("wallet") ? "Agent wallet not configured — add AGENT_WALLET_MNEMONIC on Vercel." : agentResult.error}</span></>
                            : agentResult.mode === "db-only" && (agentResult.processed ?? 0) > 0
                              ? <><RiAlertLine className="size-3.5 mt-0.5 shrink-0" /><span>Simulation only, {agentResult.processed} vault{agentResult.processed !== 1 ? "s" : ""} found.</span></>
                              : agentResult.released === 0
                                ? (agentResult.alerts_sent && agentResult.alerts_sent > 0)
                                  ? <><RiCheckDoubleLine className="size-3.5 mt-0.5 shrink-0" /><span>Sent {agentResult.alerts_sent} alert{agentResult.alerts_sent !== 1 ? "s" : ""}. Waiting for your decision on Telegram.</span></>
                                  : <><RiCheckDoubleLine className="size-3.5 mt-0.5 shrink-0" /><span>No locked vaults due.</span></>
                                : <><RiCheckDoubleLine className="size-3.5 mt-0.5 shrink-0" /><span>Released {agentResult.released} vault{agentResult.released !== 1 ? "s" : ""} on-chain.</span></>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })()}
        </div>


        {/* Recent Subscriptions */}
        <div className="mt-6 rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h2 className="font-semibold text-foreground">Recent Subscriptions</h2>
            <Link to="/subscriptions" className="text-sm font-medium text-primary hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-border">
            {subscriptions.length === 0 ? (
              <div className="p-8 text-center">
                <RiAddLine className="mx-auto mb-3 size-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
                <Button asChild className="mt-4">
                  <Link to="/subscriptions/new">
                    <RiAddLine className="mr-2 size-4" />
                    Add your first subscription
                  </Link>
                </Button>
              </div>
            ) : (
              subscriptions.slice(0, 5).map((sub) => {
                const favicon = getSubFavicon(sub.name)
                const now = new Date(); now.setHours(0,0,0,0)
                const billing = new Date(sub.next_billing_date); billing.setHours(0,0,0,0)
                const diffDays = Math.ceil((billing.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                const dueLabel = diffDays < 0 ? "Overdue" : diffDays === 0 ? "Today" : diffDays === 1 ? "Tomorrow" : `in ${diffDays}d`
                const statusDotColor = sub.status === "active" ? "bg-emerald-500" : sub.status === "trial" ? "bg-blue-500" : sub.status === "paused" ? "bg-amber-500" : "bg-red-500"
                return (
                <Link
                  key={sub.id}
                  to={`/subscriptions/${sub.id}`}
                  className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/50 active:bg-muted"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {favicon ? (
                      <img src={favicon} alt="" className="size-6 rounded object-contain shrink-0 bg-background border border-border p-0.5" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                    ) : (
                      <div className="size-6 rounded bg-muted shrink-0 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-muted-foreground">{sub.name?.charAt(0)?.toUpperCase()}</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`size-2 rounded-full shrink-0 ${statusDotColor}`} />
                        <p className="truncate font-medium text-foreground">{sub.name}</p>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{sub.category || "Uncategorized"} · {sub.billing_cycle}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-foreground">
                      {formatCurrency(sub.amount, sub.currency || currency)}
                    </p>
                    <p className={`text-xs ${diffDays <= 1 ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                      {dueLabel}
                    </p>
                  </div>
                </Link>
                )
              })
            )}
          </div>
        </div>
        </>
        )}
      </div>

      {/* Mobile FAB — fixed bottom-right, only on small screens */}
      <MobileFAB />
    </div>
  )
}

function MobileFAB() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2 md:hidden">
      {open && (
        <>
          <Link
            to="/escrow-vaults"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-md"
          >
            <RiShieldLine className="size-4" />
            Create Vault
          </Link>
          <Link
            to="/subscriptions/new"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-md"
          >
            <RiAddLine className="size-4" />
            Add Subscription
          </Link>
        </>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex size-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform active:scale-95"
        aria-label="Quick actions"
      >
        <span className={`text-xl font-light transition-transform duration-200 ${open ? "rotate-45" : "rotate-0"}`}>+</span>
      </button>
    </div>
  )
}