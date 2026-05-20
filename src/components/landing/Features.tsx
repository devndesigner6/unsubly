import { motion } from "motion/react"

const features = [
  {
    icon: "/icons/algorand-black.svg",
    iconDark: "/icons/algorand-white.svg",
    title: "Escrow Vaults",
    iconBg: "bg-blue-100 dark:bg-white/5",
    description: "Lock subscription funds in Algorand smart contracts. Kill switch on every vault — pull it anytime to get your ALGO back instantly.",
    example: "e.g. Lock 3 ALGO for Spotify. Agent pays Jun 5th.",
  },
  {
    icon: "/icons/telegram.svg",
    title: "Telegram Bot Control",
    iconBg: "bg-sky-50 dark:bg-sky-900/20",
    description: "Get renewal alerts 3 days before billing. Reply 'cancel spotify' to cancel, 'done' to confirm. Voice messages supported.",
    example: "e.g. Reply 'cancel spotify' — done in 30 seconds.",
  },
  {
    icon: "/icons/gmail.svg",
    title: "Gmail Auto-Import",
    iconBg: "bg-red-50 dark:bg-red-900/20",
    description: "Sign in with Google and we scan 6 months of receipts to auto-detect your subscriptions. No manual entry needed.",
    example: "e.g. Found Netflix, Spotify, YouTube from receipts.",
  },
  {
    icon: "/icons/mcp.svg",
    title: "MCP for Any AI Agent",
    iconBg: "bg-purple-50 dark:bg-purple-900/20",
    description: "Connect Claude, ChatGPT, or any MCP-compatible AI to manage your subscriptions. 12 tools, full vault control, on-chain proofs.",
    example: "e.g. Claude cancelled 3 idle subs. Saved $47/mo.",
  },
  {
    icon: "/icons/pera-black.svg",
    iconDark: "/icons/pera-white.svg",
    title: "Autonomous Agent",
    iconBg: "bg-green-50 dark:bg-green-900/20",
    description: "Runs every 30 minutes. Releases vaults on billing day, sends alerts, attempts auto-cancellation, writes on-chain proofs.",
    example: "e.g. Checked 6 vaults at 3 AM. Released 2 payments.",
  },
  {
    icon: "/icons/algorand-black.svg",
    iconDark: "/icons/algorand-white.svg",
    title: "Cancellation Proofs",
    iconBg: "bg-amber-50 dark:bg-amber-900/20",
    description: "Every cancellation is recorded on Algorand as an immutable proof. Verifiable by anyone — useful in disputes with providers.",
    example: "e.g. Proof txid verified on Algorand explorer.",
  },
]

export function Features() {
  return (
    <section id="features" className="py-14 sm:py-16 lg:py-20 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 sm:mb-16"
        >
          <p className="font-display italic text-base text-muted-foreground mb-3">What you get</p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl text-foreground tracking-tight leading-[1.1]">
            Everything to manage
            <br />
            <span className="text-muted-foreground/50">your subscriptions</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className={`group rounded-2xl border border-border bg-background p-6 sm:p-7 hover:border-foreground/20 hover:shadow-sm transition-colors ${
                index < 2 ? "sm:col-span-1 lg:col-span-1 bg-muted/20 dark:bg-white/[0.02]" : ""
              }`}
            >
              <div className={`flex size-12 items-center justify-center rounded-2xl mb-4 ${feature.iconBg}`}>
                {feature.iconDark ? (
                  <>
                    <img src={feature.icon} alt="" className="h-6 w-auto dark:hidden" />
                    <img src={feature.iconDark} alt="" className="h-6 w-auto hidden dark:block" />
                  </>
                ) : (
                  <img src={feature.icon} alt="" className="size-6 rounded-sm" />
                )}
              </div>
              <h3 className="text-base font-medium text-foreground tracking-tight">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              {feature.example && (
                <p className="mt-2 text-xs italic text-muted-foreground/70">{feature.example}</p>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
