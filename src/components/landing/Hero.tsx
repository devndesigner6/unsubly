import { useEffect, useState } from "react"
import { Button } from "@/components/Button"
import { RiArrowRightLine } from "@remixicon/react"
import { Link } from "react-router-dom"
import { motion } from "motion/react"

// Typewriter phrases — cycles every 4 seconds
const PHRASES = [
  { main: "TRACK.", italic: "CONTROL.", end: "SAVE." },
  { main: "LOCK.", italic: "RELEASE.", end: "PROVE." },
  { main: "AUTOMATE.", italic: "VERIFY.", end: "OWN." },
]

// Agent logos displayed inline in the pill — MCP-compatible AI tools (colored for both themes)
const AGENT_LOGOS = [
  { src: "/icons/openclaw-official.svg", alt: "OpenClaw" },
  { src: "/icons/claude-official.svg", alt: "Claude" },
  { src: "/icons/openai-color.svg", alt: "ChatGPT" },
  { src: "/icons/cursor-color.svg", alt: "Cursor" },
  { src: "/icons/gemini-color.svg", alt: "Gemini" },
]

export function Hero() {
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setPhraseIdx((i) => (i + 1) % PHRASES.length)
        setFading(false)
      }, 250)
    }, 4000)

    return () => clearInterval(interval)
  }, [])

  const phrase = PHRASES[phraseIdx]

  return (
    <section className="relative pt-24 pb-8 sm:pt-32 sm:pb-10 lg:pt-36 lg:pb-12 overflow-hidden">
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

        {/* Agent pill — marquee icons + text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="group inline-flex items-center rounded-full border border-border/40 bg-background/80 backdrop-blur-sm shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] px-1 py-1 mb-6 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.12)] hover:border-border transition-shadow"
        >
          {/* Marquee icon strip */}
          <div className="flex items-center overflow-hidden w-[52px] ml-0.5">
            <div className="flex items-center gap-0.5 animate-[slide_4s_linear_infinite]">
              {[...AGENT_LOGOS, ...AGENT_LOGOS].map((logo, i) => (
                <div key={`${logo.alt}-${i}`} className="flex items-center justify-center size-4 rounded-full bg-muted/60 shrink-0">
                  {logo.srcDark ? (
                    <>
                      <img src={logo.src} alt={logo.alt} className="size-2.5 dark:hidden" />
                      <img src={logo.srcDark} alt={logo.alt} className="size-2.5 hidden dark:block" />
                    </>
                  ) : (
                    <img src={logo.src} alt={logo.alt} className="size-2.5 rounded-sm" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pr-2.5 pl-1.5 flex items-baseline gap-1">
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Autonomous
            </span>
            <span className="font-display italic text-xs text-transparent bg-clip-text bg-gradient-to-r from-foreground via-foreground/50 to-foreground bg-[length:200%_auto] animate-[shimmer_3s_ease-in-out_infinite]">
              connect your agent
            </span>
          </div>
        </motion.div>

        {/* Eyebrow text */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-sm sm:text-base text-muted-foreground tracking-wide uppercase mb-6"
        >
          Subscription Management, Reimagined
        </motion.p>

        {/* Typewriter headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: "easeOut" }}
          className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight leading-[0.95] text-foreground"
        >
          <span
            key={phraseIdx + "-main"}
            className={`inline-block ${fading ? "animate-fade-out" : "animate-fade-in"}`}
          >
            {phrase.main}
          </span>{" "}
          <span
            key={phraseIdx + "-italic"}
            className={`italic text-muted-foreground/50 inline-block ${fading ? "animate-fade-out" : "animate-fade-in"}`}
          >
            {phrase.italic}
          </span>{" "}
          <span
            key={phraseIdx + "-end"}
            className={`inline-block ${fading ? "animate-fade-out" : "animate-fade-in"}`}
          >
            {phrase.end}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45 }}
          className="mt-6 sm:mt-8 font-display text-lg sm:text-xl text-foreground/60 max-w-lg mx-auto leading-relaxed"
        >
          Unsubscribely helps you manage every subscription in one place.
          <br className="hidden sm:block" />
          Track spending, get alerts, and take back control of your money.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-8 flex flex-col items-center gap-4"
        >
          <div className="relative group">
            {/* Shimmer border loop */}
            <div className="absolute -inset-[2px] rounded-full bg-gradient-to-r from-transparent via-gold/50 to-transparent bg-[length:200%_auto] animate-[shimmer_3s_ease-in-out_infinite] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <Button asChild className="relative rounded-full bg-foreground text-background hover:bg-foreground/90 px-7 py-6 text-sm font-medium gap-2 group/btn">
              <Link to="/register">
                <div className="flex size-6 items-center justify-center rounded-md bg-background/20">
                  <RiArrowRightLine className="size-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                </div>
                Get Started Free
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
