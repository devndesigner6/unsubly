import { useState, useEffect, Suspense, lazy } from "react"
import { useParams } from "react-router-dom"
import { useAlgorand } from "@/lib/algorand/context"
import { shortenAddress, getLoraApplicationUrl, getLoraTransactionUrl, VAULT_TYPE_LABELS, type VaultType } from "@/lib/algorand/constants"
import { approveMultiSig } from "@/lib/algorand/contract"
import { WalletConnect } from "@/components/algorand/WalletConnect"
import { Button } from "@/components/Button"
import {
  RiShieldLine, RiLoader4Line, RiCheckLine, RiAlertLine,
  RiLockLine, RiExternalLinkLine, RiGroupLine, RiCheckboxMultipleLine,
} from "@remixicon/react"
import { toast } from "sonner"

const AlgorandProviderLazy = lazy(async () => {
  const { AlgorandProvider } = await import("@/lib/algorand/context")
  return {
    default: function Wrapper({ children }: { children: React.ReactNode }) {
      return <AlgorandProvider>{children}</AlgorandProvider>
    },
  }
})

function CoSignerInner() {
  const { vaultId } = useParams<{ vaultId: string }>()
  const { walletAddress, algodClient, peraWallet, network } = useAlgorand()
  const [vault, setVault] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [approved, setApproved] = useState(false)
  const [approving, setApproving] = useState(false)

  useEffect(() => {
    if (!vaultId) return
    async function loadVault() {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cosigner-access?vault_id=${vaultId}`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Content-Type': 'application/json',
            },
          }
        )
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Failed to load vault')
        setVault(data.vault)
        setApproved(data.vault.co_signer_approved)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load vault')
      } finally {
        setLoading(false)
      }
    }
    loadVault()
  }, [vaultId])

  const handleApprove = async () => {
    if (!walletAddress || !vault?.app_id || !vaultId) return
    if (walletAddress !== vault.co_signer_address) {
      toast.error('Connected wallet does not match the co-signer address', {
        description: `Expected: ${shortenAddress(vault.co_signer_address)} | Connected: ${shortenAddress(walletAddress)}`
      })
      return
    }
    setApproving(true)
    try {
      const signTransaction = async (txn: any): Promise<Uint8Array[]> => {
        return await peraWallet.signTransaction([[{ txn }]])
      }
      const txnId = await approveMultiSig(algodClient, walletAddress, vault.app_id, signTransaction)

      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cosigner-access?vault_id=${vaultId}`,
        {
          method: 'POST',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ txn_id: txnId, signer_address: walletAddress }),
        }
      )

      toast.success('Multi-sig approved!', {
        description: (
          <span>
            <a href={getLoraTransactionUrl(txnId, network)} target="_blank" rel="noopener noreferrer" className="underline">
              View on Lora ↗
            </a>
          </span>
        ) as any,
      })
      setApproved(true)
    } catch (err: any) {
      toast.error('Approval failed', { description: err?.message || 'Transaction failed' })
    } finally {
      setApproving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <RiLoader4Line className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !vault) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="mx-auto max-w-md text-center p-8">
          <RiAlertLine className="mx-auto size-12 text-destructive/50" />
          <h1 className="mt-4 text-xl font-bold text-foreground">Vault Not Found</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  const vType = (vault.vault_type || 'standard') as VaultType

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg p-6 pt-12">
        <div className="text-center mb-8">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <RiGroupLine className="size-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Co-Signer Approval</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You've been invited to co-sign an escrow vault on Algorand
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Vault Type</span>
            <span className="text-sm font-medium text-foreground">{VAULT_TYPE_LABELS[vType]}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Amount</span>
            <span className="text-sm font-bold text-foreground">{vault.amount} {vault.currency}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
              vault.status === 'locked' ? 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400' :
              vault.status === 'released' ? 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' :
              'text-destructive bg-destructive/10'
            }`}>
              <RiLockLine className="size-3" />
              {vault.status.charAt(0).toUpperCase() + vault.status.slice(1)}
            </span>
          </div>
          {vault.app_id && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Smart Contract</span>
              <a
                href={getLoraApplicationUrl(vault.app_id, network)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
              >
                App #{vault.app_id} <RiExternalLinkLine className="size-3" />
              </a>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Creator</span>
            <span className="font-mono text-xs text-foreground">{shortenAddress(vault.algorand_address)}</span>
          </div>
          {vault.co_signer_address && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Co-Signer</span>
              <span className="font-mono text-xs text-foreground">{shortenAddress(vault.co_signer_address)}</span>
            </div>
          )}
        </div>

        {approved ? (
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-center dark:border-green-800/40 dark:bg-green-900/20">
            <RiCheckLine className="mx-auto size-8 text-green-600 dark:text-green-400" />
            <p className="mt-2 text-sm font-medium text-green-700 dark:text-green-300">
              This vault has been approved by the co-signer
            </p>
          </div>
        ) : vault.status !== 'locked' ? (
          <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4 text-center">
            <p className="text-sm text-muted-foreground">This vault is no longer active.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {!walletAddress && (
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground mb-3 text-center">
                  Connect wallet <span className="font-mono text-xs">({shortenAddress(vault.co_signer_address)})</span> to approve
                </p>
                <WalletConnect />
              </div>
            )}
            {walletAddress && (
              <Button
                onClick={handleApprove}
                disabled={approving}
                className="w-full"
              >
                {approving ? (
                  <><RiLoader4Line className="mr-2 size-4 animate-spin" /> Approving…</>
                ) : (
                  <><RiCheckboxMultipleLine className="mr-2 size-4" /> Approve Vault</>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function CoSignerApprovalPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background">
        <RiLoader4Line className="size-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <AlgorandProviderLazy>
        <CoSignerInner />
      </AlgorandProviderLazy>
    </Suspense>
  )
}
