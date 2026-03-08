import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/Button"
import { RiArrowRightLine } from "@remixicon/react"
import { Link } from "react-router-dom"

const steps = [
  {
    number: "01",
    title: "Connect Wallet",
    description: "Link your Pera Wallet to Unsubscribely. Your keys, your control — we never hold your funds.",
  },
  {
    number: "02",
    title: "Add Subscriptions",
    description: "Import via CSV or add manually. Set billing cycles, amounts, and organize with folders and tags.",
  },
  {
    number: "03",
    title: "Lock & Protect",
    description: "Create escrow vaults for each subscription. Set kill switches. Build your on-chain payment resume.",
  },
]

export function HowItWorks() {
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
    <section id="how-it-works" className="py-20 sm:py-24 lg:py-32 border-t border-border overflow-hidden">
      <div ref={ref} className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className={`transition-all duration-1000 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
          <p className="font-display italic text-lg text-muted-foreground">How it works</p>
          <h2 className="mt-4 font-display text-4xl sm:text-5xl md:text-6xl text-foreground tracking-tight leading-[1.05]">
            Three steps to
            <br />
            <span className="text-muted-foreground/50">financial freedom</span>
          </h2>
        </div>

        <div className="mt-20 sm:mt-28">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className={`py-10 md:py-0 md:px-10 first:pl-0 last:pr-0 transition-all duration-700 ${
                  inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
                }`}
                style={{ transitionDelay: `${(index + 1) * 200}ms` }}
              >
                <span className="font-display text-7xl sm:text-8xl text-border/60">{step.number}</span>
                <h3 className="mt-4 text-xl font-medium text-foreground tracking-tight">{step.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={`mt-16 sm:mt-20 transition-all duration-700 delay-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <Button asChild className="rounded-full bg-foreground text-background hover:bg-foreground/90 px-7 py-6 text-sm font-medium gap-2 group">
            <Link to="/register">
              <div className="flex size-6 items-center justify-center rounded-md bg-background/20">
                <RiArrowRightLine className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
              Start Building
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
