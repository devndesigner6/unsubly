import { useEffect, useRef, useState } from "react"

type Props = {
  onConfirm: () => void
  children: React.ReactNode
  windowMs?: number
  className?: string
  ariaLabel?: string
}

/**
 * Two-step confirm without a modal or text. First click arms the action and
 * draws a shrinking ring around the button. A second click within `windowMs`
 * fires onConfirm. Moving the cursor away (mouseleave) silently disarms.
 *
 * Used by the Disconnect Wallet button to honour "the gesture itself is the
 * confirmation".
 */
export function RippleConfirm({
  onConfirm,
  children,
  windowMs = 3000,
  className = "",
  ariaLabel,
}: Props) {
  const [armed, setArmed] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
  }, [])

  function disarm() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setArmed(false)
  }

  function arm() {
    setArmed(true)
    timerRef.current = window.setTimeout(disarm, windowMs)
  }

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (armed) {
      disarm()
      onConfirm()
    } else {
      arm()
    }
  }

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseLeave={() => armed && disarm()}
    >
      {/* Shrinking ring overlay */}
      {armed && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-destructive"
          style={{
            animation: `unsub-shrink-ring ${windowMs}ms linear forwards`,
          }}
        />
      )}
      <button
        type="button"
        onClick={handleClick}
        aria-label={ariaLabel}
        aria-pressed={armed}
        className="relative inline-flex items-center"
      >
        {children}
      </button>
    </span>
  )
}
