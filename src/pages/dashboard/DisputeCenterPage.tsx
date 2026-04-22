import { useEffect, useState } from "react"
import {
  RiScalesLine, RiFlagLine, RiExternalLinkLine, RiLoader4Line,
  RiSendPlaneLine, RiCheckLine, RiCloseLine,
} from "@remixicon/react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { useAlgorand } from "@/lib/algorand/context"
import { Button } from "@/components/Button"
import { shortenAddress, getAddressExplorerUrl } from "@/lib/algorand/constants"
import { releaseEscrowFunds, killEscrowContract } from "@/lib/algorand/contract"

interface VaultRow {
  id: string
  app_id: number | null
  app_address: string | null
  vault_type: string
  amount: number | null
  escrow_address: string | null
  arbitrator_address: string | null
  status: string | null
  kill_switch_active: boolean | null
  created_at: string
}

const KEY_PREFIX = "ub:disputes:"

interface DisputeRecord {
  vaultId: string
  filed_at: string
  reason: string
  status: "open" | "resolved-released" | "resolved-killed"
  resolved_at?: string
  resolution_txid?: string
}

function loadDisputes(userId: string): DisputeRecord[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + userId)
    return raw ? (JSON.parse(raw) as DisputeRecord[]) : []
  } catch { return [] }
}
function saveDisputes(userId: string, list: DisputeRecord[]) {
  try { window.localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(list)) } catch { /* noop */ }
}

export default function DisputeCenterPage() {
  const { user } = useAuth()
  const { walletAddress, algodClient, peraWallet } = useAlgorand()
  const [vaults, setVaults] = useState<VaultRow[]>([])
  const [loading, setLoading] = useState(true)
  const [disputes, setDisputes] = useState<DisputeRecord[]>([])
  const [filingFor, setFilingFor] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const signTransaction = async (txn: any): Promise<Uint8Array[]> => {
    return await peraWallet.signTransaction([[{ txn }]])
  }

  useEffect(() => {
    if (!user) return
    setDisputes(loadDisputes(user.id))
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function load() {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("escrow_vaults")
        .select("*")
        .eq("user_id", user.id)
        .eq("vault_type", "dispute")
        .order("created_at", { ascending: false })
      if (error) throw error
      setVaults((data ?? []) as unknown as VaultRow[])
    } catch (err: any) {
      toast.error("Failed to load dispute vaults", { description: err?.message || String(err) })
    } finally {
      setLoading(false)
    }
  }

  const fileDispute = (v: VaultRow) => {
    if (!user) return
    if (!reason.trim()) return toast.error("Add a short reason for the dispute")
    const next: DisputeRecord = {
      vaultId: v.id,
      filed_at: new Date().toISOString(),
      reason: reason.trim(),
      status: "open",
    }
    const list = [...disputes.filter((d) => d.vaultId !== v.id), next]
    setDisputes(list); saveDisputes(user.id, list)
    setFilingFor(null); setReason("")
    toast.success("Dispute filed", { description: "The arbitrator can now release or refund." })
  }

  const closeDispute = async (
    v: VaultRow,
    status: "resolved-released" | "resolved-killed",
  ) => {
    if (!user || !walletAddress || !v.app_id) return
    if (walletAddress !== v.arbitrator_address) {
      toast.error("Connect the arbitrator wallet to resolve this dispute")
      return
    }
    setResolvingId(v.id)
    try {
      const txnId = status === "resolved-released"
        ? await releaseEscrowFunds(algodClient, walletAddress, v.app_id, signTransaction)
        : await killEscrowContract(algodClient, walletAddress, v.app_id, signTransaction)

      // Persist new on-chain state to the vault row.
      const updates: Record<string, any> = {
        txn_id: txnId,
        released_at: new Date().toISOString(),
        status: status === "resolved-released" ? "released" : "killed",
      }
      if (status === "resolved-killed") updates.kill_switch_active = true
      const { error: upErr } = await supabase.from("escrow_vaults" as any).update(updates as any).eq("id", v.id)
      if (upErr) toast.warning("Resolved on-chain but DB update failed", { description: upErr.message })

      // Update local dispute log with the resolution txid.
      const list = disputes.map((d) => d.vaultId === v.id
        ? { ...d, status, resolved_at: new Date().toISOString(), resolution_txid: txnId }
        : d)
      setDisputes(list); saveDisputes(user.id, list)

      toast.success("Dispute resolved on-chain", {
        description: status === "resolved-released" ? "Funds released to merchant." : "Funds refunded to user.",
      })
      void load()
    } catch (err: any) {
      toast.error("Resolution failed", { description: err?.message || String(err) })
    } finally {
      setResolvingId(null)
    }
  }

  const findDispute = (vaultId: string) => disputes.find((d) => d.vaultId === vaultId)

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <RiScalesLine className="size-5 text-gray-700 dark:text-gray-300" />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Dispute Center
          </h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          When a service fails to deliver, file a dispute on the linked dispute escrow.
          The named arbitrator (set when the vault was created) can then release the funds
          to the merchant or refund them to you on-chain.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <RiLoader4Line className="mr-2 size-4 animate-spin" /> Loading…
        </div>
      ) : vaults.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 px-6 py-12 text-center text-sm text-gray-500 dark:border-gray-700">
          You have no dispute escrow vaults yet. Create one from the Escrow Vaults page
          when setting up a high-stakes subscription.
        </div>
      ) : (
        <ul className="space-y-3">
          {vaults.map((v) => {
            const d = findDispute(v.id)
            return (
              <li key={v.id} className="space-y-3 rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {v.amount != null ? v.amount : "?"} ALGO
                      </span>
                      {v.status === "killed" && <span className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] uppercase text-gray-600 dark:border-gray-700 dark:text-gray-400">killed</span>}
                      {v.status === "released" && <span className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] uppercase text-gray-600 dark:border-gray-700 dark:text-gray-400">released</span>}
                      {d && (
                        <span className={[
                          "rounded border px-1.5 py-0.5 text-[10px] uppercase",
                          d.status === "open"
                            ? "border-amber-300 text-amber-700 dark:border-amber-900/50 dark:text-amber-300"
                            : "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-400",
                        ].join(" ")}>
                          {d.status === "open" ? "dispute open" : "dispute resolved"}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs text-gray-500 sm:grid-cols-2">
                      <div>App: <code className="font-mono text-gray-700 dark:text-gray-300">{v.app_id ?? ","}</code></div>
                      <div>Recipient: {v.escrow_address ? (
                        <a className="font-mono underline-offset-2 hover:underline" target="_blank" rel="noopener noreferrer"
                           href={getAddressExplorerUrl(v.escrow_address)}>
                          {shortenAddress(v.escrow_address)}
                        </a>
                      ) : ","}</div>
                      <div>Arbitrator: {v.arbitrator_address ? (
                        <a className="font-mono underline-offset-2 hover:underline" target="_blank" rel="noopener noreferrer"
                           href={getAddressExplorerUrl(v.arbitrator_address)}>
                          {shortenAddress(v.arbitrator_address)}
                        </a>
                      ) : ","}</div>
                      <div>Created: {new Date(v.created_at).toLocaleDateString()}</div>
                    </div>
                    {d && (
                      <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-2 text-xs dark:border-gray-800 dark:bg-gray-900">
                        <div className="text-gray-500">
                          Filed {new Date(d.filed_at).toLocaleString()}
                          {d.resolved_at && <> · resolved {new Date(d.resolved_at).toLocaleString()}</>}
                        </div>
                        <div className="mt-1 whitespace-pre-line text-gray-800 dark:text-gray-200">{d.reason}</div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {!d || d.status === "open" ? (
                      <>
                        {!d && (
                          <Button
                            variant="secondary"
                            onClick={() => { setFilingFor(v.id); setReason("") }}
                            title="File a dispute on this vault"
                          >
                            <RiFlagLine className="mr-2 size-4" /> File dispute
                          </Button>
                        )}
                        {d?.status === "open" && walletAddress === v.arbitrator_address && (
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => closeDispute(v, "resolved-released")}
                              disabled={resolvingId === v.id}
                              title="Sign an on-chain release sending funds to the merchant"
                            >
                              <RiCheckLine className="mr-2 size-4" />
                              {resolvingId === v.id ? "Signing…" : "Release to merchant"}
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => closeDispute(v, "resolved-killed")}
                              disabled={resolvingId === v.id}
                              title="Sign an on-chain kill refunding funds to the user"
                            >
                              <RiCloseLine className="mr-2 size-4" />
                              {resolvingId === v.id ? "Signing…" : "Refund to user"}
                            </Button>
                          </div>
                        )}
                      </>
                    ) : null}
                    {v.app_id && (
                      <a
                        href={`https://lora.algokit.io/testnet/application/${v.app_id}`}
                        target="_blank" rel="noopener noreferrer"
                        title="View vault on explorer"
                        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                      >
                        Explorer <RiExternalLinkLine className="size-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                {filingFor === v.id && (
                  <div className="space-y-2 rounded border border-gray-200 p-3 dark:border-gray-800">
                    <label className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
                      Reason for dispute
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      placeholder="e.g. The service was not delivered as agreed; account suspended without notice."
                      className="w-full rounded border border-gray-300 bg-white p-2 text-sm focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:focus:border-gray-100"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => { setFilingFor(null); setReason("") }}>Cancel</Button>
                      <Button variant="primary" onClick={() => fileDispute(v)} disabled={!reason.trim()}>
                        <RiSendPlaneLine className="mr-2 size-4" /> File
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
