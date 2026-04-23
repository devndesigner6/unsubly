import { useEffect, useRef, useState } from "react"

type Props = {
  value: number
  decimals?: number
  duration?: number
  className?: string
  prefix?: string
  suffix?: string
}

/**
 * Odometer-style number that rolls smoothly from its previous value to the new
 * one. Uses requestAnimationFrame and ease-out cubic so the change is felt, not
 * just shown. Fixed-width tabular numerals prevent layout shift.
 */
export function RollingNumber({
  value,
  decimals = 0,
  duration = 600,
  className = "",
  prefix = "",
  suffix = "",
}: Props) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const startedAt = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (display === value) return
    fromRef.current = display
    startedAt.current = null

    const tick = (now: number) => {
      if (startedAt.current === null) startedAt.current = now
      const elapsed = now - startedAt.current
      const t = Math.min(1, elapsed / duration)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      const next = fromRef.current + (value - fromRef.current) * eased
      setDisplay(next)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  )
}
