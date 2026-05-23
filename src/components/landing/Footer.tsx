import { Link } from "react-router-dom"
import { useEffect, useState, useRef } from "react"
import { RiTwitterXLine, RiGithubLine, RiLinkedinLine, RiTelegramLine } from "@remixicon/react"

const RECEIPT_LINES = [
  "      ╔═══════════════════════╗",
  "      ║    UNSUBSCRIBELY      ║",
  "      ╚═══════════════════════╝",
  "",
  "  DATE: 23-MAY-2026  14:32:07",
  "  TERMINAL: algorand-testnet",
  "  CASHIER: openclaw-agent v2.1",
  "",
  "  ─────────────────────────────",
  "  ITEM                     QTY",
  "  ─────────────────────────────",
  "  Subscriptions tracked     13",
  "  Escrow vaults locked       4",
  "  Agent runs (24h)          48",
  "  Cancellations proven       7",
  "  ARC-3 NFT receipts        7",
  "  MCP tools available       12",
  "  ─────────────────────────────",
  "",
  "  TOTAL SAVED:        $247.00",
  "  CHAIN:             Algorand",
  "  FINALITY:              3.3s",
  "  FEE:              < $0.001",
  "  STATUS:        ✓ VERIFIED",
  "",
  "  ─────────────────────────────",
  "  \"Your subscriptions called.",
  "   We hung up.\"",
  "  ─────────────────────────────",
  "",
  "      THANK YOU COME AGAIN",
  "       keep your money ♠",
]

const social = [
  { name: "Twitter", href: "https://x.com/hemanttbuilds", icon: RiTwitterXLine },
  { name: "GitHub", href: "https://github.com/devndesigner6", icon: RiGithubLine },
  { name: "LinkedIn", href: "https://www.linkedin.com/in/hemanthp15gr6", icon: RiLinkedinLine },
  { name: "Telegram", href: "https://t.me/unsublyybot", icon: RiTelegramLine },
]

const links = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Blockchain", href: "#blockchain" },
  { label: "Pricing", href: "#pricing" },
  { label: "Docs", href: "/docs", internal: true },
  { label: "Telegram Bot", href: "https://t.me/unsublyybot" },
  { label: "GitHub", href: "https://github.com/devndesigner6/unsubly" },
  { label: "GTM Plan", href: "/Unsubscribely-GTM-Plan.pdf" },
  { label: "Privacy", href: "/privacy", internal: true },
  { label: "Terms", href: "/terms", internal: true },
  { label: "Contact", href: "mailto:peddadahemanth6@gmail.com" },
]

export function Footer() {
  const ref = useRef<HTMLDivElement>(null)
  const [displayedText, setDisplayedText] = useState("")
  const [done, setDone] = useState(false)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) setStarted(true)
      },
      { threshold: 0.05 }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [started])

  useEffect(() => {
    if (!started) return
    const fullText = RECEIPT_LINES.join("\n")
    let i = 0
    const interval = setInterval(() => {
      i += 3
      if (i >= fullText.length) i = fullText.length
      setDisplayedText(fullText.slice(0, i))
      if (i >= fullText.length) { clearInterval(interval); setDone(true) }
    }, 8)
    return () => clearInterval(interval)
  }, [started])

  return (
    <footer className="border-t border-border py-10 sm:py-14">
      <div ref={ref} className="mx-auto max-w-5xl px-6 lg:px-8">

        {/* Main content — receipt left, right side compact */}
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8 items-start">

          {/* Receipt */}
          <div>
            <div className="h-[2px] mb-3 opacity-10" style={{ background: `repeating-linear-gradient(90deg, hsl(var(--foreground)) 0px, hsl(var(--foreground)) 2px, transparent 2px, transparent 5px)` }} />
            <div className="font-mono-pixel text-[9px] text-foreground/70 leading-[1.6] whitespace-pre-wrap">
              {displayedText}
              {!done && <span className="inline-block w-[4px] h-[9px] bg-foreground/50 animate-pulse ml-[1px] align-middle" />}
            </div>
            <div className={`mt-2 flex items-center gap-[1px] transition-opacity duration-300 ${done ? "opacity-100" : "opacity-0"}`}>
              {Array.from({ length: 40 }, (_, i) => (
                <div key={i} className="bg-foreground/15" style={{ width: [1, 2, 1, 2, 1, 1, 2, 1][i % 8] + "px", height: "16px" }} />
              ))}
            </div>
          </div>

          {/* Right side — links as a flowing grid of pills + social below */}
          <div className={`transition-opacity duration-500 ${started ? "opacity-100" : "opacity-0"}`}>
            {/* All links as pills in one flowing block */}
            <div className="flex flex-wrap gap-2">
              {links.map((link) =>
                link.internal ? (
                  <Link key={link.label} to={link.href} className="text-[10px] px-3 py-1.5 rounded-full border border-border/40 text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors">
                    {link.label}
                  </Link>
                ) : (
                  <a key={link.label} href={link.href} target={link.href.startsWith("http") || link.href.startsWith("mailto:") ? "_blank" : undefined} rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined} className="text-[10px] px-3 py-1.5 rounded-full border border-border/40 text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors">
                    {link.label}
                  </a>
                )
              )}
            </div>

            {/* Social */}
            <div className="flex gap-2 mt-5">
              {social.map((item) => (
                <a key={item.name} href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.name} className="flex size-8 items-center justify-center rounded-full border border-border/40 text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all">
                  <item.icon className="size-3.5" />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className={`mt-8 flex flex-col items-center justify-between gap-3 border-t border-border/50 pt-5 sm:flex-row transition-opacity duration-500 ${started ? "opacity-100" : "opacity-0"}`}>
          <p className="text-[11px] text-muted-foreground">
            Built by{" "}
            <a href="https://me.in" target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-400 font-medium transition-colors">Hemanth</a>
            {" "}♠ Open Source
          </p>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground border border-border/50 rounded-full px-2.5 py-1">
            <img src="/icons/algorand-black.svg" alt="" className="size-3 dark:hidden" />
            <img src="/icons/algorand-white.svg" alt="" className="size-3 hidden dark:block" />
            AlgoBharat 2026
          </span>
        </div>
      </div>
    </footer>
  )
}
