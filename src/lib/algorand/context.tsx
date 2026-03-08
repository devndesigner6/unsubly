import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { PeraWalletConnect } from "@perawallet/connect"
import algosdk from "algosdk"
import { ALGORAND_TESTNET, microalgosToAlgo } from "./constants"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"

const peraWallet = new PeraWalletConnect()

const algodClient = new algosdk.Algodv2(
  ALGORAND_TESTNET.algodToken,
  ALGORAND_TESTNET.algodServer,
  ALGORAND_TESTNET.algodPort
)

interface AlgorandContextType {
  walletAddress: string | null
  isConnecting: boolean
  balance: number
  isLoadingBalance: boolean
  connectWallet: () => Promise<void>
  disconnectWallet: () => Promise<void>
  algodClient: algosdk.Algodv2
  peraWallet: PeraWalletConnect
  signAndSendTransaction: (txn: algosdk.Transaction) => Promise<string>
  refreshBalance: () => Promise<void>
}

const AlgorandContext = createContext<AlgorandContextType>({
  walletAddress: null,
  isConnecting: false,
  balance: 0,
  isLoadingBalance: false,
  connectWallet: async () => {},
  disconnectWallet: async () => {},
  algodClient,
  peraWallet,
  signAndSendTransaction: async () => "",
  refreshBalance: async () => {},
})

export function useAlgorand() {
  return useContext(AlgorandContext)
}

export function AlgorandProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [balance, setBalance] = useState(0)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)

  const fetchBalance = useCallback(async (address: string) => {
    setIsLoadingBalance(true)
    try {
      const accountInfo = await algodClient.accountInformation(address).do()
      const amount = Number((accountInfo as any).amount ?? accountInfo?.amount ?? 0)
      setBalance(microalgosToAlgo(amount))
    } catch (err) {
      console.error("Failed to fetch balance:", err)
      setBalance(0)
    } finally {
      setIsLoadingBalance(false)
    }
  }, [])

  const refreshBalance = useCallback(async () => {
    if (walletAddress) {
      await fetchBalance(walletAddress)
    }
  }, [walletAddress, fetchBalance])

  const saveWalletToProfile = useCallback(async (address: string | null) => {
    if (!user) return
    await supabase
      .from("profiles")
      .update({ algorand_address: address } as any)
      .eq("id", user.id)
  }, [user])

  // Load saved wallet on mount
  useEffect(() => {
    if (!user) return
    const loadSavedWallet = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("algorand_address")
        .eq("id", user.id)
        .maybeSingle()
      
      if (data && (data as any).algorand_address) {
        const address = (data as any).algorand_address as string
        setWalletAddress(address)
        fetchBalance(address)
        try {
          const accounts = await peraWallet.reconnectSession()
          if (accounts.length > 0 && accounts[0] === address) {
            peraWallet.connector?.on("disconnect", () => {
              setWalletAddress(null)
            })
          }
        } catch {
          // Session expired, user will need to reconnect via button
        }
      }
    }
    loadSavedWallet()
  }, [user, fetchBalance])

  const connectWallet = useCallback(async () => {
    setIsConnecting(true)
    try {
      try {
        await peraWallet.disconnect()
      } catch {
        // No existing session
      }

      const accounts = await peraWallet.connect()
      const address = accounts[0]
      setWalletAddress(address)
      await saveWalletToProfile(address)
      await fetchBalance(address)
      toast.success("Wallet connected", { description: `${address.slice(0, 8)}...${address.slice(-4)}` })

      peraWallet.connector?.on("disconnect", () => {
        setWalletAddress(null)
        saveWalletToProfile(null)
        toast.info("Wallet disconnected")
      })
    } catch (err: any) {
      if (err?.data?.type !== "CONNECT_MODAL_CLOSED") {
        console.error("Wallet connection error:", err)
        toast.error("Failed to connect wallet", {
          description: err?.message || "Please try again",
        })
      }
    } finally {
      setIsConnecting(false)
    }
  }, [fetchBalance, saveWalletToProfile])

  const disconnectWallet = useCallback(async () => {
    try {
      await peraWallet.disconnect()
    } catch {
      // Already disconnected
    }
    setWalletAddress(null)
    setBalance(0)
    await saveWalletToProfile(null)
    toast.info("Wallet disconnected")
  }, [saveWalletToProfile])

  const signAndSendTransaction = useCallback(async (txn: algosdk.Transaction): Promise<string> => {
    if (!walletAddress) throw new Error("Wallet not connected")

    const signedTxns = await peraWallet.signTransaction([[{ txn }]])
    const response = await algodClient.sendRawTransaction(signedTxns[0]).do()
    const txid = typeof response === "object" && response !== null
      ? String((response as any).txid ?? (response as any).txId ?? "")
      : String(response)
    await algosdk.waitForConfirmation(algodClient, txid, 4)
    await refreshBalance()
    return txid
  }, [walletAddress, refreshBalance])

  return (
    <AlgorandContext.Provider
      value={{
        walletAddress,
        isConnecting,
        balance,
        isLoadingBalance,
        connectWallet,
        disconnectWallet,
        algodClient,
        peraWallet,
        signAndSendTransaction,
        refreshBalance,
      }}
    >
      {children}
    </AlgorandContext.Provider>
  )
}
