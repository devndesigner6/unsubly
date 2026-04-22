import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useLocation } from "react-router-dom"
import { useAuth } from "@/lib/auth-context"

type Placement = "top" | "bottom" | "left" | "right"

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
    body: "Start by adding any subscription you want to track — Netflix, Spotify, gym, anything. We'll watch the renewal dates for you.",
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
    body: "Click here any time to expand or collapse the sidebar with all your pages — Subscriptions, Calendar, Vaults and more.",
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

export function OnboardingTour() {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  const [stepIdx, setStepIdx] = useState(0)
  const [active, setActive] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const bubbleRef = useRef<HTMLDivElement | null>(null)

  // Only trigger the tour from the dashboard so it doesn't interrupt deep
  // links to /subscriptions, /x402-demo, etc.
  const isDashboard = pathname === "/dashboard"

  // Decide whether to start the tour for this user.
  useEffect(() => {
    if (loading || !user || !isDashboard) return
    const key = STORAGE_PREFIX + user.id
    if (localStorage.getItem(key) === "1") return
    // Wait a tick so the dashboard layout finishes mounting.
    const t = window.setTimeout(() => {
      setStepIdx(0)
      setActive(true)
    }, 600)
    return () => window.clearTimeout(t)
  }, [user, loading, isDashboard])

  // Recompute target rect whenever the step changes, on resize, and on scroll.
  useLayoutEffect(() => {
    if (!active) return
    let raf = 0

    function findEl(): HTMLElement | null {
      const sel = STEPS[stepIdx]?.selector
      if (!sel) return null
      return document.querySelector<HTMLElement>(sel)
    }

    function update() {
      const el = findEl()
      if (!el) {
        setRect(null)
        return
      }
      setRect(el.getBoundingClientRect())
    }

    // Poll briefly in case the target hasn't mounted yet (e.g. wallet button
    // appears only after the dashboard query finishes).
    let attempts = 0
    function tick() {
      const el = findEl()
      if (el) {
        update()
        return
      }
      attempts++
      // Poll for ~5 seconds — the dashboard waits on subscription / vault
      // queries before rendering the hero, so the target may not exist yet.
      if (attempts < 300) raf = window.requestAnimationFrame(tick)
      else {
        // Target never appeared (e.g. wallet already connected, so the
        // "Connect wallet" button isn't rendered). Skip this step rather
        // than parking a detached bubble in the middle of the screen.
        setStepIdx((i) => {
          if (i >= STEPS.length - 1) {
            try {
              if (user) localStorage.setItem(STORAGE_PREFIX + user.id, "1")
            } catch { /* ignore */ }
            setActive(false)
            return i
          }
          return i + 1
        })
      }
    }
    tick()

    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
    }
  }, [stepIdx, active])

  // While a step is showing, scroll the target into view if it's off-screen.
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
  const next = () => {
    if (stepIdx >= STEPS.length - 1) finish(true)
    else setStepIdx((i) => i + 1)
  }
  const prev = () => setStepIdx((i) => Math.max(0, i - 1))

  // ── Bubble positioning ────────────────────────────────────────────────
  const placement: Placement = step.placement ?? "bottom"
  const BUBBLE_W = 320
  const BUBBLE_OFFSET = 14

  let bubbleStyle: React.CSSProperties = {
    position: "fixed",
    width: BUBBLE_W,
    zIndex: 10001,
  }
  let arrowStyle: React.CSSProperties = {}

  if (rect) {
    if (placement === "bottom") {
      bubbleStyle.top = rect.bottom + BUBBLE_OFFSET
      bubbleStyle.left = Math.max(
        12,
        Math.min(window.innerWidth - BUBBLE_W - 12, rect.left + rect.width / 2 - BUBBLE_W / 2)
      )
      arrowStyle = {
        top: -7,
        left: rect.left + rect.width / 2 - (bubbleStyle.left as number),
      }
    } else if (placement === "top") {
      bubbleStyle.bottom = window.innerHeight - rect.top + BUBBLE_OFFSET
      bubbleStyle.left = Math.max(
        12,
        Math.min(window.innerWidth - BUBBLE_W - 12, rect.left + rect.width / 2 - BUBBLE_W / 2)
      )
      arrowStyle = {
        bottom: -7,
        left: rect.left + rect.width / 2 - (bubbleStyle.left as number),
      }
    } else if (placement === "right") {
      bubbleStyle.top = Math.max(12, rect.top + rect.height / 2 - 60)
      bubbleStyle.left = rect.right + BUBBLE_OFFSET
      arrowStyle = { left: -7, top: 24 }
    } else if (placement === "left") {
      bubbleStyle.top = Math.max(12, rect.top + rect.height / 2 - 60)
      bubbleStyle.right = window.innerWidth - rect.left + BUBBLE_OFFSET
      arrowStyle = { right: -7, top: 24 }
    }
  } else {
    // Target not found (yet): center the bubble so the user still sees the copy.
    bubbleStyle.top = window.innerHeight / 2 - 80
    bubbleStyle.left = window.innerWidth / 2 - BUBBLE_W / 2
  }

  // Spotlight rect (transparent hole over the target with a dark backdrop).
  const padding = 8
  const spotlight = rect
    ? {
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }
    : null

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[10000]">
      {/* Backdrop with a punched hole over the target */}
      <svg className="pointer-events-auto absolute inset-0 h-full w-full" onClick={() => finish(false)}>
        <defs>
          <mask id="ub-tour-hole">
            <rect width="100%" height="100%" fill="white" />
            {spotlight && (
              <rect
                x={spotlight.left}
                y={spotlight.top}
                width={spotlight.width}
                height={spotlight.height}
                rx={10}
                ry={10}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#ub-tour-hole)" />
      </svg>

      {/* Highlight ring around target */}
      {spotlight && (
        <div
          className="absolute rounded-[10px] ring-2 ring-white shadow-[0_0_0_4px_rgba(255,255,255,0.15)]"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      )}

      {/* Tooltip bubble */}
      <div
        ref={bubbleRef}
        role="dialog"
        aria-label={step.title}
        className="pointer-events-auto rounded-2xl bg-white text-gray-900 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.45)] ring-1 ring-black/5"
        style={bubbleStyle}
      >
        {/* Arrow */}
        {rect && (
          <div
            aria-hidden
            className="absolute size-3.5 rotate-45 bg-white ring-1 ring-black/5"
            style={arrowStyle}
          />
        )}

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
