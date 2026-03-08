import { useAuth } from "@/lib/auth-context"
import { fetchSubscriptions } from "@/lib/supabase-queries"
import { fetchProfile } from "@/lib/supabase-queries"
import { formatCurrency } from "@/lib/currency"
import { cx } from "@/lib/utils"
import { useState, useEffect, useMemo } from "react"
import {
  RiArrowLeftSLine, RiArrowRightSLine, RiLoader4Line,
  RiWalletLine,
} from "@remixicon/react"

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

export default function CalendarPageContent() {
  const { user } = useAuth()
  const today = new Date()
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [currency, setCurrency] = useState("USD")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const [subs, profile] = await Promise.all([
          fetchSubscriptions(user!.id),
          fetchProfile(user!.id)
        ])
        setSubscriptions(subs)
        setCurrency(profile?.currency || "USD")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay()

  const calendarDays = useMemo(() => {
    const days = []
    for (let i = 0; i < firstDayOfMonth; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)
    return days
  }, [firstDayOfMonth, daysInMonth])

  const getSubsForDay = (day: number) => {
    return subscriptions.filter(sub => {
      const date = new Date(sub.next_billing_date)
      return date.getDate() === day && date.getMonth() === month && date.getFullYear() === year
    })
  }

  const monthlyTotal = subscriptions.reduce((sum, sub) => {
    const date = new Date(sub.next_billing_date)
    if (date.getMonth() === month && date.getFullYear() === year) {
      return sum + (sub.amount || 0)
    }
    return sum
  }, 0)

  if (loading) return <div className="flex h-screen items-center justify-center"><RiLoader4Line className="animate-spin text-primary" /></div>

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-cyan-600 via-teal-600 to-emerald-700">
        <div className="relative mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="flex items-center justify-between text-white">
            <h1 className="text-2xl font-bold">Payment Calendar</h1>
            <div className="flex items-center gap-2 rounded-lg bg-white/10 p-1">
              <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1 hover:bg-white/10 rounded"><RiArrowLeftSLine /></button>
              <span className="min-w-[120px] text-center font-medium">{MONTHS[month]} {year}</span>
              <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1 hover:bg-white/10 rounded"><RiArrowRightSLine /></button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-white">
            <div className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1">
              <RiWalletLine className="size-4" />
              <span>{formatCurrency(monthlyTotal, currency)} this month</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-3 sm:p-6 lg:p-8">
        <div className="grid grid-cols-7 gap-px rounded-xl border border-border bg-border overflow-hidden">
          {DAYS.map(day => (
            <div key={day} className="bg-muted py-2 text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
          {calendarDays.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} className="min-h-[100px] bg-card" />
            const daySubs = getSubsForDay(day)
            const dayTotal = daySubs.reduce((sum, s) => sum + (s.amount || 0), 0)
            
            return (
              <div key={day} className="group relative min-h-[100px] bg-card p-2 transition-colors hover:bg-accent/50">
                <span className={cx(
                  "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                  day === today.getDate() && month === today.getMonth() && year === today.getFullYear() 
                    ? "bg-primary text-primary-foreground" 
                    : "text-foreground"
                )}>
                  {day}
                </span>
                <div className="mt-2 space-y-1">
                  {daySubs.map(sub => (
                    <div key={sub.id} className="truncate rounded px-1.5 py-0.5 text-xs bg-primary/10 text-primary">
                      {sub.name}
                    </div>
                  ))}
                  {dayTotal > 0 && (
                    <div className="mt-1 text-xs font-semibold text-foreground">
                      {formatCurrency(dayTotal, currency)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}