import { Link } from "react-router-dom"
import { useEffect, useState } from "react"
import { RiTwitterXLine, RiGithubLine, RiTelegramLine } from "@remixicon/react"

export function Footer() {
  const [agentRuns, setAgentRuns] = useState(48)
  const [saved, setSaved] = useState(247)

  // Slowly tick up the numbers for liveness
  useEffect(() => {
    const interval = setInterval(() => {
      setAgentRuns((n) => n + 1)
      if (Math.random() > 0.6) setSaved((n) => n + Math.floor(Math.random() * 12 + 3))
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  return (
    <footer className="border-t border-border py-12 sm:py-16">
      <div className="mx-auto max-w-sm px-6">
        {/* Zig-zag torn edge */}
        <div
          className="h-3 -mt-12 mb-8 opacity-20"
          style={{
            background: "repeating-linear-gradient(90deg, transparent, transparent 8px, hsl(var(--foreground)) 8px, hsl(var(--foreground)) 9px, transparent 9px, transparent 16px)",
            maskImage: "repeating-conic-gradient(from 0deg, #000 0deg 45deg, transparent 45deg 90deg) 0 0 / 12px 12px",
            WebkitMaskImage: "repeating-conic-gradient(from 0deg, #000 0deg 45deg, transparent 45deg 90deg) 0 0 / 12px 12px",
          }}
        />

        {/* Receipt content */}
        <div className="font-mono-pixel text-[11px] text-foreground/70 leading-[1.8] text-center">
          <p className="text-foreground font-medium text-xs tracking-wider mb-1">UNSUBSCRIBELY</p>
          <p className="text-muted-foreground/40 text-[10px]">─────────────────────────────</p>

          <div className="text-left mt-3 space-y-0.5">
            <div className="flex justify-between">
              <span>Subscriptions tracked</span>
              <span className="text-foreground">13</span>
            </div>
            <div className="flex justify-between">
              <span>Vaults locked</span>
              <span className="text-foreground">4</span>
            </div>
            <div className="flex justify-between">
              <span>Agent runs today</span>
              <span className="text-foreground">{agentRuns}</span>
            </div>
            <div className="flex justify-between">
              <span>Money saved (testnet)</span>
              <span className="text-emerald-500">${saved}.00</span>
            </div>
          </div>

          <p className="text-muted-foreground/40 text-[10px] mt-3">─────────────────────────────</p>

          <div className="text-left mt-2 space-y-0.5">
            <div className="flex justify-between">
              <span>SUBTOTAL:</span>
              <span className="text-foreground italic">you're welcome</span>
            </div>
            <div className="flex justify-between">
              <span>TAX:</span>
              <span>$0</span>
            </div>
            <div className="flex justify-between">
              <span>TIP:</span>
              <a href="https://github.com/devndesigner6/unsubly" target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-gold transition-colors underline underline-offset-2">star us on github</a>
            </div>
          </div>

          <p className="text-muted-foreground/40 text-[10px] mt-3">─────────────────────────────</p>

          {/* Links */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <a href="https://github.com/devndesigner6/unsubly" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <RiGithubLine className="size-3.5" />
            </a>
            <a href="https://x.com/hemanttbuilds" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <RiTwitterXLine className="size-3.5" />
            </a>
            <a href="https://t.me/unsublyybot" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <RiTelegramLine className="size-3.5" />
            </a>
            <Link to="/docs" className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Docs</Link>
            <Link to="/privacy" className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/terms" className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
          </div>

          <p className="text-muted-foreground/40 text-[10px] mt-4">─────────────────────────────</p>

          {/* Bottom */}
          <div className="mt-3 space-y-1">
            <p className="text-[9px] text-muted-foreground/50">
              Built on Algorand · Apache-2.0 · © {new Date().getFullYear()}
            </p>
            <p className="text-[9px] text-muted-foreground/40">
              @hemanttbuilds · AlgoBharat 2026
            </p>
          </div>

          <p className="text-muted-foreground/40 text-[10px] mt-3">─────────────────────────────</p>
          <p className="mt-2 text-[10px] text-muted-foreground/50 tracking-widest">THANK YOU COME AGAIN</p>

          {/* Barcode */}
          <div className="mt-3 flex items-center justify-center gap-[1px]">
            {Array.from({ length: 40 }, (_, i) => (
              <div
                key={i}
                className="bg-foreground/30"
                style={{
                  width: Math.random() > 0.5 ? "2px" : "1px",
                  height: "18px",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
