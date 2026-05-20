import { useState } from "react"

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
  const [showLegend, setShowLegend] = useState(false)
  const okCount = ticks.filter((t) => t.status === "ok").length
  const failCount = ticks.filter((t) => t.status === "fail").length

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          {label}
          <button
            type="button"
            onClick={() => setShowLegend(!showLegend)}
            className="inline-flex size-4 items-center justify-center rounded-full border border-border text-[9px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="What does this mean?"
            aria-label="Show heartbeat legend"
          >
            ?
          </button>
        </span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {okCount} ok · {failCount} fail · {ticks.length - okCount - failCount} pending
        </span>
      </div>

      {showLegend && (
        <div className="rounded-lg border border-border bg-muted/60 p-2.5 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Each bar = one hourly agent run</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            <span><span className="font-mono text-foreground">●</span> Green = success</span>
            <span><span className="font-mono text-destructive">×</span> Red = error</span>
            <span><span className="font-mono text-muted-foreground/50">·</span> Grey = no run yet</span>
          </div>
          <p className="text-[10px]">Hover any dot for the exact timestamp.</p>
        </div>
      )}

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
