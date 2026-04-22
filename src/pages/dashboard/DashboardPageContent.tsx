import { useAuth } from "@/lib/auth-context"
import { useAlgorand } from "@/lib/algorand/context"
import { fetchSubscriptions } from "@/lib/supabase-queries"
import { fetchProfile } from "@/lib/supabase-queries"
import { formatCurrency } from "@/lib/currency"
import { shortenAddress, getAddressExplorerUrl, getLoraTransactionUrl } from "@/lib/algorand/constants"
import { Button } from "@/components/Button"
import { Link } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import {
  RiAddLine, RiWalletLine, RiEditLine,
  RiCalendarCheckLine, RiAlertLine, RiLoader4Line,
  RiPlayCircleLine,
  RiShieldLine, RiFileChartLine, RiLockLine,
  RiExternalLinkLine, RiRobotLine, RiCheckDoubleLine,
  RiRefreshLine, RiPulseLine, RiTimeLine, RiBrainLine,
} from "@remixicon/react"
import { WalletSelectorModal } from "@/components/algorand/WalletSelectorModal"
import { useState, useEffect, useMemo } from "react"
import agentLogoUrl from "@assets/32716952a37bb6ea6d8b0143ec5735c2_1776859681399.png"
import { WALLET_LOGOS, WALLET_LABELS } from "@/lib/algorand/walletLogos"

export default function DashboardPageContent() {
  const { user } = useAuth()
  const { walletAddress, balance, isConnecting, isLoadingBalance, network, setShowWalletSelector, walletType } = useAlgorand()
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vaultStats, setVaultStats] = useState({ total: 0, locked: 0, killed: 0, totalLocked: 0 })
  const [recentPayments, setRecentPayments] = useState<any[]>([])
  const [agentActions, setAgentActions] = useState<any[]>([])
  const [agentRunning, setAgentRunning] = useState(false)
  const [agentResult, setAgentResult] = useState<{ released: number; processed?: number; mode?: string; error?: string; onChainErrors?: string[] } | null>(null)
  const [showAllAgentActions, setShowAllAgentActions] = useState(false)

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
          .select("status, amount")
          .eq("user_id", user!.id)
        if (vaults) {
          const v = vaults as any[]
          setVaultStats({
            total: v.length,
            locked: v.filter((x) => x.status === "locked").length,
            killed: v.filter((x) => x.status === "killed").length,
            totalLocked: v.filter((x) => x.status === "locked").reduce((s, x) => s + Number(x.amount), 0),
          })
        }

        const { data: payments } = await supabase
          .from("onchain_payments" as any)
          .select("*")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(3)
        if (payments) setRecentPayments(payments as any[])

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

  const currency = profile?.currency || "USD"
  const userName = profile?.name?.split(" ")[0] || user?.user_metadata?.full_name?.split(" ")[0] || "there"

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
      const isOnChain = agentActions.some((a: any) => a?.payload?.mode === "on-chain")
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <RiLoader4Line className="size-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
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
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800">
        <div className="absolute inset-0 bg-grid-white/10" />
        <div className="relative mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-white">
              <p className="text-xs font-medium text-blue-200 sm:text-sm">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl lg:text-4xl">
                {getGreeting()}, {userName}!
              </h1>
              <p className="mt-1.5 text-sm text-blue-100 sm:mt-2 sm:text-base">
                {metrics.upcoming > 0
                  ? `You have ${metrics.upcoming} payment${metrics.upcoming > 1 ? "s" : ""} due this week`
                  : "No payments due this week — you're all caught up!"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Button asChild variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-white/20 text-sm sm:text-base">
                <Link to="/escrow-vaults">
                  <RiShieldLine className="mr-1.5 size-4 sm:mr-2" />
                  Escrow Vaults
                </Link>
              </Button>
              <Button asChild variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-white/20 text-sm sm:text-base">
                <Link to="/onchain-resume">
                  <RiFileChartLine className="mr-1.5 size-4 sm:mr-2" />
                  On-Chain Resume
                </Link>
              </Button>
              <Button asChild className="bg-white text-blue-700 hover:bg-blue-50 shadow-lg text-sm sm:text-base" data-tour="add-subscription">
                <Link to="/subscriptions/new">
                  <RiAddLine className="mr-1.5 size-4 sm:mr-2" />
                  Add Subscription
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 sm:mt-6 sm:gap-3">
            <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs text-white backdrop-blur-sm sm:gap-2 sm:px-4 sm:py-2 sm:text-sm">
              <RiWalletLine className="size-3.5 sm:size-4" />
              <span className="font-medium">{formatCurrency(metrics.monthly, currency)}/mo</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs text-white backdrop-blur-sm sm:gap-2 sm:px-4 sm:py-2 sm:text-sm">
              <RiPlayCircleLine className="size-3.5 sm:size-4" />
              <span className="font-medium">{metrics.active} Active</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs text-white backdrop-blur-sm sm:gap-2 sm:px-4 sm:py-2 sm:text-sm">
              <RiCalendarCheckLine className="size-3.5 sm:size-4" />
              <span className="font-medium">{metrics.upcoming} due this week</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-3 sm:p-6 lg:p-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[
            { label: "Total Subscriptions", value: metrics.total },
            { label: "Active", value: metrics.active },
            { label: "Monthly Spending", value: formatCurrency(metrics.monthly, currency) },
            { label: "Yearly Projection", value: formatCurrency(metrics.monthly * 12, currency) },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Upcoming Renewals Banner */}
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
                return (
                  <Link
                    key={sub.id}
                    to={`/subscriptions/${sub.id}`}
                    className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs shadow-sm transition-colors hover:border-amber-400 dark:border-amber-700 dark:bg-amber-900/30"
                  >
                    <span className="font-medium text-gray-900 dark:text-gray-100">{sub.name}</span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {formatCurrency(sub.amount, currency)} · {daysLeft === 0 ? "Today" : daysLeft === 1 ? "Tomorrow" : `in ${daysLeft}d`}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Algorand (60%) + Agent (40%) — side-by-side */}
        <div className="mt-6 grid gap-5 lg:grid-cols-5">

          {/* === Card 1: Algorand wallet — Premium Banking style (60%) === */}
          {(() => {
            const activeLogo = walletType ? WALLET_LOGOS[walletType] : null
            const activeLabel = walletType ? WALLET_LABELS[walletType] : null
            return (
              <div className="lg:col-span-3 relative" data-tour="algorand-total">
                <div
                  className="relative overflow-hidden rounded-[32px] bg-black p-6 sm:p-7 ring-1 ring-emerald-500/30 shadow-[0_20px_60px_-15px_rgba(34,197,94,0.35)] flex flex-col aspect-[1.55/1] min-h-[300px]"
                >
                  {/* Green metallic blob — top */}
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
                          {isLoadingBalance ? "…" : balance.toFixed(3)}
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
                        ? `${network === "mainnet" ? "MainNet" : "TestNet"} · ${shortenAddress(walletAddress)}`
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
                    {walletAddress && (
                      <div
                        aria-hidden
                        className="relative h-6 w-11 rounded-full p-0.5 transition-colors ring-1 bg-emerald-400 ring-emerald-300/60 shadow-[0_0_12px_rgba(74,222,128,0.6)]"
                      >
                        <div className="size-5 rounded-full bg-white shadow translate-x-5" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* === Card 2: Autonomous Agent === */}
          {(() => {
            const stamp = agentStats.lastRunAt ?? new Date()
            const tickHour = stamp.getHours()
            const tickMin = stamp.getMinutes().toString().padStart(2, "0")
            const tickAmPm = tickHour >= 12 ? "PM" : "AM"
            const tickHr12 = ((tickHour + 11) % 12) + 1
            const lastAction = agentActions[0]
            return (
              <div className="lg:col-span-2 relative rounded-3xl bg-card p-6 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.15)] ring-1 ring-black/5 sm:p-7 flex flex-col">
                {/* Top: icon + tick widget */}
                <div className="flex items-start justify-between">
                  <img
                    src={agentLogoUrl}
                    alt="Autonomous Agent"
                    className="size-12 rounded-2xl object-cover shadow-md"
                  />
                  <div className="overflow-hidden rounded-xl border border-border bg-card text-center shadow-sm">
                    <div className="bg-foreground px-3 py-0.5 text-[9px] font-bold tracking-wider text-background">
                      TICK
                    </div>
                    <div className="px-3 py-0.5">
                      <div className="text-base font-bold leading-tight text-foreground">{tickHr12}:{tickMin}</div>
                      <div className="text-[9px] leading-tight text-muted-foreground">{tickAmPm}</div>
                    </div>
                  </div>
                </div>

                {/* Title first, then secondary line */}
                <div className="mt-6">
                  <h2 className="text-2xl font-bold text-foreground sm:text-[26px] leading-tight">
                    Autonomous Agent
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground/80">{agentStats.isOnChain ? "On-chain" : "Simulation"}</span>
                    <span className="mx-1.5 text-muted-foreground/60">·</span>
                    <span>{agentStats.lastRunAt ? `last tick ${agentStats.lastRunAt.toLocaleTimeString(undefined, {hour: "2-digit", minute: "2-digit"})}` : "idle"}</span>
                  </p>
                  {/* Pills */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                      agentStats.isOnChain
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}>
                      <span className="relative flex size-1.5">
                        <span className={`absolute inset-0 animate-ping rounded-full ${agentStats.isOnChain ? "bg-emerald-500" : "bg-amber-500"} opacity-75`} />
                        <span className={`relative inline-flex size-1.5 rounded-full ${agentStats.isOnChain ? "bg-emerald-500" : "bg-amber-500"}`} />
                      </span>
                      {agentStats.isOnChain ? "Live" : "Simulation"}
                    </span>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground/70">
                      {agentStats.onChainCount} on-chain
                    </span>
                    {lastAction?.payload?.subscription_name && (
                      <span className="max-w-[160px] truncate rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground/70">
                        last: {lastAction.payload.subscription_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Spacer */}
                <div className="flex-1 min-h-[12px]" />

                {/* Bottom info row */}
                <div className="mt-6 flex items-end justify-between gap-3">
                  <div>
                    <span className={`text-2xl font-bold ${agentStats.dueToday > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                      {agentStats.dueToday}
                    </span>
                    <span className="ml-1 text-sm text-muted-foreground">due now</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {agentStats.nextHrs == null
                      ? "no upcoming"
                      : <>next in {agentStats.nextHrs < 24 ? `${agentStats.nextHrs}h` : `${Math.round(agentStats.nextHrs / 24)}d`}</>}
                  </p>
                </div>

                {/* Divider */}
                <div className="mt-4 border-t border-border" />

                {/* Big CTA */}
                <div className="mt-5">
                  <button
                    onClick={runAgent}
                    disabled={agentRunning}
                    className="block w-full rounded-full bg-foreground px-6 py-3.5 text-center text-sm font-semibold text-background shadow-[0_8px_20px_-6px_rgba(0,0,0,0.4)] transition-transform hover:scale-[1.02] active:scale-[0.99] disabled:opacity-60"
                  >
                    {agentRunning ? "Running tick…" : "Trigger tick"}
                  </button>
                </div>

                {/* Inline run feedback (compact) */}
                {agentResult && (
                  <div className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${
                    agentResult.error
                      ? "bg-destructive/10 text-destructive"
                      : agentResult.mode === "db-only" && (agentResult.processed ?? 0) > 0
                        ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
                        : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                  }`}>
                    {agentResult.error
                      ? <><RiAlertLine className="size-3.5 mt-0.5 shrink-0" /><span>{
                          agentResult.error.toLowerCase().includes("mnemonic") ||
                          agentResult.error.toLowerCase().includes("wallet") ||
                          agentResult.error.toLowerCase().includes("sign")
                            ? "Agent wallet not configured — add AGENT_WALLET_MNEMONIC on Vercel."
                            : agentResult.error
                        }</span></>
                      : agentResult.mode === "db-only" && (agentResult.processed ?? 0) > 0
                        ? <><RiAlertLine className="size-3.5 mt-0.5 shrink-0" /><span>Simulation only — {agentResult.processed} vault{agentResult.processed !== 1 ? "s" : ""} found, none released on-chain.</span></>
                        : agentResult.released === 0
                          ? <><RiCheckDoubleLine className="size-3.5 mt-0.5 shrink-0" /><span>No locked vaults due — nothing to release.</span></>
                          : <><RiCheckDoubleLine className="size-3.5 mt-0.5 shrink-0" /><span>Released {agentResult.released} vault{agentResult.released !== 1 ? "s" : ""} on-chain.</span></>}
                  </div>
                )}
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
              subscriptions.slice(0, 5).map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium text-foreground">{sub.name}</p>
                    <p className="text-xs text-muted-foreground">{sub.category || "Uncategorized"} · {sub.billing_cycle}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        {formatCurrency(sub.amount, sub.currency || currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(sub.next_billing_date).toLocaleDateString()}
                      </p>
                    </div>
                    <Link
                      to={`/subscriptions/${sub.id}`}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <RiEditLine className="size-3.5" />
                      Edit
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}