import { useState } from "react"
import { RiExternalLinkLine, RiLockUnlockLine, RiArrowGoBackLine } from "@remixicon/react"

type Props = {
  amount: number
  currency: string
  vendorName: string
  txnId: string
  explorerUrl: string
  asaId?: number | null
  capturedAt?: string | null
  /** When true the card is rendered already-flipped to its back face */
  initialBack?: boolean
}

/**
 * NFT-style receipt card. Layout takes its cues from the dark, rounded-corner
 * card mockup: a substantial card with rounded-2xl corners, soft outer shadow,
 * a subtle inner highlight at the top edge, label top-left, content centered,
 * action button bottom-right.
 *
 * Click the card (or auto-trigger via initialBack) to flip on the Y axis and
 * reveal the on-chain transaction id + explorer link.
 */
export function NftReceiptCard({
  amount,
  currency,
  vendorName,
  txnId,
  explorerUrl,
  asaId,
  capturedAt,
  initialBack = false,
}: Props) {
  const [showBack, setShowBack] = useState(initialBack)

  return (
    <div
      className="relative w-full max-w-md cursor-pointer select-none"
      style={{ perspective: "1200px" }}
      onClick={() => setShowBack((v) => !v)}
      role="button"
      tabIndex={0}
      aria-label={showBack ? "Show receipt front" : "Show transaction details"}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          setShowBack((v) => !v)
        }
      }}
    >
      <div
        className="relative h-[260px] w-full transition-transform duration-700"
        style={{
          transformStyle: "preserve-3d",
          transform: showBack ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* FRONT */}
        <Face>
          <span className="absolute left-5 top-4 text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
            Subscription Receipt
          </span>
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-white">
            <div className="flex size-12 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
              <RiLockUnlockLine className="size-6 text-white/85" />
            </div>
            <div className="text-center">
              <div className="text-3xl font-semibold tabular-nums">
                {amount} <span className="text-base font-normal text-white/65">{currency}</span>
              </div>
              <div className="mt-1 text-sm text-white/70">{vendorName}</div>
            </div>
            {capturedAt && (
              <div className="text-[11px] uppercase tracking-wider text-white/45">
                {new Date(capturedAt).toLocaleString()}
              </div>
            )}
          </div>
          <div className="absolute bottom-4 right-4">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-orange-500 text-white shadow-[0_0_0_4px_rgba(249,115,22,0.18)]">
              <span className="block size-3 rounded-sm bg-white" />
            </span>
          </div>
        </Face>

        {/* BACK */}
        <Face back>
          <span className="absolute left-5 top-4 text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
            On-Chain Proof
          </span>
          <div className="flex h-full flex-col justify-center gap-3 px-6 text-white">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/50">Transaction</div>
              <div className="mt-1 break-all font-mono text-xs text-white/90">{txnId}</div>
            </div>
            {asaId != null && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/50">ASA</div>
                <div className="mt-1 font-mono text-xs text-white/90">#{asaId}</div>
              </div>
            )}
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 self-start rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
            >
              View on Explorer <RiExternalLinkLine className="size-3" />
            </a>
          </div>
          <div className="absolute bottom-4 right-4">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15">
              <RiArrowGoBackLine className="size-4" />
            </span>
          </div>
        </Face>
      </div>
    </div>
  )
}

function Face({ children, back = false }: { children: React.ReactNode; back?: boolean }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-3xl bg-zinc-950 shadow-[0_18px_48px_-16px_rgba(0,0,0,0.55),0_4px_12px_-4px_rgba(0,0,0,0.35)] ring-1 ring-white/5"
      style={{
        backfaceVisibility: "hidden",
        transform: back ? "rotateY(180deg)" : "rotateY(0deg)",
        backgroundImage:
          "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 30%), linear-gradient(0deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 25%)",
      }}
    >
      {/* Top inner highlight rim, visible against dark face */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-4 top-px h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />
      {children}
    </div>
  )
}
