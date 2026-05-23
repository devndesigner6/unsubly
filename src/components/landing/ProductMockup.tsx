import { motion, AnimatePresence } from "motion/react"
import { useState, useEffect, useCallback } from "react"

// Subscription data matching the real app
const MOCK_SUBS = [
  { name: "Apple Music", icon: "/icons/apple-music.svg", price: 180, currency: "₹", cycle: "Monthly", next: "5/24/2026", status: "active" as const, category: "Music" },
  { name: "Spotify", icon: "/icons/spotify.svg", price: 139, currency: "₹", cycle: "Monthly", next: "6/1/2026", status: "active" as const, category: "Music" },
  { name: "Cursor Premium", icon: "/icons/cursor.svg", price: 25, currency: "$", cycle: "Monthly", next: "5/23/2026", status: "cancelled" as const, category: "Development" },
  { name: "GitHub Pro", icon: "/icons/github.svg", price: 30, currency: "$", cycle: "Monthly", next: "5/25/2026", status: "active" as const, category: "Development" },
  { name: "Duolingo Super", icon: "/icons/duolingo.svg", price: 84, currency: "$", cycle: "Monthly", next: "4/25/2027", status: "active" as const, category: "Education" },
  { name: "Google AI Pro", icon: "/icons/google-ai.svg", price: 249.99, currency: "$", cycle: "Monthly", next: "6/3/2026", status: "active" as const, category: "AI Tools" },
  { name: "YouTube Premium", icon: "/icons/youtube.svg", price: 13.99, currency: "$", cycle: "Monthly", next: "6/5/2026", status: "active" as const, category: "Entertainment" },
  { name: "Notion", icon: "/icons/notion.svg", price: 100, currency: "$", cycle: "Quarterly", next: "5/18/2026", status: "cancelled" as const, category: "Productivity" },
  { name: "Lovable", icon: "/icons/lovable.svg", price: 5, currency: "$", cycle: "Monthly", next: "5/29/2026", status: "active" as const, category: "Development" },
]

// Billing feed messages that pulse on cards
const BILLING_EVENTS = [
  { index: 0, message: "Billed ₹180 just now" },
  { index: 3, message: "Billed $30 just now" },
  { index: 5, message: "Billed $249.99 just now" },
  { index: 6, message: "Billed $13.99 just now" },
]

function VaultFlipBack({ sub }: { sub: typeof MOCK_SUBS[0] }) {
  const algoAmount = (sub.price * (sub.currency === "₹" ? 0.012 : 1) / 0.18).toFixed(2)
  return (
    <div className="absolute inset-0 rounded-xl border border-gold/30 bg-[#0a0a0a] p-3 flex flex-col justify-between backface-hidden rotate-y-180">
      <div className="flex items-center gap-2">
        <svg className="size-4 text-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span className="text-[9px] text-gold font-mono-pixel">VAULT LOCKED</span>
      </div>
      <div>
        <p className="text-[10px] text-white/60">Locked Amount</p>
        <p className="font-mono-pixel text-sm text-white">{algoAmount} ALGO</p>
      </div>
      <div>
        <p className="text-[8px] text-white/40 font-mono truncate">txid: {Array.from({ length: 8 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]).join("")}...</p>
      </div>
    </div>
  )
}

function SubCard({ sub, index, billingPulse, isCancelling }: {
  sub: typeof MOCK_SUBS[0]
  index: number
  billingPulse: string | null
  isCancelling: boolean
}) {
  const [flipped, setFlipped] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.08, type: "spring", stiffness: 180, damping: 22 }}
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
      className="relative cursor-pointer select-none"
      style={{ perspective: "600px" }}
    >
      <div
        className="relative w-full h-full transition-transform duration-500"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front face */}
        <div className={`relative rounded-xl border bg-background p-3 transition-all duration-200 ${
          billingPulse ? "border-red-400/60 shadow-[0_0_12px_-2px_rgba(239,68,68,0.3)]" : "border-border/50 dark:border-white/[0.06]"
        } ${isCancelling ? "border-emerald-400/60" : ""}`}
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-muted/40 dark:bg-white/5 border border-border/20 flex items-center justify-center overflow-hidden">
                <img
                  src={sub.icon}
                  alt={sub.name}
                  className="size-4 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(sub.name.slice(0, 2))}&background=f5f5f4&color=1c1917&size=28&font-size=0.5&bold=true`
                  }}
                />
              </div>
              <div>
                <p className="text-[10px] font-medium text-foreground leading-tight">{sub.name}</p>
                <p className="text-[8px] text-muted-foreground/50">{sub.category}</p>
              </div>
            </div>
            {sub.status === "cancelled" ? (
              <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <span className="size-1 rounded-full bg-muted-foreground/50" />Cancelled
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <span className="size-1 rounded-full bg-emerald-500" />Active
              </span>
            )}
          </div>

          <div className="flex items-end justify-between">
            <div className="relative">
              <p className={`font-mono-pixel text-xs font-semibold text-foreground ${isCancelling ? "line-through decoration-red-500 decoration-2" : ""}`}>
                {sub.currency}{sub.price.toFixed(2)}
              </p>
              {isCancelling && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[8px] text-emerald-500 font-medium"
                >
                  Saved · Proof on-chain ✓
                </motion.p>
              )}
            </div>
            <p className="text-[8px] text-muted-foreground/40">{sub.cycle}</p>
          </div>

          {/* Billing pulse badge */}
          <AnimatePresence>
            {billingPulse && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.9 }}
                className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-red-500 text-white text-[8px] font-medium shadow-lg"
              >
                {billingPulse}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Back face - vault visualization */}
        <VaultFlipBack sub={sub} />
      </div>
    </motion.div>
  )
}

export function ProductMockup() {
  const [totalMonthly, setTotalMonthly] = useState(1159.96)
  const [activeBilling, setActiveBilling] = useState<{ index: number; message: string } | null>(null)
  const [cancellingIndex, setCancellingIndex] = useState<number | null>(null)
  const [scanActive, setScanActive] = useState(false)

  // Live billing feed - pulses a random card every 4s
  useEffect(() => {
    const interval = setInterval(() => {
      const event = BILLING_EVENTS[Math.floor(Math.random() * BILLING_EVENTS.length)]
      setActiveBilling(event)
      setTimeout(() => setActiveBilling(null), 2500)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  // Cancellation animation - Notion card gets cancelled every 12s
  useEffect(() => {
    const interval = setInterval(() => {
      setCancellingIndex(7) // Notion
      setTimeout(() => {
        setTotalMonthly((prev) => {
          const newVal = prev - 100
          // Reset after tick-down
          setTimeout(() => setTotalMonthly(1159.96), 4000)
          return newVal
        })
        setTimeout(() => setCancellingIndex(null), 3000)
      }, 1500)
    }, 12000)
    return () => clearInterval(interval)
  }, [])

  // Smart Import scan animation
  const handleSmartImport = useCallback(() => {
    setScanActive(true)
    setTimeout(() => setScanActive(false), 3000)
  }, [])

  return (
    <section className="relative mt-8 pb-16 sm:pb-20 overflow-hidden">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Live stats with animated total */}
        <p className="text-center text-[11px] font-mono-pixel text-muted-foreground/50 mb-6 tracking-wide">
          Tracking{" "}
          <motion.span
            key={totalMonthly.toFixed(2)}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block text-foreground/70"
          >
            ${totalMonthly.toFixed(2)}
          </motion.span>
          /mo across 13 subscriptions on Algorand testnet
        </p>

        {/* Browser frame wrapper with orbital icons BEHIND */}
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
            {/* macOS Title Bar */}
            <div className="flex items-center h-10 px-4 bg-[#f8f8f7] dark:bg-white/[0.03] border-b border-black/[0.05] dark:border-white/[0.05]">
              <div className="flex items-center gap-2">
                <span className="size-[10px] rounded-full bg-[#FF5F57]" />
                <span className="size-[10px] rounded-full bg-[#FEBC2E]" />
                <span className="size-[10px] rounded-full bg-[#28C840]" />
              </div>
              <div className="hidden sm:flex items-center gap-2.5 ml-4 text-muted-foreground/40">
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></svg>
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                <svg className="size-3.5 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </div>
              <div className="flex-1 flex justify-center mx-4">
                <div className="flex items-center gap-1.5 rounded-md bg-black/[0.04] dark:bg-white/[0.05] px-3 py-1 w-full max-w-sm">
                  <svg className="size-2.5 text-muted-foreground/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                  <span className="text-[10px] text-muted-foreground/50 font-mono truncate select-none">unsubly.xyz/subscriptions</span>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2.5 text-muted-foreground/30">
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3v11.25" /></svg>
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              </div>
            </div>

            {/* Page content */}
            <div
              className="bg-[#fafaf9] dark:bg-[#0a0a0a] p-4 sm:p-5"
              style={{
                maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-muted/40 dark:bg-white/5 flex items-center justify-center">
                    <svg className="size-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-display font-semibold text-foreground">Subscriptions</h3>
                    <p className="text-[9px] text-muted-foreground">
                      <span className="font-mono-pixel">13</span> total ·{" "}
                      <motion.span
                        key={totalMonthly.toFixed(2)}
                        initial={{ color: "hsl(var(--foreground))" }}
                        animate={{ color: totalMonthly < 1159 ? "hsl(142 71% 45%)" : "hsl(var(--foreground))" }}
                        className="font-mono-pixel"
                      >
                        ${totalMonthly.toFixed(2)}
                      </motion.span>
                      /mo
                    </p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-1.5">
                  <span className="text-[9px] px-2 py-1 rounded-full border border-border/50 dark:border-white/[0.08] text-muted-foreground">Import CSV</span>
                  <button
                    onClick={handleSmartImport}
                    className="relative text-[9px] px-2 py-1 rounded-full border border-border/50 dark:border-white/[0.08] text-muted-foreground overflow-hidden hover:border-gold/40 transition-colors"
                  >
                    {/* Shimmer on loop */}
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-gold/20 to-transparent bg-[length:200%_auto] animate-[shimmer_3s_ease-in-out_infinite]" />
                    <span className="relative">Smart Import</span>
                  </button>
                  <span className="text-[9px] px-2.5 py-1 rounded-full bg-foreground text-background font-medium">+ Add</span>
                </div>
              </div>

              {/* Gmail scan overlay */}
              <AnimatePresence>
                {scanActive && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 rounded-lg border border-gold/30 bg-gold/5 p-3 overflow-hidden"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <img src="/icons/gmail.svg" alt="Gmail" className="size-4" />
                      <span className="text-[10px] font-medium text-foreground">Scanning receipts...</span>
                    </div>
                    <div className="flex gap-2 overflow-hidden">
                      {["Netflix", "AWS", "Figma"].map((name, i) => (
                        <motion.span
                          key={name}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.5 + i * 0.4 }}
                          className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        >
                          + {name} found
                        </motion.span>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Search */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 flex items-center gap-1.5 rounded-lg border border-border/40 dark:border-white/[0.06] bg-background dark:bg-white/[0.02] px-2.5 py-1.5">
                  <svg className="size-3 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                  <span className="text-[9px] text-muted-foreground/30">Search subscriptions...</span>
                </div>
                <span className="hidden sm:block text-[9px] px-2 py-1.5 rounded border border-border/40 dark:border-white/[0.06] text-muted-foreground/50">All Status</span>
                <span className="hidden sm:block text-[9px] px-2 py-1.5 rounded border border-border/40 dark:border-white/[0.06] text-muted-foreground/50">A-Z</span>
              </div>

              {/* Grid - 3 cols, 3 rows */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {MOCK_SUBS.map((sub, i) => (
                  <SubCard
                    key={sub.name}
                    sub={sub}
                    index={i}
                    billingPulse={activeBilling?.index === i ? activeBilling.message : null}
                    isCancelling={cancellingIndex === i}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
