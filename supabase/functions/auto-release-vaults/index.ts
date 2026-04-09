/**
 * auto-release-vaults — Agentic Commerce Edge Function
 *
 * This is the autonomous AI agent that qualifies Unsubscribely for the
 * Agentic Commerce #3 (A2A Autonomous Payments) track at AlgoBharat Hack Series 3.0.
 *
 * How it works (triggered daily via pg_cron at 00:05 UTC):
 *  1. Finds subscriptions where next_billing_date <= today AND status = 'active'
 *  2. For each, finds linked standard escrow vaults with status = 'locked'
 *  3. Calls EscrowVault.release() on-chain using the AGENT_WALLET_MNEMONIC
 *     — the AgentEscrowVault contract authorises both creator AND agent to release
 *  4. Updates vault status to 'released' in the database
 *  5. Logs every action in agent_actions table (full audit trail)
 *
 * The agent wallet address must match the 'agent' field embedded in each vault
 * at creation time (stored via VITE_AGENT_WALLET_ADDRESS during vault deployment).
 *
 * Environment secrets required in Supabase dashboard:
 *   AGENT_WALLET_MNEMONIC — 25-word Algorand mnemonic of the agent wallet
 *   SUPABASE_URL          — auto-provided by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — auto-provided by Supabase
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import algosdk from "https://esm.sh/algosdk@2.7.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// ARC-4 method selector for release()void
// sha512_256("release()void")[0:4] = 0x07 0x6b 0xbd 0x4d
const RELEASE_SELECTOR = new Uint8Array([0x07, 0x6b, 0xbd, 0x4d])

async function releaseVaultOnChain(
  algodClient: algosdk.Algodv2,
  agentAccount: algosdk.Account,
  appId: number,
): Promise<string> {
  const params = await algodClient.getTransactionParams().do()

  // fee=2000 covers outer txn (1000) + inner payment txn (1000)
  const appCallTxn = algosdk.makeApplicationCallTxnFromObject({
    sender: agentAccount.addr,
    suggestedParams: { ...params, fee: 2000, flatFee: true },
    appIndex: appId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [RELEASE_SELECTOR],
  })

  const signedTxn = appCallTxn.signTxn(agentAccount.sk)
  const sendResponse = await algodClient.sendRawTransaction(signedTxn).do()
  const txid: string = (sendResponse as any).txId ?? (sendResponse as any).txid ?? ""
  await algosdk.waitForConfirmation(algodClient, txid, 4)
  return txid
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  const results = {
    checked: 0,
    released: 0,
    skipped: 0,
    errors: [] as string[],
    actions: [] as object[],
    agent_mode: "unconfigured",
  }

  try {
    const today = new Date().toISOString().split("T")[0]

    // Step 1: Find active subscriptions with billing due today or overdue
    const { data: dueSubs, error: subsErr } = await supabase
      .from("subscriptions")
      .select("id, name, user_id, next_billing_date")
      .eq("status", "active")
      .lte("next_billing_date", today)

    if (subsErr) throw subsErr
    results.checked = dueSubs?.length ?? 0

    if (!dueSubs || dueSubs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No subscriptions due today", ...results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const subIds = dueSubs.map((s) => s.id)

    // Step 2: Find locked standard vaults linked to due subscriptions
    const { data: vaults, error: vaultErr } = await supabase
      .from("escrow_vaults")
      .select("id, app_id, app_address, subscription_id, user_id, amount, agent_address")
      .in("subscription_id", subIds)
      .eq("status", "locked")
      .eq("vault_type", "standard")

    if (vaultErr) throw vaultErr

    if (!vaults || vaults.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No locked standard vaults to release", ...results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    // Step 3: Set up agent wallet
    const agentMnemonic = Deno.env.get("AGENT_WALLET_MNEMONIC")
    const algodUrl = Deno.env.get("ALGOD_URL") || "https://testnet-api.algonode.cloud"
    const algodToken = Deno.env.get("ALGOD_TOKEN") || ""

    let agentAccount: algosdk.Account | null = null
    let algodClient: algosdk.Algodv2 | null = null

    if (agentMnemonic) {
      try {
        agentAccount = algosdk.mnemonicToSecretKey(agentMnemonic)
        algodClient = new algosdk.Algodv2(algodToken, algodUrl, "")
        results.agent_mode = "on-chain"
      } catch (keyErr: any) {
        results.errors.push(`Agent wallet setup failed: ${keyErr.message}`)
        results.agent_mode = "db-only"
      }
    } else {
      results.agent_mode = "db-only"
    }

    // Step 4: Process each vault
    for (const vault of vaults) {
      const sub = dueSubs.find((s) => s.id === vault.subscription_id)
      const subName = sub?.name ?? "Unknown"

      try {
        let txid: string | null = null
        let mode = "db-only"

        if (algodClient && agentAccount && vault.app_id) {
          try {
            txid = await releaseVaultOnChain(algodClient, agentAccount, Number(vault.app_id))
            mode = "on-chain"
          } catch (onChainErr: any) {
            results.errors.push(`Vault ${vault.id} on-chain release failed: ${onChainErr.message}`)
            mode = "db-only"
          }
        }

        // Update vault status in database
        await supabase
          .from("escrow_vaults")
          .update({
            status: "released",
            released_at: new Date().toISOString(),
          } as any)
          .eq("id", vault.id)
          .throwOnError()

        // Log the autonomous action in agent_actions
        const actionPayload = {
          vault_id: vault.id,
          subscription_id: vault.subscription_id,
          subscription_name: subName,
          user_id: vault.user_id,
          amount: vault.amount,
          agent_address: agentAccount?.addr ?? null,
          txid,
          mode,
          released_at: new Date().toISOString(),
        }

        await supabase.from("agent_actions").insert({
          action_type: "auto_release",
          vault_id: vault.id,
          subscription_id: vault.subscription_id,
          user_id: vault.user_id,
          payload: actionPayload,
          txid,
          status: "success",
        } as any).throwOnError()

        results.released++
        results.actions.push(actionPayload)
      } catch (err: any) {
        results.errors.push(`Vault ${vault.id}: ${err.message}`)
        results.skipped++

        // Log the failure
        try {
          await supabase.from("agent_actions").insert({
            action_type: "auto_release",
            vault_id: vault.id,
            subscription_id: vault.subscription_id,
            user_id: vault.user_id,
            payload: { error: err.message, vault_id: vault.id },
            txid: null,
            status: "error",
          } as any)
        } catch {
          // Swallow log error
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message, ...results }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
