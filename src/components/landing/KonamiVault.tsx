import { useEffect, useState, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"

const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"]

const TERMINAL_LINES = [
  { text: "> AGENT OVERRIDE ACTIVATED", delay: 0 },
  { text: "> scanning your browser history...", delay: 800 },
  { text: "> found: 4 SaaS tabs open right now", delay: 2000 },
  { text: "> Notion. Figma. Linear. GitHub Copilot.", delay: 3200 },
  { text: "> estimated monthly drain: ₹4,200", delay: 4400 },
  { text: "> shall I lock them all? [Y/N]", delay: 5600 },
]

export function KonamiVault() {
  const [sequence, setSequence] = useState<string[]>([])
  const [active, setActive] = useState(false)
  const [lines, setLines] = useState<string[]>([])
  const [waitingInput, setWaitingInput] = useState(false)
  const [response, setResponse] = useState<string | null>(null)
  const [lockMode, setLockMode] = useState(false)

  // Listen for Konami sequence
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (active && waitingInput) {
        if (e.key.toLowerCase() === "y") {
          setResponse("y")
          setWaitingInput(false)
          setLockMode(true)
          // Close after 4s
          setTimeout(() => {
            setActive(false)
            setLockMode(false)
            setLines([])
            setResponse(null)
            setSequence([])
          }, 4000)
        } else if (e.key.toLowerCase() === "n") {
          setResponse("n")
          setWaitingInput(false)
          // Close after 3s
          setTimeout(() => {
            setActive(false)
            setLines([])
            setResponse(null)
            setSequence([])
          }, 3000)
        }
        return
      }

      if (active) return

      const newSeq = [...sequence, e.key].slice(-10)
      setSequence(newSeq)

      if (newSeq.length === 10 && newSeq.every((k, i) => k === KONAMI[i])) {
        setActive(true)
        setSequence([])
      }
    }

    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [sequence, active, waitingInput])

  // Type out terminal lines when active
  useEffect(() => {
    if (!active) return

    TERMINAL_LINES.forEach(({ text, delay }) => {
      setTimeout(() => {
        setLines((prev) => [...prev, text])
        if (text.includes("[Y/N]")) {
          setTimeout(() => setWaitingInput(true), 400)
        }
      }, delay)
    })
  }, [active])

  // Add padlocks to page elements when lockMode is active
  useEffect(() => {
    if (!lockMode) return
    const elements = document.querySelectorAll("h1, h2, h3, button, a, img")
    const originals: { el: Element; text: string }[] = []

    elements.forEach((el) => {
      if (el.closest("[data-konami-overlay]")) return
      const htmlEl = el as HTMLElement
      originals.push({ el, text: htmlEl.innerText })
      if (htmlEl.tagName === "IMG") {
        htmlEl.style.opacity = "0.3"
      } else if (htmlEl.innerText && htmlEl.innerText.length < 100) {
        htmlEl.innerText = "🔒 " + htmlEl.innerText
      }
    })

    return () => {
      originals.forEach(({ el, text }) => {
        const htmlEl = el as HTMLElement
        if (htmlEl.tagName === "IMG") {
          htmlEl.style.opacity = ""
        } else if (text) {
          htmlEl.innerText = text
        }
      })
    }
  }, [lockMode])

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          data-konami-overlay
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] bg-black flex items-center justify-center p-6"
        >
          <div className="w-full max-w-2xl">
            {/* Terminal chrome */}
            <div className="rounded-t-lg border border-white/10 bg-white/[0.03] flex items-center gap-2 px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-[#FF5F57]" />
              <span className="size-2.5 rounded-full bg-[#FEBC2E]" />
              <span className="size-2.5 rounded-full bg-[#28C840]" />
              <span className="ml-3 text-xs text-white/30 font-mono">openclaw-agent — override mode</span>
            </div>

            {/* Terminal body */}
            <div className="rounded-b-lg border border-t-0 border-white/10 bg-[#0a0a0a] p-6 font-mono text-sm min-h-[280px]">
              {lines.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`mb-1.5 ${
                    line.includes("OVERRIDE") ? "text-red-400 font-bold" :
                    line.includes("₹") ? "text-gold" :
                    line.includes("[Y/N]") ? "text-white" :
                    "text-white/60"
                  }`}
                >
                  {line}
                </motion.div>
              ))}

              {/* User response */}
              {response === "y" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-3"
                >
                  <p className="text-emerald-400 font-bold">&gt; LOCKING ALL VAULTS...</p>
                  <p className="text-emerald-400/70 mt-1">&gt; 4 escrow vaults created. ₹4,200 secured.</p>
                  <p className="text-white/40 mt-1 text-xs">&gt; you just saved a month's worth of regret.</p>
                </motion.div>
              )}

              {response === "n" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-3"
                >
                  <p className="text-white/50">&gt; coward. the subscriptions win again.</p>
                  <p className="text-white/20 mt-1 text-xs">&gt; closing terminal...</p>
                </motion.div>
              )}

              {/* Blinking cursor */}
              {!response && (
                <span className="inline-block w-2 h-4 bg-white/70 animate-pulse mt-2" />
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
