import { useEffect, useRef, useState } from "react"

const useCases = [
  {
    title: "Cross-border subscriptions",
    description: "Pay for international services without bank fees or 3-5 day delays. Lock ALGO in a vault, agent releases on schedule — anywhere in the world.",
  },
  {
    title: "Freelancer & gig worker tools",
    description: "Automate recurring SaaS payments. No chasing invoices, no payment delays. On-chain proof of every payout for your financial resume.",
  },
  {
    title: "SME subscription management",
    description: "Small businesses automate recurring vendor payments without complex payment gateways. The smart contract is the payment processor.",
  },
]

export function IndiaSection() {
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
    <section className="py-16 sm:py-20 lg:py-24 border-t border-border overflow-hidden">
      <div ref={ref} className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">

          {/* Left */}
          <div className={`transition-all duration-1000 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 mb-6">
              <span className="text-base">🌍</span>
              <span className="text-xs text-muted-foreground font-medium">Built on Algorand</span>
            </div>
            <h2 className="font-display text-4xl sm:text-5xl md:text-6xl text-foreground tracking-tight leading-[1.05]">
              Built for
              <br />
              the global
              <br />
              <span className="text-muted-foreground/50">digital economy</span>
            </h2>
            <p className="mt-6 text-base text-muted-foreground leading-relaxed max-w-md">
              Billions of people pay for recurring services but have no control over when or how much leaves their account. Unsubscribely puts you back in charge — trustless, autonomous, and on-chain.
            </p>
          </div>

          {/* Right — use cases */}
          <div className={`transition-all duration-1000 delay-300 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
            <div className="space-y-0 divide-y divide-border">
              {useCases.map((item, index) => (
                <div
                  key={item.title}
                  className={`py-6 transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                  style={{ transitionDelay: `${(index + 1) * 150}ms` }}
                >
                  <h3 className="text-base font-medium text-foreground tracking-tight">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
