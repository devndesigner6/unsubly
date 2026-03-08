import { useState, useEffect } from "react"
import { useAlgorand } from "@/lib/algorand/context"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { algoToMicroalgos } from "@/lib/algorand/constants"
import algosdk from "algosdk"
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
  const { walletAddress, signAndSendTransaction, algodClient } = useAlgorand()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [selectedSubscription, setSelectedSubscription] = useState("")
  const [amount, setAmount] = useState("")
  const [recipientAddress, setRecipientAddress] = useState("")
  const [isCreating, setIsCreating] = useState(false)

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

  const handleCreate = async () => {
    if (!walletAddress || !user || !amount) return
    setIsCreating(true)
    try {
      const algoAmount = parseFloat(amount)
      
      // Create on-chain escrow transaction (lock funds with a note)
      const params = await algodClient.getTransactionParams().do()
      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: walletAddress,
        receiver: recipientAddress || walletAddress, // Self-escrow if no recipient
        amount: algoToMicroalgos(algoAmount),
        suggestedParams: params,
        note: new TextEncoder().encode(
          JSON.stringify({
            app: "unsubscribely",
            action: "create_vault",
            subscription_id: selectedSubscription || null,
            timestamp: Date.now(),
          })
        ),
      })

      const txnId = await signAndSendTransaction(txn)

      // Save vault to database
      await supabase.from("escrow_vaults" as any).insert({
        user_id: user.id,
        subscription_id: selectedSubscription || null,
        algorand_address: walletAddress,
        amount: algoAmount,
        currency: "ALGO",
        status: "locked",
        txn_id: txnId,
        escrow_address: recipientAddress || walletAddress,
      } as any)

      // Record on-chain payment
      await supabase.from("onchain_payments" as any).insert({
        user_id: user.id,
        subscription_id: selectedSubscription || null,
        algorand_txn_id: txnId,
        amount: algoAmount,
        sender_address: walletAddress,
        recipient_address: recipientAddress || walletAddress,
        note: "Escrow vault created",
      } as any)

      onCreated()
      onClose()
      setAmount("")
      setSelectedSubscription("")
      setRecipientAddress("")
    } catch (err) {
      console.error("Create vault error:", err)
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
              Recipient Address (optional)
            </label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="Service provider's Algorand address"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground font-mono text-xs"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Leave empty for self-escrow (testnet demo)
            </p>
          </div>

          <button
            onClick={handleCreate}
            disabled={isCreating || !walletAddress || !amount}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <RiLockLine className="size-4" />
            {isCreating ? "Locking Funds..." : "Lock Payment in Vault"}
          </button>
        </div>
      </div>
    </div>
  )
}
