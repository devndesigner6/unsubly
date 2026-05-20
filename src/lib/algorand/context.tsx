import {
  createContext, useContext, useEffect, useState, useCallback, useRef,
  type ReactNode,
} from "react"
import algosdk from "algosdk"
import { WalletManager, WalletId, NetworkId } from "@txnlab/use-wallet"
import { WalletProvider, useWallet, useNetwork } from "@txnlab/use-wallet-react"
import {
  getNetworkConfig, getStoredNetwork, setStoredNetwork, microalgosToAlgo,
  type AlgorandNetwork,
} from "./constants"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"

export type WalletType = "pera" | "defly" | "lute" | null

interface AlgorandContextType {
  walletAddress: string | null
  /** Address last connected on ANY device, persisted to the user's profile.
   * Useful for showing "Reconnect [addr]" on a fresh device (e.g., mobile)
   * since self-custody wallets cannot share connection state across devices. */
  savedWalletAddress: string | null
  walletType: WalletType
  isConnecting: boolean
  balance: number
  isLoadingBalance: boolean
  network: AlgorandNetwork
  networkSwitching: boolean
  showWalletSelector: boolean
  setShowWalletSelector: (show: boolean) => void
  connectWallet: (walletId?: WalletId) => Promise<void>
  disconnectWallet: () => Promise<void>
  algodClient: algosdk.Algodv2
  peraWallet: {
    signTransaction: (
      txnGroups: { txn: algosdk.Transaction }[][]
    ) => Promise<Uint8Array[]>
  }
  signAndSendTransaction: (txn: algosdk.Transaction) => Promise<string>
  refreshBalance: () => Promise<void>
  switchNetwork: (network: AlgorandNetwork) => Promise<void>
}

const AlgorandContext = createContext<AlgorandContextType | null>(null)

export function useAlgorand() {
  const ctx = useContext(AlgorandContext)
  if (!ctx) throw new Error("useAlgorand must be inside AlgorandProvider")
  return ctx
}

function createAlgodClient(network: AlgorandNetwork) {
  const config = getNetworkConfig(network)
  return new algosdk.Algodv2(config.algodToken, config.algodServer, config.algodPort)
}

function toNetworkId(network: AlgorandNetwork): NetworkId {
  return network === "mainnet" ? NetworkId.MAINNET : NetworkId.TESTNET
}

function createManager(network: AlgorandNetwork): WalletManager {
  return new WalletManager({
    wallets: [WalletId.PERA, WalletId.DEFLY, WalletId.LUTE],
    defaultNetwork: toNetworkId(network),
  })
}

function AlgorandBridge({
  children,
  network,
  setNetworkState,
}: {
  children: ReactNode
  network: AlgorandNetwork
  setNetworkState: (n: AlgorandNetwork) => void
}) {
  const { user } = useAuth()
  const { wallets, activeAddress, signTransactions } = useWallet()
  const { setActiveNetwork } = useNetwork()

  const [isConnecting, setIsConnecting] = useState(false)
  const [networkSwitching, setNetworkSwitching] = useState(false)
  const [balance, setBalance] = useState(0)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [showWalletSelector, setShowWalletSelector] = useState(false)
  const [savedWalletAddress, setSavedWalletAddress] = useState<string | null>(null)

  // Keep both a ref (for sync access inside callbacks) and state (for reactive context consumers)
  const algodClientRef = useRef(createAlgodClient(network))
  const [algodClientState, setAlgodClientState] = useState(() => createAlgodClient(network))

  const hasMounted = useRef(false)

  const activeWallet = wallets.find((w) => w.isActive) ?? null
  const walletType: WalletType = activeWallet
    ? (activeWallet.id as WalletType)
    : null

  const fetchBalance = useCallback(async (address: string, client?: algosdk.Algodv2) => {
    setIsLoadingBalance(true)
    try {
      const c = client ?? algodClientRef.current
      const info = await c.accountInformation(address).do()
      setBalance(microalgosToAlgo(Number((info as any).amount ?? 0)))
    } catch {
      setBalance(0)
    } finally {
      setIsLoadingBalance(false)
    }
  }, [])

  const refreshBalance = useCallback(async () => {
    if (activeAddress) await fetchBalance(activeAddress)
  }, [activeAddress, fetchBalance])

  const saveWalletToProfile = useCallback(
    async (address: string | null) => {
      if (!user) return
      await supabase
        .from("profiles")
        .update({ algorand_address: address } as any)
        .eq("id", user.id)
      setSavedWalletAddress(address)
    },
    [user]
  )

  useEffect(() => {
    if (!user || hasMounted.current) return
    hasMounted.current = true
    const loadSaved = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("algorand_address")
        .eq("id", user.id)
        .maybeSingle()
      if (data && (data as any).algorand_address) {
        const addr = (data as any).algorand_address as string
        setSavedWalletAddress(addr)
        fetchBalance(addr)

        // If a wallet is connected but doesn't match this user's saved address,
        // disconnect it — prevents wallet leaking between accounts via localStorage.
        if (activeAddress && activeAddress !== addr && activeWallet) {
          activeWallet.disconnect().catch(() => {})
          setBalance(0)
        }
      } else {
        // User has no saved wallet — if one is connected from a previous session
        // (different user), disconnect it.
        if (activeAddress && activeWallet) {
          activeWallet.disconnect().catch(() => {})
          setBalance(0)
        }
      }
    }
    loadSaved()
  }, [user, fetchBalance])

  useEffect(() => {
    if (activeAddress) {
      fetchBalance(activeAddress)
      saveWalletToProfile(activeAddress)
    }
  }, [activeAddress, fetchBalance, saveWalletToProfile])

  // Disconnect wallet when user changes (prevents wallet leaking between accounts)
  const prevUserIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!user) {
      // User signed out — disconnect wallet
      if (prevUserIdRef.current && activeWallet) {
        activeWallet.disconnect().catch(() => {})
        setBalance(0)
      }
      prevUserIdRef.current = null
      return
    }
    if (prevUserIdRef.current && prevUserIdRef.current !== user.id) {
      // Different user signed in — disconnect previous wallet
      if (activeWallet) {
        activeWallet.disconnect().catch(() => {})
        setBalance(0)
      }
    }
    prevUserIdRef.current = user.id
  }, [user])

  const connectWallet = useCallback(
    async (walletId?: WalletId) => {
      if (!walletId) {
        setShowWalletSelector(true)
        return
      }
      setIsConnecting(true)
      try {
        const wallet = wallets.find((w) => w.id === walletId)
        if (!wallet) throw new Error(`Wallet ${walletId} not found`)
        await wallet.connect()
        try { wallet.setActive() } catch {}
        toast.success("Wallet connected", { description: wallet.metadata.name })
        setShowWalletSelector(false)
      } catch (err: any) {
        const msg: string = err?.message ?? ""
        const cancelled = msg.toLowerCase().includes("cancel") ||
                          msg.toLowerCase().includes("rejected") ||
                          msg.toLowerCase().includes("denied")
        const sessionConflict = msg.toLowerCase().includes("session") ||
                                msg.toLowerCase().includes("already connected") ||
                                msg.toLowerCase().includes("pairing")
        if (sessionConflict) {
          // Clear stale WalletConnect session data and retry
          try {
            Object.keys(localStorage).forEach(k => {
              if (k.includes("walletconnect") || k.includes("wc@") || k.includes("txnlab")) {
                localStorage.removeItem(k)
              }
            })
          } catch {}
          toast.error("Session conflict cleared", {
            description: "Stale wallet session removed. Please try connecting again.",
          })
        } else if (!cancelled) {
          toast.error("Failed to connect wallet", { description: msg || "Please try again" })
        }
        throw err
      } finally {
        setIsConnecting(false)
      }
    },
    [wallets]
  )

  const disconnectWallet = useCallback(async () => {
    if (activeWallet) {
      try {
        await activeWallet.disconnect()
      } catch {}
    }
    setBalance(0)
    await saveWalletToProfile(null)
    toast.info("Wallet disconnected")
  }, [activeWallet, saveWalletToProfile])

  const peraWallet = {
    signTransaction: async (
      txnGroups: { txn: algosdk.Transaction }[][]
    ): Promise<Uint8Array[]> => {
      if (!activeAddress) throw new Error("Wallet not connected")
      const txns = txnGroups.flat().map((t) => t.txn)
      const signed = await signTransactions(txns)
      return signed.filter((s): s is Uint8Array => s !== null)
    },
  }

  const signAndSendTransaction = useCallback(
    async (txn: algosdk.Transaction): Promise<string> => {
      if (!activeAddress) throw new Error("Wallet not connected")
      const signed = await signTransactions([txn])
      const signedTxn = signed[0]
      if (!signedTxn) throw new Error("Transaction signing failed")
      // Always use the ref (always current network's client)
      const response = await algodClientRef.current
        .sendRawTransaction(signedTxn)
        .do()
      const txid =
        typeof response === "object" && response !== null
          ? String(
              (response as any).txid ??
                (response as any).txId ??
                ""
            )
          : String(response)
      await algosdk.waitForConfirmation(algodClientRef.current, txid, 4)
      await refreshBalance()
      return txid
    },
    [activeAddress, signTransactions, refreshBalance]
  )

  const switchNetwork = useCallback(
    async (net: AlgorandNetwork) => {
      if (net === network) return
      // Whitelist: only allow known networks
      if (net !== "testnet" && net !== "mainnet") {
        toast.error("Unsupported network", { description: `"${net}" is not a supported network.` })
        return
      }
      setNetworkSwitching(true)
      try {
        // Disconnect wallet first, wallets may not support cross-network signing
        if (activeWallet) {
          try { await activeWallet.disconnect() } catch {}
          setBalance(0)
          await saveWalletToProfile(null)
        }

        // Swap out the algod client for the new network
        const newClient = createAlgodClient(net)
        algodClientRef.current = newClient
        setAlgodClientState(newClient)

        // Persist and propagate network choice
        setStoredNetwork(net)
        setNetworkState(net)
        setActiveNetwork(toNetworkId(net))

        const label = net === "mainnet" ? "Mainnet" : "Testnet"
        // After switching networks the wallet is force-disconnected (most wallets
        // don't support cross-network signing). Surface a one-tap "Reconnect" CTA
        // in the success toast so the user can finish the toggle in one click.
        toast.success(`Switched to ${label}`, {
          description: activeWallet
            ? "Reconnect your wallet to continue."
            : "Select a wallet to connect.",
          action: {
            label: activeWallet ? "Reconnect" : "Connect",
            onClick: () => setShowWalletSelector(true),
          },
        })
      } finally {
        setNetworkSwitching(false)
      }
    },
    [network, activeWallet, saveWalletToProfile, setNetworkState, setActiveNetwork]
  )

  return (
    <AlgorandContext.Provider
      value={{
        walletAddress: activeAddress,
        savedWalletAddress,
        walletType,
        isConnecting,
        networkSwitching,
        balance,
        isLoadingBalance,
        network,
        showWalletSelector,
        setShowWalletSelector,
        connectWallet,
        disconnectWallet,
        algodClient: algodClientState,
        peraWallet,
        signAndSendTransaction,
        refreshBalance,
        switchNetwork,
      }}
    >
      {children}
    </AlgorandContext.Provider>
  )
}

export function AlgorandProvider({ children }: { children: ReactNode }) {
  const [network, setNetwork] = useState<AlgorandNetwork>(() => {
    try { return getStoredNetwork() } catch { return "testnet" }
  })
  const [manager] = useState(() => {
    try {
      return createManager(network)
    } catch {
      try { localStorage.removeItem("algorand_network") } catch {}
      try { localStorage.removeItem("txnlab-use-wallet") } catch {}
      return new WalletManager({
        wallets: [WalletId.PERA, WalletId.DEFLY, WalletId.LUTE],
        defaultNetwork: NetworkId.TESTNET,
      })
    }
  })

  return (
    <WalletProvider manager={manager}>
      <AlgorandBridge network={network} setNetworkState={setNetwork}>
        {children}
      </AlgorandBridge>
    </WalletProvider>
  )
}
