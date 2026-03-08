import { useEffect, useRef, useState } from "react"
import { RiArrowRightLine } from "@remixicon/react"
import { Link } from "react-router-dom"

const features = [
  {
    title: "Escrow Vaults",
    subtitle: "Lock & control every payment",
    description: "A new category of payment protection. Lock subscription funds in Algorand escrow vaults — your money stays under your control until you authorize release.",
    highlight: "escrow vaults",
  },
  {
    title: "Kill Switch",
    subtitle: "One-click subscription termination",
    description: "Instantly freeze any subscription payment with a single click. The provider can never withdraw once the kill switch is activated. Recorded permanently on-chain.",
    highlight: "kill switch",
  },
  {
    title: "On-Chain Resume",
    subtitle: "Your verifiable payment history",
    description: "Build a tamper-proof, blockchain-verified payment history. Prove your reliability as a payer to anyone, anywhere — powered by Algorand's immutable ledger.",
    highlight: "on-chain resume",
  },
]

export function Features() {
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
    <section id="features" className="py-24 sm:py-32 lg:py-40 overflow-hidden">
      <div ref={ref} className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Main Feature - Large editorial layout */}
        <div className={`transition-all duration-1000 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
          <div className="flex items-start gap-2 mb-4">
            <p className="font-display italic text-lg text-muted-foreground">Introducing</p>
          </div>
          <h2 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-foreground tracking-tight leading-[1.05]">
            Our smartest system
            <br />
            <span className="text-muted-foreground/50">capable of </span>
            <span className="text-foreground">protecting
            <br />
            your money</span>
          </h2>
        </div>

        {/* Feature Grid */}
        <div className="mt-20 sm:mt-28 space-y-0 divide-y divide-border">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`group grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 py-12 sm:py-16 transition-all duration-700 ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
              }`}
              style={{ transitionDelay: `${(index + 1) * 200}ms` }}
            >
              <div className="lg:col-span-4">
                <span className="text-xs text-muted-foreground tracking-widest uppercase">0{index + 1}</span>
                <h3 className="mt-3 font-display text-3xl sm:text-4xl text-foreground tracking-tight">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.subtitle}</p>
              </div>
              <div className="lg:col-span-6 lg:col-start-6">
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">{feature.description}</p>
                <Link
                  to="/register"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-foreground group/link"
                >
                  <div className="flex size-8 items-center justify-center rounded-full border border-border bg-background transition-colors group-hover/link:bg-foreground group-hover/link:text-background">
                    <RiArrowRightLine className="size-3.5" />
                  </div>
                  <span className="transition-transform group-hover/link:translate-x-1">Learn More</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
