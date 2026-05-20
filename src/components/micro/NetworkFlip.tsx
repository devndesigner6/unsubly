import { useEffect, useState } from "react"

type Network = "testnet" | "mainnet"

type Props = {
  network: Network
  onChange: (n: Network) => void
  disabled?: boolean
}

/**
 * Coin-flip toggle for switching Algorand TestNet / MainNet. Two faces of the
 * same coin: TestNet shows the white Algorand mark on a black face, MainNet
 * shows the black mark on a white face. A Y-axis flip animation plays when
 * the network changes, reinforcing "two sides of the same chain".
 *
 * Network icons sourced from web3icons.io and stored as static SVGs.
 */
export function NetworkFlip({ network, onChange, disabled }: Props) {
  const [flipping, setFlipping] = useState(false)
  const [shownNetwork, setShownNetwork] = useState<Network>(network)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingTarget, setPendingTarget] = useState<Network | null>(null)

  // Trigger the flip when the parent network value changes.
  useEffect(() => {
    if (network === shownNetwork) return
    setFlipping(true)
    const swap = window.setTimeout(() => setShownNetwork(network), 220)
    const done = window.setTimeout(() => setFlipping(false), 460)
    return () => {
      window.clearTimeout(swap)
      window.clearTimeout(done)
    }
  }, [network, shownNetwork])

  const target: Network = network === "testnet" ? "mainnet" : "testnet"
  const targetLabel = target === "mainnet" ? "MainNet" : "TestNet"
  const currentLabel = shownNetwork === "mainnet" ? "MainNet" : "TestNet"

  const isMain = shownNetwork === "mainnet"

  function handleClick() {
    if (disabled) return
    setPendingTarget(target)
    setShowConfirm(true)
  }

  function confirmSwitch() {
    if (pendingTarget) onChange(pendingTarget)
    setShowConfirm(false)
    setPendingTarget(null)
  }

  function cancelSwitch() {
    setShowConfirm(false)
    setPendingTarget(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={`Switch to ${targetLabel}`}
        aria-label={`Switch network to ${targetLabel}`}
        className="group relative inline-flex items-center gap-2 rounded-full border border-border bg-card px-1 py-1 pr-3 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        style={{ perspective: "600px" }}
      >
        <span
          aria-hidden="true"
          className={`relative inline-block size-6 shrink-0 rounded-full ${
            isMain ? "bg-white ring-1 ring-zinc-300" : "bg-zinc-900 ring-1 ring-zinc-700"
          }`}
          style={{
            transform: flipping ? "rotateY(180deg)" : "rotateY(0deg)",
            transformStyle: "preserve-3d",
            transition: "transform 460ms cubic-bezier(0.65, 0, 0.35, 1)",
          }}
        >
          <img
            src={isMain ? "/icons/algorand-black.svg" : "/icons/algorand-white.svg"}
            alt=""
            className="absolute inset-0 m-auto size-4"
            draggable={false}
          />
        </span>
        <span className="tabular-nums">{currentLabel}</span>
      </button>

      {/* Network switch confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={cancelSwitch}>
          <div
            className="mx-4 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-foreground mb-2">Switch Network?</h3>
            <p className="text-sm text-muted-foreground mb-1">
              You're about to switch from <span className="font-semibold text-foreground">{currentLabel}</span> to <span className="font-semibold text-foreground">{pendingTarget === "mainnet" ? "MainNet" : "TestNet"}</span>.
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {pendingTarget === "mainnet"
                ? "MainNet uses real ALGO. Transactions are irreversible and cost real funds."
                : "TestNet uses free test ALGO. Vaults and transactions here have no real value."}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={cancelSwitch}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSwitch}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
                  pendingTarget === "mainnet"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-primary hover:bg-primary/90"
                }`}
              >
                Switch to {pendingTarget === "mainnet" ? "MainNet" : "TestNet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
