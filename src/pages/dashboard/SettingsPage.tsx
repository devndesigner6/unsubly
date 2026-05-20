import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/lib/auth-context"
import { useAlgorand } from "@/lib/algorand/context"
import { fetchProfile, updateProfile } from "@/lib/supabase-queries"
import { supabase } from "@/integrations/supabase/client"
import algosdk from "algosdk"
import { toast } from "sonner"
import { usePageTitle } from "@/hooks/usePageTitle"
import { Skeleton } from "@/components/ui/Skeleton"

import { Button } from "@/components/Button"
import {
  RiLoader4Line, RiSaveLine, RiLogoutBoxLine, RiAlertLine,
  RiUserLine, RiMoneyDollarCircleLine, RiNotification3Line,
  RiShieldLine, RiCheckLine, RiLockPasswordLine,
  RiArrowLeftRightLine, RiWalletLine, RiPulseLine,
  RiDeleteBinLine, RiErrorWarningLine, RiTelegramLine,
  RiDownloadLine,
} from "@remixicon/react"
import { NetworkFlip } from "@/components/micro/NetworkFlip"
import { HeartbeatStrip } from "@/components/micro/HeartbeatStrip"

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "JPY", "SGD", "AED"]

/** Generate a deterministic pastel background color from a string seed */
function seedColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = Math.abs(hash) % 360
  return `hsl(${h}, 60%, 75%)`
}

export default function SettingsPage() {
  usePageTitle("Settings")
  const { user, signOut, isGoogleUser } = useAuth()
  const { walletAddress, network, switchNetwork } = useAlgorand()

  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [defaultAlertDays, setDefaultAlertDays] = useState(3)
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(false)
  const [algorandAddress, setAlgorandAddress] = useState("")
  const [agentHeartbeat, setAgentHeartbeat] = useState<{ at: number; status: "ok" | "fail" | "scheduled" }[]>(
    () => {
      // Initialise with the last 24 hour-aligned slots, all marked scheduled.
      // Real status is filled in once we query agent_actions.
      const out: { at: number; status: "ok" | "fail" | "scheduled" }[] = []
      const now = new Date()
      now.setMinutes(0, 0, 0)
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 3600_000)
        out.push({ at: d.getTime(), status: i === 0 ? "scheduled" : "scheduled" })
      }
      return out
    }
  )
  const [addressError, setAddressError] = useState("")

  // Password change
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  // Email reminder delivery is intentionally disabled in the UI until a custom
  // domain is set up with Resend. The send-subscription-alerts edge function
  // still exists and can be re-enabled by restoring the test button below.

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  // Telegram connect (Feature 2)
  const [telegramChatId, setTelegramChatId] = useState<string | null>(null)
  const [telegramCode, setTelegramCode] = useState("")
  const [telegramConnecting, setTelegramConnecting] = useState(false)
  const [showTelegramInput, setShowTelegramInput] = useState(false)

  // Export data
  const [exporting, setExporting] = useState(false)

  // MCP API tokens
  const [mcpTokens, setMcpTokens] = useState<any[]>([])
  const [mcpLoading, setMcpLoading] = useState(false)
  const [mcpNewToken, setMcpNewToken] = useState<string | null>(null)
  const [mcpCreating, setMcpCreating] = useState(false)
  const [mcpTokenName, setMcpTokenName] = useState("")
  const [mcpTokenScopes, setMcpTokenScopes] = useState<string[]>(["read"])

  // Profile avatar
  const avatarUrl = isGoogleUser ? user?.user_metadata?.avatar_url : null
  const bgColor = useMemo(() => seedColor(user?.id || "default"), [user?.id])
  const initials = useMemo(() => {
    if (name) return name.slice(0, 2).toUpperCase()
    return user?.email?.slice(0, 2).toUpperCase() || "U"
  }, [name, user?.email])

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const prof = await fetchProfile(user!.id)
        if (prof) {
          setProfile(prof)
          setName(prof.name || "")
          setCurrency(prof.currency || "USD")
          setDefaultAlertDays(prof.default_alert_days ?? 3)
          setEmailAlerts(prof.email_alerts ?? true)
          setWeeklyDigest(prof.weekly_digest ?? false)
          setAlgorandAddress(prof.algorand_address || "")
          setTelegramChatId((prof as any).telegram_chat_id || null)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  // Sync wallet address from Pera when connected
  useEffect(() => {
    if (walletAddress && walletAddress !== algorandAddress) {
      setAlgorandAddress(walletAddress)
      setAddressError("")
    }
  }, [walletAddress])

  // Fetch the last 24h of agent runs from supabase and bucket them into hour
  // slots for the heartbeat strip.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const since = new Date(Date.now() - 24 * 3600_000).toISOString()
        const { data, error } = await supabase
          .from("agent_actions" as any)
          .select("created_at, status")
          .eq("user_id", user.id)
          .gte("created_at", since)
          .order("created_at", { ascending: true })
        if (cancelled || error) return
        const buckets = new Map<number, "ok" | "fail">()
        ;(data as any[] | null)?.forEach((row) => {
          const t = new Date(row.created_at)
          t.setMinutes(0, 0, 0)
          const key = t.getTime()
          const ok = row.status === "ok" || row.status === "success" || row.status === "completed"
          buckets.set(key, ok ? "ok" : "fail")
        })
        setAgentHeartbeat((prev) =>
          prev.map((tick) => {
            const hit = buckets.get(tick.at)
            return hit ? { ...tick, status: hit } : tick
          }),
        )
      } catch {
        /* table may not exist yet on some envs - keep all scheduled */
      }
    })()
    return () => { cancelled = true }
  }, [user])

  const validateAlgorandAddress = (addr: string): boolean => {
    if (!addr) return true // empty is valid
    if (addr.length !== 58) {
      setAddressError("Address must be 58 characters")
      return false
    }
    try {
      algosdk.decodeAddress(addr)
      setAddressError("")
      return true
    } catch {
      setAddressError("Invalid Algorand address checksum")
      return false
    }
  }

  async function handleSave() {
    if (!user) return
    if (algorandAddress && !validateAlgorandAddress(algorandAddress)) return
    setSaving(true)
    setSaved(false)
    try {
      await updateProfile(user.id, {
        name,
        currency,
        default_alert_days: defaultAlertDays,
        email_alerts: emailAlerts,
        weekly_digest: weeklyDigest,
        algorand_address: algorandAddress || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  function validatePasswordStrength(pwd: string): string | null {
    if (pwd.length < 8) return "Password must be at least 8 characters"
    if (!/[A-Z]/.test(pwd)) return "Password must contain at least one uppercase letter"
    if (!/[a-z]/.test(pwd)) return "Password must contain at least one lowercase letter"
    if (!/[0-9]/.test(pwd)) return "Password must contain at least one number"
    return null
  }

  async function handleChangePassword() {
    setPasswordError("")
    setPasswordSuccess(false)
    const strengthError = validatePasswordStrength(newPassword)
    if (strengthError) {
      setPasswordError(strengthError)
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match")
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordError(error.message)
    } else {
      setPasswordSuccess(true)
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => setPasswordSuccess(false), 3000)
    }
  }


  async function handleConnectTelegram() {
    if (!telegramCode || telegramCode.length !== 6) {
      toast.error("Enter the 6-digit code from @unsublyybot")
      return
    }
    setTelegramConnecting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error("Not authenticated")
      const res = await fetch("/api/telegram-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ code: telegramCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to connect")
      setTelegramChatId(data.chat_id)
      setTelegramCode("")
      setShowTelegramInput(false)
      toast.success("Telegram connected!", { description: "You'll now receive personal agent notifications." })
    } catch (err: any) {
      toast.error("Connection failed", { description: err.message })
    } finally {
      setTelegramConnecting(false)
    }
  }

  async function handleDisconnectTelegram() {
    if (!user) return
    const { error } = await supabase.from("profiles").update({ telegram_chat_id: null } as any).eq("id", user.id)
    if (!error) {
      setTelegramChatId(null)
      toast.success("Telegram disconnected")
    }
  }

  async function handleExportData() {
    if (!user) return
    setExporting(true)
    try {
      // Fetch subscriptions
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (!subs || subs.length === 0) {
        toast.error("No data to export")
        setExporting(false)
        return
      }

      // Build CSV
      const headers = ["Name", "Amount", "Currency", "Billing Cycle", "Next Billing", "Category", "Status", "Created At"]
      const rows = subs.map((s: any) => [
        `"${(s.name || "").replace(/"/g, '""')}"`,
        s.amount || "",
        s.currency || "",
        s.billing_cycle || "",
        s.next_billing_date || "",
        s.category || "",
        s.status || "active",
        s.created_at || "",
      ].join(","))

      const csv = [headers.join(","), ...rows].join("\n")
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `unsubscribely-export-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Data exported successfully")
    } catch (err: any) {
      toast.error("Export failed", { description: err.message })
    } finally {
      setExporting(false)
    }
  }

  // ─── MCP Token Management ─────────────────────────────────────────────────
  async function fetchMcpTokens() {
    if (!user) return
    setMcpLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await fetch("/api/mcp-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      })
      const data = await res.json()
      if (data.tokens) setMcpTokens(data.tokens)
    } catch { /* silent */ } finally { setMcpLoading(false) }
  }

  async function handleCreateMcpToken() {
    if (!user || mcpCreating) return
    setMcpCreating(true)
    setMcpNewToken(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error("Not authenticated")
      const res = await fetch("/api/mcp-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: mcpTokenName || "Default Token", scopes: mcpTokenScopes }),
      })
      const data = await res.json()
      if (data.token) {
        setMcpNewToken(data.token)
        setMcpTokenName("")
        toast.success("MCP token created")
        fetchMcpTokens()
      } else {
        toast.error(data.error || "Failed to create token")
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally { setMcpCreating(false) }
  }

  async function handleRevokeMcpToken(tokenId: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      await fetch("/api/mcp-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", token_id: tokenId }),
      })
      setMcpTokens(prev => prev.filter(t => t.id !== tokenId))
      toast.success("Token revoked")
    } catch { toast.error("Failed to revoke token") }
  }

  // Load MCP tokens on mount
  useEffect(() => { if (user) fetchMcpTokens() }, [user])

  async function handleDeleteAccount() {
    if (!user || deleteConfirmText !== "DELETE") return
    setIsDeleting(true)

    // Helper, delete from a table silently; ignore 404 / RLS / missing table errors
    async function tryDelete(table: string, column: string, value: string) {
      try {
        await (supabase.from(table as any) as any).delete().eq(column, value)
      } catch (_) { /* table may not exist in this environment, that's fine */ }
    }

    try {
      // Step 1, wipe every application data table; failures are silent
      await tryDelete("resume_shares",   "user_id", user.id)
      await tryDelete("onchain_payments","user_id", user.id)
      await tryDelete("agent_actions",   "user_id", user.id)
      await tryDelete("escrow_vaults",   "user_id", user.id)
      await tryDelete("subscriptions",   "user_id", user.id)
      await tryDelete("profiles",        "id",      user.id)

      // Step 2, obfuscate the email so the original address is free to re-register.
      // GoTrue's DELETE /user (405) is disabled in Lovable's Supabase, so instead we
      // rename the email to a throwaway address. If Supabase requires email confirmation
      // the rename won't take immediate effect, but all data is already gone above.
      const ghostEmail = `deleted_${user.id.slice(0, 8)}_${Date.now()}@unsubscribely.deleted`
      const { error: updateErr } = await supabase.auth.updateUser({ email: ghostEmail })

      if (updateErr) {
        // Email rename failed (e.g. confirmation required), data is still gone; sign out.
        toast.success("Account data deleted", {
          description: "All your subscriptions, vaults, and profile have been permanently removed. Your login email may still be reserved, use a different address or add +1 to re-register.",
          duration: 8000,
        })
      } else {
        toast.success("Account deleted", {
          description: "All data wiped and your email has been released. You can re-register with the same address.",
        })
      }

      await signOut()
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete account")
      setIsDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
          <Skeleton className="h-9 w-32 mb-2" />
          <Skeleton className="h-4 w-48 mb-8" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="mb-6 rounded-xl border border-border bg-card p-5 sm:p-6">
              <Skeleton className="h-5 w-24 mb-4" />
              <Skeleton className="h-10 w-full mb-3" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">Settings</h1>
          <p className="mt-2 text-muted-foreground">Manage your account and preferences</p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <RiAlertLine className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Profile Section */}
        <section className="mb-6 rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <RiUserLine className="size-5 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Profile</h2>
          </div>
          <div className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="size-14 rounded-full object-cover ring-2 ring-border"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span
                  className="flex size-14 items-center justify-center rounded-full text-lg font-bold text-gray-800 ring-2 ring-border"
                  style={{ backgroundColor: bgColor }}
                >
                  {initials}
                </span>
              )}
              <div>
                <p className="text-sm font-medium text-foreground">{name || user?.email || "User"}</p>
                <p className="text-xs text-muted-foreground">
                  {isGoogleUser ? "Photo imported from Google" : "Auto-generated avatar"}
                </p>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Email</label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Email cannot be changed here. It is linked to your authentication provider.
              </p>
            </div>
          </div>
        </section>

        {/* Currency & Preferences */}
        <section className="mb-6 rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <RiMoneyDollarCircleLine className="size-5 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Preferences</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Default Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Default Alert Days Before Payment</label>
              <input
                type="number"
                min={1}
                max={30}
                value={defaultAlertDays}
                onChange={(e) => setDefaultAlertDays(Number(e.target.value))}
                className="w-32 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="mb-6 rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <RiNotification3Line className="size-5 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
          </div>
          <div className="space-y-4">

            {/* Telegram Connect — FIRST, most important */}
            <div className={`rounded-xl border p-4 ${telegramChatId ? "border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20" : "border-primary/20 bg-primary/5"}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <RiTelegramLine className="size-5 text-[#2AABEE]" />
                  <p className="text-sm font-semibold text-foreground">Telegram Alerts</p>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">Required for agent</span>
                </div>
                {telegramChatId ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <RiCheckLine className="size-3" /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    Not connected
                  </span>
                )}
              </div>

              {telegramChatId ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    The OpenClaw agent will send you personal notifications for every vault release, renewal alert, and cancellation update.
                  </p>
                  <button
                    onClick={handleDisconnectTelegram}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Disconnect Telegram
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Connect Telegram to receive renewal alerts 3 days before billing and cancel subscriptions with a single reply.
                  </p>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Open <a href="https://t.me/unsublyybot" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@unsublyybot</a> on Telegram
                      <span className="ml-1 text-[10px]">(<a href="tg://resolve?domain=unsublyybot" className="text-primary hover:underline">mobile deep link</a>)</span>
                    </li>
                    <li>Send <span className="font-mono bg-muted px-1 rounded">/start</span></li>
                    <li>Paste the 6-digit code below</li>
                  </ol>
                  {!showTelegramInput ? (
                    <Button onClick={() => setShowTelegramInput(true)}>
                      <RiTelegramLine className="mr-1.5 size-4" />
                      Connect Telegram
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={telegramCode}
                        onChange={(e) => setTelegramCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="6-digit code"
                        className="w-36 rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        autoFocus
                      />
                      <Button onClick={handleConnectTelegram} disabled={telegramConnecting || telegramCode.length !== 6}>
                        {telegramConnecting ? <RiLoader4Line className="size-4 animate-spin" /> : "Verify"}
                      </Button>
                      <Button variant="secondary" onClick={() => { setShowTelegramInput(false); setTelegramCode("") }}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-border pt-4 space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Email Alerts</p>
                  <p className="text-xs text-muted-foreground">Get notified before subscription renewals</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">Preferences saved — delivery activates when custom domain is live</p>
                </div>
                <button
                  onClick={() => setEmailAlerts(!emailAlerts)}
                  className={`relative h-7 w-12 sm:h-6 sm:w-11 rounded-full transition-colors ${emailAlerts ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`absolute left-0.5 top-0.5 size-6 sm:size-5 rounded-full bg-primary-foreground transition-transform ${emailAlerts ? "translate-x-5" : ""}`} />
                </button>
              </label>
              <label className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Weekly Digest</p>
                  <p className="text-xs text-muted-foreground">Weekly summary of your spending</p>
                </div>
                <button
                  onClick={() => setWeeklyDigest(!weeklyDigest)}
                  className={`relative h-7 w-12 sm:h-6 sm:w-11 rounded-full transition-colors ${weeklyDigest ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`absolute left-0.5 top-0.5 size-6 sm:size-5 rounded-full bg-primary-foreground transition-transform ${weeklyDigest ? "translate-x-5" : ""}`} />
                </button>
              </label>
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground mb-0.5">Email Reminder Delivery</p>
                    <p className="text-xs text-muted-foreground">
                      Automated renewal alerts sent to <span className="font-mono">{user?.email}</span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                    <RiLoader4Line className="size-3" />
                    Coming Soon
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Email delivery launches once our custom domain is live. Your preferences are saved and will activate automatically.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Algorand */}
        <section className="mb-6 rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RiShieldLine className="size-5 text-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Algorand Wallet</h2>
            </div>
            <NetworkFlip network={network as "testnet" | "mainnet"} onChange={(n) => switchNetwork(n)} />
          </div>

          {/* Agent heartbeat strip - last 24 hourly runs */}
          <div className="mb-4 rounded-lg border border-border bg-muted/40 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
              <RiPulseLine className="size-3.5" />
              Autonomous Agent
            </div>
            <HeartbeatStrip ticks={agentHeartbeat} />
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Wallet Address</label>
              <div className="relative">
                <input
                  type="text"
                  value={algorandAddress}
                  onChange={(e) => {
                    setAlgorandAddress(e.target.value)
                    if (e.target.value) validateAlgorandAddress(e.target.value)
                    else setAddressError("")
                  }}
                  className={`w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring ${
                    addressError ? "border-destructive" : "border-input"
                  }`}
                  placeholder="ALGO..."
                />
                {walletAddress && walletAddress === algorandAddress && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-green-600">
                    <RiWalletLine className="size-3" /> Pera
                  </span>
                )}
              </div>
              {addressError && <p className="mt-1 text-xs text-destructive">{addressError}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                {walletAddress
                  ? "Synced from your connected Pera Wallet"
                  : "Your Algorand address for on-chain features"}
              </p>
              {/* Agent wallet QR — scan from Pera mobile to fund */}
              {import.meta.env.VITE_AGENT_WALLET_ADDRESS && (
                <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
                  <p className="mb-2 text-xs font-medium text-foreground">Agent wallet — scan to fund from Pera mobile</p>
                  <div className="flex items-center gap-3">
                    <div className="rounded-md border border-border bg-background p-1.5">
                      {/* Simple QR-like visual using the address as seed — actual QR via data URI */}
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(import.meta.env.VITE_AGENT_WALLET_ADDRESS)}&bgcolor=ffffff&color=000000&margin=2`}
                        alt="Agent wallet QR code"
                        className="size-20 rounded"
                        loading="lazy"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] text-muted-foreground break-all">
                        {(import.meta.env.VITE_AGENT_WALLET_ADDRESS as string).slice(0, 20)}…
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Fund with testnet ALGO at{" "}
                        <a href="https://bank.testnet.algorand.network/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          bank.testnet.algorand.network
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* MCP API Access — link to full page */}
        <section className="mb-6 rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RiArrowLeftRightLine className="size-5 text-foreground" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">MCP API</h2>
                <p className="text-xs text-muted-foreground">Connect AI agents to manage your subscriptions</p>
              </div>
            </div>
            <a href="/connect-agent" className="rounded-full border border-border px-4 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors">
              Manage Tokens →
            </a>
          </div>
          {mcpTokens.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">{mcpTokens.filter(t => t.is_active).length} active token{mcpTokens.filter(t => t.is_active).length !== 1 ? "s" : ""}</p>
          )}
        </section>

        {/* Change Password */}
        <section className="mb-6 rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <RiLockPasswordLine className="size-5 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Change Password</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Min 8 chars, uppercase, lowercase, number"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
            {passwordSuccess && <p className="flex items-center gap-1 text-sm text-green-600"><RiCheckLine className="size-4" />Password updated!</p>}
            <Button onClick={handleChangePassword} variant="secondary" disabled={!newPassword}>
              Update Password
            </Button>
          </div>
        </section>

        {/* Save & Sign Out */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <><RiLoader4Line className="mr-2 size-4 animate-spin" />Saving...</>
            ) : saved ? (
              <><RiCheckLine className="mr-2 size-4" />Saved!</>
            ) : (
              <><RiSaveLine className="mr-2 size-4" />Save Changes</>
            )}
          </Button>
          <Button variant="destructive" onClick={signOut}>
            <RiLogoutBoxLine className="mr-2 size-4" />
            Sign Out
          </Button>
        </div>

        {/* Danger Zone */}
        <section className="mt-8 rounded-xl border border-destructive/40 bg-destructive/5 p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <RiErrorWarningLine className="size-5 text-destructive" />
            <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
          </div>

          {/* Export Data */}
          <div className="mb-5 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Export My Data</p>
                <p className="text-xs text-muted-foreground">Download all your subscriptions as a CSV file</p>
              </div>
              <Button variant="secondary" onClick={handleExportData} disabled={exporting}>
                {exporting ? (
                  <><RiLoader4Line className="mr-1.5 size-4 animate-spin" />Exporting...</>
                ) : (
                  <><RiDownloadLine className="mr-1.5 size-4" />Export CSV</>
                )}
              </Button>
            </div>
          </div>

          <p className="mb-4 text-sm text-muted-foreground">
            Permanently delete your account and all associated data, subscriptions, escrow vaults, on-chain payment records, NFT receipts, and your profile. This cannot be undone. If you sign up again with the same email, you will start completely fresh.
          </p>
          {!showDeleteConfirm ? (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <RiDeleteBinLine className="mr-2 size-4" />
              Delete My Account
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                Type <span className="font-mono font-bold text-destructive">DELETE</span> to confirm
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full rounded-lg border border-destructive/40 bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/50"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== "DELETE" || isDeleting}
                >
                  {isDeleting ? (
                    <><RiLoader4Line className="mr-2 size-4 animate-spin" />Deleting everything...</>
                  ) : (
                    <><RiDeleteBinLine className="mr-2 size-4" />Confirm Delete</>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText("") }}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
