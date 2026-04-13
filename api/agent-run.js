import { createClient } from "@supabase/supabase-js";
import algosdk from "algosdk";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://ipnywrvwszqlaykbkske.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// ARC-4 method selector for release()void
// sha512_256("release()void")[0:4] = 0x07 0x6b 0xbd 0x4d
const RELEASE_SELECTOR = new Uint8Array([0x07, 0x6b, 0xbd, 0x4d]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized — no bearer token" });
  }

  const userJwt = authHeader.replace("Bearer ", "");

  // Create Supabase client authenticated as the user (respects RLS)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
    auth: { persistSession: false },
  });

  // Verify the user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    const today = new Date().toISOString().split("T")[0];

    // Step 1: Find ALL active subscriptions for this user
    const { data: activeSubs, error: subsErr } = await supabase
      .from("subscriptions")
      .select("id, name, next_billing_date")
      .eq("status", "active");

    if (subsErr) throw subsErr;

    if (!activeSubs?.length) {
      return res
        .status(200)
        .json({ success: true, message: "No active subscriptions found", released: 0, checked: 0 });
    }

    const subIds = activeSubs.map((s) => s.id);

    // Step 2: Find ALL locked vaults linked to active subscriptions.
    // A locked vault means payment is still pending — release it regardless
    // of whether the billing date appears past-due in the DB (dates may have
    // been advanced by the auto-advance routine before the vault was released).
    const { data: vaults, error: vaultErr } = await supabase
      .from("escrow_vaults")
      .select("id, app_id, subscription_id, amount, vault_type")
      .in("subscription_id", subIds)
      .eq("status", "locked");

    if (vaultErr) throw vaultErr;

    // Determine which subs are actually due (for reporting purposes)
    const dueSubs = activeSubs.filter((s) => s.next_billing_date <= today);

    if (!vaults?.length) {
      return res.status(200).json({
        success: true,
        message: dueSubs.length
          ? "Subscriptions are due but no locked vaults found to release"
          : "No locked vaults to release",
        released: 0,
        checked: activeSubs.length,
      });
    }

    // Step 3: Set up agent wallet for on-chain signing
    const mnemonic = process.env.AGENT_WALLET_MNEMONIC;
    let agentAccount = null;
    let algodClient = null;
    let agentMode = "db-only";

    if (mnemonic && mnemonic.trim() !== "" && mnemonic !== "skip") {
      try {
        agentAccount = algosdk.mnemonicToSecretKey(mnemonic.trim());
        algodClient = new algosdk.Algodv2(
          "",
          "https://testnet-api.algonode.cloud",
          ""
        );
        agentMode = "on-chain";
      } catch (keyErr) {
        agentMode = "db-only";
      }
    }

    const results = {
      checked: activeSubs.length,
      released: 0,
      skipped: 0,
      errors: [],
      actions: [],
      agent_mode: agentMode,
    };

    // Step 4: Process each vault
    for (const vault of vaults) {
      const sub = activeSubs.find((s) => s.id === vault.subscription_id);
      const subName = sub?.name ?? "Unknown";
      let txid = null;
      let mode = "db-only";

      try {
        // Attempt on-chain release — only for "agent" vault type (AgentEscrowVault TEAL).
        // Standard EscrowVault requires creator signature; agent cannot call release() on it.
        const isAgentVault = vault.vault_type === "agent";
        if (algodClient && agentAccount && vault.app_id && isAgentVault) {
          try {
            const params = await algodClient.getTransactionParams().do();
            const txn = algosdk.makeApplicationCallTxnFromObject({
              sender: agentAccount.addr,
              suggestedParams: { ...params, fee: 2000, flatFee: true },
              appIndex: Number(vault.app_id),
              onComplete: algosdk.OnApplicationComplete.NoOpOC,
              appArgs: [RELEASE_SELECTOR],
            });
            const signed = txn.signTxn(agentAccount.sk);
            const sendRes = await algodClient.sendRawTransaction(signed).do();
            txid = sendRes.txId ?? sendRes.txid ?? "";
            await algosdk.waitForConfirmation(algodClient, txid, 4);
            mode = "on-chain";
          } catch (onChainErr) {
            results.errors.push(
              `Vault ${vault.id} on-chain release failed: ${onChainErr.message}`
            );
            mode = "db-only";
          }
        } else if (algodClient && agentAccount && vault.app_id && !isAgentVault) {
          // Not an agent vault — agent cannot sign release() for this contract type.
          // DB-only update will proceed below.
          results.errors.push(
            `Vault ${vault.id} skipped on-chain: vault type "${vault.vault_type}" requires creator signature — only AgentEscrowVault supports autonomous agent release.`
          );
        }

        // Update vault status in database (include txn_id when released on-chain)
        await supabase
          .from("escrow_vaults")
          .update({
            status: "released",
            released_at: new Date().toISOString(),
            ...(txid ? { txn_id: txid } : {}),
          })
          .eq("id", vault.id);

        // Log the autonomous action in agent_actions
        await supabase.from("agent_actions").insert({
          action_type: "auto_release",
          vault_id: vault.id,
          subscription_id: vault.subscription_id,
          user_id: user.id,
          payload: {
            subscription_name: subName,
            amount: vault.amount,
            mode,
            txid,
            agent_address: agentAccount?.addr ?? null,
            released_at: new Date().toISOString(),
          },
          txid,
          status: "success",
        });

        results.released++;
        results.actions.push({ vault_id: vault.id, sub_name: subName, mode, txid });
      } catch (err) {
        results.errors.push(`Vault ${vault.id}: ${err.message}`);
        results.skipped++;

        // Log the failure too
        try {
          await supabase.from("agent_actions").insert({
            action_type: "auto_release",
            vault_id: vault.id,
            subscription_id: vault.subscription_id,
            user_id: user.id,
            payload: { error: err.message, vault_id: vault.id, mode: "error" },
            txid: null,
            status: "error",
          });
        } catch {
          // swallow log error
        }
      }
    }

    return res.status(200).json({ success: true, ...results });
  } catch (err) {
    return res.status(500).json({ error: err?.message ?? "Agent run failed" });
  }
}
