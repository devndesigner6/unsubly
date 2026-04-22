/**
 * On-chain subscription cancellation.
 *
 * When a user cancels a subscription, this helper:
 *   1. Updates the subscription status in Supabase to "cancelled".
 *   2. Finds any LOCKED escrow vault tied to that subscription.
 *   3. If found AND it's the user's vault, calls `kill()` on-chain so the
 *      remaining balance is refunded to the user wallet (no orphaned funds).
 *   4. Updates the vault row with status='killed' + kill txid.
 *
 * Returns a result object for UI feedback. Never throws, it surfaces
 * partial-success states (e.g., DB cancelled but on-chain kill failed) so
 * the UI can show what happened.
 */

import algosdk from "algosdk"
import { supabase } from "@/integrations/supabase/client"
import { killEscrowContract } from "./contract"

type SignFn = (txn: algosdk.Transaction) => Promise<Uint8Array[]>

export interface CancelResult {
  ok: boolean
  dbUpdated: boolean
  vaultsKilled: number
  errors: string[]
  killTxids: string[]
}

export async function cancelSubscriptionOnChain(opts: {
  subscriptionId: string
  userId: string
  walletAddress: string | null
  algodClient: algosdk.Algodv2
  signTransaction: SignFn
}): Promise<CancelResult> {
  const result: CancelResult = {
    ok: true, dbUpdated: false, vaultsKilled: 0, errors: [], killTxids: [],
  }

  // 1. Mark the subscription cancelled
  const { error: subErr } = await supabase
    .from("subscriptions")
    .update({ status: "cancelled" })
    .eq("id", opts.subscriptionId)
    .eq("user_id", opts.userId)

  if (subErr) {
    result.ok = false
    result.errors.push(`Failed to update subscription: ${subErr.message}`)
    return result
  }
  result.dbUpdated = true

  // 2. Find linked LOCKED vaults that belong to this user
  const { data: vaults, error: vErr } = await supabase
    .from("escrow_vaults")
    .select("id, app_id, user_id, status")
    .eq("subscription_id", opts.subscriptionId)
    .eq("user_id", opts.userId)
    .eq("status", "locked")

  if (vErr) {
    result.errors.push(`Vault lookup failed: ${vErr.message}`)
    return result
  }
  if (!vaults?.length) return result // nothing locked, nothing to kill

  // 3. Kill on-chain (requires connected wallet)
  if (!opts.walletAddress) {
    result.errors.push("Wallet not connected, vault left locked. Reconnect and use the Kill button on the vault page.")
    return result
  }

  for (const vault of vaults) {
    if (!vault.app_id) continue
    try {
      const txid = await killEscrowContract(
        opts.algodClient, opts.walletAddress, Number(vault.app_id), opts.signTransaction
      )
      await supabase.from("escrow_vaults")
        .update({ status: "killed", kill_switch_active: true, txn_id: txid })
        .eq("id", vault.id)
      result.vaultsKilled++
      result.killTxids.push(txid)
    } catch (err: any) {
      result.errors.push(`Kill failed for vault ${vault.id}: ${err?.message || "unknown"}`)
    }
  }

  return result
}
