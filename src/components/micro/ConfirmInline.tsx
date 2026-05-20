import { useEffect, useRef, useState } from "react"
import { RiCheckLine, RiCloseLine, RiDeleteBinLine } from "@remixicon/react"

type Props = {
  onConfirm: () => void
  busy?: boolean
  trashLabel?: string
  confirmLabel?: string
  cancelLabel?: string
  icon?: React.ReactNode
}

/**
 * Replicates the dark-pill confirm pattern: a single trash button which, on
 * click, expands rightward to reveal a checkmark and an X. No modal.
 *
 * Layout mirrors the supplied mockup:
 *  - left compartment: action icon (trash by default)
 *  - chevron-shaped notch divider
 *  - right compartment: filled accent circle for confirm + outlined circle for cancel
 */
export function ConfirmInline({
  onConfirm,
  busy = false,
  trashLabel = "Delete",
  confirmLabel = "Confirm delete",
  cancelLabel = "Keep",
  icon,
}: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-collapse if the user clicks anywhere outside the pill.
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-stretch overflow-hidden rounded-full bg-muted dark:bg-white/[0.08] text-muted-foreground shadow-sm ring-1 ring-border/50 dark:ring-white/10 hover:ring-red-300 hover:text-red-500 dark:hover:ring-red-500/30 dark:hover:text-red-400 transition-colors"
    >
      {/* Left compartment: trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? cancelLabel : trashLabel}
        title={open ? cancelLabel : trashLabel}
        className="flex h-8 w-9 items-center justify-center transition-colors"
      >
        {icon ?? <RiDeleteBinLine className="size-4" />}
      </button>

      {/* Animated reveal section */}
      <div
        className="grid items-stretch transition-[grid-template-columns,opacity] duration-300 ease-out"
        style={{
          gridTemplateColumns: open ? "1fr" : "0fr",
          opacity: open ? 1 : 0,
        }}
        aria-hidden={!open}
      >
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden pr-1.5">
          {/* Chevron notch — fakes the cut-out from the mockup */}
          <span
            className="block h-9 w-2 shrink-0"
            style={{
              clipPath: "polygon(0 0, 100% 50%, 0 100%)",
              backgroundColor: "rgb(24 24 27)",
            }}
          />
          {/* Confirm */}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onConfirm()
              setOpen(false)
            }}
            aria-label={confirmLabel}
            title={confirmLabel}
            className="grid size-7 place-items-center rounded-full bg-orange-500/95 text-white shadow-inner ring-1 ring-orange-300/40 transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
          >
            <RiCheckLine className="size-4" />
          </button>
          {/* Cancel — outlined circle, no fill */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={cancelLabel}
            title={cancelLabel}
            className="grid size-7 place-items-center rounded-full bg-transparent text-white/85 ring-1 ring-white/35 transition-transform hover:scale-105 hover:text-white hover:ring-white/60 active:scale-95"
          >
            <RiCloseLine className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
