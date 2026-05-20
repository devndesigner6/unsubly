import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { RiSendPlaneFill } from "@remixicon/react"
import { motion, AnimatePresence } from "motion/react"
import { Link } from "react-router-dom"

// ── Types ───────────────────────────────────────────────────────────────────

interface PulseAction {
  label: string
  type: "link"
  href: string
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  actions?: PulseAction[]
  timestamp: number
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function formatMessage(text: string) {
  // Convert **bold** to <strong>, • bullets to styled list, and newlines to <br>
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
    .replace(/^• (.+)$/gm, '<span class="flex gap-2 items-start"><span class="text-gold shrink-0">•</span><span>$1</span></span>')
    .replace(/\n/g, "<br />")
}

// ── Loading Dots ────────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-2 rounded-full bg-muted-foreground/60"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  )
}

// ── Suggested Prompts ───────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  "What should I cancel?",
  "Show my spending",
  "Which subs need vaults?",
  "Find savings",
]

// ── Main Component ──────────────────────────────────────────────────────────

export default function ChatPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [greeted, setGreeted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  // Auto-send greeting on mount
  useEffect(() => {
    if (user && !greeted) {
      setGreeted(true)
      sendToAPI([{ role: "user", content: "Hi! Give me a quick summary of my subscription spending and one actionable tip." }], true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function sendToAPI(conversationMessages: { role: string; content: string }[], isGreeting = false) {
    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error("Please sign in")

      const res = await fetch("/api/ai-optimizer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: conversationMessages }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to get response")

      const aiMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: data.reply || "I couldn't generate a response. Please try again.",
        actions: data.actions || [],
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, aiMessage])
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: `**Error:** ${err instanceof Error ? err.message : "Something went wrong. Please try again."}`,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  async function handleSend(text?: string) {
    const messageText = text || input.trim()
    if (!messageText || loading) return

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: messageText,
      timestamp: Date.now(),
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput("")

    // Build conversation history for API
    const conversationForAPI = updatedMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    await sendToAPI(conversationForAPI)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const showSuggestions = messages.length === 0 && !loading

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-background overflow-hidden flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-3 relative overflow-hidden">
        <span className="ghost-text select-none">CHAT</span>
        <h1 className="font-display text-3xl sm:text-4xl text-foreground tracking-tight">
          Chat
        </h1>
        <p className="font-display italic text-xs text-muted-foreground mt-1">
          Your subscription nerve center
        </p>
      </div>

      {/* Chat Area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 lg:px-8 pb-2">
        <div className="max-w-3xl mx-auto space-y-4 py-4">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-foreground text-background rounded-br-md"
                      : "bg-card border border-border rounded-bl-md"
                  }`}
                >
                  <div
                    className={`text-sm leading-relaxed ${
                      msg.role === "user" ? "text-background" : "text-foreground"
                    }`}
                    dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                  />
                  {/* Action buttons */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-border/50">
                      {msg.actions.map((action, i) => (
                        <Link
                          key={i}
                          to={action.href}
                          className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 border border-gold/30 px-3 py-1.5 text-xs font-medium text-gold hover:bg-gold/20 hover:border-gold/50 transition-all duration-150"
                        >
                          {action.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading indicator */}
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="bg-card border border-border rounded-2xl rounded-bl-md">
                <LoadingDots />
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggested Prompts + Input */}
      <div className="shrink-0 border-t border-border bg-background px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-3xl mx-auto space-y-3">
          {/* Suggested prompts */}
          {showSuggestions && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-wrap gap-2"
            >
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  disabled={loading}
                  className="rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted/50 transition-all duration-150 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </motion.div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your subscriptions..."
              disabled={loading}
              className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/50 disabled:opacity-50 transition-all"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="flex size-11 items-center justify-center rounded-xl bg-foreground text-background hover:bg-foreground/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 shrink-0"
              aria-label="Send message"
            >
              <RiSendPlaneFill className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
