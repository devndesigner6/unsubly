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

const social = [
  { name: "Twitter", href: "https://x.com/hemanttbuilds", icon: RiTwitterXLine },
  { name: "GitHub", href: "https://github.com/devndesigner6", icon: RiGithubLine },
  { name: "LinkedIn", href: "https://www.linkedin.com/in/hemanthp15gr6", icon: RiLinkedinLine },
  { name: "Telegram", href: "https://t.me/unsublyybot", icon: RiTelegramLine },
]

// Terminal navigation links
const NAV_LINKS = [
  { label: "features", href: "#features" },
  { label: "how-it-works", href: "#how-it-works" },
  { label: "blockchain", href: "#blockchain" },
  { label: "pricing", href: "#pricing" },
  { label: "docs", href: "/docs", internal: true },
  { label: "telegram-bot", href: "https://t.me/unsublyybot" },
  { label: "github", href: "https://github.com/devndesigner6/unsubly" },
  { label: "gtm-plan", href: "/Unsubscribely-GTM-Plan.pdf" },
  { label: "privacy", href: "/privacy", internal: true },
  { label: "terms", href: "/terms", internal: true },
  { label: "contact", href: "mailto:peddadahemanth6@gmail.com" },
]

// Challenge questions
const QUESTIONS = [
  { q: "How many seconds for Algorand finality?", accept: ["3.3", "3.3s"] },
  { q: "What does the agent do every 30 minutes?", accept: ["vault", "check", "release", "pay", "monitor"] },
  { q: "What's the opposite of subscribing?", accept: ["unsub", "cancel", "unsubscribe", "unsubscribely"] },
]

function TerminalLink({ label, href, internal }: { label: string; href: string; internal?: boolean }) {
  const cls = "text-[#33ff33] hover:text-[#80ffb0] hover:underline underline-offset-2 transition-colors cursor-pointer"
  if (internal) return <Link to={href} className={cls}>{label}</Link>
  return <a href={href} target={href.startsWith("http") || href.startsWith("mailto:") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined} className={cls}>{label}</a>
}

function InteractiveTerminal({ started }: { started: boolean }) {
  const [phase, setPhase] = useState<"typing" | "challenge" | "done">("typing")
  const [typedLines, setTypedLines] = useState(0)
  const [questionIdx, setQuestionIdx] = useState(0)
  const [input, setInput] = useState("")
  const [history, setHistory] = useState<string[]>([])
  const [wrong, setWrong] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Type out initial lines
  useEffect(() => {
    if (!started) return
    // 7 lines to type: header note, ls pages, results, ls resources, results, ls legal, results
    const totalLines = 7
    let i = 0
    const interval = setInterval(() => {
      i++
      setTypedLines(i)
      if (i >= totalLines) { clearInterval(interval); setTimeout(() => setPhase("challenge"), 600) }
    }, 500)
    return () => clearInterval(interval)
  }, [started])

  // Auto-scroll terminal body
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [typedLines, history, questionIdx, phase])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const q = QUESTIONS[questionIdx]
    const answer = input.trim().toLowerCase()
    const correct = q.accept.some((a) => answer.includes(a))

    if (correct) {
      setHistory((h) => [...h, `$ ${input}`, "  ✓ correct"])
      setWrong(false)
      setInput("")
      if (questionIdx >= QUESTIONS.length - 1) {
        setHistory((h) => [...h, "", "  ━━━━━━━━━━━━━━━━━━━━━━━━", "  ACCESS GRANTED.", "  Redirecting to Pro..."])
        setPhase("done")
        setTimeout(() => {
          window.open("https://checkout.dodopayments.com/buy/pdt_0NfAOGyle2UpxBVyJL1Cn?quantity=1&redirect_url=https://unsubly.xyz/dashboard", "_blank")
        }, 1500)
      } else {
        setQuestionIdx((i) => i + 1)
      }
    } else {
      setHistory((h) => [...h, `$ ${input}`, "  ✗ nope. try again."])
      setWrong(true)
      setInput("")
    }
  }

  return (
    <div className="rounded-xl border border-[#1a1a1a] dark:border-[#2a2a2a] bg-[#0d0d0d] overflow-hidden flex flex-col h-full">
      {/* Terminal chrome */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a1a1a] bg-[#141414] shrink-0">
        <span className="size-[8px] rounded-full bg-[#FF5F57]" />
        <span className="size-[8px] rounded-full bg-[#FEBC2E]" />
        <span className="size-[8px] rounded-full bg-[#28C840]" />
        <span className="ml-2 text-[9px] text-[#555] font-mono">visitor@unsubly ~ %</span>
      </div>

      {/* Terminal body */}
      <div ref={bodyRef} className="p-4 font-mono text-[10px] leading-[1.8] flex-1 overflow-y-auto scrollbar-hide" style={{ textShadow: "0 0 4px #00ff6630" }}>
        {/* Header note */}
        {typedLines >= 1 && (
          <div className="text-[#555] text-[9px] mb-2">
            ┌ clickable links below — these are real pages
          </div>
        )}

        {/* Navigation commands */}
        {typedLines >= 2 && <div className="text-[#33ff33]">$ ls ./pages</div>}
        {typedLines >= 3 && (
          <div className="text-[#33ff33]/70 ml-2 flex flex-wrap gap-x-2">
            {NAV_LINKS.slice(0, 4).map((l) => <TerminalLink key={l.label} {...l} />)}
          </div>
        )}
        {typedLines >= 4 && <div className="text-[#33ff33] mt-1">$ ls ./resources</div>}
        {typedLines >= 5 && (
          <div className="text-[#33ff33]/70 ml-2 flex flex-wrap gap-x-2">
            {NAV_LINKS.slice(4, 8).map((l) => <TerminalLink key={l.label} {...l} />)}
          </div>
        )}
        {typedLines >= 6 && <div className="text-[#33ff33] mt-1">$ ls ./legal</div>}
        {typedLines >= 7 && (
          <div className="text-[#33ff33]/70 ml-2 flex flex-wrap gap-x-2">
            {NAV_LINKS.slice(8).map((l) => <TerminalLink key={l.label} {...l} />)}
          </div>
        )}

        {/* whoami + status */}
        {phase !== "typing" && (
          <>
            <div className="text-[#33ff33] mt-2">$ whoami</div>
            <div className="text-[#33ff33]/70 ml-2">
              <a href="https://x.com/hemanttbuilds" target="_blank" rel="noopener noreferrer" className="text-[#33ff33] hover:text-[#80ffb0] hover:underline underline-offset-2 transition-colors">@hemanttbuilds</a>
            </div>
            <div className="text-[#33ff33] mt-1">$ echo $STATUS</div>
            <div className="text-[#33ff33]/70 ml-2">open-source ♠ algorand</div>
          </>
        )}

        {/* Challenge */}
        {phase === "challenge" && (
          <>
            <div className="text-[#555] mt-3 text-[9px]">─── CHALLENGE MODE ───────────────</div>
            <div className="text-[#555] text-[9px]">Answer 3 to unlock Pro.</div>
            <div className="mt-2" />

            {/* History of answers */}
            {history.map((line, i) => (
              <div key={i} className={`${line.includes("✓") ? "text-[#28C840]" : line.includes("✗") ? "text-[#FF5F57]" : "text-[#33ff33]/70"}`}>
                {line}
              </div>
            ))}

            {/* Current question */}
            {questionIdx < QUESTIONS.length && (
              <div className="text-[#33ff33] mt-1">
                [{questionIdx + 1}/3] {QUESTIONS[questionIdx].q}
              </div>
            )}
          </>
        )}

        {/* Done state */}
        {phase === "done" && (
          <>
            {history.map((line, i) => (
              <div key={i} className={`${line.includes("✓") ? "text-[#28C840]" : line.includes("✗") ? "text-[#FF5F57]" : line.includes("ACCESS") ? "text-[#33ff33] font-bold" : "text-[#33ff33]/70"}`}>
                {line}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Input area */}
      {phase === "challenge" && questionIdx < QUESTIONS.length && (
        <form onSubmit={handleSubmit} className="flex items-center gap-1 px-4 py-2 border-t border-[#1a1a1a] bg-[#0a0a0a]">
          <span className="text-[#33ff33] text-[10px] font-mono">$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            className="flex-1 bg-transparent text-[#33ff33] text-[10px] font-mono outline-none placeholder:text-[#333] caret-[#33ff33]"
            placeholder="type your answer..."
          />
        </form>
      )}
    </div>
  )
}

export function Footer() {
  const ref = useRef<HTMLDivElement>(null)
  const [receiptText, setReceiptText] = useState("")
  const [receiptDone, setReceiptDone] = useState(false)
  const [started, setStarted] = useState(false)

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

  return (
    <footer className="border-t border-border py-10 sm:py-14">
      <div ref={ref} className="mx-auto max-w-5xl px-6 lg:px-8">

        {/* Two columns — same height, stack on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch" style={{ minHeight: "380px" }}>

          {/* LEFT — Receipt */}
          <div className="rounded-xl border border-border/40 bg-[#fafaf8] dark:bg-[#0d0d0d] p-5 flex flex-col items-center">
            {/* Torn edge */}
            <div className="w-full h-[2px] mb-3 opacity-15" style={{ background: `repeating-linear-gradient(90deg, hsl(var(--foreground)) 0px, hsl(var(--foreground)) 2px, transparent 2px, transparent 5px)` }} />
            {/* Receipt text — centered */}
            <div className="font-mono-pixel text-[9px] text-foreground/70 leading-[1.6] whitespace-pre-wrap flex-1 w-full max-w-[260px]">
              {receiptText}
              {!receiptDone && <span className="inline-block w-[4px] h-[8px] bg-foreground/50 animate-pulse ml-[1px] align-middle" />}
            </div>
            {/* Barcode — centered under receipt */}
            <div className={`mt-3 w-full max-w-[260px] flex items-center justify-center gap-[0.5px] transition-opacity duration-300 ${receiptDone ? "opacity-100" : "opacity-0"}`}>
              {Array.from({ length: 50 }, (_, i) => (
                <div key={i} className="bg-foreground/20 dark:bg-foreground/15" style={{ width: [1, 2, 1, 1, 2, 1, 2, 1, 1, 2][i % 10] + "px", height: "18px" }} />
              ))}
            </div>
          </div>

          {/* RIGHT — Interactive Terminal */}
          <InteractiveTerminal started={started} />
        </div>

        {/* Bottom bar */}
        <div className={`mt-8 flex flex-col items-center justify-between gap-3 border-t border-border/40 pt-5 sm:flex-row transition-opacity duration-500 ${started ? "opacity-100" : "opacity-0"}`}>
          <div className="flex items-center gap-4">
            <p className="text-[11px] text-muted-foreground">
              Built by{" "}
              <a href="https://hemanthme.in" target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-400 font-medium transition-colors">Hemanth</a>
              {" "}♠ Open Source
            </p>
            <div className="flex gap-2">
              {social.map((item) => (
                <a key={item.name} href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.name} className="text-muted-foreground hover:text-foreground transition-colors">
                  <item.icon className="size-4" />
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
