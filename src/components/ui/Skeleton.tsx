import { cx } from "@/lib/utils"

/**
 * Minimal skeleton shimmer block. Uses a CSS pulse animation
 * with the muted background color from the theme.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        "animate-pulse rounded-md bg-muted dark:bg-white/[0.08]",
        className,
      )}
    />
  )
}
