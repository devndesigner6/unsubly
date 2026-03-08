import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react"
import { PeraWalletConnect } from "@perawallet/connect"
import algosdk from "algosdk"
import {
  getNetworkConfig, getStoredNetwork, setStoredNetwork, microalgosToAlgo,
  type AlgorandNetwork,
} from "./constants"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"

interface AlgorandContextType {
  walletAddress: string | null
  isConnecting: boolean
  balance: number
  isLoadingBalance: boolean
  network: AlgorandNetwork
  connectWallet: () => Promise<void>
  disconnectWallet: () => Promise<void>
  algodClient: algosdk.Algodv2
  peraWallet: PeraWalletConnect
  signAndSendTransaction: (txn: algosdk.Transaction) => Promise<string>
  refreshBalance: () => Promise<void>
  switchNetwork: (network: AlgorandNetwork) => void
}

const AlgorandContext = createContext<AlgorandContextType | null>(null)

export function useAlgorand() {
  const ctx = useContext(AlgorandContext)
  if (!ctx) throw new Error("useAlgorand must be inside AlgorandProvider")
  return ctx
}

let peraInstance: PeraWalletConnect | null = null
function getPeraWallet() {
  if (!peraInstance) peraInstance = new PeraWalletConnect()
  return peraInstance
}

function createAlgodClient(network: AlgorandNetwork) {
  const config = getNetworkConfig(network)
  return new algosdk.Algodv2(config.algodToken, config.algodServer, config.algodPort)
}

export function AlgorandProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [network, setNetwork] = useState<AlgorandNetwork>(getStoredNetwork)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [balance, setBalance] = useState(0)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const algodClientRef = useRef(createAlgodClient(network))
  const hasMounted = useRef(false)

  const algodClient = algodClientRef.current

  const fetchBalance = useCallback(async (address: string) => {
    setIsLoadingBalance(true)
    try {
      const info = await algodClientRef.current.accountInformation(address).do()
      setBalance(microalgosToAlgo(Number((info as any).amount ?? 0)))
    } catch {
      setBalance(0)
    } finally {
      setIsLoadingBalance(false)
    }
  }, [])

  const refreshBalance = useCallback(async () => {
    if (walletAddress) await fetchBalance(walletAddress)
  }, [walletAddress, fetchBalance])

  const saveWalletToProfile = useCallback(async (address: string | null) => {
    if (!user) return
    await supabase.from("profiles").update({ algorand_address: address } as any).eq("id", user.id)
  }, [user])

  useEffect(() => {
    if (!user || hasMounted.current) return
    hasMounted.current = true
    const loadSaved = async () => {
      const { data } = await supabase.from("profiles").select("algorand_address").eq("id", user.id).maybeSingle()
      if (data && (data as any).algorand_address) {
        const addr = (data as any).algorand_address as string
        setWalletAddress(addr)
        fetchBalance(addr)
        try {
          const pera = getPeraWallet()
          const accounts = await pera.reconnectSession()
          if (accounts.length > 0 && accounts[0] === addr) {
            pera.connector?.on("disconnect", () => setWalletAddress(null))
          }
        } catch {}
      }
    }
    loadSaved()
  }, [user, fetchBalance])

  const connectWallet = useCallback(async () => {
    setIsConnecting(true)
    try {
      const pera = getPeraWallet()
      try { await pera.disconnect() } catch {}
      const accounts = await pera.connect()
      const addr = accounts[0]
      setWalletAddress(addr)
      await saveWalletToProfile(addr)
      await fetchBalance(addr)
      toast.success("Wallet connected", { description: `${addr.slice(0, 8)}...${addr.slice(-4)}` })
      pera.connector?.on("disconnect", () => {
        setWalletAddress(null)
        saveWalletToProfile(null)
        toast.info("Wallet disconnected")
      })
    } catch (err: any) {
      if (err?.data?.type !== "CONNECT_MODAL_CLOSED") {
        toast.error("Failed to connect wallet", { description: err?.message || "Please try again" })
      }
    } finally {
      setIsConnecting(false)
    }
  }, [fetchBalance, saveWalletToProfile])

  const disconnectWallet = useCallback(async () => {
    try { await getPeraWallet().disconnect() } catch {}
    setWalletAddress(null)
    setBalance(0)
    await saveWalletToProfile(null)
    toast.info("Wallet disconnected")
  }, [saveWalletToProfile])

  const signAndSendTransaction = useCallback(async (txn: algosdk.Transaction): Promise<string> => {
    if (!walletAddress) throw new Error("Wallet not connected")
    const pera = getPeraWallet()
    const signedTxns = await pera.signTransaction([[{ txn }]])
    const response = await algodClientRef.current.sendRawTransaction(signedTxns[0]).do()
    const txid = typeof response === "object" && response !== null
      ? String((response as any).txid ?? (response as any).txId ?? "")
      : String(response)
    await algosdk.waitForConfirmation(algodClientRef.current, txid, 4)
    await refreshBalance()
    return txid
  }, [walletAddress, refreshBalance])

  const switchNetwork = useCallback((net: AlgorandNetwork) => {
    setNetwork(net)
    setStoredNetwork(net)
    algodClientRef.current = createAlgodClient(net)
    if (walletAddress) fetchBalance(walletAddress)
    toast.info(`Switched to ${net === "mainnet" ? "Mainnet" : "Testnet"}`)
  }, [walletAddress, fetchBalance])

  return (
    <AlgorandContext.Provider value={{
      walletAddress, isConnecting, balance, isLoadingBalance, network,
      connectWallet, disconnectWallet, algodClient, peraWallet: getPeraWallet(),
      signAndSendTransaction, refreshBalance, switchNetwork,
    }}>
      {children}
    </AlgorandContext.Provider>
  )
}
