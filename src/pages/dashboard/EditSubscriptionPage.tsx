import { SubscriptionForm } from "@/components/subscriptions/SubscriptionFormVite"
import { GuardrailsSection } from "@/components/subscriptions/GuardrailsSection"
import { CredentialsSection } from "@/components/subscriptions/CredentialsSection"
import { Link, useParams, useNavigate } from "react-router-dom"
import { useAuth } from "@/lib/auth-context"
import { fetchSubscriptionById, deleteSubscription, fetchSubscriptionTags } from "@/lib/supabase-queries"
import { formatCurrency } from "@/lib/currency"
import { Button } from "@/components/Button"
import { toast } from "sonner"
import { RiArrowLeftLine, RiDeleteBinLine, RiLoader4Line, RiAlertLine, RiEditLine, RiCloseCircleLine } from "@remixicon/react"
import { useState, useEffect } from "react"
import { useAlgorand } from "@/lib/algorand/context"
import { cancelSubscriptionOnChain } from "@/lib/algorand/cancel"

export default function EditSubscriptionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [subscription, setSubscription] = useState<any>(null)
  const [tagIds, setTagIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const { walletAddress, algodClient, peraWallet } = useAlgorand()

  useEffect(() => {
    if (!id) return
    async function load() {
      try {
        const [sub, tags] = await Promise.all([
          fetchSubscriptionById(id!),
          fetchSubscriptionTags(id!),
        ])
        setSubscription(sub)
        setTagIds(tags)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const handleCancelOnChain = async () => {
    if (!id || !user) return
    setIsCancelling(true)
    try {
      const signTransaction = async (txn: any): Promise<Uint8Array[]> => {
        return await peraWallet.signTransaction([[{ txn }]])
      }
      const result = await cancelSubscriptionOnChain({
        subscriptionId: id,
        userId: user.id,
        walletAddress,
        algodClient,
        signTransaction,
      })
      if (result.dbUpdated && result.vaultsKilled > 0) {
        toast.success(`Cancelled. Killed ${result.vaultsKilled} vault(s) on-chain, funds refunded to your wallet.`)
        navigate("/subscriptions")
      } else if (result.dbUpdated && result.errors.length === 0) {
        toast.success("Subscription cancelled.")
        navigate("/subscriptions")
      } else if (result.dbUpdated) {
        // Sub status was changed but on-chain kill failed → stay on page so user can retry from the vault details page.
        toast.warning(`Cancelled in app. On-chain kill failed: ${result.errors.join("; ")}. Visit the vault page to kill manually.`)
      } else {
        // DB update itself failed, keep user here, do not navigate.
        toast.error(result.errors.join("; ") || "Cancellation failed")
      }
    } catch (err: any) {
      toast.error(err?.message || "Cancellation failed")
    } finally {
      setIsCancelling(false)
      setShowCancelConfirm(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    setIsDeleting(true)
    try {
      await deleteSubscription(id)
      toast.success("Subscription deleted")
      navigate("/subscriptions")
    } catch {
      toast.error("Failed to delete subscription")
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <RiLoader4Line className="size-10 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error || !subscription) {
    return (
      <div className="flex h-96 items-center justify-center p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-900/20">
          <RiAlertLine className="mx-auto mb-4 size-12 text-red-400" />
          <p className="text-lg font-medium text-red-600 dark:text-red-400">{error || "Not found"}</p>
          <Button variant="secondary" className="mt-4" asChild>
            <Link to="/subscriptions">Back</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800">
        <div className="relative mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Link to="/subscriptions" className="mb-2 inline-flex items-center gap-1 text-xs text-blue-200 hover:text-white transition-colors sm:text-sm">
                <RiArrowLeftLine className="size-3.5 sm:size-4" />
                Back to Subscriptions
              </Link>
              <div className="flex items-center gap-3 text-white">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm sm:size-12">
                  <RiEditLine className="size-5 sm:size-6" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-bold sm:text-2xl">{subscription.name}</h1>
                  <p className="truncate text-sm text-blue-100">
                    {formatCurrency(subscription.amount, subscription.currency || "USD")} / {subscription.billing_cycle}
                  </p>
                </div>
              </div>
            </div>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  className="border-white/20"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? <RiLoader4Line className="mr-2 size-4 animate-spin" /> : null}
                  {isDeleting ? "Deleting..." : "Confirm Delete"}
                </Button>
                <Button
                  variant="secondary"
                  className="bg-white/20 text-white hover:bg-white/30 border-white/20"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
              </div>
            ) : showCancelConfirm ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  className="border-white/20"
                  onClick={handleCancelOnChain}
                  disabled={isCancelling}
                >
                  {isCancelling ? <RiLoader4Line className="mr-2 size-4 animate-spin" /> : null}
                  {isCancelling ? "Cancelling on-chain…" : "Confirm Cancel + Refund"}
                </Button>
                <Button
                  variant="secondary"
                  className="bg-white/20 text-white hover:bg-white/30 border-white/20"
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={isCancelling}
                >
                  Keep
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  className="bg-white/20 text-white hover:bg-white/30 border-white/20"
                  onClick={() => setShowCancelConfirm(true)}
                  title={walletAddress ? "Cancel subscription and kill linked vault on-chain (refunds remaining funds)" : "Connect wallet to also kill linked vault"}
                >
                  <RiCloseCircleLine className="mr-2 size-4" />
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  className="bg-white/20 text-white hover:bg-white/30 border-white/20"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <RiDeleteBinLine className="mr-2 size-4" />
                  Delete
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-3xl space-y-6 p-3 sm:p-6 lg:p-8">
        <SubscriptionForm key={subscription.id} subscription={subscription} tagIds={tagIds} />
        <CredentialsSection
          subscriptionId={subscription.id}
          subscriptionName={subscription.name}
          credentialsAlreadySet={!!subscription.credentials_set_at}
          onSaved={() => {
            // Reload subscription to update credentials_set_at
            fetchSubscriptionById(subscription.id).then(setSubscription).catch(() => {})
          }}
        />
        <GuardrailsSection
          subscriptionId={subscription.id}
          currency={subscription.currency || "USD"}
        />
      </div>
    </div>
  )
}
