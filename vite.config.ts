import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_SUPABASE_URL || "https://ipnywrvwszqlaykbkske.supabase.co";
  const backendPublishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlwbnl3cnZ3c3pxbGF5a2Jrc2tlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTg0NDksImV4cCI6MjA4ODQ3NDQ0OX0.xUcUpKQ52PVFGAjKokKDwhf9p8RZYmEOgMmu7HAm-sk";

  // ── Dev API middleware helpers ────────────────────────────────────────────

  /** Read the full request body as a string */
  function readBody(req: any): Promise<string> {
    return new Promise((resolve) => {
      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      req.on("end", () => resolve(body));
    });
  }

  /** Send a JSON response */
  function jsonRes(res: any, status: number, data: unknown) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data));
  }

  return {
    server: {
      host: "0.0.0.0",
      port: 5000,
      allowedHosts: true,
    },
    plugins: [
      react(),
      {
        name: "dev-api-routes",
        configureServer(server) {

          // ── /api/ai-optimizer ────────────────────────────────────────────
          server.middlewares.use("/api/ai-optimizer", async (req: any, res: any) => {
            if (req.method !== "POST") { jsonRes(res, 405, { error: "Method Not Allowed" }); return; }

            const GROQ_API_KEY = process.env.GROQ_API_KEY;
            if (!GROQ_API_KEY) { jsonRes(res, 500, { error: "AI service not configured on server" }); return; }

            try {
              const body = await readBody(req);
              const {
                subscriptions = [],
                vaults = [],
                userCurrency = "USD",
                totalMonthly = 0,
                totalVaultLocked = 0,
              } = JSON.parse(body || "{}");

              const activeSubs = subscriptions.filter((s: any) => s.status === "active");

              const systemPrompt = `You are an AI financial advisor specializing in subscription management and Algorand blockchain escrow vaults.

CRITICAL: You must respond with ONLY valid JSON. No markdown, no prose, no explanation outside the JSON.

Return exactly this structure:
{
  "spending": {
    "summary": "one sentence summary of total spend",
    "topCategory": "highest spend category name",
    "monthlyTotal": number,
    "annualTotal": number,
    "breakdown": [
      { "name": "subscription name", "monthly": number, "category": "category", "risk": "low|medium|high" }
    ]
  },
  "savings": [
    { "title": "short title", "description": "specific actionable recommendation", "saving": "e.g. $19/mo", "priority": "high|medium|low" }
  ],
  "vaultStrategy": [
    { "subscription": "name", "recommended": "standard|time-locked|multi-sig|dispute|asa", "reason": "one sentence why" }
  ],
  "riskScore": number between 0 and 100,
  "riskLabel": "Low|Medium|High",
  "topAction": "single most important thing to do right now"
}`;

              const userPrompt = `Portfolio data:
Monthly: ${Number(totalMonthly).toFixed(2)} ${userCurrency}
Annual: ${(Number(totalMonthly) * 12).toFixed(2)} ${userCurrency}
Active subscriptions: ${activeSubs.length}
Locked ALGO: ${Number(totalVaultLocked).toFixed(4)}

Subscriptions: ${JSON.stringify(activeSubs.map((s: any) => ({ name: s.name, amount: s.amount, currency: s.currency, cycle: s.billing_cycle, category: s.category })))}
Vaults: ${JSON.stringify(vaults.map((v: any) => ({ type: v.vault_type, amount: v.amount, status: v.status })))}

Respond with ONLY the JSON structure specified.`;

              const groqPayload = {
                model: "llama-3.3-70b-versatile",
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userPrompt },
                ],
                temperature: 0.3,
                max_tokens: 1200,
                response_format: { type: "json_object" },
              };
              const callGroq = () => fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify(groqPayload),
              });

              let aiRes = await callGroq();
              if (aiRes.status === 429) {
                await new Promise((r) => setTimeout(r, 8000));
                aiRes = await callGroq();
              }

              if (!aiRes.ok) {
                const errText = await aiRes.text();
                console.error("[ai-optimizer] Groq error:", aiRes.status, errText);
                if (aiRes.status === 401) throw new Error("AI service key is invalid — update GROQ_API_KEY.");
                if (aiRes.status === 429) throw new Error("AI rate limit reached — please wait 30 seconds before running again.");
                throw new Error(`AI service error ${aiRes.status}`);
              }

              const aiData = await aiRes.json() as any;
              const raw = aiData.choices?.[0]?.message?.content || "{}";
              let parsed: unknown;
              try { parsed = JSON.parse(raw); } catch {
                const match = raw.match(/\{[\s\S]*\}/);
                parsed = match ? JSON.parse(match[0]) : {};
              }

              jsonRes(res, 200, { analysis: parsed });
            } catch (err: any) {
              console.error("[ai-optimizer] error:", err);
              jsonRes(res, 500, { error: err?.message || "Analysis failed" });
            }
          });

          // ── /api/agent-run ───────────────────────────────────────────────
          server.middlewares.use("/api/agent-run", async (req: any, res: any) => {
            if (req.method !== "POST") { jsonRes(res, 405, { error: "Method Not Allowed" }); return; }

            const authHeader = req.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) { jsonRes(res, 401, { error: "Unauthorized" }); return; }

            try {
              // Dynamically import Supabase and algosdk in Node context
              const { createClient } = await import("@supabase/supabase-js");
              const algosdk = (await import("algosdk")).default;

              const SUPABASE_URL = process.env.VITE_SUPABASE_URL || backendUrl;
              const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || backendPublishableKey;
              const userJwt = authHeader.replace("Bearer ", "");

              const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
                global: { headers: { Authorization: `Bearer ${userJwt}` } },
                auth: { persistSession: false },
              });

              const { data: { user }, error: userError } = await supabase.auth.getUser();
              if (userError || !user) { jsonRes(res, 401, { error: "Invalid or expired token" }); return; }

              const today = new Date().toISOString().split("T")[0];
              const { data: activeSubs } = await supabase.from("subscriptions").select("id, name, next_billing_date").eq("status", "active");
              if (!activeSubs?.length) { jsonRes(res, 200, { success: true, message: "No active subscriptions", released: 0, checked: 0 }); return; }

              const subIds = activeSubs.map((s: any) => s.id);
              const { data: vaults } = await supabase.from("escrow_vaults").select("id, app_id, subscription_id, amount, vault_type").in("subscription_id", subIds).eq("status", "locked");
              if (!vaults?.length) { jsonRes(res, 200, { success: true, message: "No locked vaults", released: 0, checked: activeSubs.length }); return; }

              const mnemonic = process.env.AGENT_WALLET_MNEMONIC;
              let agentAccount: any = null;
              let algodClient: any = null;
              let agentMode = "db-only";

              if (mnemonic && mnemonic.trim() !== "" && mnemonic !== "skip") {
                try {
                  agentAccount = algosdk.mnemonicToSecretKey(mnemonic.trim());
                  algodClient = new algosdk.Algodv2("", "https://testnet-api.algonode.cloud", "");
                  agentMode = "on-chain";
                } catch { agentMode = "db-only"; }
              }

              const RELEASE_SELECTOR = new Uint8Array([0x07, 0x6b, 0xbd, 0x4d]);
              const results = { checked: activeSubs.length, released: 0, skipped: 0, errors: [] as string[], actions: [] as any[], agent_mode: agentMode };

              for (const vault of (vaults as any[])) {
                const sub = activeSubs.find((s: any) => s.id === vault.subscription_id);
                const subName = (sub as any)?.name ?? "Unknown";
                let txid: string | null = null;
                let mode = "db-only";

                try {
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
                    } catch (onChainErr: any) {
                      results.errors.push(`Vault ${vault.id} on-chain failed: ${onChainErr.message}`);
                    }
                  } else if (algodClient && agentAccount && vault.app_id && !isAgentVault) {
                    results.errors.push(`Vault ${vault.id} skipped: type "${vault.vault_type}" requires creator signature`);
                  }

                  // Only update vault status when a real on-chain tx confirmed
                  if (mode === "on-chain" && txid) {
                    await supabase.from("escrow_vaults").update({ status: "released", released_at: new Date().toISOString(), txn_id: txid }).eq("id", vault.id);
                  }

                  await supabase.from("agent_actions").insert({
                    action_type: "auto_release", vault_id: vault.id, subscription_id: vault.subscription_id, user_id: user.id,
                    payload: {
                      subscription_name: subName, amount: vault.amount, mode, txid,
                      agent_address: agentAccount?.addr ?? null,
                      released_at: new Date().toISOString(),
                      note: mode === "db-only"
                        ? "Simulation only — vault stays locked on-chain. Configure AGENT_WALLET_MNEMONIC for real releases."
                        : "On-chain release confirmed.",
                    },
                    txid, status: mode === "on-chain" ? "success" : "simulation",
                  });

                  results.released++;
                  results.actions.push({ vault_id: vault.id, sub_name: subName, mode, txid });
                } catch (err: any) {
                  results.errors.push(`Vault ${vault.id}: ${err.message}`);
                  results.skipped++;
                }
              }

              jsonRes(res, 200, { success: true, ...results });
            } catch (err: any) {
              console.error("[agent-run] error:", err);
              jsonRes(res, 500, { error: err?.message ?? "Agent run failed" });
            }
          });

          // ── /api/advance-billing ─────────────────────────────────────────
          server.middlewares.use("/api/advance-billing", async (req: any, res: any) => {
            if (req.method !== "POST") { jsonRes(res, 405, { error: "Method Not Allowed" }); return; }

            const authHeader = req.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) { jsonRes(res, 401, { error: "Unauthorized" }); return; }

            try {
              const { createClient } = await import("@supabase/supabase-js");
              const SUPABASE_URL = process.env.VITE_SUPABASE_URL || backendUrl;
              const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || backendPublishableKey;
              const userJwt = authHeader.replace("Bearer ", "");

              const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
                global: { headers: { Authorization: `Bearer ${userJwt}` } },
                auth: { persistSession: false },
              });

              const { data: { user }, error: userError } = await supabase.auth.getUser();
              if (userError || !user) { jsonRes(res, 401, { error: "Invalid or expired token" }); return; }

              const today = new Date().toISOString().split("T")[0];
              const { data: subs } = await supabase.from("subscriptions").select("id, next_billing_date, billing_cycle").eq("status", "active").lte("next_billing_date", today);
              if (!subs?.length) { jsonRes(res, 200, { success: true, advanced: 0 }); return; }

              // Skip subs that have locked vaults (don't advance locked vault billing dates)
              const { data: lockedVaults } = await supabase.from("escrow_vaults").select("subscription_id").eq("status", "locked").in("subscription_id", (subs as any[]).map((s: any) => s.id));
              const lockedSubIds = new Set((lockedVaults as any[] ?? []).map((v: any) => v.subscription_id));

              let advanced = 0;
              for (const sub of (subs as any[])) {
                if (lockedSubIds.has(sub.id)) continue;
                const next = new Date(sub.next_billing_date);
                switch (sub.billing_cycle) {
                  case "weekly":    next.setDate(next.getDate() + 7); break;
                  case "monthly":   next.setMonth(next.getMonth() + 1); break;
                  case "quarterly": next.setMonth(next.getMonth() + 3); break;
                  case "yearly":    next.setFullYear(next.getFullYear() + 1); break;
                  default:          next.setMonth(next.getMonth() + 1);
                }
                await supabase.from("subscriptions").update({ next_billing_date: next.toISOString().split("T")[0] }).eq("id", sub.id);
                advanced++;
              }

              jsonRes(res, 200, { success: true, advanced });
            } catch (err: any) {
              console.error("[advance-billing] error:", err);
              jsonRes(res, 500, { error: err?.message ?? "Advance billing failed" });
            }
          });

        },
      },
    ],
    define: {
      global: "globalThis",
      "process.env": {},
      "process.browser": true,
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(backendUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(backendPublishableKey),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        buffer: "buffer/",
      },
    },
    optimizeDeps: {
      include: ["buffer", "@perawallet/connect"],
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
      },
    },
  };
});
