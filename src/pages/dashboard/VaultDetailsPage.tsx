import { useState, useEffect } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/lib/auth-context"
import { useAlgorand } from "@/lib/algorand/context"
import { supabase } from "@/integrations/supabase/client"
import { shortenAddress, getAddressExplorerUrl, getAlgoExplorerUrl, microalgosToAlgo, VAULT_TYPE_LABELS, type VaultType } from "@/lib/algorand/constants"
import { releaseEscrowFunds, killEscrowContract, deleteEscrowContract, approveMultiSig, mintNFTReceipt } from "@/lib/algorand/contract"
import { Button } from "@/components/Button"
import {
  RiArrowLeftLine, RiLoader4Line, RiShieldLine, RiExternalLinkLine,
  RiCodeLine, RiLockLine, RiLockUnlockLine, RiAlarmWarningLine,
  RiDeleteBinLine, RiRefreshLine, RiWalletLine, RiTimeLine,
  RiUserLine, RiCoinLine, RiGroupLine, RiNftLine, RiCheckDoubleLine,
} from "@remixicon/react"
import algosdk from "algosdk"
import { toast } from "sonner"

interface OnChainState {
  creator: string
  recipient: string
  balance: number
  appExists: boolean
  globalState: Record<string, string | number>
}

export default function VaultDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { walletAddress, algodClient, peraWallet, network } = useAlgorand()
  const [vault, setVault] = useState<any>(null)
  const [onChainState, setOnChainState] = useState<OnChainState | null>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingChain, setLoadingChain] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [actionMsg, setActionMsg] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [chainError, setChainError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"details" | "history">("details")
  const [confirmAction, setConfirmAction] = useState<"kill" | "delete" | null>(null)

  async function loadVault() {
    if (!user || !id) return
    const { data, error: err } = await supabase
      .from("escrow_vaults" as any)
      .select("*, subscription:subscriptions(name, logo)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
    if (err) { setError("Vault not found"); setLoading(false); return }
    setVault(data)
    setLoading(false)
    if ((data as any).app_id) fetchOnChainState((data as any).app_id, (data as any).app_address)

    const { data: paymentData } = await supabase
      .from("onchain_payments" as any)
      .select("*")
      .eq("user_id", user.id)
      .or(`subscription_id.eq.${(data as any).subscription_id},recipient_address.eq.${(data as any).app_address}`)
      .order("created_at", { ascending: false })
    setPayments(paymentData || [])
  }

  async function fetchOnChainState(appId: number, appAddress: string | null) {
    setLoadingChain(true)
    setChainError(null)
    try {
      const appInfo = await algodClient.getApplicationByID(appId).do() as any
      const globalState: Record<string, string | number> = {}
      const stateArray = appInfo.params?.globalState ?? appInfo.params?.["global-state"] ?? []
      if (Array.isArray(stateArray)) {
        for (const item of stateArray) {
          const key = atob(item.key)
          if (item.value.type === 1) {
            const bytes = Uint8Array.from(atob(item.value.bytes), c => c.charCodeAt(0))
            if (bytes.length === 32) {
              globalState[key] = String(algosdk.encodeAddress(bytes))
            } else {
              globalState[key] = item.value.bytes
            }
          } else {
            globalState[key] = Number(item.value.uint)
          }
        }
      }

      let balance = 0
      if (appAddress) {
        try {
          const acctInfo = await algodClient.accountInformation(appAddress).do() as any
          balance = Number(acctInfo.amount ?? 0)
        } catch {}
      }

      setOnChainState({
        creator: String(appInfo.params?.creator ?? ""),
        recipient: String(globalState["recipient"] || ""),
        balance,
        appExists: true,
        globalState,
      })
    } catch (err: any) {
      if (err?.message?.includes("not found") || err?.status === 404) {
        setOnChainState({ creator: "", recipient: "", balance: 0, appExists: false, globalState: {} })
        setChainError("Application has been deleted from the chain")
      } else {
        setChainError(`Failed to read on-chain state: ${err?.message || "Unknown error"}`)
      }
    } finally {
      setLoadingChain(false)
    }
  }

  useEffect(() => { loadVault() }, [user, id])

  const signTransaction = async (txn: any): Promise<Uint8Array[]> => {
    return await peraWallet.signTransaction([[{ txn }]])
  }

  const handleRelease = async () => {
    if (!walletAddress || !vault?.app_id) return
    setIsProcessing(true)
    setActionMsg("Releasing funds on-chain… (sign in Pera)")
    try {
      const txnId = await releaseEscrowFunds(algodClient, walletAddress, vault.app_id, signTransaction)
      await supabase.from("escrow_vaults" as any).update({ status: "released", txn_id: txnId, released_at: new Date().toISOString() } as any).eq("id", vault.id)
      await supabase.from("onchain_payments" as any).insert({ user_id: user!.id, subscription_id: vault.subscription_id, algorand_txn_id: txnId, amount: vault.amount, sender_address: vault.app_address || walletAddress, recipient_address: vault.escrow_address || walletAddress, note: `Released from ${VAULT_TYPE_LABELS[(vault.vault_type || "standard") as VaultType]} App ${vault.app_id}` } as any)
      toast.success("Funds released!", { description: `${vault.amount} ALGO sent to recipient` })
      loadVault()
    } catch (err: any) {
      toast.error("Release failed", { description: err?.message || "Transaction failed" })
    } finally {
      setIsProcessing(false)
      setActionMsg("")
    }
  }

  const handleKill = async () => {
    if (!walletAddress || !vault?.app_id) return
    setConfirmAction(null)
    setIsProcessing(true)
    setActionMsg("Activating kill switch…")
    try {
      const txnId = await killEscrowContract(algodClient, walletAddress, vault.app_id, signTransaction)
      await supabase.from("escrow_vaults" as any).update({ status: "killed", kill_switch_active: true, txn_id: txnId, released_at: new Date().toISOString() } as any).eq("id", vault.id)
      await supabase.from("onchain_payments" as any).insert({ user_id: user!.id, subscription_id: vault.subscription_id, algorand_txn_id: txnId, amount: 0, sender_address: vault.app_address || walletAddress, recipient_address: walletAddress, note: `Kill switch on App ${vault.app_id}` } as any)
      toast.success("Kill switch activated", { description: "Funds returned to your wallet" })
      loadVault()
    } catch (err: any) {
      toast.error("Kill switch failed", { description: err?.message || "Transaction failed" })
    } finally {
      setIsProcessing(false)
      setActionMsg("")
    }
  }

  const handleDelete = async () => {
    if (!walletAddress || !vault?.app_id) return
    setConfirmAction(null)
    setIsProcessing(true)
    setActionMsg("Deleting contract…")
    try {
      await deleteEscrowContract(algodClient, walletAddress, vault.app_id, signTransaction)
      await supabase.from("escrow_vaults" as any).delete().eq("id", vault.id)
      toast.success("Contract deleted", { description: "MBR reclaimed" })
      navigate("/escrow-vaults")
    } catch (err: any) {
      toast.error("Delete failed", { description: err?.message || "Transaction failed" })
    } finally {
      setIsProcessing(false)
      setActionMsg("")
    }
  }

  const handleApproveMultiSig = async () => {
    if (!walletAddress || !vault?.app_id) return
    setIsProcessing(true)
    setActionMsg("Approving multi-sig… (sign in Pera)")
    try {
      const txnId = await approveMultiSig(algodClient, walletAddress, vault.app_id, signTransaction)
      await supabase.from("escrow_vaults" as any).update({ co_signer_approved: true, txn_id: txnId } as any).eq("id", vault.id)
      await supabase.from("onchain_payments" as any).insert({ user_id: user!.id, subscription_id: vault.subscription_id, algorand_txn_id: txnId, amount: 0, sender_address: walletAddress, recipient_address: vault.app_address, note: `Multi-sig approval on App ${vault.app_id}` } as any)
      toast.success("Multi-sig approved!", { description: "If both parties approved, funds will auto-release" })
      loadVault()
    } catch (err: any) {
      toast.error("Approval failed", { description: err?.message || "Transaction failed" })
    } finally {
      setIsProcessing(false)
      setActionMsg("")
    }
  }

  const handleMintReceipt = async () => {
    if (!walletAddress || !vault?.app_id) return
    setIsProcessing(true)
    setActionMsg("Minting ARC-3 NFT receipt… (sign in Pera)")
    try {
      const vType = (vault.vault_type || "standard") as VaultType
      const { assetId, txnId } = await mintNFTReceipt(
        algodClient, walletAddress, vault.app_id,
        vault.amount, vault.escrow_address || walletAddress,
        vType, network, signTransaction
      )
      await supabase.from("escrow_vaults" as any).update({ nft_asset_id: assetId } as any).eq("id", vault.id)
      await supabase.from("onchain_payments" as any).insert({ user_id: user!.id, subscription_id: vault.subscription_id, algorand_txn_id: txnId, amount: 0, sender_address: walletAddress, recipient_address: walletAddress, note: `ARC-3 Receipt minted (ASA ${assetId}) for App ${vault.app_id}` } as any)
      toast.success("NFT Receipt minted!", { description: `ASA ID: ${assetId}` })
      loadVault()
    } catch (err: any) {
      toast.error("Minting failed", { description: err?.message || "Transaction failed" })
    } finally {
      setIsProcessing(false)
      setActionMsg("")
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RiLoader4Line className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !vault) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-destructive">{error || "Vault not found"}</p>
        <Button asChild variant="secondary" className="mt-4"><Link to="/escrow-vaults"><RiArrowLeftLine className="mr-1.5 size-4" /> Back</Link></Button>
      </div>
    )
  }

  const isSmartContract = !!vault.app_id
  const vType = (vault.vault_type || "standard") as VaultType
  const isMultiSig = vType === "multi_sig"
  const hasNFTReceipt = !!vault.nft_asset_id
  const canMintReceipt = (vault.status === "released" || vault.status === "killed") && !hasNFTReceipt

  const statusColor: Record<string, string> = {
    locked: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400",
    released: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400",
    killed: "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400",
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/escrow-vaults" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <RiArrowLeftLine className="size-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">
              {vault.subscription?.name || "Escrow Vault"}
            </h1>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${statusColor[vault.status] || "bg-muted text-muted-foreground"}`}>
              {vault.status === "locked" && <RiLockLine className="size-3" />}
              {vault.status === "released" && <RiLockUnlockLine className="size-3" />}
              {vault.status === "killed" && <RiAlarmWarningLine className="size-3" />}
              {vault.status.charAt(0).toUpperCase() + vault.status.slice(1)}
            </span>
            {hasNFTReceipt && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                <RiNftLine className="size-3" /> NFT #{vault.nft_asset_id}
              </span>
            )}
          </div>
          {isSmartContract && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-primary">
              <RiCodeLine className="size-3" />
              <span className="font-medium">{VAULT_TYPE_LABELS[vType]} Contract (TEAL v10)</span>
              <span className="text-muted-foreground">• App ID: {vault.app_id}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 mb-4">
        <button
          onClick={() => setActiveTab("details")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${activeTab === "details" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Vault Details
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${activeTab === "history" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Transaction History {payments.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({payments.length})</span>}
        </button>
      </div>

      {activeTab === "details" && (
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Database State */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <RiShieldLine className="size-4 text-primary" /> Vault Info
          </h2>
          <dl className="space-y-3">
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="font-medium text-foreground">{vault.amount} {vault.currency}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Type</dt>
              <dd className="font-medium text-foreground">{VAULT_TYPE_LABELS[vType]}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Wallet</dt>
              <dd className="font-mono text-xs text-foreground">
                <a href={getAddressExplorerUrl(vault.algorand_address, network)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                  {shortenAddress(vault.algorand_address)} <RiExternalLinkLine className="size-3" />
                </a>
              </dd>
            </div>
            {vault.app_address && (
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">App Address</dt>
                <dd className="font-mono text-xs text-foreground">
                  <a href={getAddressExplorerUrl(vault.app_address, network)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                    {shortenAddress(vault.app_address)} <RiExternalLinkLine className="size-3" />
                  </a>
                </dd>
              </div>
            )}
            {/* Type-specific info */}
            {vType === "time_locked" && vault.unlock_time && (
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground flex items-center gap-1"><RiTimeLine className="size-3.5" /> Unlock Time</dt>
                <dd className="text-foreground">{new Date(vault.unlock_time).toLocaleString()}</dd>
              </div>
            )}
            {isMultiSig && vault.co_signer_address && (
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground flex items-center gap-1"><RiGroupLine className="size-3.5" /> Co-Signer</dt>
                <dd className="font-mono text-xs text-foreground">
                  <a href={getAddressExplorerUrl(vault.co_signer_address, network)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                    {shortenAddress(vault.co_signer_address)} <RiExternalLinkLine className="size-3" />
                  </a>
                </dd>
              </div>
            )}
            {isMultiSig && (
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">Co-Signer Approved</dt>
                <dd className={vault.co_signer_approved ? "text-green-600 dark:text-green-400 font-medium" : "text-muted-foreground"}>
                  {vault.co_signer_approved ? "✓ Yes" : "✗ Pending"}
                </dd>
              </div>
            )}
            {vType === "dispute" && vault.arbitrator_address && (
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground flex items-center gap-1"><RiShieldLine className="size-3.5" /> Arbitrator</dt>
                <dd className="font-mono text-xs text-foreground">
                  <a href={getAddressExplorerUrl(vault.arbitrator_address, network)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                    {shortenAddress(vault.arbitrator_address)} <RiExternalLinkLine className="size-3" />
                  </a>
                </dd>
              </div>
            )}
            {vType === "asa" && vault.asset_id && (
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground flex items-center gap-1"><RiCoinLine className="size-3.5" /> ASA ID</dt>
                <dd className="font-medium text-foreground">{vault.asset_id}</dd>
              </div>
            )}
            {vault.txn_id && (
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">Last Txn</dt>
                <dd className="font-mono text-xs text-foreground">
                  <a href={getAlgoExplorerUrl(vault.txn_id, network)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                    {shortenAddress(vault.txn_id, 8)} <RiExternalLinkLine className="size-3" />
                  </a>
                </dd>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Created</dt>
              <dd className="text-foreground">{new Date(vault.created_at).toLocaleString()}</dd>
            </div>
            {vault.released_at && (
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">{vault.status === "killed" ? "Killed" : "Released"}</dt>
                <dd className="text-foreground">{new Date(vault.released_at).toLocaleString()}</dd>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Kill Switch</dt>
              <dd className={vault.kill_switch_active ? "text-destructive font-medium" : "text-foreground"}>
                {vault.kill_switch_active ? "Activated" : "Inactive"}
              </dd>
            </div>
          </dl>
        </div>

        {/* On-Chain State */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <RiCodeLine className="size-4 text-primary" /> On-Chain State
            </h2>
            {isSmartContract && (
              <button
                onClick={() => fetchOnChainState(vault.app_id, vault.app_address)}
                disabled={loadingChain}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
              >
                <RiRefreshLine className={`size-3.5 ${loadingChain ? "animate-spin" : ""}`} />
                Refresh
              </button>
            )}
          </div>

          {!isSmartContract ? (
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground">Legacy vault — no on-chain contract</p>
            </div>
          ) : loadingChain ? (
            <div className="flex items-center justify-center py-8">
              <RiLoader4Line className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : chainError ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">{chainError}</p>
            </div>
          ) : onChainState ? (
            <dl className="space-y-3">
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${onChainState.appExists ? "bg-green-500" : "bg-red-500"}`} />
                  Status
                </dt>
                <dd className={`font-medium ${onChainState.appExists ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                  {onChainState.appExists ? `Live on ${network === "mainnet" ? "Mainnet" : "Testnet"}` : "Deleted"}
                </dd>
              </div>

              {onChainState.appExists && (
                <>
                  <div className="flex justify-between text-sm">
                    <dt className="text-muted-foreground flex items-center gap-1.5"><RiCoinLine className="size-3.5" /> App Balance</dt>
                    <dd className="font-medium text-foreground">{microalgosToAlgo(onChainState.balance).toFixed(4)} ALGO</dd>
                  </div>

                  <div className="flex justify-between text-sm">
                    <dt className="text-muted-foreground flex items-center gap-1.5"><RiUserLine className="size-3.5" /> Creator</dt>
                    <dd className="font-mono text-xs text-foreground">
                      <a href={getAddressExplorerUrl(onChainState.creator, network)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                        {shortenAddress(onChainState.creator)} <RiExternalLinkLine className="size-3" />
                      </a>
                    </dd>
                  </div>

                  {onChainState.recipient && (
                    <div className="flex justify-between text-sm">
                      <dt className="text-muted-foreground flex items-center gap-1.5"><RiWalletLine className="size-3.5" /> Recipient</dt>
                      <dd className="font-mono text-xs text-foreground">
                        <a href={getAddressExplorerUrl(onChainState.recipient, network)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                          {shortenAddress(onChainState.recipient)} <RiExternalLinkLine className="size-3" />
                        </a>
                      </dd>
                    </div>
                  )}

                  {/* Raw Global State */}
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Global State Keys</p>
                    <div className="space-y-1.5">
                      {Object.entries(onChainState.globalState).map(([key, value]) => (
                        <div key={key} className="flex justify-between rounded-lg bg-muted/50 px-3 py-1.5 text-xs">
                          <span className="font-mono text-muted-foreground">{key}</span>
                          <span className="font-mono text-foreground truncate max-w-[200px]">
                            {typeof value === "number" ? value.toLocaleString() : shortenAddress(String(value), 8)}
                          </span>
                        </div>
                      ))}
                      {Object.keys(onChainState.globalState).length === 0 && (
                        <p className="text-xs text-muted-foreground italic">No global state keys</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </dl>
          ) : null}
        </div>
      </div>
      )}

      {activeTab === "history" && (
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border p-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <RiTimeLine className="size-4 text-primary" /> On-Chain Transactions
            </h2>
          </div>
          {payments.length === 0 ? (
            <div className="p-8 text-center">
              <RiTimeLine className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No transactions recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <RiShieldLine className="size-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.note || "Transaction"}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(p.created_at).toLocaleString()}</span>
                        {p.algorand_txn_id && (
                          <a href={getAlgoExplorerUrl(p.algorand_txn_id, network)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-primary hover:text-primary/80">
                            {shortenAddress(p.algorand_txn_id, 6)} <RiExternalLinkLine className="size-3" />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="font-mono">From: {shortenAddress(p.sender_address, 4)}</span>
                        {p.recipient_address && <span className="font-mono">To: {shortenAddress(p.recipient_address, 4)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-semibold text-foreground">{Number(p.amount).toFixed(4)} ALGO</p>
                    {p.confirmed_at && (
                      <span className="text-xs text-green-600 dark:text-green-400">Confirmed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {actionMsg && (
        <div className="mt-4 rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
          <p className="text-sm text-primary font-medium animate-pulse">{actionMsg}</p>
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmAction && (
        <div className="mt-4 rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-4">
          <p className="text-sm text-destructive font-medium mb-3">
            {confirmAction === "kill"
              ? "Are you sure you want to activate the kill switch? This returns all funds to your wallet and cannot be undone."
              : "Are you sure you want to delete this contract from the blockchain?"}
          </p>
          <div className="flex gap-2">
            <Button variant="destructive" onClick={confirmAction === "kill" ? handleKill : handleDelete}>
              Confirm {confirmAction === "kill" ? "Kill Switch" : "Delete"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmAction(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {vault.status === "locked" && isSmartContract && !confirmAction && (
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={handleRelease} disabled={isProcessing || !walletAddress}>
            <RiLockUnlockLine className="mr-1.5 size-4" />
            {isProcessing ? "Processing…" : "Release Payment"}
          </Button>

          {/* Multi-sig approve button */}
          {isMultiSig && !vault.co_signer_approved && (
            <Button variant="secondary" onClick={handleApproveMultiSig} disabled={isProcessing || !walletAddress}>
              <RiCheckDoubleLine className="mr-1.5 size-4" />
              Approve (Multi-Sig)
            </Button>
          )}

          <Button variant="destructive" onClick={() => setConfirmAction("kill")} disabled={isProcessing || !walletAddress}>
            <RiAlarmWarningLine className="mr-1.5 size-4" />
            Kill Switch
          </Button>
        </div>
      )}

      {(vault.status === "released" || vault.status === "killed") && isSmartContract && !confirmAction && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {/* NFT Receipt Mint Button */}
          {canMintReceipt && (
            <Button variant="secondary" onClick={handleMintReceipt} disabled={isProcessing || !walletAddress}>
              <RiNftLine className="mr-1.5 size-4" />
              {isProcessing ? "Minting…" : "Mint ARC-3 Receipt"}
            </Button>
          )}

          <button
            onClick={() => setConfirmAction("delete")}
            disabled={isProcessing || !walletAddress}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
          >
            <RiDeleteBinLine className="size-4" />
            Delete Contract (reclaim MBR)
          </button>
        </div>
      )}
    </div>
  )
}
