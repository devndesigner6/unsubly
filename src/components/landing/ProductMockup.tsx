import { motion } from "motion/react"
import { useState } from "react"

// Subscription data matching the real app - 3 rows x 3 cols = 9 cards
const MOCK_SUBS = [
  { name: "Apple Music", icon: "/icons/apple-music.svg", price: "₹180.00", cycle: "Monthly", next: "5/24/2026", status: "active", category: "Music", renews: "6 days" },
  { name: "Spotify", icon: "/icons/spotify.svg", price: "₹139.00", cycle: "Monthly", next: "6/1/2026", status: "active", category: "Music" },
  { name: "Cursor Premium", icon: "/icons/cursor.svg", price: "$25.00", cycle: "Monthly", next: "5/23/2026", status: "cancelled", category: "Development", renews: "5 days" },
  { name: "GitHub Pro", icon: "/icons/github.svg", price: "$30.00", cycle: "Monthly", next: "5/25/2026", status: "active", category: "Development" },
  { name: "Duolingo Super", icon: "/icons/duolingo.svg", price: "$84.00", cycle: "Monthly", next: "4/25/2027", status: "active", category: "Education" },
  { name: "Google AI Pro", icon: "/icons/google-ai.svg", price: "$249.99", cycle: "Monthly", next: "6/3/2026", status: "active", category: "AI Tools" },
  { name: "YouTube Premium", icon: "/icons/youtube.svg", price: "$13.99", cycle: "Monthly", next: "6/5/2026", status: "active", category: "Entertainment" },
  { name: "Notion", icon: "/icons/notion.svg", price: "$100.00", cycle: "Quarterly", next: "5/18/2026", status: "cancelled", category: "Productivity", renews: "2 days" },
  { name: "Lovable", icon: "/icons/lovable.svg", price: "$5.00", cycle: "Monthly", next: "5/29/2026", status: "active", category: "Development" },
]

function StatusBadge({ status, renews }: { status: string; renews?: string }) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <span className="size-1 rounded-full bg-muted-foreground/50" />Cancelled
        </span>
        {renews && (
          <span className="text-[8px] font-medium text-red-500 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded-full">
            Renews in {renews}
          </span>
        )}
      </div>
    )
  }
  return (
    <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
      <span className="size-1 rounded-full bg-emerald-500" />Active
      {renews && (
        <span className="ml-1 text-[8px] font-medium text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-full">
          Renews in {renews}
        </span>
      )}
    </span>
  )
}

function SubCard({ sub, index }: { sub: typeof MOCK_SUBS[0]; index: number }) {
  const [hovered, setHovered] = useState(false)
  const [toggled, setToggled] = useState(false)

  const displayStatus = toggled ? (sub.status === "active" ? "cancelled" : "active") : sub.status

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setToggled(!toggled)}
      className="relative rounded-xl border border-border/50 dark:border-white/[0.06] bg-background p-3 hover:border-foreground/10 transition-all duration-200 cursor-pointer group select-none"
      style={{ transform: hovered ? "translateY(-2px)" : "translateY(0)" }}
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
        <StatusBadge status={displayStatus} renews={sub.renews} />
      </div>
      <div className="flex items-end justify-between">
        <p className="font-mono-pixel text-xs font-semibold text-foreground">{sub.price}</p>
        <p className="text-[8px] text-muted-foreground/40">{sub.cycle} · {sub.next}</p>
      </div>
      {/* Interactive hint */}
      {hovered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 rounded-xl border-2 border-gold/30 pointer-events-none"
        />
      )}
    </motion.div>
  )
}

// (OrbitingIcon removed - using inline orbit in ProductMockup)

export function ProductMockup() {
  // Use real numbers from the app (updated manually or via public API)
  // Supabase RLS blocks anonymous reads, so we use known values
  const liveStats = { total: 13, monthly: 1159 }

  return (
    <section className="relative mt-8 pb-16 sm:pb-20 overflow-hidden">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Live stats */}
        <p className="text-center text-[11px] font-mono-pixel text-muted-foreground/50 mb-6 tracking-wide">
          Tracking ${liveStats.monthly.toLocaleString()}/mo across {liveStats.total} subscriptions on Algorand testnet
        </p>

        {/* Browser frame wrapper with orbital icons BEHIND */}
        <div className="relative">
          {/* Orbital icons - z-index 0 so they go BEHIND the browser frame */}
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

          {/* macOS Browser Window - z-index 10 so it's ABOVE the orbit */}
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
              {/* Traffic lights */}
              <div className="flex items-center gap-2">
                <span className="size-[10px] rounded-full bg-[#FF5F57]" />
                <span className="size-[10px] rounded-full bg-[#FEBC2E]" />
                <span className="size-[10px] rounded-full bg-[#28C840]" />
              </div>

              {/* Sidebar + arrows */}
              <div className="hidden sm:flex items-center gap-2.5 ml-4 text-muted-foreground/40">
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></svg>
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                <svg className="size-3.5 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </div>

              {/* URL Bar */}
              <div className="flex-1 flex justify-center mx-4">
                <div className="flex items-center gap-1.5 rounded-md bg-black/[0.04] dark:bg-white/[0.05] px-3 py-1 w-full max-w-sm">
                  <svg className="size-2.5 text-muted-foreground/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                  <span className="text-[10px] text-muted-foreground/50 font-mono truncate select-none">unsubly.xyz/subscriptions</span>
                </div>
              </div>

              {/* Right icons */}
              <div className="hidden sm:flex items-center gap-2.5 text-muted-foreground/30">
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3v11.25" /></svg>
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 8.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h2.25m8.25-8.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-6A2.25 2.25 0 019.75 18v-2.25" /></svg>
              </div>
            </div>

            {/* Page content with bottom fade */}
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
                    <p className="text-[9px] text-muted-foreground"><span className="font-mono-pixel">13</span> total · <span className="font-mono-pixel">$1,159.96</span>/mo</p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-1.5">
                  <span className="text-[9px] px-2 py-1 rounded-full border border-border/50 dark:border-white/[0.08] text-muted-foreground">Import CSV</span>
                  <span className="text-[9px] px-2 py-1 rounded-full border border-border/50 dark:border-white/[0.08] text-muted-foreground">Smart Import</span>
                  <span className="text-[9px] px-2.5 py-1 rounded-full bg-foreground text-background font-medium">+ Add</span>
                </div>
              </div>

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
                  <SubCard key={sub.name} sub={sub} index={i} />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
