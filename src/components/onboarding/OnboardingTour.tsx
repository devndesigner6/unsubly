import { useEffect, useState, useCallback } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "motion/react"
import { useAuth } from "@/lib/auth-context"
import { useAlgorand } from "@/lib/algorand/context"
import { supabase } from "@/integrations/supabase/client"
import { RiCloseLine, RiCheckLine } from "@remixicon/react"

interface StepDef {
  label: string
  path: string
}

const STEPS: StepDef[] = [
  { label: "Add a subscription", path: "/subscriptions/new" },
  { label: "Connect wallet", path: "/escrow-vaults" },
  { label: "Create a vault", path: "/escrow-vaults" },
  { label: "Connect Telegram", path: "/settings" },
]

const STORAGE_KEY = (userId: string) => `ub:onboarding:${userId}`
const DISMISSED_KEY = (userId: string) => `ub:onboarding:dismissed:${userId}`

interface OnboardingState {
  completed: boolean[]
  dismissed: boolean
}

function getStoredState(userId: string): OnboardingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(userId))
    if (raw) return JSON.parse(raw)
  } catch {}
  return { completed: [false, false, false, false], dismissed: false }
}

function storeState(userId: string, state: OnboardingState) {
  try {
    localStorage.setItem(STORAGE_KEY(userId), JSON.stringify(state))
  } catch {}
}

export function OnboardingTour() {
  const { user, loading } = useAuth()
  const { walletAddress } = useAlgorand()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const [completed, setCompleted] = useState<boolean[]>([false, false, false, false])
  const [dismissed, setDismissed] = useState(false)
  const [allDone, setAllDone] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [visible, setVisible] = useState(false)

  // Load persisted state and check completion from live data
  const checkCompletion = useCallback(async () => {
    if (!user) return

    const stored = getStoredState(user.id)
    if (stored.dismissed) {
      setDismissed(true)
      return
    }

    const newCompleted = [...stored.completed]

    // Step 1: has at least 1 subscription
    try {
      const { count } = await supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
      newCompleted[0] = (count ?? 0) > 0
    } catch {}

    // Step 2: wallet connected
    newCompleted[1] = !!walletAddress

    // Step 3: has at least 1 vault
    try {
      const { count } = await supabase
        .from("escrow_vaults")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
      newCompleted[2] = (count ?? 0) > 0
    } catch {}

    // Step 4: telegram connected
    try {
      const { data } = await supabase
        .from("profiles")
        .select("telegram_chat_id")
        .eq("id", user.id)
        .maybeSingle()
      newCompleted[3] = !!(data as any)?.telegram_chat_id
    } catch {}

    setCompleted(newCompleted)
    storeState(user.id, { completed: newCompleted, dismissed: false })

    // Check if all done
    if (newCompleted.every(Boolean)) {
      setAllDone(true)
    }
  }, [user, walletAddress])

  // Initial load + re-check when wallet or route changes
  useEffect(() => {
    if (loading || !user) return
    checkCompletion()
  }, [loading, user, walletAddress, pathname, checkCompletion])

  // Show card on ALL pages for non-dismissed, non-complete users
  useEffect(() => {
    if (!user || loading || dismissed) {
      setVisible(false)
      return
    }
    const stored = getStoredState(user.id)
    if (stored.dismissed || stored.completed.every(Boolean)) {
      setVisible(false)
      return
    }
    setVisible(true)
  }, [user, loading, dismissed, pathname])

  // Celebration auto-dismiss
  useEffect(() => {
    if (!allDone || !visible) return
    setCelebrating(true)
    const timer = setTimeout(() => {
      setVisible(false)
      if (user) {
        storeState(user.id, { completed: [true, true, true, true], dismissed: true })
      }
    }, 3000)
    return () => clearTimeout(timer)
  }, [allDone, visible, user])

  const handleDismiss = () => {
    setVisible(false)
    setDismissed(true)
    if (user) {
      storeState(user.id, { completed, dismissed: true })
    }
  }

  const handleStepClick = (index: number) => {
    if (completed[index]) return
    navigate(STEPS[index].path)
  }

  const completedCount = completed.filter(Boolean).length
  const progress = (completedCount / STEPS.length) * 100

  if (!user) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed bottom-6 right-6 z-[9999] w-[320px] rounded-2xl border border-border bg-card shadow-lg"
        >
          {celebrating ? (
            <CelebrationView />
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h3 className="font-display text-sm font-semibold text-foreground">
                  Get Started
                </h3>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Close onboarding"
                >
                  <RiCloseLine className="size-4" />
                </button>
              </div>

              {/* Progress bar */}
              <div className="mx-4 mb-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gold"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>

              {/* Steps */}
              <div className="px-4 pb-3 space-y-1">
                {STEPS.map((step, i) => (
                  <button
                    key={step.label}
                    type="button"
                    onClick={() => handleStepClick(i)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${
                      completed[i]
                        ? "cursor-default"
                        : "hover:bg-muted/60 cursor-pointer"
                    }`}
                  >
                    {/* Circle / Checkmark */}
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                        completed[i]
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "border border-border text-muted-foreground"
                      }`}
                    >
                      {completed[i] ? (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 15 }}
                        >
                          <RiCheckLine className="size-3.5" />
                        </motion.span>
                      ) : (
                        i + 1
                      )}
                    </span>

                    {/* Label */}
                    <span
                      className={`text-sm ${
                        completed[i]
                          ? "line-through text-muted-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Footer button */}
              {completedCount < STEPS.length && (
                <div className="px-4 pb-4">
                  <button
                    type="button"
                    onClick={() => {
                      const nextIncomplete = completed.findIndex((c) => !c)
                      if (nextIncomplete >= 0) navigate(STEPS[nextIncomplete].path)
                    }}
                    className="w-full rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background hover:bg-foreground/90 transition-colors"
                  >
                    Let's go
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function CelebrationView() {
  return (
    <div className="px-4 py-6 text-center">
      {/* Confetti dots */}
      <div className="relative mx-auto mb-3 size-12">
        {[...Array(8)].map((_, i) => (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 size-2 rounded-full"
            style={{
              backgroundColor: ["#f59e0b", "#10b981", "#6366f1", "#ec4899"][i % 4],
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
            animate={{
              x: Math.cos((i * Math.PI) / 4) * 20,
              y: Math.sin((i * Math.PI) / 4) * 20,
              opacity: [1, 1, 0],
              scale: [0, 1.2, 0.8],
            }}
            transition={{ duration: 1.5, ease: "easeOut", delay: i * 0.05 }}
          />
        ))}
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.2 }}
          className="absolute inset-0 flex items-center justify-center rounded-full bg-emerald-500/15"
        >
          <RiCheckLine className="size-6 text-emerald-500" />
        </motion.span>
      </div>
      <p className="text-sm font-medium text-foreground">You're all set!</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Track your subscriptions on Algorand.
      </p>
    </div>
  )
}
