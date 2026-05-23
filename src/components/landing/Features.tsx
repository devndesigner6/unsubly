import { motion } from "motion/react"
import { useState, useEffect } from "react"

// Agent terminal lines that auto-type
const TERMINAL_LINES = [
  "> Checking vaults... 6 found",
  "> Spotify vault: billing in 2 days",
  "> Telegram alert sent ✓",
  "> Notion vault: user replied CANCEL",
  "> Cancelling... writing on-chain proof",
  "> txid: Z3RE3E... confirmed ✓",
  "> Saved $100.00 this cycle",
]

function AgentTerminal() {
  const [displayedText, setDisplayedText] = useState("")
  const [lineIndex, setLineIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)

  useEffect(() => {
    if (lineIndex >= TERMINAL_LINES.length) {
      // Reset after a pause
      const timeout = setTimeout(() => {
        setDisplayedText("")
        setLineIndex(0)
        setCharIndex(0)
      }, 2000)
      return () => clearTimeout(timeout)
    }

    const currentLine = TERMINAL_LINES[lineIndex]
    if (charIndex < currentLine.length) {
      // Type next character
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + currentLine[charIndex])
        setCharIndex((c) => c + 1)
      }, 30 + Math.random() * 20) // slight randomness for realism
      return () => clearTimeout(timeout)
    } else {
      // Line done, move to next after a short pause
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + "\n")
        setLineIndex((l) => l + 1)
        setCharIndex(0)
      }, 400)
      return () => clearTimeout(timeout)
    }
  }, [lineIndex, charIndex])

  const lines = displayedText.split("\n")

  return (
    <div className="mt-3 rounded-lg border border-white/[0.06] bg-[#0a0a0a] overflow-hidden">
      {/* Terminal title bar */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-white/[0.06] bg-white/[0.02]">
        <span className="size-[6px] rounded-full bg-[#FF5F57]" />
        <span className="size-[6px] rounded-full bg-[#FEBC2E]" />
        <span className="size-[6px] rounded-full bg-[#28C840]" />
        <span className="ml-2 text-[8px] text-white/30 font-mono">openclaw-agent</span>
      </div>
      {/* Terminal body */}
      <div className="p-2.5 font-mono text-[9px] h-[80px] overflow-hidden">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`leading-relaxed ${line.includes("✓") ? "text-emerald-400" : line.includes("CANCEL") ? "text-amber-300" : "text-white/70"}`}
          >
            {line}
          </div>
        ))}
        {/* Blinking cursor */}
        <span className="inline-block w-[5px] h-[10px] bg-white/60 animate-pulse" />
      </div>
    </div>
  )
}

const features = [
  {
    icon: "/icons/algorand-black.svg",
    iconDark: "/icons/algorand-white.svg",
    title: "Escrow Vaults",
    iconBg: "bg-blue-100 dark:bg-white/5",
    description: "Lock subscription funds in Algorand smart contracts. Kill switch on every vault — pull it anytime to get your ALGO back instantly.",
    example: "e.g. Lock 3 ALGO for Spotify. Agent pays Jun 5th.",
    techDetail: "PyTEAL smart contract • ABI method: release_vault(uint64) • Atomic group txn with proof mint",
  },
  {
    icon: "/icons/telegram.svg",
    title: "Telegram Bot Control",
    iconBg: "bg-sky-50 dark:bg-sky-900/20",
    description: "Get renewal alerts 3 days before billing. Reply 'cancel spotify' to cancel, 'done' to confirm. Voice messages supported.",
    example: "e.g. Reply 'cancel spotify' — done in 30 seconds.",
    techDetail: "Webhook-based • NLP intent parsing • Inline keyboard confirmations • Voice-to-text via Whisper",
  },
  {
    icon: "/icons/gmail.svg",
    title: "Gmail Auto-Import",
    iconBg: "bg-red-50 dark:bg-red-900/20",
    description: "Sign in with Google and we scan 6 months of receipts to auto-detect your subscriptions. No manual entry needed.",
    example: "e.g. Found Netflix, Spotify, YouTube from receipts.",
    techDetail: "OAuth2 scope: gmail.readonly • Pattern matching on 47 billing templates • Zero data stored server-side",
  },
  {
    icon: "/icons/mcp.svg",
    title: "MCP for Any AI Agent",
    iconBg: "bg-purple-50 dark:bg-purple-900/20",
    description: "Connect Claude, ChatGPT, or any MCP-compatible AI to manage your subscriptions. 12 tools, full vault control, on-chain proofs.",
    example: "e.g. Claude cancelled 3 idle subs. Saved $47/mo.",
    techDetail: "12 MCP tools • JSON-RPC 2.0 • Bearer token auth • Tools: list_vaults, release, cancel, prove",
  },
  {
    icon: "/icons/pera-black.svg",
    iconDark: "/icons/pera-white.svg",
    title: "Autonomous Agent",
    iconBg: "bg-green-50 dark:bg-green-900/20",
    description: "Runs every 30 minutes. Releases vaults on billing day, sends alerts, attempts auto-cancellation, writes on-chain proofs.",
    example: "e.g. Checked 6 vaults at 3 AM. Released 2 payments.",
    techDetail: "Cron: */30 * * * * • Railway deployment • Supabase edge function fallback • 99.7% uptime",
  },
  {
    icon: "/icons/algorand-black.svg",
    iconDark: "/icons/algorand-white.svg",
    title: "Cancellation Proofs",
    iconBg: "bg-amber-50 dark:bg-amber-900/20",
    description: "Every cancellation is recorded on Algorand as an immutable proof. Verifiable by anyone — useful in disputes with providers.",
    example: "e.g. Proof txid verified on Algorand explorer.",
    techDetail: "ARC-3 NFT • IPFS metadata • Fields: service, date, method, user_addr • Explorer-verifiable",
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
          {features.map((feature, index) => {
            const isAgentCard = feature.title === "Autonomous Agent"

            // Agent card doesn't flip — it has the terminal as its interaction
            if (isAgentCard) {
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                  className="rounded-2xl border border-border bg-background p-6 sm:p-7 shadow-sm"
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
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                  <AgentTerminal />
                </motion.div>
              )
            }

            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="group/card relative cursor-pointer"
                style={{ perspective: "800px" }}
              >
                <div className="relative w-full h-full transition-transform duration-500 group-hover/card:[transform:rotateY(180deg)] preserve-3d">
                  {/* Front face */}
                  <div className="rounded-2xl border border-border bg-background p-6 sm:p-7 shadow-sm backface-hidden">
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
                  </div>

                  {/* Back face - tech detail */}
                  <div className="absolute inset-0 rounded-2xl border border-indigo-400/30 bg-[#0a0a0a] p-6 sm:p-7 backface-hidden rotate-y-180 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-indigo-400/70 mb-3">Technical Spec</p>
                      <h3 className="text-base font-medium text-white tracking-tight mb-3">{feature.title}</h3>
                      <p className="text-xs text-white/60 font-mono leading-relaxed">{feature.techDetail}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Single testnet badge */}
        <div className="mt-8 flex justify-center">
          <span className="inline-flex items-center gap-2 text-[10px] text-muted-foreground/60">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            All features live on Algorand Testnet
          </span>
        </div>
      </div>
    </section>
  )
}
