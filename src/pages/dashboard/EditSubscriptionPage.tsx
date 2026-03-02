import { SubscriptionForm } from "@/components/subscriptions/SubscriptionFormVite"
import { Link, useParams, useNavigate } from "react-router-dom"
import { useAuth } from "@/lib/auth-context"
import { fetchSubscriptionById, deleteSubscription, fetchSubscriptionTags } from "@/lib/supabase-queries"
import { formatCurrency } from "@/lib/currency"
import { Button } from "@/components/Button"
import { RiArrowLeftLine, RiDeleteBinLine, RiLoader4Line, RiAlertLine, RiEditLine } from "@remixicon/react"
import { useState, useEffect } from "react"

export default function EditSubscriptionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [subscription, setSubscription] = useState<any>(null)
  const [tagIds, setTagIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

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

  const handleDelete = async () => {
    if (!id || !confirm("Delete this subscription?")) return
    setIsDeleting(true)
    try {
      await deleteSubscription(id)
      navigate("/subscriptions")
    } catch {
      alert("Failed to delete")
    } finally {
      setIsDeleting(false)
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="relative overflow-hidden border-b border-gray-200 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 dark:border-gray-800">
        <div className="relative mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <Link to="/subscriptions" className="mb-2 inline-flex items-center gap-1 text-xs text-blue-200 hover:text-white transition-colors sm:text-sm">
                <RiArrowLeftLine className="size-3.5 sm:size-4" />
                Back to Subscriptions
              </Link>
              <div className="flex items-center gap-3 text-white">
                <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm sm:size-12">
                  <RiEditLine className="size-5 sm:size-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold sm:text-2xl">{subscription.name}</h1>
                  <p className="text-sm text-blue-100">
                    {formatCurrency(subscription.amount, subscription.currency || "USD")} / {subscription.billing_cycle}
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="secondary"
              className="bg-white/20 text-white hover:bg-white/30 border-white/20"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <RiLoader4Line className="mr-2 size-4 animate-spin" /> : <RiDeleteBinLine className="mr-2 size-4" />}
              Delete
            </Button>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-3xl p-3 sm:p-6 lg:p-8">
        <SubscriptionForm subscription={subscription} tagIds={tagIds} />
      </div>
    </div>
  )
}
