import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { useAuth } from "@/lib/auth-context"
import { useAlgorand } from "@/lib/algorand/context"
import { supabase } from "@/integrations/supabase/client"
import { shortenAddress, getAddressExplorerUrl, getAlgoExplorerUrl, microalgosToAlgo } from "@/lib/algorand/constants"
import { releaseEscrowFunds, killEscrowContract, deleteEscrowContract } from "@/lib/algorand/contract"
import { Button } from "@/components/Button"
import {
  RiArrowLeftLine, RiLoader4Line, RiShieldLine, RiExternalLinkLine,
  RiCodeLine, RiLockLine, RiLockUnlockLine, RiAlarmWarningLine,
  RiDeleteBinLine, RiRefreshLine, RiWalletLine, RiTimeLine,
  RiUserLine, RiCoinLine,
} from "@remixicon/react"
import algosdk from "algosdk"

interface OnChainState {
  creator: string
  recipient: string
  balance: number // microalgos
  appExists: boolean
  globalState: Record<string, string | number>
}

export default function VaultDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { walletAddress, algodClient, peraWallet } = useAlgorand()
  const [vault, setVault] = useState<any>(null)
  const [onChainState, setOnChainState] = useState<OnChainState | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingChain, setLoadingChain] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [actionMsg, setActionMsg] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [chainError, setChainError] = useState<string | null>(null)

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
  }

  async function fetchOnChainState(appId: number, appAddress: string | null) {
    setLoadingChain(true)
    setChainError(null)
    try {
      const appInfo = await algodClient.getApplicationByID(appId).do()
      const globalState: Record<string, string | number> = {}

      if (appInfo.params?.globalState) {
        for (const item of appInfo.params.globalState as any[]) {
          const key = atob(item.key)
          if (item.value.type === 1) {
            // bytes -> try to decode as address (32 bytes)
            const bytes = Uint8Array.from(atob(item.value.bytes), c => c.charCodeAt(0))
            if (bytes.length === 32) {
              globalState[key] = (algosdk.encodeAddress(bytes) as any as string)
            } else {
              globalState[key] = item.value.bytes
            }
          } else {
            globalState[key] = Number(item.value.uint)
          }
        }
      }

      // Get app account balance
      let balance = 0
      if (appAddress) {
        try {
          const acctInfo = await algodClient.accountInformation(appAddress).do()
          balance = Number((acctInfo as any).amount || 0)
        } catch {}
      }

      setOnChainState({
        creator: appInfo.params?.creator || "",
        recipient: (globalState["recipient"] as string) || "",
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
    setIsProcessing(true); setActionMsg("Releasing funds on-chain…")
    try {
      const txnId = await releaseEscrowFunds(algodClient, walletAddress, vault.app_id, signTransaction)
      await supabase.from("escrow_vaults" as any).update({ status: "released", txn_id: txnId, released_at: new Date().toISOString() } as any).eq("id", vault.id)
      await supabase.from("onchain_payments" as any).insert({ user_id: user!.id, subscription_id: vault.subscription_id, algorand_txn_id: txnId, amount: vault.amount, sender_address: vault.app_address || walletAddress, recipient_address: vault.escrow_address || walletAddress, note: `Released from App ${vault.app_id}` } as any)
      loadVault()
    } catch (err) { console.error(err) } finally { setIsProcessing(false); setActionMsg("") }
  }

  const handleKill = async () => {
    if (!walletAddress || !vault?.app_id) return
    setIsProcessing(true); setActionMsg("Activating kill switch…")
    try {
      const txnId = await killEscrowContract(algodClient, walletAddress, vault.app_id, signTransaction)
      await supabase.from("escrow_vaults" as any).update({ status: "killed", kill_switch_active: true, txn_id: txnId, released_at: new Date().toISOString() } as any).eq("id", vault.id)
      await supabase.from("onchain_payments" as any).insert({ user_id: user!.id, subscription_id: vault.subscription_id, algorand_txn_id: txnId, amount: 0, sender_address: vault.app_address || walletAddress, recipient_address: walletAddress, note: `Kill switch on App ${vault.app_id}` } as any)
      loadVault()
    } catch (err) { console.error(err) } finally { setIsProcessing(false); setActionMsg("") }
  }

  const handleDelete = async () => {
    if (!walletAddress || !vault?.app_id) return
    setIsProcessing(true); setActionMsg("Deleting contract…")
    try {
      await deleteEscrowContract(algodClient, walletAddress, vault.app_id, signTransaction)
      await supabase.from("escrow_vaults" as any).delete().eq("id", vault.id)
      window.location.href = "/escrow-vaults"
    } catch (err) { console.error(err) } finally { setIsProcessing(false); setActionMsg("") }
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
          </div>
          {isSmartContract && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-primary">
              <RiCodeLine className="size-3" />
              <span className="font-medium">TEAL v10 Smart Contract</span>
              <span className="text-muted-foreground">• App ID: {vault.app_id}</span>
            </div>
          )}
        </div>
      </div>

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
              <dt className="text-muted-foreground">Wallet</dt>
              <dd className="font-mono text-xs text-foreground">
                <a href={getAddressExplorerUrl(vault.algorand_address)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                  {shortenAddress(vault.algorand_address)} <RiExternalLinkLine className="size-3" />
                </a>
              </dd>
            </div>
            {vault.app_address && (
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">App Address</dt>
                <dd className="font-mono text-xs text-foreground">
                  <a href={getAddressExplorerUrl(vault.app_address)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                    {shortenAddress(vault.app_address)} <RiExternalLinkLine className="size-3" />
                  </a>
                </dd>
              </div>
            )}
            {vault.txn_id && (
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">Last Txn</dt>
                <dd className="font-mono text-xs text-foreground">
                  <a href={getAlgoExplorerUrl(vault.txn_id)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
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
                  {onChainState.appExists ? "Live on Testnet" : "Deleted"}
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
                      <a href={getAddressExplorerUrl(onChainState.creator)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                        {shortenAddress(onChainState.creator)} <RiExternalLinkLine className="size-3" />
                      </a>
                    </dd>
                  </div>

                  {onChainState.recipient && (
                    <div className="flex justify-between text-sm">
                      <dt className="text-muted-foreground flex items-center gap-1.5"><RiWalletLine className="size-3.5" /> Recipient</dt>
                      <dd className="font-mono text-xs text-foreground">
                        <a href={getAddressExplorerUrl(onChainState.recipient)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
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

      {/* Actions */}
      {actionMsg && (
        <div className="mt-4 rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
          <p className="text-sm text-primary font-medium">{actionMsg}</p>
        </div>
      )}

      {vault.status === "locked" && isSmartContract && (
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={handleRelease} disabled={isProcessing || !walletAddress}>
            <RiLockUnlockLine className="mr-1.5 size-4" />
            {isProcessing ? "Processing…" : "Release Payment"}
          </Button>
          <Button variant="destructive" onClick={handleKill} disabled={isProcessing || !walletAddress}>
            <RiAlarmWarningLine className="mr-1.5 size-4" />
            Kill Switch
          </Button>
        </div>
      )}

      {(vault.status === "released" || vault.status === "killed") && isSmartContract && (
        <div className="mt-6">
          <button
            onClick={handleDelete}
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
