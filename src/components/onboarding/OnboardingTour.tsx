import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useLocation } from "react-router-dom"
import { useAuth } from "@/lib/auth-context"

type Placement = "top" | "bottom" | "left" | "right" | "auto"

interface TourStep {
  id: string
  selector: string
  title: string
  body: string
  placement?: Placement
}

const STEPS: TourStep[] = [
  {
    id: "add-subscription",
    selector: '[data-tour="add-subscription"]',
    title: "Add a subscription",
    body: "Start by adding any subscription you want to track, Netflix, Spotify, gym, anything. We watch the renewal dates for you.",
    placement: "bottom",
  },
  {
    id: "connect-wallet",
    selector: '[data-tour="connect-wallet"]',
    title: "Connect your wallet",
    body: "Link Pera, Defly or Lute to lock funds into on-chain escrow vaults so the agent can pay your subs autonomously.",
    placement: "top",
  },
  {
    id: "sidebar-trigger",
    selector: '[data-tour="sidebar-trigger"]',
    title: "Open the sidebar",
    body: "Click here any time to expand or collapse the sidebar with all your pages, Subscriptions, Calendar, Vaults and more.",
    placement: "right",
  },
  {
    id: "algorand-total",
    selector: '[data-tour="algorand-total"]',
    title: "Your on-chain balance",
    body: "Once a wallet is connected this card shows your total ALGO balance, vaults locked, and kill switches at a glance.",
    placement: "top",
  },
]

const STORAGE_PREFIX = "ub:tour:done:"
const BUBBLE_W = 320
const BUBBLE_OFFSET = 14
const SPOT_PADDING = 8

function getRectFor(selector: string): DOMRect | null {
  const el = document.querySelector<HTMLElement>(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  // Skip zero-size elements (display:none, not yet laid out, etc.)
  if (r.width === 0 && r.height === 0) return null
  return r
}

function pickPlacement(rect: DOMRect, requested: Placement): Exclude<Placement, "auto"> {
  if (requested !== "auto") {
    // Fall back if the requested side has no room.
    if (requested === "bottom" && window.innerHeight - rect.bottom < 140) return "top"
    if (requested === "top" && rect.top < 140) return "bottom"
    if (requested === "right" && window.innerWidth - rect.right < BUBBLE_W + 24) return "bottom"
    if (requested === "left" && rect.left < BUBBLE_W + 24) return "bottom"
    return requested
  }
  if (window.innerHeight - rect.bottom > 160) return "bottom"
  if (rect.top > 160) return "top"
  return "bottom"
}

export function OnboardingTour() {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  const [stepIdx, setStepIdx] = useState(0)
  const [active, setActive] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const armedRef = useRef(false)

  // Only trigger from the dashboard so deep links to other pages aren't
  // interrupted by the overlay.
  const isDashboard = pathname === "/dashboard"

  // Arm the tour once per logged-in user. We don't activate the overlay until
  // the FIRST target actually exists, so the dashboard's loading spinner is
  // never covered by a bubble pointing at nothing.
  useEffect(() => {
    if (loading || !user || !isDashboard) return
    const key = STORAGE_PREFIX + user.id
    if (localStorage.getItem(key) === "1") return
    armedRef.current = true

    let raf = 0
    let cancelled = false

    function waitForFirst() {
      if (cancelled) return
      const r = getRectFor(STEPS[0].selector)
      if (r) {
        setStepIdx(0)
        setRect(r)
        setActive(true)
        return
      }
      raf = window.requestAnimationFrame(waitForFirst)
    }
    waitForFirst()

    return () => {
      cancelled = true
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [user, loading, isDashboard])

  // If the user navigates away from the dashboard mid-tour, dismiss it.
  useEffect(() => {
    if (active && !isDashboard) setActive(false)
  }, [active, isDashboard])

  // Continuously track the current step's target so the bubble follows it
  // through layout shifts, sidebar toggles, scroll, image loads, etc.
  useLayoutEffect(() => {
    if (!active) return
    const step = STEPS[stepIdx]
    if (!step) return

    let raf = 0
    let lastJSON = ""

    function tick() {
      const r = getRectFor(step.selector)
      if (r) {
        const j = `${r.top}|${r.left}|${r.width}|${r.height}`
        if (j !== lastJSON) {
          lastJSON = j
          setRect(r)
        }
      } else {
        if (lastJSON !== "missing") {
          lastJSON = "missing"
          setRect(null)
        }
      }
      raf = window.requestAnimationFrame(tick)
    }
    tick()

    return () => {
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [stepIdx, active])

  // Scroll the target into view when it changes.
  useEffect(() => {
    if (!active || !rect) return
    const top = rect.top
    const bottom = rect.bottom
    if (top < 80 || bottom > window.innerHeight - 80) {
      window.scrollTo({
        top: window.scrollY + top - window.innerHeight / 2 + rect.height / 2,
        behavior: "smooth",
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, active])

  if (!active || !user) return null

  const step = STEPS[stepIdx]
  const finish = (markDone: boolean) => {
    if (markDone) {
      try {
        localStorage.setItem(STORAGE_PREFIX + user.id, "1")
      } catch { /* ignore */ }
    }
    setActive(false)
  }

  // Advance: wait briefly for the next target. If it doesn't appear in 2s
  // (e.g. the wallet is already connected so the "Connect wallet" button
  // isn't on the page), skip past it.
  const advanceTo = (idx: number) => {
    if (idx >= STEPS.length) return finish(true)
    setStepIdx(idx)
    setRect(null)
    let attempts = 0
    const trySkip = () => {
      const r = getRectFor(STEPS[idx].selector)
      if (r) return
      attempts++
      if (attempts > 120) {
        // Skip to the next one with a target.
        advanceTo(idx + 1)
      } else {
        window.requestAnimationFrame(trySkip)
      }
    }
    trySkip()
  }

  const next = () => advanceTo(stepIdx + 1)
  const prev = () => setStepIdx((i) => Math.max(0, i - 1))

  // ── Positioning ───────────────────────────────────────────────────────
  const placement = rect ? pickPlacement(rect, step.placement ?? "auto") : "bottom"
  const bubbleStyle: React.CSSProperties = { position: "fixed", width: BUBBLE_W, zIndex: 10001 }
  const arrowStyle: React.CSSProperties = { position: "absolute" }
  const margin = 12

  if (rect) {
    if (placement === "bottom") {
      const left = Math.max(margin, Math.min(window.innerWidth - BUBBLE_W - margin, rect.left + rect.width / 2 - BUBBLE_W / 2))
      bubbleStyle.top = rect.bottom + BUBBLE_OFFSET
      bubbleStyle.left = left
      arrowStyle.top = -7
      arrowStyle.left = Math.max(14, Math.min(BUBBLE_W - 28, rect.left + rect.width / 2 - left - 7))
    } else if (placement === "top") {
      const left = Math.max(margin, Math.min(window.innerWidth - BUBBLE_W - margin, rect.left + rect.width / 2 - BUBBLE_W / 2))
      bubbleStyle.bottom = window.innerHeight - rect.top + BUBBLE_OFFSET
      bubbleStyle.left = left
      arrowStyle.bottom = -7
      arrowStyle.left = Math.max(14, Math.min(BUBBLE_W - 28, rect.left + rect.width / 2 - left - 7))
    } else if (placement === "right") {
      const top = Math.max(margin, Math.min(window.innerHeight - 160, rect.top + rect.height / 2 - 60))
      bubbleStyle.top = top
      bubbleStyle.left = rect.right + BUBBLE_OFFSET
      arrowStyle.left = -7
      arrowStyle.top = Math.max(14, rect.top + rect.height / 2 - top - 7)
    } else {
      const top = Math.max(margin, Math.min(window.innerHeight - 160, rect.top + rect.height / 2 - 60))
      bubbleStyle.top = top
      bubbleStyle.right = window.innerWidth - rect.left + BUBBLE_OFFSET
      arrowStyle.right = -7
      arrowStyle.top = Math.max(14, rect.top + rect.height / 2 - top - 7)
    }
  } else {
    // Hide bubble while target is missing; backdrop also hidden below.
    bubbleStyle.opacity = 0
    bubbleStyle.pointerEvents = "none"
    bubbleStyle.top = -9999
    bubbleStyle.left = -9999
  }

  const spotlight = rect
    ? {
        top: rect.top - SPOT_PADDING,
        left: rect.left - SPOT_PADDING,
        width: rect.width + SPOT_PADDING * 2,
        height: rect.height + SPOT_PADDING * 2,
      }
    : null

  // If we have no target right now, render nothing (no dark backdrop over a
  // loading spinner).
  if (!spotlight) return null

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[10000]">
      <svg className="pointer-events-auto absolute inset-0 h-full w-full" onClick={() => finish(false)}>
        <defs>
          <mask id="ub-tour-hole">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={spotlight.left}
              y={spotlight.top}
              width={spotlight.width}
              height={spotlight.height}
              rx={10}
              ry={10}
              fill="black"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#ub-tour-hole)" />
      </svg>

      <div
        className="absolute rounded-[10px] ring-2 ring-white shadow-[0_0_0_4px_rgba(255,255,255,0.15)]"
        style={{
          top: spotlight.top,
          left: spotlight.left,
          width: spotlight.width,
          height: spotlight.height,
        }}
      />

      <div
        role="dialog"
        aria-label={step.title}
        className="pointer-events-auto rounded-2xl bg-white text-gray-900 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.45)] ring-1 ring-black/5"
        style={bubbleStyle}
      >
        <div aria-hidden className="size-3.5 rotate-45 bg-white ring-1 ring-black/5" style={arrowStyle} />

        <div className="relative p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">{step.title}</h3>
            <span className="text-[11px] text-gray-500">
              {stepIdx + 1} / {STEPS.length}
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-gray-600">{step.body}</p>
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => finish(true)}
              className="text-xs font-medium text-gray-500 hover:text-gray-900"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              {stepIdx > 0 && (
                <button
                  type="button"
                  onClick={prev}
                  className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={next}
                className="rounded-full bg-gray-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
              >
                {stepIdx >= STEPS.length - 1 ? "Got it" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
