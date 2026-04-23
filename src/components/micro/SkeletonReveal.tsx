import { useEffect, useState } from "react"

type Props = {
  loading: boolean
  skeleton: React.ReactNode
  children: React.ReactNode
  className?: string
}

/**
 * Crossfades from a skeleton placeholder to real content all at once.
 * Avoids the staggered "line-by-line" reveal pattern: when content arrives
 * the entire skeleton fades to 0 while the children fade to 1 in the same
 * 280ms window, leaving a single satisfying "settle".
 */
export function SkeletonReveal({ loading, skeleton, children, className = "" }: Props) {
  const [hasLoaded, setHasLoaded] = useState(!loading)

  useEffect(() => {
    if (!loading) setHasLoaded(true)
  }, [loading])

  return (
    <div className={`relative ${className}`}>
      <div
        aria-hidden={hasLoaded}
        className="transition-opacity duration-300"
        style={{ opacity: hasLoaded ? 0 : 1, pointerEvents: hasLoaded ? "none" : "auto" }}
      >
        {skeleton}
      </div>
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ opacity: hasLoaded ? 1 : 0, pointerEvents: hasLoaded ? "auto" : "none" }}
      >
        {children}
      </div>
    </div>
  )
}

/** Equalizer-style skeleton bars suitable for use inside SkeletonReveal. */
export function EqualizerSkeleton({ bars = 7 }: { bars?: number }) {
  return (
    <div className="flex h-16 items-center justify-center gap-1.5">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="block w-2 rounded-full bg-muted-foreground/30"
          style={{
            height: `${30 + ((i * 13) % 70)}%`,
            animation: `unsub-equalizer 1.4s ease-in-out ${i * 90}ms infinite`,
          }}
        />
      ))}
    </div>
  )
}
