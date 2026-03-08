import { useState, useEffect } from "react"
import { useAlgorand } from "@/lib/algorand/context"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { algoToMicroalgos } from "@/lib/algorand/constants"
import { deployEscrowContract, fundEscrowContract } from "@/lib/algorand/contract"
import { RiCloseLine, RiLockLine } from "@remixicon/react"

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

export function CreateVaultModal({ isOpen, onClose, onCreated }: CreateVaultModalProps) {
  const { user } = useAuth()
  const { walletAddress, algodClient, peraWallet } = useAlgorand()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [selectedSubscription, setSelectedSubscription] = useState("")
  const [amount, setAmount] = useState("")
  const [recipientAddress, setRecipientAddress] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [step, setStep] = useState("")

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

  const isValidAlgorandAddress = (addr: string): boolean => {
    if (addr.length !== 58) return false
    try {
      algosdk.decodeAddress(addr)
      return true
    } catch {
      return false
    }
  }

  const handleCreate = async () => {
    if (!walletAddress || !user || !amount) return

    const recipient = recipientAddress || walletAddress

    // Validate recipient address before attempting transaction
    if (recipientAddress && !isValidAlgorandAddress(recipientAddress)) {
      setStep("❌ Invalid Algorand address. Must be 58 characters.")
      return
    }

    const algoAmount = parseFloat(amount)
    if (algoAmount <= 0) {
      setStep("❌ Amount must be greater than 0.")
      return
    }

    setIsCreating(true)
    try {

      // Step 1: Deploy the TEAL smart contract
      setStep("Deploying smart contract… (sign txn 1/2)")
      const { appId, appAddress, txnId: deployTxnId } = await deployEscrowContract(
        algodClient,
        walletAddress,
        recipient,
        signTransaction
      )

      // Step 2: Fund the contract with escrowed ALGO
      setStep("Funding escrow vault… (sign txn 2/2)")
      const fundTxnId = await fundEscrowContract(
        algodClient,
        walletAddress,
        appAddress,
        algoToMicroalgos(algoAmount),
        signTransaction
      )

      // Step 3: Save vault to database with app_id
      await supabase.from("escrow_vaults" as any).insert({
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
      } as any)

      // Record on-chain payment
      await supabase.from("onchain_payments" as any).insert({
        user_id: user.id,
        subscription_id: selectedSubscription || null,
        algorand_txn_id: fundTxnId,
        amount: algoAmount,
        sender_address: walletAddress,
        recipient_address: appAddress,
        note: `Escrow vault created (App ID: ${appId})`,
      } as any)

      onCreated()
      onClose()
      setAmount("")
      setSelectedSubscription("")
      setRecipientAddress("")
      setStep("")
    } catch (err) {
      console.error("Create vault error:", err)
      setStep("")
    } finally {
      setIsCreating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Create Escrow Vault</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">
            <RiCloseLine className="size-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Link to Subscription (optional)
            </label>
            <select
              value={selectedSubscription}
              onChange={(e) => setSelectedSubscription(e.target.value)}
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
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
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
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground font-mono text-xs"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Leave empty for self-escrow (funds release back to you)
            </p>
          </div>

          <div className="rounded-lg bg-muted/50 border border-border p-3">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Real Smart Contract:</strong> This deploys a TEAL escrow contract on Algorand Testnet. You'll sign 2 transactions: one to deploy the contract, one to fund it. The kill switch is enforced on-chain.
            </p>
          </div>

          {step && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
              <p className="text-xs text-primary font-medium">{step}</p>
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={isCreating || !walletAddress || !amount}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <RiLockLine className="size-4" />
            {isCreating ? "Deploying Contract..." : "Deploy & Lock Funds"}
          </button>
        </div>
      </div>
    </div>
  )
}
