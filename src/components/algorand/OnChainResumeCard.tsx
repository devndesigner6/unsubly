import { getAlgoExplorerUrl, shortenAddress } from "@/lib/algorand/constants"
import { RiCheckDoubleLine, RiExternalLinkLine } from "@remixicon/react"

interface OnChainPayment {
  id: string
  algorand_txn_id: string
  amount: number
  sender_address: string
  recipient_address: string | null
  note: string | null
  confirmed_at: string | null
  created_at: string
  subscription?: { name: string; logo: string | null } | null
}

export function OnChainResumeCard({ payment }: { payment: OnChainPayment }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm">
      <div className="flex size-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
        <RiCheckDoubleLine className="size-5 text-green-600 dark:text-green-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {payment.note || "Payment"}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground font-mono">
            {shortenAddress(payment.algorand_txn_id, 8)}
          </span>
          <a
            href={getAlgoExplorerUrl(payment.algorand_txn_id)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80"
          >
            <RiExternalLinkLine className="size-3" />
          </a>
        </div>
      </div>
      <div className="text-right">
        <span className="text-sm font-semibold text-foreground">
          {payment.amount} ALGO
        </span>
        <p className="text-xs text-muted-foreground">
          {new Date(payment.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  )
}
