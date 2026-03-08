import { useAlgorand } from "@/lib/algorand/context"
import { shortenAddress, getAddressExplorerUrl } from "@/lib/algorand/constants"
import { Button } from "@/components/Button"
import { RiWalletLine, RiLinkUnlinkM, RiExternalLinkLine, RiRefreshLine } from "@remixicon/react"

export function WalletConnect() {
  const {
    walletAddress,
    isConnecting,
    balance,
    isLoadingBalance,
    connectWallet,
    disconnectWallet,
    refreshBalance,
  } = useAlgorand()

  if (!walletAddress) {
    return (
      <button
        onClick={connectWallet}
        disabled={isConnecting}
        className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-all hover:bg-primary/10 hover:border-primary/50 disabled:opacity-50"
      >
        <RiWalletLine className="size-4" />
        {isConnecting ? "Connecting..." : "Connect Pera Wallet"}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
        <RiWalletLine className="size-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {shortenAddress(walletAddress)}
          </span>
          <a
            href={getAddressExplorerUrl(walletAddress)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            <RiExternalLinkLine className="size-3.5" />
          </a>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            {isLoadingBalance ? "Loading..." : `${balance.toFixed(4)} ALGO`}
          </span>
          <button
            onClick={refreshBalance}
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            <RiRefreshLine className="size-3" />
          </button>
        </div>
      </div>
      <button
        onClick={disconnectWallet}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
      >
        <RiLinkUnlinkM className="size-3.5" />
        Disconnect
      </button>
    </div>
  )
}
