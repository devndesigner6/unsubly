import { Link } from "react-router-dom"
import { useEffect, useState, useRef } from "react"
import { RiTwitterXLine, RiGithubLine, RiLinkedinLine, RiTelegramLine } from "@remixicon/react"

// Dynamic date
const now = new Date()
const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase().replace(/ /g, "-")
const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })

const RECEIPT_LINES = [
  "    ╔═════════════════════╗",
  "    ║   UNSUBSCRIBELY     ║",
  "    ╚═════════════════════╝",
  "",
  `  DATE: ${dateStr}  ${timeStr}`,
  "  TERMINAL: algorand-testnet",
  "  CASHIER: openclaw-agent v2",
  "",
  "  ───────────────────────────",
  "  ITEM                   QTY",
  "  ───────────────────────────",
  "  Subscriptions tracked   13",
  "  Escrow vaults locked     4",
  "  Agent runs (24h)        48",
  "  Cancellations proven     7",
  "  ───────────────────────────",
  "",
  "  TOTAL SAVED:      $247.00",
  "  CHAIN:           Algorand",
  "  FINALITY:            3.3s",
  "  FEE:            < $0.001",
  "  STATUS:      ✓ VERIFIED",
  "",
  "  ───────────────────────────",
  "  \"Your subs called.",
  "   We hung up.\"",
  "  ───────────────────────────",
  "    THANK YOU COME AGAIN",
  "     keep your money ♠",
]

// Terminal commands with clickable links
const TERMINAL_COMMANDS = [
  { cmd: "$ ls ./pages", delay: 0 },
  { cmd: "  features  how-it-works  blockchain  pricing", delay: 600, links: [
    { text: "features", href: "#features" },
    { text: "how-it-works", href: "#how-it-works" },
    { text: "blockchain", href: "#blockchain" },
    { text: "pricing", href: "#pricing" },
  ]},
  { cmd: "$ ls ./resources", delay: 1400 },
  { cmd: "  docs  telegram-bot  github  gtm-plan", delay: 2000, links: [
    { text: "docs", href: "/docs", internal: true },
    { text: "telegram-bot", href: "https://t.me/unsublyybot" },
    { text: "github", href: "https://github.com/devndesigner6/unsubly" },
    { text: "gtm-plan", href: "/Unsubscribely-GTM-Plan.pdf" },
  ]},
  { cmd: "$ ls ./legal", delay: 2800 },
  { cmd: "  privacy  terms  contact", delay: 3400, links: [
    { text: "privacy", href: "/privacy", internal: true },
    { text: "terms", href: "/terms", internal: true },
    { text: "contact", href: "mailto:peddadahemanth6@gmail.com" },
  ]},
  { cmd: "$ whoami", delay: 4200 },
  { cmd: "  @hemanttbuilds", delay: 4800, links: [
    { text: "@hemanttbuilds", href: "https://x.com/hemanttbuilds" },
  ]},
  { cmd: "$ echo $STATUS", delay: 5400 },
  { cmd: "  open-source ♠ algorand", delay: 6000 },
]

const social = [
  { name: "Twitter", href: "https://x.com/hemanttbuilds", icon: RiTwitterXLine },
  { name: "GitHub", href: "https://github.com/devndesigner6", icon: RiGithubLine },
  { name: "LinkedIn", href: "https://www.linkedin.com/in/hemanthp15gr6", icon: RiLinkedinLine },
  { name: "Telegram", href: "https://t.me/unsublyybot", icon: RiTelegramLine },
]

function TerminalLink({ text, href, internal }: { text: string; href: string; internal?: boolean }) {
  const cls = "text-[#33ff33] hover:text-[#80ffb0] hover:underline underline-offset-2 transition-colors cursor-pointer"
  if (internal) {
    return <Link to={href} className={cls}>{text}</Link>
  }
  return <a href={href} target={href.startsWith("http") || href.startsWith("mailto:") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined} className={cls}>{text}</a>
}

export function Footer() {
  const ref = useRef<HTMLDivElement>(null)
  const [receiptText, setReceiptText] = useState("")
  const [receiptDone, setReceiptDone] = useState(false)
  const [terminalLines, setTerminalLines] = useState<number>(0)
  const [started, setStarted] = useState(false)

  // Intersection observer
  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true) },
      { threshold: 0.05 }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [started])

  // Receipt typing
  useEffect(() => {
    if (!started) return
    const fullText = RECEIPT_LINES.join("\n")
    let i = 0
    const interval = setInterval(() => {
      i += 3
      if (i >= fullText.length) i = fullText.length
      setReceiptText(fullText.slice(0, i))
      if (i >= fullText.length) { clearInterval(interval); setReceiptDone(true) }
    }, 8)
    return () => clearInterval(interval)
  }, [started])

  // Terminal lines appear one by one
  useEffect(() => {
    if (!started) return
    TERMINAL_COMMANDS.forEach((_, idx) => {
      setTimeout(() => setTerminalLines(idx + 1), TERMINAL_COMMANDS[idx].delay + 500)
    })
  }, [started])

  return (
    <footer className="border-t border-border py-10 sm:py-14">
      <div ref={ref} className="mx-auto max-w-5xl px-6 lg:px-8">

        {/* Two columns — same height */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">

          {/* LEFT — Receipt */}
          <div className="rounded-xl border border-border/40 bg-[#fafaf8] dark:bg-[#0d0d0d] p-4 flex flex-col">
            {/* Torn edge */}
            <div className="h-[2px] mb-3 opacity-15" style={{ background: `repeating-linear-gradient(90deg, hsl(var(--foreground)) 0px, hsl(var(--foreground)) 2px, transparent 2px, transparent 5px)` }} />
            {/* Receipt text */}
            <div className="font-mono-pixel text-[9px] text-foreground/70 leading-[1.6] whitespace-pre-wrap flex-1">
              {receiptText}
              {!receiptDone && <span className="inline-block w-[4px] h-[8px] bg-foreground/50 animate-pulse ml-[1px] align-middle" />}
            </div>
            {/* Barcode */}
            <div className={`mt-3 flex items-center justify-center gap-[0.5px] transition-opacity duration-300 ${receiptDone ? "opacity-100" : "opacity-0"}`}>
              {Array.from({ length: 50 }, (_, i) => (
                <div key={i} className="bg-foreground/20 dark:bg-foreground/15" style={{ width: [1, 2, 1, 1, 2, 1, 2, 1, 1, 2][i % 10] + "px", height: "18px" }} />
              ))}
            </div>
          </div>

          {/* RIGHT — Terminal */}
          <div className="rounded-xl border border-[#1a1a1a] dark:border-[#2a2a2a] bg-[#0d0d0d] overflow-hidden flex flex-col">
            {/* Terminal chrome */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a1a1a] bg-[#141414]">
              <span className="size-[8px] rounded-full bg-[#FF5F57]" />
              <span className="size-[8px] rounded-full bg-[#FEBC2E]" />
              <span className="size-[8px] rounded-full bg-[#28C840]" />
              <span className="ml-2 text-[9px] text-[#555] font-mono">visitor@unsubly ~ %</span>
            </div>
            {/* Terminal body */}
            <div className="p-4 font-mono text-[10px] leading-[1.8] flex-1" style={{ textShadow: "0 0 4px #00ff6640" }}>
              {TERMINAL_COMMANDS.slice(0, terminalLines).map((line, idx) => (
                <div key={idx}>
                  {line.links ? (
                    <span className="text-[#33ff33]/70">
                      {"  "}
                      {line.links.map((link, li) => (
                        <span key={li}>
                          <TerminalLink text={link.text} href={link.href} internal={link.internal} />
                          {li < line.links!.length - 1 && "  "}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className={line.cmd.startsWith("$") ? "text-[#33ff33]" : "text-[#33ff33]/70"}>
                      {line.cmd}
                    </span>
                  )}
                </div>
              ))}
              {/* Blinking cursor */}
              {terminalLines < TERMINAL_COMMANDS.length && (
                <span className="inline-block w-[6px] h-[11px] bg-[#33ff33] animate-pulse mt-1" />
              )}
              {terminalLines >= TERMINAL_COMMANDS.length && (
                <div className="mt-1">
                  <span className="text-[#33ff33]">$ </span>
                  <span className="inline-block w-[6px] h-[11px] bg-[#33ff33]/70 animate-pulse" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className={`mt-8 flex flex-col items-center justify-between gap-3 border-t border-border/40 pt-5 sm:flex-row transition-opacity duration-500 ${started ? "opacity-100" : "opacity-0"}`}>
          <div className="flex items-center gap-3">
            <p className="text-[11px] text-muted-foreground">
              Built by{" "}
              <a href="https://me.in" target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-400 font-medium transition-colors">Hemanth</a>
              {" "}♠ Open Source
            </p>
            {/* Social inline */}
            <div className="flex gap-1.5">
              {social.map((item) => (
                <a key={item.name} href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.name} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                  <item.icon className="size-3" />
                </a>
              ))}
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground border border-border/40 rounded-full px-2.5 py-1">
            <img src="/icons/algorand-black.svg" alt="" className="size-3 dark:hidden" />
            <img src="/icons/algorand-white.svg" alt="" className="size-3 hidden dark:block" />
            AlgoBharat 2026
          </span>
        </div>
      </div>
    </footer>
  )
}
