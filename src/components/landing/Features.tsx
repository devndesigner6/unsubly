import { useEffect, useRef, useState } from "react"
import {
  RiPieChartLine,
  RiNotification3Line,
  RiFolderLine,
  RiPriceTag3Line,
  RiFileTextLine,
  RiShieldCheckLine,
} from "@remixicon/react"

const features = [
  {
    icon: RiPieChartLine,
    title: "Spending Analytics",
    description: "Visualize your subscription spending with charts and breakdowns by category, billing cycle, and more.",
  },
  {
    icon: RiNotification3Line,
    title: "Payment Alerts",
    description: "Get notified before charges hit. Never be surprised by a renewal again.",
  },
  {
    icon: RiFolderLine,
    title: "Folders & Tags",
    description: "Organize subscriptions your way with custom folders and color-coded tags.",
  },
  {
    icon: RiPriceTag3Line,
    title: "Multi-Currency",
    description: "Track subscriptions in any currency with automatic conversion and formatting.",
  },
  {
    icon: RiFileTextLine,
    title: "CSV Import",
    description: "Bulk import your existing subscriptions from spreadsheets in seconds.",
  },
  {
    icon: RiShieldCheckLine,
    title: "Secure & Private",
    description: "Your data stays yours. Protected by authentication and row-level security.",
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
    <section id="features" className="py-16 sm:py-20 lg:py-24 overflow-hidden">
      <div ref={ref} className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className={`text-center mb-12 sm:mb-16 transition-all duration-1000 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
          <p className="font-display italic text-base text-muted-foreground mb-3">What you get</p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl text-foreground tracking-tight leading-[1.1]">
            Everything to manage
            <br />
            <span className="text-muted-foreground/50">your subscriptions</span>
          </h2>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`group rounded-2xl border border-border bg-background p-6 sm:p-7 transition-all duration-700 hover:border-foreground/20 hover:shadow-sm ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-muted mb-4">
                <feature.icon className="size-5 text-foreground" />
              </div>
              <h3 className="text-base font-medium text-foreground tracking-tight">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
