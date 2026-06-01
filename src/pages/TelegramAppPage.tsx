/**
 * Telegram Mini App — Full subscription dashboard inside Telegram.
 *
 * This page loads inside Telegram's WebApp container.
 * Auth is handled via Telegram's initData (no separate login needed).
 * The user's telegram_chat_id is used to find their account.
 */

import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { fetchSubscriptions } from "@/lib/supabase-queries"
import { formatCurrency } from "@/lib/currency"
import { usePageTitle } from "@/hooks/usePageTitle"

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
}

interface Subscription {
  id: string
  name: string
  amount: number
  currency: string
  status: string
  billing_cycle: string
  next_billing_date: string
  category?: string
}

export default function TelegramAppPage() {
  usePageTitle("Unsubscribely")
  const [tgUser, setTgUser] = useState<TelegramUser | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalMonthly, setTotalMonthly] = useState(0)

  // Initialize Telegram WebApp
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp
    if (!tg) {
      setError("This page must be opened inside Telegram.")
      setLoading(false)
      return
    }

    // Expand the app to full height
    tg.expand()
    tg.ready()

    // Get user from initData
    const user = tg.initDataUnsafe?.user
    if (!user) {
      setError("Could not get Telegram user info.")
      setLoading(false)
      return
    }

    setTgUser(user)

    // Set theme colors from Telegram
    const root = document.documentElement
    if (tg.colorScheme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }

    // Find user by telegram_chat_id
    findUser(String(user.id))
  }, [])

  async function findUser(chatId: string) {
    try {
      const { data: profiles, error: profileErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("telegram_chat_id", chatId)
        .limit(1)

      if (profileErr || !profiles || profiles.length === 0) {
        setError("Account not connected. Send /start to @UnsubscribelyAgent bot first, then connect in Settings.")
        setLoading(false)
        return
      }

      const uid = profiles[0].id
      setUserId(uid)

      // Fetch subscriptions
      const subs = await fetchSubscriptions(uid)
      setSubscriptions(subs)

      // Calculate total monthly
      const active = subs.filter((s: any) => s.status === "active")
      const total = active.reduce((sum: number, s: any) => sum + (s.amount || 0), 0)
      setTotalMonthly(total)
    } catch (err: any) {
      setError(err.message || "Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel(subId: string, subName: string) {
    const tg = (window as any).Telegram?.WebApp
    tg?.showConfirm(`Cancel ${subName}?`, (confirmed: boolean) => {
      if (!confirmed) return
      // Send cancel command to bot
      tg?.sendData(JSON.stringify({ action: "cancel", subscription_id: subId }))
      // Update local state
      setSubscriptions((prev) =>
        prev.map((s) => s.id === subId ? { ...s, status: "cancelled" } : s)
      )
      tg?.showAlert(`Cancellation started for ${subName}. Check the bot for updates.`)
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background px-6 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <a href="https://unsubly.xyz/register" className="mt-4 text-sm text-indigo-400 underline">
          Create an account
        </a>
      </div>
    )
  }

  const active = subscriptions.filter((s) => s.status === "active")
  const cancelled = subscriptions.filter((s) => s.status === "cancelled")

  return (
    <div className="min-h-screen bg-background px-4 py-5 pb-20">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-display font-semibold text-foreground">
          Hey, {tgUser?.first_name} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {active.length} active · {subscriptions[0]?.currency || "INR"} {totalMonthly.toFixed(0)}/mo
        </p>
      </div>

      {/* Active subscriptions */}
      {active.length > 0 && (
        <div className="space-y-2.5">
          {active.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center justify-between p-3.5 rounded-xl border border-border/50 bg-background"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{sub.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sub.billing_cycle} · Next: {sub.next_billing_date}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-3">
                <p className="text-sm font-mono font-semibold text-foreground">
                  {sub.currency} {sub.amount?.toFixed(0)}
                </p>
                <button
                  onClick={() => handleCancel(sub.id, sub.name)}
                  className="text-[10px] px-2 py-1 rounded-full border border-red-300/30 text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancelled */}
      {cancelled.length > 0 && (
        <div className="mt-6">
          <p className="text-xs text-muted-foreground/60 uppercase tracking-wider mb-2">Cancelled</p>
          <div className="space-y-2">
            {cancelled.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between p-3 rounded-xl border border-border/30 bg-muted/20 opacity-60"
              >
                <p className="text-sm text-muted-foreground line-through">{sub.name}</p>
                <p className="text-xs text-muted-foreground">{sub.currency} {sub.amount?.toFixed(0)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {subscriptions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Add them on the web app or send SMS to the bot.</p>
        </div>
      )}

      {/* Footer stats */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-3 border-t border-border/40 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{active.length} active · {cancelled.length} cancelled</span>
          <a href="https://unsubly.xyz/dashboard" className="text-indigo-400">Open full app →</a>
        </div>
      </div>
    </div>
  )
}
