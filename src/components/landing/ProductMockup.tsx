import { motion, AnimatePresence } from "motion/react"
import { useState, useEffect, useRef, useCallback } from "react"

// Subscription data — real logos from SimpleIcons CDN
const MOCK_SUBS = [
  { name: "Apple Music", icon: "https://cdn.simpleicons.org/applemusic/FA243C", price: 180, currency: "₹", cycle: "Monthly" },
  { name: "Spotify", icon: "https://cdn.simpleicons.org/spotify/1DB954", price: 139, currency: "₹", cycle: "Monthly" },
  { name: "Cursor", icon: "https://cdn.simpleicons.org/cursor", price: 25, currency: "$", cycle: "Monthly" },
  { name: "GitHub Pro", icon: "https://cdn.simpleicons.org/github", price: 30, currency: "$", cycle: "Monthly" },
  { name: "Duolingo", icon: "https://cdn.simpleicons.org/duolingo/58CC02", price: 84, currency: "$", cycle: "Monthly" },
  { name: "Gemini Pro", icon: "https://cdn.simpleicons.org/googlegemini/8E75B2", price: 249.99, currency: "$", cycle: "Monthly" },
  { name: "YouTube", icon: "https://cdn.simpleicons.org/youtube/FF0000", price: 13.99, currency: "$", cycle: "Monthly" },
  { name: "Notion", icon: "https://cdn.simpleicons.org/notion", price: 100, currency: "$", cycle: "Quarterly" },
  { name: "Linear", icon: "https://cdn.simpleicons.org/linear/5E6AD2", price: 8, currency: "$", cycle: "Monthly" },
]

// Convert all prices to USD equivalent for the drain counter
function toUSD(price: number, currency: string) {
  return currency === "₹" ? price * 0.012 : price
}

const TOTAL_USD = MOCK_SUBS.reduce((sum, s) => sum + toUSD(s.price, s.currency), 0)

function SubCard({ sub, index, killed, onKill }: {
  sub: typeof MOCK_SUBS[0]
  index: number
  killed: boolean
  onKill: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.07, type: "spring", stiffness: 200, damping: 24 }}
      onClick={onKill}
      className={`relative rounded-xl border p-3 cursor-pointer select-none transition-all duration-200 ${
        killed
          ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/[0.03]"
          : "border-border/50 dark:border-white/[0.06] bg-background hover:border-foreground/15 active:scale-[0.97]"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`size-7 rounded-lg border border-border/20 flex items-center justify-center overflow-hidden ${killed ? "bg-emerald-500/10" : "bg-muted/40 dark:bg-white/5"}`}>
            <img
              src={sub.icon}
              alt={sub.name}
              className={`size-4 object-contain ${killed ? "opacity-40 grayscale" : ""}`}
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(sub.name.slice(0, 2))}&background=f5f5f4&color=1c1917&size=28&font-size=0.5&bold=true`
              }}
            />
          </div>
          <div>
            <p className={`text-[10px] font-medium leading-tight ${killed ? "text-muted-foreground line-through" : "text-foreground"}`}>{sub.name}</p>
            <p className="text-[8px] text-muted-foreground/50">{sub.cycle}</p>
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between">
        <p className={`font-mono-pixel text-xs font-semibold ${killed ? "text-emerald-500 line-through decoration-emerald-500/50" : "text-foreground"}`}>
          {sub.currency}{sub.price.toFixed(2)}
        </p>
        {killed ? (
          <span className="text-[8px] text-emerald-500 font-medium">✓ saved</span>
        ) : (
          <span className="text-[8px] text-red-400/70 font-mono-pixel">draining</span>
        )}
      </div>

      {/* Kill slash overlay */}
      <AnimatePresence>
        {killed && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            className="absolute top-1/2 left-2 right-2 h-[1.5px] bg-emerald-500/60 origin-left"
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function ProductMockup() {
  const [killedIndices, setKilledIndices] = useState<Set<number>>(new Set())
  const [drainCounter, setDrainCounter] = useState(0)
  const [killFeed, setKillFeed] = useState<string[]>([])
  const [allKilled, setAllKilled] = useState(false)
  const startTime = useRef(Date.now())
  const animRef = useRef<number>(0)

  // Calculate active monthly drain in USD
  const activeDrain = MOCK_SUBS.reduce((sum, sub, i) => {
    if (killedIndices.has(i)) return sum
    return sum + toUSD(sub.price, sub.currency)
  }, 0)

  // Per-second drain rate
  const drainPerSecond = activeDrain / (30 * 24 * 3600)

  // Live drain counter animation
  useEffect(() => {
    const tick = () => {
      const elapsed = (Date.now() - startTime.current) / 1000
      setDrainCounter(elapsed * drainPerSecond)
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [drainPerSecond])

  // Check if all killed
  useEffect(() => {
    if (killedIndices.size === MOCK_SUBS.length && !allKilled) {
      setAllKilled(true)
    }
  }, [killedIndices, allKilled])

  const handleKill = useCallback((index: number) => {
    setKilledIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
        setKillFeed((f) => f.filter((_, i) => i !== f.length - 1))
      } else {
        next.add(index)
        const sub = MOCK_SUBS[index]
        setKillFeed((f) => [...f.slice(-3), `${sub.name} — saved ${sub.currency}${sub.price.toFixed(0)}/mo`])
      }
      // Reset drain counter on each kill
      startTime.current = Date.now()
      return next
    })
    setAllKilled(false)
  }, [])

  const totalSaved = MOCK_SUBS.reduce((sum, sub, i) => {
    if (!killedIndices.has(i)) return sum
    return sum + sub.price
  }, 0)

  return (
    <section className="relative mt-8 pb-16 sm:pb-20 overflow-hidden">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Drain counter */}
        <div className="text-center mb-6">
          <p className="text-[11px] font-mono-pixel text-muted-foreground/50 tracking-wide">
            {killedIndices.size === MOCK_SUBS.length ? (
              <span className="text-emerald-500">$0.00/s — all subscriptions killed 🔒</span>
            ) : (
              <>
                leaking{" "}
                <span className="text-red-400">${drainCounter.toFixed(5)}</span>
                {" "}since you opened this page
                <span className="text-muted-foreground/30"> · click cards to cancel</span>
              </>
            )}
          </p>
        </div>

        {/* Browser frame */}
        <div className="relative">
          {/* Orbital icons */}
          <div className="absolute inset-0 hidden sm:block" style={{ zIndex: 0 }}>
            <style>{`
              @keyframes mockup-orbit {
                from { transform: rotate(0deg) translateX(var(--r)) rotate(0deg); }
                to { transform: rotate(360deg) translateX(var(--r)) rotate(-360deg); }
              }
            `}</style>
            {[
              { src: "/icons/pera-black.svg", srcDark: "/icons/pera-white.svg", alt: "Pera" },
              { src: "/icons/algorand-black.svg", srcDark: "/icons/algorand-white.svg", alt: "Algorand" },
              { src: "/icons/telegram.svg", alt: "Telegram" },
              { src: "/icons/gmail.svg", alt: "Gmail" },
            ].map((icon, i) => (
              <div
                key={icon.alt}
                className="absolute top-1/2 left-1/2 size-10"
                style={{
                  ["--r" as string]: "min(46vw, 380px)",
                  animation: "mockup-orbit 35s linear infinite",
                  animationDelay: `${-i * 8.75}s`,
                }}
              >
                <div className="size-10 rounded-xl bg-background/90 border border-border/50 dark:border-white/10 shadow-md flex items-center justify-center backdrop-blur-sm">
                  {icon.srcDark ? (
                    <>
                      <img src={icon.src} alt={icon.alt} className="size-5 dark:hidden" />
                      <img src={icon.srcDark} alt={icon.alt} className="size-5 hidden dark:block" />
                    </>
                  ) : (
                    <img src={icon.src} alt={icon.alt} className="size-5" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* macOS Browser Window */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full mx-auto rounded-xl border border-black/[0.1] dark:border-white/[0.08] shadow-[0_22px_70px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_22px_70px_4px_rgba(0,0,0,0.4)] overflow-hidden bg-background"
            style={{ zIndex: 10 }}
          >
            {/* Title Bar */}
            <div className="flex items-center h-10 px-4 bg-[#f8f8f7] dark:bg-white/[0.03] border-b border-black/[0.05] dark:border-white/[0.05]">
              <div className="flex items-center gap-2">
                <span className="size-[10px] rounded-full bg-[#FF5F57]" />
                <span className="size-[10px] rounded-full bg-[#FEBC2E]" />
                <span className="size-[10px] rounded-full bg-[#28C840]" />
              </div>
              <div className="flex-1 flex justify-center mx-4">
                <div className="flex items-center gap-1.5 rounded-md bg-black/[0.04] dark:bg-white/[0.05] px-3 py-1 w-full max-w-sm">
                  <svg className="size-2.5 text-muted-foreground/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                  <span className="text-[10px] text-muted-foreground/50 font-mono truncate select-none">unsubly.xyz/subscriptions</span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="bg-[#fafaf9] dark:bg-[#0a0a0a] p-4 sm:p-5">
              {/* Header with live total */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div>
                    <h3 className="text-sm font-display font-semibold text-foreground">Subscriptions</h3>
                    <p className="text-[9px] text-muted-foreground">
                      <span className="font-mono-pixel">{MOCK_SUBS.length - killedIndices.size}</span> active ·{" "}
                      <span className={`font-mono-pixel ${killedIndices.size > 0 ? "text-emerald-500" : ""}`}>
                        ${(TOTAL_USD - MOCK_SUBS.reduce((s, sub, i) => killedIndices.has(i) ? s + toUSD(sub.price, sub.currency) : s, 0)).toFixed(2)}
                      </span>
                      /mo
                      {totalSaved > 0 && (
                        <span className="ml-1.5 text-emerald-500">↓ saved ${totalSaved.toFixed(0)}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-1.5">
                  <span className="text-[8px] px-2 py-1 rounded-full border border-red-400/30 text-red-400 font-mono-pixel">
                    ${drainPerSecond.toFixed(5)}/s
                  </span>
                </div>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {MOCK_SUBS.map((sub, i) => (
                  <SubCard
                    key={sub.name}
                    sub={sub}
                    index={i}
                    killed={killedIndices.has(i)}
                    onKill={() => handleKill(i)}
                  />
                ))}
              </div>

              {/* Kill feed — receipt style */}
              <AnimatePresence>
                {killFeed.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-3 border-t border-dashed border-border/50 dark:border-white/[0.06] pt-2"
                  >
                    {killFeed.map((line, i) => (
                      <motion.p
                        key={`${line}-${i}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-[9px] font-mono-pixel text-emerald-500/80 leading-relaxed"
                      >
                        CANCELLED: {line}
                      </motion.p>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* All killed celebration */}
              <AnimatePresence>
                {allKilled && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-4 text-center py-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5"
                  >
                    <p className="text-xs font-mono-pixel text-emerald-500">
                      🔒 ALL VAULTS LOCKED · $0.00/mo · drain stopped
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-1">you just saved ${TOTAL_USD.toFixed(2)}/mo in 10 seconds</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
