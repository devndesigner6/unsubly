import { useState, useEffect } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/lib/auth-context"
import { useAlgorand } from "@/lib/algorand/context"
import { supabase } from "@/integrations/supabase/client"
import { shortenAddress, getAddressExplorerUrl, getAlgoExplorerUrl, getLoraTransactionUrl, getLoraApplicationUrl, getLoraAddressUrl, microalgosToAlgo, VAULT_TYPE_LABELS, type VaultType } from "@/lib/algorand/constants"
import { releaseEscrowFunds, releaseEscrowFundsWithProof, releaseAgentVaultV2, killEscrowContract, deleteEscrowContract, approveMultiSig, mintNFTReceipt } from "@/lib/algorand/contract"
import { VaultMemoryTab } from "@/components/vaults/VaultMemoryTab"
import { ProofOfDeliveryModal } from "@/components/vaults/ProofOfDeliveryModal"
import { Button } from "@/components/Button"
import { NftReceiptCard } from "@/components/micro/NftReceiptCard"
import {
  RiArrowLeftLine, RiLoader4Line, RiShieldLine, RiExternalLinkLine,
  RiCodeLine, RiLockLine, RiLockUnlockLine, RiAlarmWarningLine,
  RiDeleteBinLine, RiRefreshLine, RiWalletLine, RiTimeLine,
  RiUserLine, RiCoinLine, RiGroupLine, RiAwardLine, RiCheckboxMultipleLine,
  RiCheckLine, RiShareLine,
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
  const [activeTab, setActiveTab] = useState<"details" | "history" | "memory">("details")
  const [showProofModal, setShowProofModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState<"kill" | "delete" | null>(null)
  const [releasedTxnId, setReleasedTxnId] = useState<string | null>(null)

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

      // Handle both v2 and v3 response formats
      const stateArray = appInfo.params?.globalState ?? appInfo.params?.["global-state"] ?? appInfo?.["global-state-schema"] ?? []

      const safeDecodeKey = (raw: unknown): string => {
        if (raw instanceof Uint8Array) return new TextDecoder().decode(raw)
        if (typeof raw === "string") { try { return atob(raw) } catch { return raw } }
        return String(raw ?? "")
      }
      const safeDecodeBytes = (raw: unknown): Uint8Array | null => {
        if (raw instanceof Uint8Array) return raw
        if (typeof raw === "string" && raw.length > 0) {
          try { return Uint8Array.from(atob(raw), c => c.charCodeAt(0)) } catch { return null }
        }
        return null
      }

      if (Array.isArray(stateArray)) {
        for (const item of stateArray) {
          try {
            const key = safeDecodeKey(item.key)
            if (!key) continue
            if (item.value?.type === 1 || item.value?.bytes !== undefined) {
              const bytes = safeDecodeBytes(item.value?.bytes)
              if (bytes && bytes.length === 32) {
                globalState[key] = String(algosdk.encodeAddress(bytes))
              } else {
                globalState[key] = typeof item.value?.bytes === "string" ? item.value.bytes : ""
              }
            } else {
              globalState[key] = Number(item.value?.uint ?? item.value?.Uint ?? 0)
            }
          } catch { /* skip malformed state entry */ }
        }
      }

      let balance = 0
      if (appAddress) {
        try {
          const acctInfo = await algodClient.accountInformation(appAddress).do() as any
          balance = Number(acctInfo.amount ?? acctInfo?.amount ?? 0)
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

  // Refetch when the user toggles networks — vault state lives on a specific chain.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadVault() }, [user, id, network])

  const signTransaction = async (txn: algosdk.Transaction | algosdk.Transaction[]): Promise<Uint8Array[]> => {
    if (Array.isArray(txn)) {
      return await peraWallet.signTransaction([txn.map(t => ({ txn: t }))])
    }
    return await peraWallet.signTransaction([[{ txn }]])
  }

  const handleRelease = async (proof?: string) => {
    if (!walletAddress || !vault?.app_id) return
    setIsProcessing(true)
    setActionMsg("Releasing funds on-chain… (sign in your wallet)")
    try {
      // Agent vaults deployed via deployAgentEscrowContractV2 use the v2 ABI:
      // release(uint64)uint64, needs an explicit microAlgo amount and writes
      // a Box-stored BillingRecord. v1-style vaults take release()void.
      const isAgentV2 = vault.vault_type === "agent_v2"
      const amountMicro = Number(vault.amount_microalgos ?? Math.round(Number(vault.amount || 0) * 1_000_000))
      const txnId = isAgentV2
        ? await releaseAgentVaultV2(algodClient, walletAddress, vault.app_id, amountMicro, signTransaction, proof)
        : proof
          ? await releaseEscrowFundsWithProof(algodClient, walletAddress, vault.app_id, proof, signTransaction)
          : await releaseEscrowFunds(algodClient, walletAddress, vault.app_id, signTransaction)
      const noteSuffix = proof ? ` · proof: ${proof.slice(0, 80)}` : ""
      await supabase.from("escrow_vaults" as any).update({ status: "released", txn_id: txnId, released_at: new Date().toISOString() } as any).eq("id", vault.id)
      await supabase.from("onchain_payments" as any).insert({ user_id: user!.id, subscription_id: vault.subscription_id, algorand_txn_id: txnId, amount: vault.amount, sender_address: vault.app_address || walletAddress, recipient_address: vault.escrow_address || walletAddress, note: `Released from App ${vault.app_id}${noteSuffix}` } as any)
      setReleasedTxnId(txnId)
      toast.success("Funds released!", {
        description: (
          <span>
            {vault.amount} ALGO sent.{" "}
            <a
              href={getLoraTransactionUrl(txnId, network)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              View on Lora ↗
            </a>
          </span>
        ) as any,
        duration: 10000,
      })
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
    setActionMsg("Approving multi-sig… (sign in your wallet)")
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
    setActionMsg("Minting ARC-3 NFT receipt… (sign in your wallet)")
    try {
      const { assetId, txnId } = await mintNFTReceipt(
        algodClient, walletAddress, vault.app_id,
        vault.amount, vault.escrow_address || walletAddress,
        signTransaction
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
      <div className="flex items-start gap-3 mb-6 sm:items-center">
        <Link to="/escrow-vaults" aria-label="Back to vaults" className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <RiArrowLeftLine className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="min-w-0 truncate text-xl font-bold text-foreground sm:text-2xl">
              {vault.subscription?.name || "Escrow Vault"}
            </h1>
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${statusColor[vault.status] || "bg-muted text-muted-foreground"}`}>
              {vault.status === "locked" && <RiLockLine key={`lock-${vault.status}`} className="size-3 lock-clack" />}
              {vault.status === "released" && <RiLockUnlockLine className="size-3" />}
              {vault.status === "killed" && <RiAlarmWarningLine className="size-3" />}
              {vault.status.charAt(0).toUpperCase() + vault.status.slice(1)}
            </span>
          </div>
          {isSmartContract && (
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-1 text-xs text-primary">
              <RiCodeLine className="size-3 shrink-0" />
              <span className="font-medium">ARC-4 Smart Contract (TEAL v11)</span>
              <span className="hidden text-muted-foreground sm:inline">•</span>
              <a
                href={getLoraApplicationUrl(vault.app_id, network)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-0.5 hover:text-primary/80"
              >
                App #{vault.app_id} <RiExternalLinkLine className="size-2.5" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Lora release banner, shown after release action or for already-released vaults */}
      {(() => {
        const activeTxnId = releasedTxnId || (vault.status === "released" ? vault.txn_id : null)
        if (!activeTxnId) return null
        return (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3.5 dark:border-green-800/40 dark:bg-green-900/20">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
              <RiCheckLine className="size-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                Escrow funds released on-chain
              </p>
              <p className="mt-0.5 text-xs text-green-700 dark:text-green-400">
                {vault.amount} {vault.currency} sent to recipient •{" "}
                {vault.released_at && new Date(vault.released_at).toLocaleString()}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                <a
                  href={getLoraTransactionUrl(activeTxnId, network)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-semibold text-green-700 underline underline-offset-2 hover:text-green-900 dark:text-green-400 dark:hover:text-green-200"
                >
                  <RiExternalLinkLine className="size-3.5" />
                  View transaction on Lora Explorer
                </a>
                <span className="text-green-500/50">|</span>
                <a
                  href={getAlgoExplorerUrl(activeTxnId, network)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-0.5 text-green-600 hover:text-green-800 dark:text-green-500 dark:hover:text-green-300"
                >
                  Pera Explorer <RiExternalLinkLine className="size-3" />
                </a>
                <span className="font-mono text-green-600/70 dark:text-green-500/70">
                  {shortenAddress(activeTxnId, 8)}
                </span>
              </div>
            </div>
          </div>
        )
      })()}

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
        {(vault.vault_type as string) === "agent_v2" && vault.app_id && (
          <button
            onClick={() => setActiveTab("memory")}
            title="View immutable on-chain billing history (Box Storage)"
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${activeTab === "memory" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            On-chain Memory
          </button>
        )}
      </div>

      {activeTab === "memory" && vault.app_id && (
        <div className="rounded-xl border border-border bg-card p-5">
          <VaultMemoryTab appId={vault.app_id} vaultType={String(vault.vault_type ?? vType)} />
        </div>
      )}

      {activeTab === "details" && (
      <div className="grid gap-4 lg:grid-cols-2">

        {/* NFT Receipt hero — shown on details tab when vault is released */}
        {(vault.status === "released" || vault.status === "killed") && (() => {
          const releaseTx = payments.find(
            (p: any) => typeof p?.note === "string" && p.note.toLowerCase().includes("release") && p.algorand_txn_id,
          )
          if (!releaseTx) return null
          const asaMatch = typeof releaseTx.note === "string" ? releaseTx.note.match(/ASA\s+(\d+)/i) : null
          return (
            <div className="lg:col-span-2">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Payment Receipt
              </p>
              <div className="flex justify-center">
                <NftReceiptCard
                  amount={Number(releaseTx.amount || vault.amount || 0)}
                  currency="ALGO"
                  vendorName={vault.subscription?.name || "Subscription"}
                  txnId={releaseTx.algorand_txn_id}
                  explorerUrl={getLoraTransactionUrl(releaseTx.algorand_txn_id, network)}
                  asaId={asaMatch ? Number(asaMatch[1]) : null}
                  capturedAt={releaseTx.created_at}
                />
              </div>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Click the card to flip and see the on-chain transaction ID
              </p>
            </div>
          )
        })()}
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
                <a href={getAddressExplorerUrl(vault.algorand_address, network)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                  {shortenAddress(vault.algorand_address)} <RiExternalLinkLine className="size-3" />
                </a>
              </dd>
            </div>
            {vault.app_address && (
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">App Address</dt>
                <dd className="font-mono text-xs text-foreground">
                  <a href={getLoraAddressUrl(vault.app_address, network)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                    {shortenAddress(vault.app_address)} <RiExternalLinkLine className="size-3" />
                  </a>
                </dd>
              </div>
            )}
            {vault.txn_id && (
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">Last Txn</dt>
                <dd className="font-mono text-xs text-foreground">
                  <a href={getLoraTransactionUrl(vault.txn_id, network)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-mono text-primary hover:text-primary/80">
                    {shortenAddress(vault.txn_id, 8)} <RiExternalLinkLine className="size-2.5" />
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

        {/* Parties, co-signer / arbitrator / agent */}
        {(vault.co_signer_address || vault.arbitrator_address || vault.agent_address) && (
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <RiUserLine className="size-4 text-primary" /> Parties
            </h2>
            <dl className="space-y-3">
              {vault.co_signer_address && (
                <div className="flex justify-between text-sm">
                  <dt className="text-muted-foreground">
                    Co-signer
                    {vault.co_signer_approved && (
                      <span className="ml-2 rounded-full bg-green-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-green-700 dark:text-green-300">
                        approved
                      </span>
                    )}
                  </dt>
                  <dd className="font-mono text-xs text-foreground">
                    <a href={getAddressExplorerUrl(vault.co_signer_address, network)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                      {shortenAddress(vault.co_signer_address)} <RiExternalLinkLine className="size-3" />
                    </a>
                  </dd>
                </div>
              )}
              {vault.arbitrator_address && (
                <div className="flex justify-between text-sm">
                  <dt className="text-muted-foreground">Arbitrator</dt>
                  <dd className="font-mono text-xs text-foreground">
                    <a href={getAddressExplorerUrl(vault.arbitrator_address, network)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                      {shortenAddress(vault.arbitrator_address)} <RiExternalLinkLine className="size-3" />
                    </a>
                  </dd>
                </div>
              )}
              {vault.agent_address && (
                <div className="flex justify-between text-sm">
                  <dt className="text-muted-foreground">Autonomous agent</dt>
                  <dd className="font-mono text-xs text-foreground">
                    <a href={getAddressExplorerUrl(vault.agent_address, network)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                      {shortenAddress(vault.agent_address)} <RiExternalLinkLine className="size-3" />
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

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
              <p className="text-sm text-muted-foreground">Legacy vault, no on-chain contract</p>
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
                      <a href={getLoraAddressUrl(onChainState.creator, network)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                        {shortenAddress(onChainState.creator)} <RiExternalLinkLine className="size-3" />
                      </a>
                    </dd>
                  </div>

                  {onChainState.recipient && (
                    <div className="flex justify-between text-sm">
                      <dt className="text-muted-foreground flex items-center gap-1.5"><RiWalletLine className="size-3.5" /> Recipient</dt>
                      <dd className="font-mono text-xs text-foreground">
                        <a href={getLoraAddressUrl(onChainState.recipient, network)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
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
        <>
          {/* NFT Receipt Card — shown prominently at top of history tab when a release tx exists */}
          {(() => {
            const releaseTx = payments.find(
              (p: any) => typeof p?.note === "string" && p.note.toLowerCase().includes("release") && p.algorand_txn_id,
            )
            if (!releaseTx) return null
            const asaMatch = typeof releaseTx.note === "string" ? releaseTx.note.match(/ASA\s+(\d+)/i) : null
            return (
              <div className="mb-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Payment Receipt
                </p>
                <div className="flex justify-center">
                  <NftReceiptCard
                    amount={Number(releaseTx.amount || vault.amount || 0)}
                    currency="ALGO"
                    vendorName={vault.subscription?.name || "Subscription"}
                    txnId={releaseTx.algorand_txn_id}
                    explorerUrl={getLoraTransactionUrl(releaseTx.algorand_txn_id, network)}
                    asaId={asaMatch ? Number(asaMatch[1]) : null}
                    capturedAt={releaseTx.created_at}
                  />
                </div>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  Click the card to flip and see the on-chain transaction ID
                </p>
              </div>
            )
          })()}
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
                          <span className="flex items-center gap-2">
                            <a
                              href={getLoraTransactionUrl(p.algorand_txn_id, network)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-0.5 font-medium text-primary hover:text-primary/80"
                            >
                              Lora <RiExternalLinkLine className="size-3" />
                            </a>
                            <a
                              href={getAlgoExplorerUrl(p.algorand_txn_id, network)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
                            >
                              {shortenAddress(p.algorand_txn_id, 5)} <RiExternalLinkLine className="size-2.5" />
                            </a>
                          </span>
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
        </>
      )}

      {actionMsg && (
        <div className="mt-4 rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
          <p className="text-sm text-primary font-medium animate-pulse">{actionMsg}</p>
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmAction && (
        <div className={`mt-4 rounded-xl border-2 px-5 py-5 ${
          confirmAction === "kill"
            ? "border-destructive bg-destructive/10"
            : "border-destructive/40 bg-destructive/5"
        }`}>
          <div className="flex items-start gap-3 mb-4">
            <RiAlarmWarningLine className={`mt-0.5 size-5 shrink-0 ${confirmAction === "kill" ? "text-destructive" : "text-destructive/70"}`} />
            <div>
              <p className={`text-sm font-bold mb-1 ${confirmAction === "kill" ? "text-destructive" : "text-foreground"}`}>
                {confirmAction === "kill" ? "⚠ Kill Switch, Irreversible Action" : "Delete Smart Contract"}
              </p>
              <p className="text-sm text-muted-foreground">
                {confirmAction === "kill"
                  ? "This will immediately return all locked ALGO to your wallet and permanently close the escrow contract. The recipient will receive nothing. This cannot be undone."
                  : "This will permanently delete the smart contract from the Algorand blockchain and reclaim the minimum balance reserve (MBR). The contract must have status Released or Killed on-chain first, if funds are still locked, use Kill Switch above to reclaim your ALGO before deleting."}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="destructive" onClick={confirmAction === "kill" ? handleKill : handleDelete} disabled={isProcessing}>
              {isProcessing ? <RiLoader4Line className="mr-1.5 size-4 animate-spin" /> : <RiAlarmWarningLine className="mr-1.5 size-4" />}
              {confirmAction === "kill" ? "Yes, Activate Kill Switch" : "Yes, Delete Contract"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmAction(null)} disabled={isProcessing}>Cancel</Button>
          </div>
        </div>
      )}

      {vault.status === "locked" && isSmartContract && !confirmAction && (
        <div className="mt-6 space-y-4">
          {vType === "agent" && (
            <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800/40 dark:bg-green-900/20">
              <RiLockUnlockLine className="mt-0.5 size-5 shrink-0 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                  Agent-Managed Auto-Release
                </p>
                <p className="mt-0.5 text-sm text-green-700/80 dark:text-green-300/80">
                  The autonomous agent will release funds to the recipient on the billing date. You can also release manually or use Kill Switch to cancel and reclaim your ALGO.
                </p>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
          <Button onClick={() => handleRelease()} disabled={isProcessing || !walletAddress}>
            <RiLockUnlockLine className="mr-1.5 size-4" />
            {isProcessing ? "Processing…" : "Release Payment"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowProofModal(true)}
            disabled={isProcessing || !walletAddress}
            title="Release and attach an on-chain proof of delivery (URL or hash)"
          >
            Release with proof
          </Button>

          {isMultiSig && !vault.co_signer_approved && (
            <>
              <Button variant="secondary" onClick={handleApproveMultiSig} disabled={isProcessing || !walletAddress}>
                <RiCheckboxMultipleLine className="mr-1.5 size-4" />
                Approve (Multi-Sig)
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const link = `${window.location.origin}/vault-approve/${vault.id}`
                  navigator.clipboard.writeText(link)
                  toast.success("Co-signer link copied!", { description: "Share this link with your co-signer" })
                }}
              >
                <RiShareLine className="mr-1.5 size-4" />
                Copy Co-Signer Link
              </Button>
            </>
          )}

          <Button variant="destructive" onClick={() => setConfirmAction("kill")} disabled={isProcessing || !walletAddress}>
            <RiAlarmWarningLine className="mr-1.5 size-4" />
            Kill Switch
          </Button>
          </div>
        </div>
      )}

      {/* ── Recovery banner: DB says "released" but on-chain may still be locked ──
          Show when:
          (a) on-chain state could not be loaded (null), can't confirm release happened
          (b) on-chain explicitly shows status=0 (locked) with balance > 0.1 ALGO
          In both cases we offer Kill + Release so user can recover funds.           */}
      {vault.status === "released" && isSmartContract && !confirmAction &&
        !loadingChain &&
        (
          onChainState === null ||
          (
            onChainState.appExists === true &&
            (onChainState.globalState["status"] === 0 || onChainState.globalState["status"] === undefined) &&
            onChainState.balance > 100_000
          )
        ) && (
        <div className="mt-6 space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/50 dark:bg-amber-900/20">
            <RiAlarmWarningLine className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                ALGO may still be locked on-chain, recover your funds
              </p>
              <p className="mt-1 text-sm text-amber-700/80 dark:text-amber-300/80">
                {onChainState === null
                  ? "This vault was marked \"released\" but on-chain status could not be verified. If your ALGO has not arrived in your Pera wallet, it is still locked in the escrow contract."
                  : `This vault was marked "released" by the agent in simulation mode, but no real blockchain transaction happened. Your ALGO (${microalgosToAlgo(onChainState.balance).toFixed(6)} ALGO) is still locked in the escrow contract.`
                }
                {" "}Use the buttons below to release or reclaim it now.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => handleRelease()} disabled={isProcessing || !walletAddress}>
                  <RiLockUnlockLine className="mr-1.5 size-4" />
                  {isProcessing ? "Processing…" : "Release to Recipient"}
                </Button>
                <Button variant="destructive" onClick={() => setConfirmAction("kill")} disabled={isProcessing || !walletAddress}>
                  <RiAlarmWarningLine className="mr-1.5 size-4" />
                  Reclaim to My Wallet (Kill)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(vault.status === "released" || vault.status === "killed") && isSmartContract && !confirmAction && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {canMintReceipt && (
            <Button variant="secondary" onClick={handleMintReceipt} disabled={isProcessing || !walletAddress}>
              <RiAwardLine className="mr-1.5 size-4" />
              {isProcessing ? "Minting…" : "Mint ARC-3 Receipt"}
            </Button>
          )}

          {/* Kill button shown for "released" vaults in case ALGO is still locked on-chain */}
          {vault.status === "released" && (
            <Button variant="destructive" size="sm" onClick={() => setConfirmAction("kill")} disabled={isProcessing || !walletAddress}>
              <RiAlarmWarningLine className="mr-1.5 size-4" />
              Kill Switch (reclaim ALGO)
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

      <ProofOfDeliveryModal
        open={showProofModal}
        onClose={() => setShowProofModal(false)}
        onConfirm={async (proof) => {
          setShowProofModal(false)
          await handleRelease(proof)
        }}
      />
    </div>
  )
}
