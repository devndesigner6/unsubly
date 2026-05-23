import { motion, AnimatePresence } from "motion/react"
import { useState, useEffect, useRef, useCallback } from "react"

// Subscription data — matches real app, real logos from SimpleIcons CDN
const MOCK_SUBS = [
  { name: "Apple Music", icon: "https://cdn.simpleicons.org/applemusic/FA243C", price: 180, currency: "₹", cycle: "Monthly", next: "5/24/2026", renews: "6 days" },
  { name: "Spotify", icon: "https://cdn.simpleicons.org/spotify/1DB954", price: 139, currency: "₹", cycle: "Monthly", next: "5/18/2026", renews: "0 days" },
  { name: "Cursor", icon: "https://cdn.simpleicons.org/cursor", price: 25, currency: "$", cycle: "Monthly", next: "5/23/2026", renews: "5 days" },
  { name: "GitHub Pro", icon: "https://cdn.simpleicons.org/github", price: 30, currency: "$", cycle: "Monthly", next: "5/25/2026" },
  { name: "Duolingo Super", icon: "https://cdn.simpleicons.org/duolingo/58CC02", price: 84, currency: "$", cycle: "Monthly", next: "4/25/2027" },
  { name: "Google AI Pro", icon: "https://cdn.simpleicons.org/googlegemini/8E75B2", price: 249.99, currency: "$", cycle: "Monthly", next: "6/3/2026" },
  { name: "YouTube", icon: "https://cdn.simpleicons.org/youtube/FF0000", price: 13.99, currency: "$", cycle: "Monthly", next: "6/5/2026" },
  { name: "Notion", icon: "https://cdn.simpleicons.org/notion", price: 100, currency: "$", cycle: "Monthly", next: "6/5/2026" },
  { name: "Linear", icon: "https://cdn.simpleicons.org/linear/5E6AD2", price: 8, currency: "$", cycle: "Monthly", next: "5/29/2026" },
]

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
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: index * 0.06, type: "spring", stiffness: 220, damping: 26 }}
      onClick={onKill}
      className={`relative rounded-xl border p-3.5 cursor-pointer select-none transition-all duration-200 ${
        killed
          ? "border-indigo-400/40 bg-indigo-400/[0.04]"
          : "border-border/50 dark:border-white/[0.06] bg-background hover:border-foreground/10 active:scale-[0.97]"
      }`}
    >
      {/* Top row: icon + name + status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`size-8 rounded-lg border flex items-center justify-center overflow-hidden ${killed ? "border-indigo-400/30 bg-indigo-400/10" : "border-border/30 bg-muted/30 dark:bg-white/5"}`}>
            <img
              src={sub.icon}
              alt={sub.name}
              className={`size-4.5 object-contain ${killed ? "opacity-40 grayscale" : ""}`}
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(sub.name.slice(0, 2))}&background=f5f5f4&color=1c1917&size=32&font-size=0.45&bold=true`
              }}
            />
          </div>
          <div>
            <p className={`text-[11px] font-medium leading-tight ${killed ? "text-muted-foreground line-through decoration-indigo-400/50" : "text-foreground"}`}>{sub.name}</p>
            <p className="text-[9px] text-muted-foreground/50">{sub.cycle}</p>
          </div>
        </div>
        {killed ? (
          <span className="text-[8px] font-medium text-indigo-400 px-1.5 py-0.5 rounded-full border border-indigo-400/30 bg-indigo-400/10">Saved</span>
        ) : sub.renews ? (
          <span className="text-[8px] font-medium text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10">Renews in {sub.renews}</span>
        ) : (
          <span className="flex items-center gap-1 text-[9px] text-muted-foreground/60">
            <span className="size-1 rounded-full bg-foreground/30" />Active
          </span>
        )}
      </div>

      {/* Price row */}
      <div className="flex items-end justify-between">
        <p className={`font-mono-pixel text-sm font-semibold ${killed ? "text-indigo-400 line-through decoration-indigo-400/40" : "text-foreground"}`}>
          {sub.currency}{sub.price.toFixed(2)}
        </p>
        {killed ? (
          <span className="text-[8px] font-mono-pixel text-indigo-400">✓ on-chain</span>
        ) : (
          <span className="text-[8px] text-red-400/60 font-mono-pixel italic">draining</span>
        )}
      </div>

      {/* Next billing */}
      <p className="mt-1.5 text-[8px] text-muted-foreground/40">Next: {sub.next}</p>
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

  const activeDrain = MOCK_SUBS.reduce((sum, sub, i) => {
    if (killedIndices.has(i)) return sum
    return sum + toUSD(sub.price, sub.currency)
  }, 0)

  const drainPerSecond = activeDrain / (30 * 24 * 3600)

  useEffect(() => {
    const tick = () => {
      const elapsed = (Date.now() - startTime.current) / 1000
      setDrainCounter(elapsed * drainPerSecond)
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [drainPerSecond])

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
      } else {
        next.add(index)
        const sub = MOCK_SUBS[index]
        setKillFeed((f) => [...f.slice(-3), `${sub.name} — saved ${sub.currency}${sub.price.toFixed(0)}/mo`])
      }
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
            {allKilled ? (
              <span className="text-indigo-400">$0.00/s — all subscriptions locked 🔒</span>
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

        {/* App window — macOS Safari Sequoia style */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full mx-auto rounded-xl border border-black/[0.08] dark:border-white/[0.08] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] overflow-hidden bg-[#f6f6f6] dark:bg-[#1c1c1e]"
        >
          {/* Safari toolbar */}
          <div className="flex items-center h-11 px-3.5 bg-[#e8e8e8] dark:bg-[#2c2c2e] border-b border-black/[0.06] dark:border-white/[0.06]">
            {/* Traffic lights */}
            <div className="flex items-center gap-[6px]">
              <span className="size-[11px] rounded-full bg-[#FF5F57] border border-[#E0443E]/60" />
              <span className="size-[11px] rounded-full bg-[#FEBC2E] border border-[#DEA123]/60" />
              <span className="size-[11px] rounded-full bg-[#28C840] border border-[#1AAB29]/60" />
            </div>

            {/* Navigation arrows */}
            <div className="hidden sm:flex items-center gap-3 ml-5 text-[#999] dark:text-white/30">
              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
              <svg className="size-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </div>

            {/* URL bar — Safari Sequoia style: rounded, centered, compact */}
            <div className="flex-1 flex justify-center mx-4">
              <div className="flex items-center gap-1.5 rounded-md bg-white/80 dark:bg-white/[0.08] border border-black/[0.04] dark:border-white/[0.04] px-3 py-[5px] min-w-[200px] max-w-[320px] w-full justify-center">
                <svg className="size-[10px] text-[#999] dark:text-white/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                <span className="text-[11px] text-[#666] dark:text-white/50 font-sans select-none">unsubly.xyz/subscriptions</span>
              </div>
            </div>

            {/* Right side icons */}
            <div className="hidden sm:flex items-center gap-3 text-[#999] dark:text-white/30">
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" /></svg>
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            </div>
          </div>

          {/* App content */}
          <div className="bg-background p-4 sm:p-6">
            {/* Header — matches real app */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-display font-semibold text-foreground">Subscriptions</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  <span className="font-mono-pixel">{MOCK_SUBS.length - killedIndices.size}</span> active ·{" "}
                  <span className="font-mono-pixel">${(TOTAL_USD - MOCK_SUBS.reduce((s, sub, i) => killedIndices.has(i) ? s + toUSD(sub.price, sub.currency) : s, 0)).toFixed(2)}</span>/mo
                  {totalSaved > 0 && (
                    <span className="ml-2 text-indigo-400 font-mono-pixel">↓ saved ${totalSaved.toFixed(0)}</span>
                  )}
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-[9px] px-2.5 py-1.5 rounded-lg border border-border/50 dark:border-white/[0.06] text-muted-foreground/70">Import CSV</span>
                <span className="text-[9px] px-2.5 py-1.5 rounded-lg border border-border/50 dark:border-white/[0.06] text-muted-foreground/70">Smart Import</span>
                <span className="text-[9px] px-3 py-1.5 rounded-lg bg-foreground text-background font-medium">+ Add Subscription</span>
              </div>
            </div>

            {/* Search bar */}
            <div className="flex items-center gap-2 mb-5">
              <div className="flex-1 flex items-center gap-2 rounded-lg border border-border/40 dark:border-white/[0.06] bg-muted/20 dark:bg-white/[0.02] px-3 py-2">
                <svg className="size-3.5 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                <span className="text-[10px] text-muted-foreground/30">Search subscriptions...</span>
              </div>
              <span className="hidden sm:block text-[9px] px-2.5 py-2 rounded-lg border border-border/40 dark:border-white/[0.06] text-muted-foreground/50">All Status ▾</span>
              <span className="hidden sm:block text-[9px] px-2.5 py-2 rounded-lg border border-border/40 dark:border-white/[0.06] text-muted-foreground/50">A-Z ▾</span>
            </div>

            {/* Drain rate badge */}
            {!allKilled && (
              <div className="flex justify-end mb-3">
                <span className="text-[8px] px-2 py-1 rounded-full border border-red-300/30 dark:border-red-400/20 text-red-400 font-mono-pixel">
                  ${drainPerSecond.toFixed(5)}/s
                </span>
              </div>
            )}

            {/* Grid — 3 cols matching real app */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

            {/* Kill feed */}
            <AnimatePresence>
              {killFeed.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-4 border-t border-dashed border-border/40 dark:border-white/[0.06] pt-3"
                >
                  {killFeed.map((line, i) => (
                    <motion.p
                      key={`${line}-${i}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-[9px] font-mono-pixel text-indigo-400/80 leading-relaxed"
                    >
                      CANCELLED: {line}
                    </motion.p>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* All killed */}
            <AnimatePresence>
              {allKilled && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-4 text-center py-3 rounded-xl border border-indigo-400/30 bg-indigo-400/[0.04]"
                >
                  <p className="text-xs font-mono-pixel text-indigo-400">
                    🔒 ALL VAULTS LOCKED · $0.00/mo
                  </p>
                  <p className="text-[9px] text-muted-foreground mt-1">you just saved ${TOTAL_USD.toFixed(2)}/mo in 10 seconds</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
