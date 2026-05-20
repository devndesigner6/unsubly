import algosdk from "algosdk"
import { useState, useEffect } from "react"
import { useAlgorand } from "@/lib/algorand/context"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { algoToMicroalgos, VAULT_TYPE_LABELS, type VaultType } from "@/lib/algorand/constants"
import {
  deployAgentEscrowContractV2, deployEscrowContract, deployTimeLockContract,
  deployMultiSigContract, deployDisputeContract, deployASAContract, fundEscrowContract,
  optinASAVault,
} from "@/lib/algorand/contract"
import { RiCloseLine, RiLockLine, RiTimeLine, RiGroupLine, RiShieldLine, RiCoinLine, RiRobotLine, RiShieldCheckLine } from "@remixicon/react"
import { toast } from "sonner"
import { findSubscription, getFaviconUrl } from "@/data/subscriptionCatalog"
import { useAlgoPrice } from "@/hooks/useAlgoPrice"

const AGENT_ADDRESS = import.meta.env.VITE_AGENT_WALLET_ADDRESS as string | undefined
const KNOWN_AGENT_ADDRESS = "RVHOYLPY4L47JYCYEMCP7EMEC2AZ3HV53YHSL2ZISX6PSO5EQ6H5YVAE5U"
const EFFECTIVE_AGENT_ADDRESS = AGENT_ADDRESS || KNOWN_AGENT_ADDRESS

interface Subscription {
  id: string
  name: string
  amount: number
  currency: string | null
}

interface CreateVaultModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
  defaultVaultType?: VaultType
}

const VAULT_TYPE_ICONS: Record<VaultType, typeof RiLockLine> = {
  standard:               RiLockLine,
  agent:                  RiRobotLine,
  agent_v2:               RiRobotLine,
  time_locked:            RiTimeLine,
  multi_sig:              RiGroupLine,
  dispute:                RiShieldLine,
  asa:                    RiCoinLine,
  cancellation_insurance: RiShieldCheckLine,
}

const VAULT_TYPE_DESCRIPTIONS: Record<VaultType, string> = {
  standard:               "Basic escrow, you release manually",
  agent:                  "Agent auto-releases on billing date",
  agent_v2:               "Agent auto-releases with on-chain billing history",
  time_locked:            "Auto-releases after a set date",
  multi_sig:              "Requires co-signer approval",
  dispute:                "Arbitrator can resolve disputes",
  asa:                    "Lock ASA tokens instead of ALGO",
  cancellation_insurance: "Cancel & prove it → get ALGO back. Miss it → vendor gets paid",
}

export function CreateVaultModal({ isOpen, onClose, onCreated, defaultVaultType }: CreateVaultModalProps) {
  const { user } = useAuth()
  const { walletAddress, algodClient, peraWallet, balance, refreshBalance } = useAlgorand()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [selectedSubscription, setSelectedSubscription] = useState("")
  const [subSearchQuery, setSubSearchQuery] = useState("")
  const [showSubDropdown, setShowSubDropdown] = useState(false)
  const [amount, setAmount] = useState("")
  const [recipientAddress, setRecipientAddress] = useState("")
  const [vaultType, setVaultType] = useState<VaultType>(defaultVaultType || (localStorage.getItem("ub:vault-tooltip-seen") ? "standard" : "agent_v2"))
  const [unlockDate, setUnlockDate] = useState("")
  const [coSignerAddress, setCoSignerAddress] = useState("")
  const [arbitratorAddress, setArbitratorAddress] = useState("")
  const [assetId, setAssetId] = useState("")
  const [agentAddress, setAgentAddress] = useState(EFFECTIVE_AGENT_ADDRESS ?? "")
  const [isCreating, setIsCreating] = useState(false)
  const [step, setStep] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [usdAmount, setUsdAmount] = useState("")
  const [inputMode, setInputMode] = useState<"algo" | "usd">("algo")
  const { price: algoUsdPrice } = useAlgoPrice()

  useEffect(() => {
    if (!user || !isOpen) return
    const fetchSubscriptions = async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("id, name, amount, currency")
        .eq("user_id", user.id)
        .eq("status", "active")
      if (data) setSubscriptions(data)
    }
    fetchSubscriptions()
    setErrorMsg("")
    setStep("")
  }, [user, isOpen])

  useEffect(() => {
    if (selectedSubscription) {
      const sub = subscriptions.find((s) => s.id === selectedSubscription)
      if (sub) setAmount(String(sub.amount))
    }
  }, [selectedSubscription, subscriptions])

  const signTransaction = async (txn: algosdk.Transaction | algosdk.Transaction[]): Promise<Uint8Array[]> => {
    if (Array.isArray(txn)) {
      return await peraWallet.signTransaction([txn.map(t => ({ txn: t }))])
    }
    return await peraWallet.signTransaction([[{ txn }]])
  }

  // Returns a clean address if valid, otherwise an error string explaining why.
  // Trims whitespace because pasting from explorers/notes often includes it.
  const validateAddress = (raw: string, label: string): { ok: true; value: string } | { ok: false; error: string } => {
    const addr = raw.trim()
    if (!addr) return { ok: false, error: `${label} address is required.` }
    if (addr.length !== 58) {
      return { ok: false, error: `${label} address must be exactly 58 characters (you entered ${addr.length}).` }
    }
    try {
      algosdk.decodeAddress(addr)
      return { ok: true, value: addr }
    } catch (e: any) {
      return { ok: false, error: `${label} address is not a valid Algorand address (${e?.message || "checksum mismatch"}).` }
    }
  }
  const isValidAlgorandAddress = (addr: string): boolean => validateAddress(addr, "x").ok

  const handleCreate = async () => {
    if (!walletAddress || !user || !amount) return
    setErrorMsg("")

    // Runtime guard: ensure vault_type is a known supported type
    const SUPPORTED_TYPES: VaultType[] = ["standard", "agent", "agent_v2", "time_locked", "multi_sig", "dispute", "asa", "cancellation_insurance"]
    if (!SUPPORTED_TYPES.includes(vaultType)) {
      setErrorMsg(`Unsupported vault type: ${vaultType}. Please select a valid vault type.`)
      return
    }

    // Validate + clean each address up-front so on-chain calls always receive
    // canonical 58-char Algorand addresses (no leading/trailing whitespace).
    let recipient = walletAddress
    if (recipientAddress.trim()) {
      const v = validateAddress(recipientAddress, "Recipient")
      if (!v.ok) { setErrorMsg(v.error); return }
      recipient = v.value
    }

    let cleanCoSigner = ""
    if (vaultType === "multi_sig") {
      const v = validateAddress(coSignerAddress, "Co-signer")
      if (!v.ok) { setErrorMsg(v.error); return }
      cleanCoSigner = v.value
    }

    let cleanArbitrator = ""
    if (vaultType === "dispute") {
      const v = validateAddress(arbitratorAddress, "Arbitrator")
      if (!v.ok) { setErrorMsg(v.error); return }
      cleanArbitrator = v.value
    }

    let cleanAgent = ""
    if (vaultType === "agent" || vaultType === "agent_v2" || vaultType === "cancellation_insurance") {
      const v = validateAddress(agentAddress, "Agent")
      if (!v.ok) {
        setErrorMsg(`${v.error} Tip: paste the agent's full Algorand address (it will sign release txns autonomously when bills are due).`)
        return
      }
      cleanAgent = v.value
    }

    if (vaultType === "time_locked" && !unlockDate) {
      setErrorMsg("Please select an unlock date.")
      return
    }

    if (vaultType === "time_locked" && new Date(unlockDate).getTime() <= Date.now()) {
      setErrorMsg("Unlock date must be in the future.")
      return
    }

    if (vaultType === "asa" && (!assetId || isNaN(Number(assetId)))) {
      setErrorMsg("Please enter a valid ASA ID.")
      return
    }

    const algoAmount = parseFloat(amount)
    if (isNaN(algoAmount) || algoAmount <= 0) {
      setErrorMsg("Amount must be greater than 0.")
      return
    }

    await refreshBalance()

    if (balance <= 0) {
      setErrorMsg("Wallet has 0 ALGO. Fund your testnet wallet first at https://bank.testnet.algorand.network/")
      return
    }

    const requiredAlgo = algoAmount + 0.3
    if (balance < requiredAlgo) {
      setErrorMsg(`Insufficient balance. Need ~${requiredAlgo.toFixed(4)} ALGO, have ${balance.toFixed(4)} ALGO.`)
      return
    }

    setIsCreating(true)
    try {
      setStep("Deploying smart contract… (sign txn 1/2 in Pera Wallet)")

      let deployResult: { appId: number; appAddress: string; txnId: string }

      switch (vaultType) {
        case "agent":
        case "agent_v2":
        case "cancellation_insurance":
          deployResult = await deployAgentEscrowContractV2(
            algodClient, walletAddress, recipient, cleanAgent, signTransaction
          )
          break
        case "time_locked":
          deployResult = await deployTimeLockContract(
            algodClient, walletAddress, recipient,
            Math.floor(new Date(unlockDate).getTime() / 1000), signTransaction
          )
          break
        case "multi_sig":
          deployResult = await deployMultiSigContract(
            algodClient, walletAddress, recipient, cleanCoSigner, signTransaction
          )
          break
        case "dispute":
          deployResult = await deployDisputeContract(
            algodClient, walletAddress, recipient, cleanArbitrator, signTransaction
          )
          break
        case "asa":
          deployResult = await deployASAContract(
            algodClient, walletAddress, recipient, Number(assetId), signTransaction
          )
          break
        default:
          deployResult = await deployEscrowContract(algodClient, walletAddress, recipient, signTransaction)
      }

      const { appId, appAddress, txnId: deployTxnId } = deployResult

      // For ASA vaults: opt the contract into the ASA before funding.
      // Without this the app account cannot receive ASA tokens.
      if (vaultType === "asa" && assetId) {
        setStep("Opting contract into ASA… (sign txn 2/3 in Pera Wallet)")
        await optinASAVault(algodClient, walletAddress, appId, signTransaction)
        setStep("Funding escrow vault… (sign txn 3/3 in Pera Wallet)")
      } else {
        setStep("Funding escrow vault… (sign txn 2/2 in Pera Wallet)")
      }

      const fundTxnId = await fundEscrowContract(
        algodClient, walletAddress, appAddress, algoToMicroalgos(algoAmount), signTransaction
      )

      const baseRow: Record<string, unknown> = {
        user_id: user.id,
        subscription_id: selectedSubscription || null,
        algorand_address: walletAddress,
        amount: algoAmount,
        currency: "ALGO",
        status: "locked",
        txn_id: deployTxnId,
        escrow_address: recipient,
        app_id: appId,
        app_address: appAddress,
        vault_type: vaultType === "agent" ? "agent_v2" : vaultType,
        unlock_time: vaultType === "time_locked" ? new Date(unlockDate).toISOString() : null,
        co_signer_address: vaultType === "multi_sig" ? cleanCoSigner : null,
        arbitrator_address: vaultType === "dispute" ? cleanArbitrator : null,
        agent_address: (vaultType === "agent" || vaultType === "agent_v2") ? cleanAgent : null,
        asset_id: vaultType === "asa" ? Number(assetId) : null,
      }

      let { error: insertError } = await supabase.from("escrow_vaults" as any).insert(baseRow as any)

      // Schema-cache fallback: if agent_address column doesn't exist on the
      // remote DB yet, retry without it so the vault still saves on-chain.
      if (insertError && /agent_address/i.test((insertError as any)?.message || "")) {
        const { agent_address: _omit, ...legacyRow } = baseRow
        const retry = await supabase.from("escrow_vaults" as any).insert(legacyRow as any)
        insertError = retry.error
        if (!retry.error) {
          toast.warning("Vault saved (legacy schema)", {
            description: "Apply migration 20260409000002_agent_vault_columns.sql in Supabase to enable agent auto-release tracking.",
            duration: 12000,
          })
        }
      }

      if (insertError) {
        console.error("DB insert error:", insertError)
        const errDetail = (insertError as any)?.message || (insertError as any)?.details || JSON.stringify(insertError)
        toast.error("Vault on-chain, syncing to database…", {
          description: `Auto-recovery will import it now. (${errDetail})`,
          duration: 10000,
        })
      }

      const effectiveVaultType: VaultType = vaultType

      await supabase.from("onchain_payments" as any).insert({
        user_id: user.id,
        subscription_id: selectedSubscription || null,
        algorand_txn_id: fundTxnId,
        amount: algoAmount,
        sender_address: walletAddress,
        recipient_address: appAddress,
        note: `${VAULT_TYPE_LABELS[effectiveVaultType]} vault created (App ID: ${appId})`,
      } as any)

      toast.success("Escrow vault created!", {
        description: `${algoAmount} ALGO locked in ${VAULT_TYPE_LABELS[effectiveVaultType]} contract (App ID: ${appId})`,
      })

      onCreated()
      onClose()
      setAmount("")
      setSelectedSubscription("")
      setSubSearchQuery("")
      setRecipientAddress("")
      setVaultType("standard")
      setUnlockDate("")
      setCoSignerAddress("")
      setArbitratorAddress("")
      setAssetId("")
      setStep("")
      setErrorMsg("")
    } catch (err: any) {
      console.error("Create vault error:", err)
      const raw = err?.message || "Transaction failed"
      let friendly = raw

      if (raw.includes("CONNECT_MODAL_CLOSED") || raw.toLowerCase().includes("cancel")) {
        friendly = "Transaction cancelled, nothing was sent."
      } else if (raw.includes("4100") || raw.toLowerCase().includes("pending") || raw.toLowerCase().includes("another transaction request")) {
        friendly = "Pera Wallet has a pending request. Open Pera Wallet on your phone, reject any pending transaction, then try again."
      } else if (raw.toLowerCase().includes("unable to parse") || raw.toLowerCase().includes("invalid request format")) {
        friendly = "Pera Wallet couldn't read the transaction. Make sure Pera is updated to the latest version, then try again."
      } else if (raw.toLowerCase().includes("insufficient") || raw.toLowerCase().includes("below min")) {
        friendly = "Your wallet doesn't have enough ALGO. You need at least 0.3 ALGO to cover the vault minimum balance and fees."
      } else if (raw.toLowerCase().includes("network") || raw.toLowerCase().includes("fetch")) {
        friendly = "Couldn't connect to Algorand. Check your internet connection and try again."
      } else if (raw.toLowerCase().includes("unauthorized") || raw.toLowerCase().includes("auth")) {
        friendly = "Wallet authorization failed. Reconnect your Pera Wallet and try again."
      } else if (raw.toLowerCase().includes("overspend") || raw.toLowerCase().includes("balance")) {
        friendly = "Transaction would leave your wallet below the minimum balance. Add more ALGO and retry."
      }

      setErrorMsg(friendly)
      if (!raw.includes("CONNECT_MODAL_CLOSED") && !raw.toLowerCase().includes("cancel")) {
        toast.error("Failed to create vault", { description: friendly })
      }
      setStep("")
    } finally {
      setIsCreating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-xl mx-3">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Create Escrow Vault</h2>
          <div className="flex items-center gap-3">
            {/* Step indicator */}
            {isCreating && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={`size-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step.includes("1/") || step.includes("1 of") || step.includes("txn 1") ? "bg-foreground text-background" : "bg-muted text-foreground"}`}>1</span>
                <span className="size-3 border-t border-border" />
                <span className={`size-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step.includes("2/") || step.includes("2 of") || step.includes("txn 2") ? "bg-foreground text-background" : "bg-muted text-foreground"}`}>2</span>
                {vaultType === "asa" && (
                  <>
                    <span className="size-3 border-t border-border" />
                    <span className={`size-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step.includes("3/") || step.includes("txn 3") ? "bg-foreground text-background" : "bg-muted text-foreground"}`}>3</span>
                  </>
                )}
              </div>
            )}
            <button onClick={onClose} disabled={isCreating} aria-label="Close" title="Close" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50">
              <RiCloseLine className="size-5" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Vault Type Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Vault Type</label>

            {/* First-time tooltip — shows once */}
            {!localStorage.getItem("ub:vault-tooltip-seen") && (
              <div className="mb-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 px-3 py-2 text-[11px] text-red-800 dark:text-red-300">
                <span className="font-medium">Recommended:</span> Agent-Managed v2 lets the autonomous agent release payments on billing day automatically. No manual action needed.
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {(["agent_v2", "agent", "standard", "time_locked", "multi_sig", "dispute", "asa", "cancellation_insurance"] as VaultType[]).map((type) => {
                const Icon = VAULT_TYPE_ICONS[type]
                const isAgentType = type === "agent" || type === "agent_v2"
                return (
                  <button
                    key={type}
                    onClick={() => {
                      setVaultType(type)
                      localStorage.setItem("ub:vault-tooltip-seen", "1")
                    }}
                    disabled={isCreating}
                    className={`flex items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                      isAgentType
                        ? vaultType === type
                          ? "border-red-500 bg-red-600 text-white"
                          : "border-red-500/50 bg-red-600/90 text-white hover:bg-red-600"
                        : vaultType === type
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {isAgentType ? (
                      <RiRobotLine className="size-4 mt-0.5 shrink-0 text-white" />
                    ) : (
                      <Icon className="size-4 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <p className="text-xs font-medium">{VAULT_TYPE_LABELS[type]}</p>
                      <p className={`text-[10px] ${isAgentType ? "text-white/70" : "opacity-70"}`}>{VAULT_TYPE_DESCRIPTIONS[type]}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Link to Subscription (optional)
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search your subscriptions..."
                value={subSearchQuery}
                onChange={(e) => {
                  setSubSearchQuery(e.target.value)
                  setShowSubDropdown(true)
                  if (!e.target.value) setSelectedSubscription("")
                }}
                onFocus={() => setShowSubDropdown(true)}
                onBlur={() => setTimeout(() => setShowSubDropdown(false), 200)}
                disabled={isCreating}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                autoComplete="off"
              />
              {showSubDropdown && (
                <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                  {subscriptions
                    .filter(s => !subSearchQuery || s.name.toLowerCase().includes(subSearchQuery.toLowerCase()))
                    .map((sub) => {
                      const entry = findSubscription(sub.name)
                      const domain = entry?.domain
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${selectedSubscription === sub.id ? "bg-muted" : "hover:bg-muted/50"}`}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            setSelectedSubscription(sub.id)
                            setSubSearchQuery(sub.name)
                            setShowSubDropdown(false)
                          }}
                        >
                          {domain ? (
                            <img src={getFaviconUrl(domain)} alt="" className="size-5 rounded object-contain bg-white border border-border p-0.5 shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                          ) : (
                            <div className="size-5 rounded bg-muted flex items-center justify-center shrink-0">
                              <span className="text-[8px] font-bold text-muted-foreground">{sub.name.charAt(0)}</span>
                            </div>
                          )}
                          <span className="font-medium text-foreground truncate">{sub.name}</span>
                          <span className="ml-auto text-xs text-muted-foreground shrink-0">{sub.amount} {sub.currency}</span>
                        </button>
                      )
                    })}
                  {subscriptions.filter(s => !subSearchQuery || s.name.toLowerCase().includes(subSearchQuery.toLowerCase())).length === 0 && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">No subscriptions found</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Amount
            </label>
            {/* Toggle between ALGO and USD input */}
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setInputMode("algo")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${inputMode === "algo" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
              >
                ALGO
              </button>
              <button
                type="button"
                onClick={() => setInputMode("usd")}
                disabled={!algoUsdPrice}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${inputMode === "usd" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
              >
                USD
              </button>
              {algoUsdPrice && (
                <span className="text-[10px] text-muted-foreground ml-auto">
                  1 ALGO ≈ ${algoUsdPrice.toFixed(4)}
                </span>
              )}
            </div>
            {inputMode === "algo" ? (
              <input
                type="number"
                step="0.0001"
                min="0.001"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  if (algoUsdPrice && e.target.value) setUsdAmount((parseFloat(e.target.value) * algoUsdPrice).toFixed(2))
                }}
                placeholder="0.00 ALGO"
                disabled={isCreating}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            ) : (
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={usdAmount}
                onChange={(e) => {
                  setUsdAmount(e.target.value)
                  if (algoUsdPrice && e.target.value) setAmount((parseFloat(e.target.value) / algoUsdPrice).toFixed(4))
                }}
                placeholder="0.00 USD"
                disabled={isCreating}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            )}
            <div className="mt-1 flex items-center justify-between">
              {balance > 0 && (
                <p className="text-xs text-muted-foreground">
                  Available: {balance.toFixed(4)} ALGO
                </p>
              )}
              {inputMode === "usd" && amount && (
                <p className="text-xs text-muted-foreground">
                  ≈ {amount} ALGO
                </p>
              )}
              {inputMode === "algo" && usdAmount && algoUsdPrice && (
                <p className="text-xs text-muted-foreground">
                  ≈ ${usdAmount} USD <span className="text-muted-foreground/50">(Gora Oracle)</span>
                </p>
              )}
            </div>
            {/* Tinyman swap suggestion when balance is low */}
            {balance > 0 && Number(amount) > 0 && balance < Number(amount) + 0.3 && (
              <div className="mt-2 rounded-lg border border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5 px-3 py-2">
                <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                  Need {(Number(amount) + 0.3 - balance).toFixed(4)} more ALGO
                </p>
                <a
                  href={`https://testnet.tinyman.org/#/swap?asset_in=10458941&asset_out=0`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1 text-[10px] text-amber-600 dark:text-amber-300 hover:underline"
                >
                  Swap USDC → ALGO on Tinyman DEX ↗
                </a>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Recipient Address
            </label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="Service provider's Algorand address"
              disabled={isCreating}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground font-mono text-xs"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Leave empty for self-escrow (funds release back to you)
            </p>
          </div>

          {/* Conditional fields based on vault type */}
          {vaultType === "time_locked" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Unlock Date & Time
              </label>
              <input
                type="datetime-local"
                value={unlockDate}
                onChange={(e) => setUnlockDate(e.target.value)}
                disabled={isCreating}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Funds cannot be released before this date
              </p>
            </div>
          )}

          {vaultType === "multi_sig" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Co-Signer Address
              </label>
              <input
                type="text"
                value={coSignerAddress}
                onChange={(e) => setCoSignerAddress(e.target.value)}
                placeholder="Co-signer's Algorand address"
                disabled={isCreating}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground font-mono text-xs"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Both you and the co-signer must approve release
              </p>
            </div>
          )}

          {vaultType === "dispute" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Arbitrator Address
              </label>
              <input
                type="text"
                value={arbitratorAddress}
                onChange={(e) => setArbitratorAddress(e.target.value)}
                placeholder="Arbitrator's Algorand address"
                disabled={isCreating}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground font-mono text-xs"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Arbitrator can resolve disputes and force release/kill
              </p>
            </div>
          )}

          {(vaultType === "agent" || vaultType === "agent_v2" || vaultType === "cancellation_insurance") && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {vaultType === "cancellation_insurance" ? "Agent Wallet (releases to vendor if not cancelled)" : "Auto-Pay Agent Wallet"}
              </label>
              <input
                type="text"
                value={agentAddress}
                onChange={(e) => setAgentAddress(e.target.value.trim())}
                placeholder="Agent's Algorand address (pre-filled with the Unsubscribely agent)"
                disabled={isCreating}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground font-mono text-xs"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                This is the wallet of the autonomous agent that pays your subscription on its billing date so you do not have to. By default it is the Unsubscribely agent. You can replace it with any wallet you control if you want to run your own agent.
              </p>
            </div>
          )}

          {vaultType === "asa" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                ASA Token ID
              </label>
              <input
                type="number"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                placeholder="e.g. 10458941 (USDC)"
                disabled={isCreating}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The Algorand Standard Asset to lock in the vault
              </p>
            </div>
          )}

          {(vaultType === "agent" || vaultType === "agent_v2" || vaultType === "cancellation_insurance") && agentAddress ? (
            <div className="rounded-lg bg-green-500/5 border border-green-500/20 p-3 flex items-start gap-2">
              <img src="/openclaw.svg" alt="OpenClaw" className="size-4 mt-0.5 shrink-0 dark:hidden" />
              <img src="/openclaw-dark.svg" alt="OpenClaw" className="size-4 mt-0.5 shrink-0 hidden dark:block" />
              <div>
                <p className="text-xs font-medium text-green-700 dark:text-green-400">Agent Auto-Pay Enabled</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  The agent below will automatically pay this subscription for you on its billing date. You stay in control: kill the vault any time and your funds come back instantly.
                </p>
                <p className="text-[10px] font-mono text-muted-foreground mt-1 truncate">
                  Paying agent: {agentAddress.slice(0, 8)}…{agentAddress.slice(-8)}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/50 border border-border p-3">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Real Smart Contract:</strong> This deploys a {VAULT_TYPE_LABELS[vaultType]} TEAL contract on Algorand. You'll sign 2 transactions in Pera Wallet.
              </p>
            </div>
          )}

          {step && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
              <p className="text-xs text-primary font-medium animate-pulse">{step}</p>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
              <p className="text-xs text-destructive font-medium">❌ {errorMsg}</p>
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={isCreating || !walletAddress || !amount}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <RiLockLine className="size-4" />
            {isCreating ? "Deploying Contract..." : `Deploy ${VAULT_TYPE_LABELS[vaultType]} Vault`}
          </button>
        </div>
      </div>
    </div>
  )
}
