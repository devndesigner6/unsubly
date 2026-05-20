import { useAlgorand } from "@/lib/algorand/context"
import { shortenAddress, getAddressExplorerUrl } from "@/lib/algorand/constants"
import {
  RiWalletLine, RiLinkUnlinkM, RiExternalLinkLine,
  RiRefreshLine, RiArrowLeftRightLine, RiLoader4Line,
} from "@remixicon/react"
import { WalletSelectorModal } from "./WalletSelectorModal"
import { RippleConfirm } from "@/components/micro/RippleConfirm"

const WALLET_LABELS: Record<string, string> = {
  pera: "Pera",
  defly: "Defly",
  lute: "Lute",
}

export function WalletConnect() {
  const {
    walletAddress, savedWalletAddress, walletType, isConnecting, balance, isLoadingBalance, network,
    networkSwitching, disconnectWallet, refreshBalance, switchNetwork,
    setShowWalletSelector,
  } = useAlgorand()

  const walletLabel = walletType ? WALLET_LABELS[walletType] ?? walletType : null
  const targetNetwork = network === "testnet" ? "mainnet" : "testnet"
  const targetLabel   = targetNetwork === "mainnet" ? "Mainnet" : "Testnet"
  const currentLabel  = network === "mainnet" ? "Mainnet" : "Testnet"

  // Disconnected state. If the user has previously connected on another device
  // (saved to their profile), show a "Reconnect [addr]" CTA so they don't see
  // a generic "Connect" prompt. Self-custody wallets cannot share connection
  // state across devices, but we can at least show what they're reconnecting to.
  if (!walletAddress) {
    const hasSaved = !!savedWalletAddress
    return (
      <>
        <WalletSelectorModal />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          <button
            onClick={() => setShowWalletSelector(true)}
            disabled={isConnecting || networkSwitching}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted disabled:opacity-50 sm:w-auto"
          >
            <RiWalletLine className="size-4 shrink-0" />
            <span className="truncate">
              {isConnecting
                ? "Connecting…"
                : hasSaved
                ? `Reconnect ${shortenAddress(savedWalletAddress)}`
                : "Connect Wallet"}
            </span>
          </button>

          <button
            onClick={() => switchNetwork(targetNetwork)}
            disabled={networkSwitching}
            title={`Switch to ${targetLabel}`}
            aria-label={`Switch network to ${targetLabel}`}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 sm:w-auto"
          >
            {networkSwitching
              ? <RiLoader4Line className="size-3.5 animate-spin" />
              : <RiArrowLeftRightLine className="size-3.5" />
            }
            {currentLabel}
          </button>
        </div>

        {hasSaved && (
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Your wallet is saved to your account, but each device must authorize once for security. Tap above to reopen Pera, Defly, or Lute.
          </p>
        )}
      </>
    )
  }

  return (
    <>
      <WalletSelectorModal />
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
        {/* Identity row: icon + address + badges + explorer */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border">
            <RiWalletLine className="size-4 text-foreground" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium font-mono-pixel text-foreground">
                {shortenAddress(walletAddress)}
              </span>
              {walletLabel && (
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-foreground">
                  {walletLabel}
                </span>
              )}
              <span
                className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-foreground"
              >
                {currentLabel}
              </span>
              <a
                href={getAddressExplorerUrl(walletAddress, network)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View address on block explorer"
                title="View on explorer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <RiExternalLinkLine className="size-3.5" />
              </a>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono-pixel text-muted-foreground">
                {isLoadingBalance ? "Loading…" : `${balance.toFixed(4)} ALGO`}
              </span>
              <button
                onClick={refreshBalance}
                aria-label="Refresh wallet balance"
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Refresh balance"
              >
                <RiRefreshLine className="size-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Action row: stretches full width on mobile, inline on desktop */}
        <div className="flex items-center gap-2 sm:ml-auto">
          <button
            onClick={() => switchNetwork(targetNetwork)}
            disabled={networkSwitching}
            title={`Switch to ${targetLabel} (will disconnect wallet)`}
            aria-label={`Switch network to ${targetLabel}, will disconnect wallet`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50 sm:flex-initial"
          >
            {networkSwitching
              ? <RiLoader4Line className="size-3.5 animate-spin" />
              : <RiArrowLeftRightLine className="size-3.5" />
            }
            {targetLabel}
          </button>

          <RippleConfirm
            onConfirm={disconnectWallet}
            ariaLabel="Disconnect wallet (click again within 3 seconds to confirm)"
            className="flex-1 sm:flex-initial"
          >
            <span className="flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors">
              <RiLinkUnlinkM className="size-3.5" />
              Disconnect
            </span>
          </RippleConfirm>
        </div>
      </div>
    </>
  )
}
