import { useAuth } from "@/lib/auth-context"
import { useAlgorand } from "@/lib/algorand/context"
import { fetchSubscriptions } from "@/lib/supabase-queries"
import { fetchProfile } from "@/lib/supabase-queries"
import { formatCurrency } from "@/lib/currency"
import { shortenAddress, getAddressExplorerUrl, getLoraTransactionUrl } from "@/lib/algorand/constants"
import { Button } from "@/components/Button"
import { Link } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import {
  RiAddLine, RiWalletLine, RiEditLine,
  RiCalendarCheckLine, RiAlertLine, RiLoader4Line,
  RiPlayCircleLine,
  RiShieldLine, RiFileChartLine, RiLockLine,
  RiExternalLinkLine, RiRobotLine, RiCheckDoubleLine,
  RiRefreshLine,
} from "@remixicon/react"
import { WalletSelectorModal } from "@/components/algorand/WalletSelectorModal"
import { useState, useEffect, useMemo } from "react"

export default function DashboardPageContent() {
  const { user } = useAuth()
  const { walletAddress, balance, isConnecting, isLoadingBalance, network, setShowWalletSelector } = useAlgorand()
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vaultStats, setVaultStats] = useState({ total: 0, locked: 0, killed: 0, totalLocked: 0 })
  const [recentPayments, setRecentPayments] = useState<any[]>([])
  const [agentActions, setAgentActions] = useState<any[]>([])
  const [agentRunning, setAgentRunning] = useState(false)
  const [agentResult, setAgentResult] = useState<{ released: number; mode?: string; error?: string } | null>(null)

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
        mode: data.agent_mode,
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
            const advData = await advRes.json()
            if (advRes.ok && advData.advanced > 0) {
              // Re-fetch subscriptions with updated dates
              const refreshed = await fetchSubscriptions(user!.id)
              setSubscriptions(refreshed)
            }
          }
        } catch {
          // Non-critical: billing date advance failed, continue with stale dates
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
              <Button asChild className="bg-white text-blue-700 hover:bg-blue-50 shadow-lg text-sm sm:text-base">
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

        {/* Algorand Blockchain Section */}
        <div className="mt-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/20">
                <RiShieldLine className="size-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Algorand Blockchain</h2>
                <p className="text-xs text-muted-foreground">
                  {walletAddress
                    ? `Connected: ${shortenAddress(walletAddress)}`
                    : "Connect your wallet to enable blockchain features"}
                </p>
              </div>
            </div>
            {!walletAddress ? (
              <button
                onClick={() => setShowWalletSelector(true)}
                disabled={isConnecting}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <RiWalletLine className="size-4" />
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            ) : (
              <a
                href={getAddressExplorerUrl(walletAddress, network)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                View on Explorer <RiExternalLinkLine className="size-3" />
              </a>
            )}
          </div>

          {walletAddress && (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-card/80 p-3 backdrop-blur-sm">
                  <p className="text-xs text-muted-foreground">Wallet Balance</p>
                  <p className="mt-1 text-lg font-bold text-foreground">
                    {isLoadingBalance ? "..." : `${balance.toFixed(2)} ALGO`}
                  </p>
                </div>
                <div className="rounded-xl bg-card/80 p-3 backdrop-blur-sm">
                  <p className="text-xs text-muted-foreground">Total Vaults</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{vaultStats.total}</p>
                </div>
                <div className="rounded-xl bg-card/80 p-3 backdrop-blur-sm">
                  <p className="text-xs text-muted-foreground">Locked</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{vaultStats.totalLocked.toFixed(2)} ALGO</p>
                </div>
                <div className="rounded-xl bg-card/80 p-3 backdrop-blur-sm">
                  <p className="text-xs text-muted-foreground">Kill Switches</p>
                  <p className="mt-1 text-lg font-bold text-destructive">{vaultStats.killed}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/escrow-vaults" className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted">
                  <RiLockLine className="size-3.5" /> Manage Vaults
                </Link>
                <Link to="/onchain-resume" className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted">
                  <RiFileChartLine className="size-3.5" /> View Resume
                </Link>
              </div>

              {recentPayments.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Recent On-Chain Activity</p>
                  <div className="space-y-2">
                    {recentPayments.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg bg-card/80 p-2.5 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                          <RiShieldLine className="size-3.5 text-primary" />
                          <span className="text-xs text-foreground truncate max-w-[200px]">{p.note || "Transaction"}</span>
                        </div>
                        <span className="text-xs font-medium text-foreground">{Number(p.amount).toFixed(2)} ALGO</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Agentic Activity Panel */}
        <div className="mt-6 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/60 to-teal-50/40 dark:from-emerald-950/20 dark:to-teal-950/10 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/15">
                <RiRobotLine className="size-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Autonomous Agent</h2>
                <p className="text-xs text-muted-foreground">
                  Releases vaults when subscriptions are due
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {agentActions.some((a: any) => a.payload?.mode === "on-chain") ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  On-chain
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  DB Only
                </span>
              )}
              <button
                onClick={runAgent}
                disabled={agentRunning}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors disabled:opacity-60"
              >
                {agentRunning
                  ? <><RiLoader4Line className="size-3.5 animate-spin" /> Running…</>
                  : <><RiRefreshLine className="size-3.5" /> Run Now</>
                }
              </button>
            </div>
          </div>

          {/* Agent result feedback */}
          {agentResult && (
            <div className={`mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
              agentResult.error
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
            }`}>
              {agentResult.error
                ? <><RiAlertLine className="size-3.5 shrink-0" /> {
                    agentResult.error.toLowerCase().includes("mnemonic") ||
                    agentResult.error.toLowerCase().includes("wallet") ||
                    agentResult.error.toLowerCase().includes("sign")
                      ? "Agent wallet not configured in Vercel — add AGENT_WALLET_MNEMONIC to your Vercel environment variables to enable on-chain releases."
                      : agentResult.error
                  }</>
                : agentResult.released === 0
                  ? <><RiCheckDoubleLine className="size-3.5 shrink-0" /> No vaults due right now — all clear.</>
                  : <><RiCheckDoubleLine className="size-3.5 shrink-0" /> Released {agentResult.released} vault{agentResult.released !== 1 ? "s" : ""} · {agentResult.mode === "on-chain" ? "On-chain ✓" : "DB only"}</>
              }
            </div>
          )}

          {agentActions.length === 0 ? (
            <div className="rounded-xl bg-card/60 border border-border/50 px-4 py-4 text-sm text-muted-foreground text-center">
              <RiCheckDoubleLine className="mx-auto mb-2 size-6 opacity-40" />
              <p>No autonomous actions yet.</p>
              <p className="text-xs mt-1">
                Hit <strong>Run Now</strong> to check for due subscriptions and release linked vaults automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {agentActions.map((action: any) => {
                const p = action.payload ?? {}
                const date = new Date(action.created_at).toLocaleString()
                return (
                  <div key={action.id} className="flex items-start gap-3 rounded-xl bg-card/70 border border-border/50 px-4 py-3">
                    <RiCheckDoubleLine className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        Auto-released: {p.subscription_name ?? "Subscription"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.amount ? `${Number(p.amount).toFixed(2)} ALGO` : ""} · {date}
                        {action.txid && (
                          <> · <a
                            href={getLoraTransactionUrl(action.txid, network)}
                            target="_blank" rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >View tx ↗</a></>
                        )}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      p.mode === "on-chain"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}>
                      {p.mode === "on-chain" ? "On-chain" : "Simulated"}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
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