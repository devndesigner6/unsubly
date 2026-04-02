import { WalletId } from "@txnlab/use-wallet"
import { useWallet } from "@txnlab/use-wallet-react"
import { useAlgorand } from "@/lib/algorand/context"
import { RiCloseLine } from "@remixicon/react"

const WALLET_INFO: Record<string, { label: string; description: string; icon: string; color: string }> = {
  [WalletId.PERA]: {
    label: "Pera Wallet",
    description: "Official Algorand mobile & web wallet",
    icon: "https://assets.perawallet.app/images/pera-logo.svg",
    color: "from-yellow-400 to-yellow-500",
  },
  [WalletId.DEFLY]: {
    label: "Defly Wallet",
    description: "DeFi-focused Algorand wallet",
    icon: "https://defly.app/favicon.png",
    color: "from-green-400 to-green-500",
  },
  [WalletId.LUTE]: {
    label: "Lute Wallet",
    description: "Browser-based Algorand wallet",
    icon: "https://lute.app/favicon.png",
    color: "from-purple-400 to-purple-500",
  },
}

export function WalletSelectorModal() {
  const { showWalletSelector, setShowWalletSelector, connectWallet, isConnecting } = useAlgorand()
  const { wallets } = useWallet()

  if (!showWalletSelector) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setShowWalletSelector(false)
      }}
    >
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-2xl">
        <button
          onClick={() => setShowWalletSelector(false)}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <RiCloseLine className="size-5" />
        </button>

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground">Connect Wallet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose your Algorand wallet to connect
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {wallets.map((wallet) => {
            const info = WALLET_INFO[wallet.id]
            if (!info) return null
            return (
              <button
                key={wallet.id}
                onClick={() => connectWallet(wallet.id as WalletId)}
                disabled={isConnecting}
                className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${info.color} shadow-sm`}>
                  <img
                    src={info.icon}
                    alt={info.label}
                    className="size-7 object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none"
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {info.label}
                    </span>
                    {wallet.isConnected && (
                      <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {info.description}
                  </p>
                </div>
                <svg
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )
          })}
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          By connecting, you agree to interact with Algorand Testnet.
          <br />
          Powered by{" "}
          <a
            href="https://github.com/TxnLab/use-wallet"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            @txnlab/use-wallet
          </a>
        </p>
      </div>
    </div>
  )
}
