import { useEffect, useRef, useState } from "react"

export function AlgorandShowcase() {
  const [inView, setInView] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="blockchain" className="py-20 sm:py-24 lg:py-32 border-t border-border overflow-hidden">
      <div ref={ref} className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left - Text */}
          <div className={`transition-all duration-1000 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
            <h2 className="font-display text-4xl sm:text-5xl md:text-6xl text-foreground tracking-tight leading-[1.05]">
              Debug any charge
              <br />
              down to a
              <br />
              <span className="text-muted-foreground/50">single transaction,</span>
            </h2>
            <p className="mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg">
              and make sure it <span className="text-foreground font-medium">never happens again</span>
            </p>
          </div>

          {/* Right - Description */}
          <div className={`transition-all duration-1000 delay-300 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The first-of-its-kind decentralized subscription management system that can understand and control payment state across multiple providers using the Algorand blockchain.
            </p>
            <div className="mt-10 space-y-6">
              {[
                { label: "Sub-penny fees", value: "< $0.001 per transaction" },
                { label: "Finality", value: "3.3 seconds average" },
                { label: "Infrastructure", value: "Carbon negative blockchain" },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between border-b border-border pb-4">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-medium text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Decorative dot matrix */}
        <div className={`mt-16 flex justify-end transition-all duration-1000 delay-500 ${inView ? "opacity-100" : "opacity-0"}`}>
          <div className="grid gap-1.5 opacity-[0.06]" style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}>
            {Array.from({ length: 200 }).map((_, i) => (
              <div
                key={i}
                className="size-1 rounded-full bg-foreground"
                style={{ opacity: Math.random() > 0.3 ? 1 : 0 }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
