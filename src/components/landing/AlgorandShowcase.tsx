import { useEffect, useRef, useState } from "react"
import { RiShieldLine, RiAlarmWarningLine, RiFileChartLine, RiLockLine, RiArrowRightLine } from "@remixicon/react"
import { Link } from "react-router-dom"

const blockchainFeatures = [
  {
    title: "Escrow Vaults",
    description: "Lock subscription payments in secure Algorand vaults. Your money stays under your control until you authorize the release.",
    icon: RiLockLine,
    demo: (
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <RiLockLine className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">Netflix Vault</p>
              <p className="text-[10px] text-muted-foreground">14.99 ALGO</p>
            </div>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Locked</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <RiShieldLine className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">Spotify Vault</p>
              <p className="text-[10px] text-muted-foreground">9.99 ALGO</p>
            </div>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Locked</span>
        </div>
      </div>
    ),
  },
  {
    title: "Kill Switch",
    description: "Instantly freeze any subscription payment with one click. The service provider can never withdraw a single cent once activated.",
    icon: RiAlarmWarningLine,
    demo: (
      <div className="space-y-3">
        <div className="rounded-lg border-2 border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <RiAlarmWarningLine className="size-5 text-destructive" />
            <span className="text-sm font-semibold text-destructive">Kill Switch Activated</span>
          </div>
          <p className="text-xs text-muted-foreground">Adobe CC subscription has been permanently blocked. No further charges possible.</p>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-muted">
              <div className="h-full w-full rounded-full bg-destructive" />
            </div>
            <span className="text-[10px] font-medium text-destructive">Blocked</span>
          </div>
        </div>
        <p className="text-center text-[10px] text-muted-foreground">Recorded on Algorand Testnet • Block #28,493,102</p>
      </div>
    ),
  },
  {
    title: "On-Chain Resume",
    description: "Build a verifiable, tamper-proof payment history on the Algorand blockchain. Prove your reliability as a payer to anyone.",
    icon: RiFileChartLine,
    demo: (
      <div className="space-y-2">
        {[
          { name: "Netflix Payment", amount: "14.99", date: "Mar 1, 2026", verified: true },
          { name: "Spotify Payment", amount: "9.99", date: "Mar 1, 2026", verified: true },
          { name: "Kill Switch: Adobe", amount: "0.00", date: "Feb 28, 2026", verified: true },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-2.5">
            <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center">
              <RiFileChartLine className="size-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
              <p className="text-[10px] text-muted-foreground">{item.date}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-foreground">{item.amount} ALGO</p>
              <p className="text-[10px] text-primary">✓ Verified</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
]

export function AlgorandShowcase() {
  const [inView, setInView] = useState(false)
  const [activeFeature, setActiveFeature] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!inView) return
    const timer = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 3)
    }, 4000)
    return () => clearInterval(timer)
  }, [inView])

  return (
    <section id="blockchain" className="py-16 sm:py-24 lg:py-32 bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className={`mx-auto max-w-2xl text-center transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
            </span>
            <span className="font-medium text-primary">Powered by Algorand</span>
          </div>
          <h2 className="mt-6 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground">
            Blockchain-powered
            <br />
            <span className="text-muted-foreground">financial control</span>
          </h2>
          <p className="mt-6 text-base sm:text-lg text-muted-foreground">
            Your money, your rules. Algorand's sub-penny transaction fees and instant finality give you absolute control over every subscription payment.
          </p>
        </div>

        {/* Feature Cards + Demo */}
        <div className="mt-12 sm:mt-16 lg:mt-20 grid lg:grid-cols-2 gap-8 lg:gap-16 items-start">
          {/* Left - Feature Selectors */}
          <div className="space-y-4">
            {blockchainFeatures.map((feature, index) => (
              <div
                key={feature.title}
                onClick={() => setActiveFeature(index)}
                className={`rounded-2xl border p-5 sm:p-6 cursor-pointer transition-all duration-500 ${
                  activeFeature === index
                    ? "border-primary bg-card shadow-lg"
                    : "border-border bg-card/50 hover:border-primary/30"
                } ${inView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                    activeFeature === index ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    <feature.icon className="size-5" />
                  </div>
                  <div>
                    <h3 className={`text-base sm:text-lg font-semibold transition-colors ${
                      activeFeature === index ? "text-foreground" : "text-muted-foreground"
                    }`}>
                      {feature.title}
                    </h3>
                    <p className={`mt-1.5 text-sm leading-relaxed transition-colors ${
                      activeFeature === index ? "text-muted-foreground" : "text-muted-foreground/70"
                    }`}>
                      {feature.description}
                    </p>
                  </div>
                </div>
                {activeFeature === index && (
                  <div className="mt-4 h-0.5 rounded-full bg-primary animate-[progress_4s_linear]" />
                )}
              </div>
            ))}
          </div>

          {/* Right - Interactive Demo */}
          <div className={`relative transition-all duration-700 delay-300 ${inView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}>
            <div className="sticky top-24">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-border pb-4 mb-5">
                  <div className="flex items-center gap-2">
                    <div className="size-3 rounded-full bg-destructive/60" />
                    <div className="size-3 rounded-full bg-primary/40" />
                    <div className="size-3 rounded-full bg-primary/60" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Unsubscribely • Algorand Testnet</span>
                </div>
                {blockchainFeatures.map((feature, index) => (
                  <div
                    key={feature.title}
                    className={`transition-all duration-500 ${
                      activeFeature === index ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 absolute inset-x-6 pointer-events-none"
                    }`}
                  >
                    {activeFeature === index && feature.demo}
                  </div>
                ))}
              </div>

              {/* Algorand Trust Badges */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary"></span>
                  Sub-penny fees
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary"></span>
                  3.3s finality
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary"></span>
                  Carbon negative
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className={`mt-12 sm:mt-16 flex items-center justify-center transition-all duration-700 delay-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <Link
            to="/register"
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
          >
            Get Started with Algorand
            <RiArrowRightLine className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  )
}
