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

const navigation = {
  product: [
    { name: "Features", href: "#features" },
    { name: "How It Works", href: "#how-it-works" },
    { name: "Blockchain", href: "#blockchain" },
    { name: "Pricing", href: "#pricing" },
  ],
  resources: [
    { name: "Documentation", href: "/docs", internal: true },
    { name: "Telegram Bot", href: "https://t.me/unsublyybot" },
    { name: "GitHub", href: "https://github.com/devndesigner6/unsubly" },
    { name: "GTM Plan", href: "/Unsubscribely-GTM-Plan.pdf" },
  ],
  legal: [
    { name: "Privacy Policy", href: "/privacy", internal: true },
    { name: "Terms of Service", href: "/terms", internal: true },
    { name: "Contact", href: "mailto:peddadahemanth6@gmail.com" },
  ],
}

const social = [
  { name: "Twitter", href: "https://x.com/hemanttbuilds", icon: RiTwitterXLine },
  { name: "GitHub", href: "https://github.com/devndesigner6", icon: RiGithubLine },
  { name: "LinkedIn", href: "https://www.linkedin.com/in/hemanthp15gr6", icon: RiLinkedinLine },
  { name: "Telegram", href: "https://t.me/unsublyybot", icon: RiTelegramLine },
]

export function Footer() {
  const ref = useRef<HTMLDivElement>(null)
  const [displayedText, setDisplayedText] = useState("")
  const [done, setDone] = useState(false)
  const [started, setStarted] = useState(false)

  // Use IntersectionObserver directly — more reliable than motion's useInView
  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true)
        }
      },
      { threshold: 0.05 }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [started])

  // Character-by-character typing
  useEffect(() => {
    if (!started) return

    const fullText = RECEIPT_LINES.join("\n")
    let i = 0

    const interval = setInterval(() => {
      i += 3
      if (i >= fullText.length) i = fullText.length
      setDisplayedText(fullText.slice(0, i))
      if (i >= fullText.length) {
        clearInterval(interval)
        setDone(true)
      }
    }, 8)

    return () => clearInterval(interval)
  }, [started])

  return (
    <footer className="border-t border-border py-12 sm:py-16">
      <div ref={ref} className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Two column layout: receipt on left, links on right */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-12 lg:gap-16">

          {/* Left — Receipt */}
          <div className="mx-auto lg:mx-0 max-w-[320px] w-full">
            {/* Torn paper edge */}
            <div
              className="h-2 mb-4 opacity-10"
              style={{
                background: `repeating-linear-gradient(90deg, hsl(var(--foreground)) 0px, hsl(var(--foreground)) 2px, transparent 2px, transparent 5px)`,
              }}
            />

            {/* Receipt body — typed character by character */}
            <div className="font-mono-pixel text-[10px] text-foreground/70 leading-[1.7] whitespace-pre-wrap min-h-[280px]">
              {displayedText}
              {!done && <span className="inline-block w-[5px] h-[10px] bg-foreground/50 animate-pulse ml-[1px] align-middle" />}
            </div>

            {/* Barcode — appears after typing */}
            <div className={`mt-3 flex items-center justify-center gap-[1px] transition-opacity duration-500 ${done ? "opacity-100" : "opacity-0"}`}>
              {Array.from({ length: 48 }, (_, i) => (
                <div
                  key={i}
                  className="bg-foreground/20"
                  style={{
                    width: [1, 2, 1, 2, 1, 1, 2, 1][i % 8] + "px",
                    height: "22px",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Right — Navigation links */}
          <div className={`transition-opacity duration-700 ${started ? "opacity-100" : "opacity-0"}`}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
              <div>
                <h3 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">Product</h3>
                <ul className="mt-4 space-y-3">
                  {navigation.product.map((item) => (
                    <li key={item.name}>
                      <a href={item.href} className="text-sm text-foreground/70 transition-colors hover:text-foreground">
                        {item.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">Resources</h3>
                <ul className="mt-4 space-y-3">
                  {navigation.resources.map((item) => (
                    <li key={item.name}>
                      {item.internal ? (
                        <Link to={item.href} className="text-sm text-foreground/70 transition-colors hover:text-foreground">
                          {item.name}
                        </Link>
                      ) : (
                        <a href={item.href} target="_blank" rel="noopener noreferrer" className="text-sm text-foreground/70 transition-colors hover:text-foreground">
                          {item.name}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">Legal</h3>
                <ul className="mt-4 space-y-3">
                  {navigation.legal.map((item) => (
                    <li key={item.name}>
                      {item.internal ? (
                        <Link to={item.href} className="text-sm text-foreground/70 transition-colors hover:text-foreground">
                          {item.name}
                        </Link>
                      ) : (
                        <a href={item.href} className="text-sm text-foreground/70 transition-colors hover:text-foreground">
                          {item.name}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Social icons */}
            <div className="mt-8 flex gap-2">
              {social.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.name}
                  className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-all hover:border-foreground/30 hover:text-foreground"
                >
                  <item.icon className="size-4" />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className={`mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row transition-opacity duration-700 ${started ? "opacity-100" : "opacity-0"}`}>
          <p className="text-xs text-muted-foreground">
            Built by{" "}
            <a href="https://me.in" target="_blank" rel="noopener noreferrer" className="text-foreground/70 hover:text-foreground underline underline-offset-2 transition-colors">Hemanth</a>
            {" "}♠ Open Source
          </p>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground border border-border dark:border-white/10 rounded-full px-2.5 py-1">
              <img src="/icons/algorand-black.svg" alt="" className="size-3 dark:hidden" />
              <img src="/icons/algorand-white.svg" alt="" className="size-3 hidden dark:block" />
              AlgoBharat 2026
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
