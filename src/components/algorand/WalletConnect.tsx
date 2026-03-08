import { useAlgorand } from "@/lib/algorand/context"
import { shortenAddress, getAddressExplorerUrl } from "@/lib/algorand/constants"
import { RiWalletLine, RiLinkUnlinkM, RiExternalLinkLine, RiRefreshLine, RiArrowLeftRightLine } from "@remixicon/react"

export function WalletConnect() {
  const {
    walletAddress, isConnecting, balance, isLoadingBalance, network,
    connectWallet, disconnectWallet, refreshBalance, switchNetwork,
  } = useAlgorand()

  if (!walletAddress) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-all hover:bg-primary/10 hover:border-primary/50 disabled:opacity-50"
        >
          <RiWalletLine className="size-4" />
          {isConnecting ? "Connecting..." : "Connect Pera Wallet"}
        </button>
        <button
          onClick={() => switchNetwork(network === "testnet" ? "mainnet" : "testnet")}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <RiArrowLeftRightLine className="size-3.5" />
          {network === "testnet" ? "Testnet" : "Mainnet"}
        </button>
      </div>
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
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
            network === "mainnet" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
          }`}>
            {network === "mainnet" ? "Mainnet" : "Testnet"}
          </span>
          <a href={getAddressExplorerUrl(walletAddress)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
            <RiExternalLinkLine className="size-3.5" />
          </a>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            {isLoadingBalance ? "Loading..." : `${balance.toFixed(4)} ALGO`}
          </span>
          <button onClick={refreshBalance} className="text-muted-foreground hover:text-primary transition-colors">
            <RiRefreshLine className="size-3" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => switchNetwork(network === "testnet" ? "mainnet" : "testnet")}
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <RiArrowLeftRightLine className="size-3" />
        </button>
        <button
          onClick={disconnectWallet}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <RiLinkUnlinkM className="size-3.5" />
          Disconnect
        </button>
      </div>
    </div>
  )
}
