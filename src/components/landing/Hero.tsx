import { useEffect, useState } from "react"
import { Button } from "@/components/Button"
import { RiArrowRightLine } from "@remixicon/react"
import { Link } from "react-router-dom"

export function Hero() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(true)
  }, [])

  return (
    <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 lg:pt-48 lg:pb-36 overflow-hidden">
      {/* Subtle connection lines like PlayerZero */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <svg className="absolute top-1/3 left-0 w-full h-64 opacity-[0.08]" viewBox="0 0 1200 200" fill="none">
          <line x1="0" y1="100" x2="400" y2="100" stroke="currentColor" strokeWidth="1" className="text-foreground" />
          <line x1="800" y1="100" x2="1200" y2="100" stroke="currentColor" strokeWidth="1" className="text-foreground" />
          <line x1="400" y1="100" x2="400" y2="40" stroke="currentColor" strokeWidth="1" className="text-foreground" />
          <line x1="800" y1="100" x2="800" y2="40" stroke="currentColor" strokeWidth="1" className="text-foreground" />
          <circle cx="400" cy="100" r="3" fill="currentColor" className="text-foreground" />
          <circle cx="800" cy="100" r="3" fill="currentColor" className="text-foreground" />
        </svg>
      </div>

      {/* Floating labels */}
      <div className={`absolute left-[10%] top-[35%] hidden lg:block transition-all duration-1000 delay-700 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        <span className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] tracking-wide text-muted-foreground">Escrow</span>
      </div>
      <div className={`absolute right-[12%] top-[30%] hidden lg:block transition-all duration-1000 delay-900 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        <span className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] tracking-wide text-muted-foreground">Algorand</span>
      </div>
      <div className={`absolute left-[20%] bottom-[25%] hidden lg:block transition-all duration-1000 delay-1100 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        <span className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] tracking-wide text-muted-foreground">Kill Switch</span>
      </div>
      <div className={`absolute right-[18%] bottom-[30%] hidden lg:block transition-all duration-1000 delay-800 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        <span className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] tracking-wide text-muted-foreground">Resume</span>
      </div>

      <div className="relative mx-auto max-w-5xl px-6 lg:px-8 text-center">
        {/* Large stencil-style heading */}
        <h1
          className={`font-display text-6xl sm:text-7xl md:text-8xl lg:text-9xl tracking-tight leading-[0.9] text-foreground transition-all duration-1000 ${
            loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          }`}
        >
          TRACK.
          <br />
          <span className="text-muted-foreground/40">CONTROL.</span>
        </h1>

        {/* Center icon/logo element */}
        <div className={`mt-10 mb-10 flex justify-center transition-all duration-1000 delay-200 ${loaded ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
          <div className="relative">
            <div className="absolute -inset-4 rounded-2xl border border-border/50" />
            <div className="absolute -inset-8 rounded-3xl border border-border/30" />
            <div className="relative flex size-16 items-center justify-center rounded-xl bg-foreground shadow-2xl">
              <svg viewBox="0 0 24 24" fill="none" className="size-8 text-background">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" opacity="0.3" />
                <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Second heading */}
        <h2
          className={`font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight leading-[0.9] text-foreground transition-all duration-1000 delay-300 ${
            loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          }`}
        >
          SAVE.
        </h2>

        <p
          className={`mt-8 sm:mt-10 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed transition-all duration-1000 delay-500 ${
            loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          Unsubscribely brings blockchain to subscription management.
          <br className="hidden sm:block" />
          Lock payments in Algorand escrow vaults, kill unwanted charges instantly.
        </p>

        <div
          className={`mt-10 flex justify-center transition-all duration-1000 delay-600 ${
            loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <Button asChild className="rounded-full bg-foreground text-background hover:bg-foreground/90 px-7 py-6 text-sm font-medium gap-2 group">
            <Link to="/register">
              <div className="flex size-6 items-center justify-center rounded-md bg-background/20">
                <RiArrowRightLine className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
              Get Started Free
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
