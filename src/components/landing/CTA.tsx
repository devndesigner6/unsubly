import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/Button"
import { RiArrowRightLine } from "@remixicon/react"
import { Link } from "react-router-dom"

export function CTA() {
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
    <section className="py-20 sm:py-24 lg:py-32 border-t border-border overflow-hidden">
      <div ref={ref} className="mx-auto max-w-5xl px-6 lg:px-8 text-center">
        <div className={`transition-all duration-1000 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
          <h2 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-foreground tracking-tight leading-[0.9]">
            TAKE
            <br />
            <span className="text-muted-foreground/40">CONTROL.</span>
          </h2>
          <p className="mt-8 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Start tracking subscriptions, locking payments in escrow,
            and building your on-chain financial identity. 100% free.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild className="rounded-full bg-foreground text-background hover:bg-foreground/90 px-8 py-6 text-sm font-medium gap-2 group w-full sm:w-auto">
              <Link to="/register">
                <div className="flex size-6 items-center justify-center rounded-md bg-background/20">
                  <RiArrowRightLine className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
                Get Started Free
              </Link>
            </Button>
            <Button variant="ghost" asChild className="rounded-full px-8 py-6 text-sm text-muted-foreground hover:text-foreground w-full sm:w-auto">
              <a href="#how-it-works">See How It Works</a>
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            {["No credit card", "Free forever", "Open source"].map((item) => (
              <span key={item} className="flex items-center gap-2">
                <span className="size-1 rounded-full bg-foreground/30" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
