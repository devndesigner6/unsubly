import { useAlgorand } from "@/lib/algorand/context"
import { WalletSelectorModal } from "./WalletSelectorModal"
import { shortenAddress } from "@/lib/algorand/constants"
import { RiWalletLine, RiPlugLine, RiShieldLine, RiArrowRightLine, RiSmartphoneLine } from "@remixicon/react"
import { useRef } from "react"

const PHRASES = [
  {
    headline: "Your keys. Your chain. Your call.",
    sub: "Connect a wallet to interact with the Algorand blockchain and manage your on-chain escrow vaults.",
  },
  {
    headline: "The chain is live. Are you?",
    sub: "Link your Algorand wallet to unlock escrow creation, vault funding, and on-chain payment tracking.",
  },
  {
    headline: "Trustless money awaits.",
    sub: "This feature lives on-chain. Connect your wallet to participate in the decentralised economy.",
  },
  {
    headline: "Smart contracts don't wait, but you do.",
    sub: "Your escrow vaults are deployed and ready on Algorand. Connect your wallet to access them.",
  },
]

interface WalletRequiredProps {
  children: React.ReactNode
  feature?: string
}

export function WalletRequired({ children, feature }: WalletRequiredProps) {
  const { walletAddress, savedWalletAddress, setShowWalletSelector, isConnecting } = useAlgorand()
  // Fix: use useRef so the phrase is chosen once per mount, not on every re-render
  const phraseRef = useRef(PHRASES[Math.floor(Math.random() * PHRASES.length)])

  if (walletAddress) return <>{children}</>

  const phrase = phraseRef.current
  const hasSaved = !!savedWalletAddress

  return (
    <>
      <WalletSelectorModal />
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="relative mb-6">
          <div className="flex size-20 items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5">
            <RiWalletLine className="size-9 text-primary/50" />
          </div>
          <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary">
            <RiPlugLine className="size-3 text-primary-foreground" />
          </span>
        </div>

        <h2 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
          {hasSaved ? "Welcome back" : phrase.headline}
        </h2>
        <p className="mb-8 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {hasSaved
            ? "We remember your wallet. For security, each device has to authorize it once. Tap below to reopen your wallet app and reconnect."
            : phrase.sub}
        </p>

        {hasSaved && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5">
            <RiSmartphoneLine className="size-3.5 text-muted-foreground" />
            <span className="font-mono text-xs text-foreground">{shortenAddress(savedWalletAddress)}</span>
          </div>
        )}

        <button
          onClick={() => setShowWalletSelector(true)}
          disabled={isConnecting}
          className="group flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-60"
        >
          <RiWalletLine className="size-4" />
          {isConnecting ? "Connecting…" : hasSaved ? "Reconnect Wallet" : "Connect Wallet"}
          <RiArrowRightLine className="size-4 transition-transform group-hover:translate-x-0.5" />
        </button>

        {feature && (
          <div className="mt-8 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
            <RiShieldLine className="size-4 shrink-0 text-primary" />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{feature}</span> requires an Algorand wallet, Pera, Defly, or Lute.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
