import algosdk from "algosdk"
import { useState, useEffect } from "react"
import { useAlgorand } from "@/lib/algorand/context"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { algoToMicroalgos, VAULT_TYPE_LABELS, type VaultType } from "@/lib/algorand/constants"
import {
  deployAgentEscrowContractV2, deployEscrowContract, deployTimeLockContract,
  deployMultiSigContract, deployDisputeContract, deployASAContract, fundEscrowContract,
} from "@/lib/algorand/contract"
import { RiCloseLine, RiLockLine, RiTimeLine, RiGroupLine, RiShieldLine, RiCoinLine, RiRobotLine } from "@remixicon/react"
import { toast } from "sonner"

const AGENT_ADDRESS = import.meta.env.VITE_AGENT_WALLET_ADDRESS as string | undefined

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
}

const VAULT_TYPE_ICONS: Record<VaultType, typeof RiLockLine> = {
  standard:    RiLockLine,
  agent:       RiRobotLine,
  agent_v2:    RiRobotLine,
  time_locked: RiTimeLine,
  multi_sig:   RiGroupLine,
  dispute:     RiShieldLine,
  asa:         RiCoinLine,
}

const VAULT_TYPE_DESCRIPTIONS: Record<VaultType, string> = {
  standard:    "Basic escrow, you release manually",
  agent:       "Agent auto-releases on billing date",
  agent_v2:    "Agent auto-releases with on-chain billing history",
  time_locked: "Auto-releases after a set date",
  multi_sig:   "Requires co-signer approval",
  dispute:     "Arbitrator can resolve disputes",
  asa:         "Lock ASA tokens instead of ALGO",
}

export function CreateVaultModal({ isOpen, onClose, onCreated }: CreateVaultModalProps) {
  const { user } = useAuth()
  const { walletAddress, algodClient, peraWallet, balance, refreshBalance } = useAlgorand()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [selectedSubscription, setSelectedSubscription] = useState("")
  const [amount, setAmount] = useState("")
  const [recipientAddress, setRecipientAddress] = useState("")
  const [vaultType, setVaultType] = useState<VaultType>("standard")
  const [unlockDate, setUnlockDate] = useState("")
  const [coSignerAddress, setCoSignerAddress] = useState("")
  const [arbitratorAddress, setArbitratorAddress] = useState("")
  const [assetId, setAssetId] = useState("")
  const [agentAddress, setAgentAddress] = useState(AGENT_ADDRESS ?? "")
  const [isCreating, setIsCreating] = useState(false)
  const [step, setStep] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

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

  const signTransaction = async (txn: any): Promise<Uint8Array[]> => {
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
    if (vaultType === "agent") {
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

      setStep("Funding escrow vault… (sign txn 2/2 in Pera Wallet)")
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
        agent_address: vaultType === "agent" ? cleanAgent : null,
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
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Create Escrow Vault</h2>
          <button onClick={onClose} disabled={isCreating} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50">
            <RiCloseLine className="size-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Vault Type Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Vault Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(VAULT_TYPE_LABELS) as VaultType[]).map((type) => {
                const Icon = VAULT_TYPE_ICONS[type]
                return (
                  <button
                    key={type}
                    onClick={() => setVaultType(type)}
                    disabled={isCreating}
                    className={`flex items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                      vaultType === type
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    <Icon className="size-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium">{VAULT_TYPE_LABELS[type]}</p>
                      <p className="text-[10px] opacity-70">{VAULT_TYPE_DESCRIPTIONS[type]}</p>
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
            <select
              value={selectedSubscription}
              onChange={(e) => setSelectedSubscription(e.target.value)}
              disabled={isCreating}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">No linked subscription</option>
              {subscriptions.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} ({sub.amount} {sub.currency})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Amount (ALGO)
            </label>
            <input
              type="number"
              step="0.0001"
              min="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={isCreating}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
            {balance > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Available: {balance.toFixed(4)} ALGO
              </p>
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

          {vaultType === "agent" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Agent Wallet Address
              </label>
              <input
                type="text"
                value={agentAddress}
                onChange={(e) => setAgentAddress(e.target.value.trim())}
                placeholder="Agent's Algorand address (auto-fills from env if set)"
                disabled={isCreating}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground font-mono text-xs"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The autonomous agent will sign release txns on the billing date. Use the deployer/agent wallet your backend controls.
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

          {vaultType === "agent" && agentAddress ? (
            <div className="rounded-lg bg-green-500/5 border border-green-500/20 p-3 flex items-start gap-2">
              <RiRobotLine className="size-4 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-xs font-medium text-green-700 dark:text-green-400">Agent Auto-Release Enabled</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  The autonomous agent will release this vault on the subscription billing date, no manual action needed.
                </p>
                <p className="text-[10px] font-mono text-muted-foreground mt-1 truncate">
                  Agent: {agentAddress.slice(0, 8)}…{agentAddress.slice(-8)}
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
