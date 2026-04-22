import { WalletId } from "@txnlab/use-wallet"
import { useWallet } from "@txnlab/use-wallet-react"
import { useAlgorand } from "@/lib/algorand/context"
import { RiCloseLine, RiExternalLinkLine, RiCheckLine, RiLoaderLine } from "@remixicon/react"
import { useState } from "react"
import { WALLET_LOGOS } from "@/lib/algorand/walletLogos"

interface WalletMeta {
  label: string
  description: string
  icon: string
  color: string
  installUrl: string
  type: "mobile" | "extension" | "both"
}

const WALLET_INFO: Record<string, WalletMeta> = {
  [WalletId.PERA]: {
    label: "Pera Wallet",
    description: "Official Algorand mobile & web wallet",
    icon: WALLET_LOGOS.pera,
    color: "from-yellow-400 to-yellow-500",
    installUrl: "https://perawallet.app",
    type: "both",
  },
  [WalletId.DEFLY]: {
    label: "Defly Wallet",
    description: "DeFi-focused Algorand mobile wallet",
    icon: WALLET_LOGOS.defly,
    color: "from-green-400 to-green-500",
    installUrl: "https://defly.app",
    type: "mobile",
  },
  [WalletId.LUTE]: {
    label: "Lute Wallet",
    description: "Browser-based Algorand wallet extension",
    icon: WALLET_LOGOS.lute,
    color: "from-purple-400 to-purple-500",
    installUrl: "https://lute.app",
    type: "extension",
  },
}

const TYPE_BADGE: Record<string, string> = {
  mobile: "Mobile App",
  extension: "Browser Extension",
  both: "Mobile + Web",
}

export function WalletSelectorModal() {
  const { showWalletSelector, setShowWalletSelector, connectWallet, isConnecting, network } = useAlgorand()
  const { wallets } = useWallet()
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [iconErrors, setIconErrors] = useState<Record<string, boolean>>({})

  const networkLabel = network === "mainnet" ? "Mainnet" : "Testnet"
  const networkBadgeClass = network === "mainnet"
    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"

  if (!showWalletSelector) return null

  async function handleConnect(walletId: WalletId) {
    setConnectingId(walletId)
    setErrors((prev) => ({ ...prev, [walletId]: "" }))
    try {
      await connectWallet(walletId)
    } catch (err: any) {
      const msg = err?.message ?? "Connection failed"
      if (!msg.toLowerCase().includes("cancel")) {
        setErrors((prev) => ({ ...prev, [walletId]: msg }))
      }
    } finally {
      setConnectingId(null)
    }
  }

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

        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold text-foreground">Connect Wallet</h2>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${networkBadgeClass}`}>
              {networkLabel}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Choose your Algorand wallet, you'll be prompted to approve the connection.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          {wallets.map((wallet) => {
            const info = WALLET_INFO[wallet.id]
            if (!info) return null
            const isThisConnecting = connectingId === wallet.id
            const anyConnecting = isConnecting || connectingId !== null
            const errMsg = errors[wallet.id]

            return (
              <div key={wallet.id}>
                <button
                  onClick={() => handleConnect(wallet.id as WalletId)}
                  disabled={anyConnecting}
                  className="group w-full flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-white shadow-sm dark:bg-zinc-900">
                    {isThisConnecting ? (
                      <RiLoaderLine className="size-5 text-muted-foreground animate-spin" />
                    ) : wallet.isConnected ? (
                      <RiCheckLine className="size-5 text-green-600" />
                    ) : iconErrors[wallet.id] ? (
                      <span className="text-lg font-bold text-primary">{info.label.charAt(0)}</span>
                    ) : (
                      <img
                        src={info.icon}
                        alt={info.label}
                        className="size-7 object-contain"
                        onError={() => setIconErrors((prev) => ({ ...prev, [wallet.id]: true }))}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">
                        {info.label}
                      </span>
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {TYPE_BADGE[info.type]}
                      </span>
                      {wallet.isConnected && (
                        <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">
                      {isThisConnecting ? "Waiting for approval in wallet app…" : info.description}
                    </p>
                  </div>
                  <svg
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {errMsg && (
                  <div className="mt-1.5 flex items-start justify-between gap-2 rounded-lg bg-destructive/5 px-3 py-2 text-xs text-destructive border border-destructive/15">
                    <span>{errMsg.includes("not installed") || errMsg.includes("Not found")
                      ? `${info.label} is not installed.`
                      : errMsg}
                    </span>
                    <a
                      href={info.installUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-1 font-medium hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Install <RiExternalLinkLine className="size-3" />
                    </a>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-4 rounded-xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">How it works</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Click a wallet above</li>
            <li>Approve the connection in your wallet app or extension</li>
            <li>You're connected to Algorand {networkLabel}</li>
          </ol>
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Powered by{" "}
          <a
            href="https://github.com/TxnLab/use-wallet"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            @txnlab/use-wallet
          </a>{" "}
          · Algorand {networkLabel}
        </p>
      </div>
    </div>
  )
}
