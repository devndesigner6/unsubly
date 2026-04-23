type Tick = {
  /** Unix ms of the scheduled run */
  at: number
  /** ok = ran successfully, fail = errored, scheduled = future or no-data */
  status: "ok" | "fail" | "scheduled"
}

type Props = {
  ticks: Tick[]
  label?: string
}

/**
 * Last-N hourly heartbeats as monospace dots. Filled circle = ok, X = fail,
 * hollow = scheduled / no data. Hovering any dot shows the exact UTC stamp
 * via the title attribute.
 */
export function HeartbeatStrip({ ticks, label = "Last 24 hourly runs" }: Props) {
  const okCount = ticks.filter((t) => t.status === "ok").length
  const failCount = ticks.filter((t) => t.status === "fail").length

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {okCount} ok · {failCount} fail · {ticks.length - okCount - failCount} pending
        </span>
      </div>
      <div className="flex items-center gap-[3px] font-mono text-base leading-none">
        {ticks.map((t, i) => {
          const utc = new Date(t.at).toISOString().replace("T", " ").slice(0, 16) + " UTC"
          const glyph =
            t.status === "ok"   ? "\u25CF" :
            t.status === "fail" ? "\u00D7" :
                                  "\u00B7"
          const color =
            t.status === "ok"   ? "text-foreground" :
            t.status === "fail" ? "text-destructive" :
                                  "text-muted-foreground/50"
          return (
            <button
              key={i}
              type="button"
              tabIndex={0}
              title={`${utc} - ${t.status}`}
              aria-label={`${utc} - ${t.status}`}
              className={`inline-block w-3 cursor-help bg-transparent text-center outline-none transition-colors hover:text-primary focus-visible:rounded focus-visible:ring-2 focus-visible:ring-primary ${color}`}
            >
              {glyph}
            </button>
          )
        })}
      </div>
    </div>
  )
}
