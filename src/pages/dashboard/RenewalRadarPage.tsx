import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  RiRadarLine, RiAlertLine, RiCheckLine, RiTimeLine,
  RiArrowRightLine, RiLoader4Line,
} from "@remixicon/react"
import { useAuth } from "@/lib/auth-context"
import { fetchSubscriptions } from "@/lib/supabase-queries"
import { formatCurrency } from "@/lib/currency"
import { getGuardrails, assessRenewalRisk, type RenewalRisk } from "@/lib/budget"

interface SubRow {
  id: string
  name: string
  amount: number
  currency: string | null
  next_billing_date: string | null
  status: string | null
  billing_cycle: string
}

interface RadarItem {
  sub: SubRow
  risk: RenewalRisk
  daysUntil: number | null
  totalDue: number
}

const today = () => new Date().toISOString().slice(0, 10)
const daysFrom = (iso: string | null): number | null => {
  if (!iso) return null
  const a = Date.parse(today() + "T00:00:00Z")
  const b = Date.parse(iso + "T00:00:00Z")
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.round((b - a) / 86_400_000)
}

function RiskBadge({ risk }: { risk: RenewalRisk }) {
  if (risk.level === "danger") {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
        <RiAlertLine className="size-3" /> Action needed
      </span>
    )
  }
  if (risk.level === "warn") {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
        <RiTimeLine className="size-3" /> Soon
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded border border-gray-300 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 dark:border-gray-700 dark:text-gray-400">
      <RiCheckLine className="size-3" /> Healthy
    </span>
  )
}

export default function RenewalRadarPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<RadarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [windowDays, setWindowDays] = useState<7 | 14 | 30>(14)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user) return
      setLoading(true)
      try {
        const subs = (await fetchSubscriptions(user.id)) as SubRow[]
        const built: RadarItem[] = subs
          .filter((s) => s.status === "active" || s.status === "trial")
          .map((sub) => {
            const guardrails = getGuardrails(sub.id)
            const risk = assessRenewalRisk({
              amount: sub.amount,
              currency: sub.currency,
              nextBillingDate: sub.next_billing_date,
              status: sub.status,
              guardrails,
            })
            return {
              sub,
              risk,
              daysUntil: daysFrom(sub.next_billing_date),
              totalDue: sub.amount,
            }
          })
        if (!cancelled) setItems(built)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [user])

  const filtered = useMemo(() => {
    return items
      .filter((it) => it.daysUntil != null && it.daysUntil >= 0 && it.daysUntil <= windowDays)
      .sort((a, b) => {
        const order = { danger: 0, warn: 1, ok: 2 } as const
        const da = order[a.risk.level]
        const db = order[b.risk.level]
        if (da !== db) return da - db
        return (a.daysUntil ?? 0) - (b.daysUntil ?? 0)
      })
  }, [items, windowDays])

  const totals = useMemo(() => {
    const grouped = new Map<string, number>()
    for (const it of filtered) {
      const cur = it.sub.currency || "USD"
      grouped.set(cur, (grouped.get(cur) ?? 0) + it.totalDue)
    }
    return Array.from(grouped.entries())
  }, [filtered])

  const atRiskCount = filtered.filter((i) => i.risk.level !== "ok").length

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <RiRadarLine className="size-5 text-gray-700 dark:text-gray-300" />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Renewal Radar
          </h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Upcoming renewals with smart alerts for trial conversions, budget overruns,
          and pending agent approvals. Configure per-subscription guardrails from
          each subscription's edit page.
        </p>
      </header>

      <div className="flex items-center gap-2">
        {[7, 14, 30].map((d) => (
          <button
            key={d}
            onClick={() => setWindowDays(d as 7 | 14 | 30)}
            className={[
              "rounded border px-3 py-1 text-xs",
              windowDays === d
                ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
                : "border-gray-200 text-gray-700 hover:border-gray-400 dark:border-gray-800 dark:text-gray-300 dark:hover:border-gray-600",
            ].join(" ")}
            title={`Show renewals in the next ${d} days`}
          >
            Next {d} days
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
          <div className="text-xs uppercase tracking-wide text-gray-500">Renewals due</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-50">{filtered.length}</div>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
          <div className="text-xs uppercase tracking-wide text-gray-500">Need attention</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-50">{atRiskCount}</div>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
          <div className="text-xs uppercase tracking-wide text-gray-500">Total due</div>
          <div className="mt-1 space-y-0.5 text-sm">
            {totals.length === 0 ? (
              <span className="text-gray-400">—</span>
            ) : totals.map(([cur, amt]) => (
              <div key={cur} className="font-medium text-gray-900 dark:text-gray-50">
                {formatCurrency(amt, cur)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <RiLoader4Line className="mr-2 size-4 animate-spin" /> Loading renewals…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 px-6 py-12 text-center text-sm text-gray-500 dark:border-gray-700">
          No renewals due in the next {windowDays} days. You're clear.
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 overflow-hidden rounded-md border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-950">
          {filtered.map(({ sub, risk, daysUntil }) => (
            <li key={sub.id} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-gray-900 dark:text-gray-100">
                    {sub.name}
                  </span>
                  <RiskBadge risk={risk} />
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {formatCurrency(sub.amount, sub.currency || "USD")} · {sub.billing_cycle}
                  {daysUntil != null && (
                    <> · in {daysUntil === 0 ? "today" : `${daysUntil} day${daysUntil === 1 ? "" : "s"}`}</>
                  )}
                </div>
                {risk.reasons.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-gray-700 dark:text-gray-300">
                    {risk.reasons.map((r, i) => (
                      <li key={i}>· {r}</li>
                    ))}
                  </ul>
                )}
              </div>
              <Link
                to={`/subscriptions/${sub.id}`}
                title="Edit subscription & guardrails"
                className="flex shrink-0 items-center gap-1 text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                Edit <RiArrowRightLine className="size-3.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
