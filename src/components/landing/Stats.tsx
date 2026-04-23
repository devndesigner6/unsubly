import { useEffect, useState, useRef } from "react"

const partners = [
  { name: "Algorand", logo: "◆" },
  { name: "Pera Wallet", logo: "⬡" },
]

const stats = [
  { value: "3.3s", label: "Transaction finality" },
  { value: "<$0.01", label: "Per transaction fee" },
]

export function Stats() {
  const [inView, setInView] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold: 0.2 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={ref} className="py-12 sm:py-16 border-y border-border overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-border transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          {/* Partner 1 */}
          <div className="flex flex-col items-start gap-4 py-6 md:py-0 md:pr-8">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{partners[0].logo}</span>
              <span className="text-sm font-medium text-foreground tracking-tight">{partners[0].name}</span>
            </div>
            <div>
              <p className="font-display text-5xl sm:text-6xl text-foreground tracking-tight">{stats[0].value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stats[0].label}</p>
            </div>
          </div>

          {/* Partner 2 */}
          <div className="flex flex-col items-start gap-4 py-6 md:py-0 md:px-8">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{partners[1].logo}</span>
              <span className="text-sm font-medium text-foreground tracking-tight">{partners[1].name}</span>
            </div>
            <div>
              <p className="font-display text-5xl sm:text-6xl text-foreground tracking-tight">{stats[1].value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stats[1].label}</p>
            </div>
          </div>

          {/* CTA Column */}
          <div className="flex flex-col items-start justify-between gap-4 py-6 md:py-0 md:pl-8">
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Powered by Algorand blockchain. Sub-penny fees, instant finality, and carbon-negative infrastructure.
            </p>
            <a
              href="/register"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <div className="flex size-5 items-center justify-center rounded bg-foreground">
                <svg viewBox="0 0 24 24" fill="none" className="size-3 text-background">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" />
                </svg>
              </div>
              Sign up
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
