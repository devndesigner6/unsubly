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
    <section className="relative pt-32 pb-16 sm:pt-40 sm:pb-20 lg:pt-44 lg:pb-24 overflow-hidden">
      {/* Subtle connection lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <svg className="absolute top-1/3 left-0 w-full h-64 opacity-[0.08]" viewBox="0 0 1200 200" fill="none">
          <line x1="0" y1="100" x2="400" y2="100" stroke="currentColor" strokeWidth="1" className="text-foreground" />
          <line x1="800" y1="100" x2="1200" y2="100" stroke="currentColor" strokeWidth="1" className="text-foreground" />
          <circle cx="400" cy="100" r="3" fill="currentColor" className="text-foreground" />
          <circle cx="800" cy="100" r="3" fill="currentColor" className="text-foreground" />
        </svg>
      </div>

      <div className="relative mx-auto max-w-5xl px-6 lg:px-8 text-center">
        {/* About Unsubscribely first */}
        <p
          className={`text-sm sm:text-base text-muted-foreground tracking-wide uppercase mb-6 transition-all duration-700 ${
            loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          Subscription Management, Reimagined
        </p>

        {/* TRACK. CONTROL. SAVE. — compact with tilted CONTROL */}
        <h1
          className={`font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight leading-[0.95] text-foreground transition-all duration-1000 ${
            loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          }`}
        >
          TRACK.{" "}
          <span className="italic text-muted-foreground/50">CONTROL.</span>{" "}
          SAVE.
        </h1>

        <p
          className={`mt-6 sm:mt-8 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed transition-all duration-1000 delay-300 ${
            loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          Unsubscribely helps you manage every subscription in one place.
          <br className="hidden sm:block" />
          Track spending, get alerts, and take back control of your money.
        </p>

        <div
          className={`mt-8 flex justify-center transition-all duration-1000 delay-500 ${
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
