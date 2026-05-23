import { Link } from "react-router-dom"
import { useEffect, useState, useRef } from "react"
import { motion, useInView } from "motion/react"
import { RiTwitterXLine, RiGithubLine, RiTelegramLine } from "@remixicon/react"

export function Footer() {
  const [agentRuns, setAgentRuns] = useState(48)
  const [saved, setSaved] = useState(247)
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.2 })
  const [visibleLines, setVisibleLines] = useState(0)

  // Slowly tick up the numbers for liveness
  useEffect(() => {
    const interval = setInterval(() => {
      setAgentRuns((n) => n + 1)
      if (Math.random() > 0.6) setSaved((n) => n + Math.floor(Math.random() * 12 + 3))
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  // Typewriter reveal when scrolled into view
  useEffect(() => {
    if (!isInView) return
    const totalLines = 14
    let current = 0
    const interval = setInterval(() => {
      current++
      setVisibleLines(current)
      if (current >= totalLines) clearInterval(interval)
    }, 120)
    return () => clearInterval(interval)
  }, [isInView])

  return (
    <footer className="border-t border-border py-12 sm:py-16">
      <div ref={ref} className="mx-auto max-w-sm px-6">
        {/* Zig-zag torn edge */}
        <div
          className="h-3 -mt-12 mb-8 opacity-15"
          style={{
            background: `repeating-linear-gradient(90deg, hsl(var(--foreground)) 0px, hsl(var(--foreground)) 2px, transparent 2px, transparent 6px)`,
            maskImage: "linear-gradient(to bottom, transparent 0%, black 40%, black 60%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 40%, black 60%, transparent 100%)",
          }}
        />

        {/* Receipt content — typewriter reveal */}
        <div className="font-mono-pixel text-[11px] text-foreground/70 leading-[1.8] text-center">
          <motion.div style={{ opacity: visibleLines >= 1 ? 1 : 0 }} className="transition-opacity duration-150">
            <p className="text-foreground font-medium text-xs tracking-wider mb-1">UNSUBSCRIBELY</p>
          </motion.div>
          <motion.div style={{ opacity: visibleLines >= 2 ? 1 : 0 }} className="transition-opacity duration-150">
            <p className="text-muted-foreground/40 text-[10px]">─────────────────────────────</p>
          </motion.div>

          <div className="text-left mt-3 space-y-0.5">
            <motion.div style={{ opacity: visibleLines >= 3 ? 1 : 0 }} className="flex justify-between transition-opacity duration-150">
              <span>Subscriptions tracked</span>
              <span className="text-foreground">13</span>
            </motion.div>
            <motion.div style={{ opacity: visibleLines >= 4 ? 1 : 0 }} className="flex justify-between transition-opacity duration-150">
              <span>Vaults locked</span>
              <span className="text-foreground">4</span>
            </motion.div>
            <motion.div style={{ opacity: visibleLines >= 5 ? 1 : 0 }} className="flex justify-between transition-opacity duration-150">
              <span>Agent runs today</span>
              <span className="text-foreground">{agentRuns}</span>
            </motion.div>
            <motion.div style={{ opacity: visibleLines >= 6 ? 1 : 0 }} className="flex justify-between transition-opacity duration-150">
              <span>Money saved (testnet)</span>
              <span className="text-indigo-400">${saved}.00</span>
            </motion.div>
          </div>

          <motion.div style={{ opacity: visibleLines >= 7 ? 1 : 0 }} className="transition-opacity duration-150">
            <p className="text-muted-foreground/40 text-[10px] mt-3">─────────────────────────────</p>
          </motion.div>

          <div className="text-left mt-2 space-y-0.5">
            <motion.div style={{ opacity: visibleLines >= 8 ? 1 : 0 }} className="flex justify-between transition-opacity duration-150">
              <span>SUBTOTAL:</span>
              <span className="text-foreground italic">you're welcome</span>
            </motion.div>
            <motion.div style={{ opacity: visibleLines >= 9 ? 1 : 0 }} className="flex justify-between transition-opacity duration-150">
              <span>TAX:</span>
              <span>$0</span>
            </motion.div>
            <motion.div style={{ opacity: visibleLines >= 10 ? 1 : 0 }} className="flex justify-between transition-opacity duration-150">
              <span>TIP:</span>
              <a href="https://github.com/devndesigner6/unsubly" target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-indigo-400 transition-colors underline underline-offset-2">star us on github</a>
            </motion.div>
          </div>

          <motion.div style={{ opacity: visibleLines >= 11 ? 1 : 0 }} className="transition-opacity duration-150">
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
          </motion.div>

          <motion.div style={{ opacity: visibleLines >= 12 ? 1 : 0 }} className="transition-opacity duration-150">
            <p className="text-muted-foreground/40 text-[10px] mt-4">─────────────────────────────</p>
            <div className="mt-3 space-y-1">
              <p className="text-[9px] text-muted-foreground/50">
                Built on Algorand · Apache-2.0 · © {new Date().getFullYear()}
              </p>
              <p className="text-[9px] text-muted-foreground/40">
                @hemanttbuilds · AlgoBharat 2026
              </p>
            </div>
          </motion.div>

          <motion.div style={{ opacity: visibleLines >= 13 ? 1 : 0 }} className="transition-opacity duration-150">
            <p className="text-muted-foreground/40 text-[10px] mt-3">─────────────────────────────</p>
            <p className="mt-2 text-[10px] text-muted-foreground/50 tracking-widest">THANK YOU COME AGAIN</p>
          </motion.div>

          <motion.div style={{ opacity: visibleLines >= 14 ? 1 : 0 }} className="transition-opacity duration-150">
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
          </motion.div>
        </div>
      </div>
    </footer>
  )
}
