import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const ALGOD = "https://testnet-api.algonode.cloud"

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders })

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { data: { user } } = await createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser()

    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders })

    const { data: vaults } = await supabase
      .from("escrow_vaults")
      .select("id, app_id, app_address, status, amount, vault_type")
      .eq("user_id", user.id)
      .not("app_id", "is", null)

    if (!vaults || vaults.length === 0) {
      return new Response(JSON.stringify({ issues: [], checked: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const issues: any[] = []

    for (const vault of vaults) {
      try {
        const appRes = await fetch(`${ALGOD}/v2/applications/${vault.app_id}`)
        if (!appRes.ok) {
          if (appRes.status === 404 && vault.status === "locked") {
            issues.push({ vaultId: vault.id, appId: vault.app_id, type: "DELETED_BUT_LOCKED", message: "Contract deleted on-chain but DB shows locked" })
          }
          continue
        }

        if (vault.app_address) {
          const acctRes = await fetch(`${ALGOD}/v2/accounts/${vault.app_address}`)
          if (acctRes.ok) {
            const acct = await acctRes.json()
            const onChainBalance = Number(acct.amount || 0) / 1_000_000
            if (vault.status === "locked" && onChainBalance < 0.1) {
              issues.push({ vaultId: vault.id, appId: vault.app_id, type: "LOW_BALANCE", message: `On-chain balance (${onChainBalance.toFixed(4)} ALGO) is below expected ${vault.amount} ALGO` })
            }
          }
        }

        const appData = await appRes.json()
        const stateArray = appData.params?.["global-state"] || []
        let onChainStatus = -1
        for (const item of stateArray) {
          if (atob(item.key) === "status") onChainStatus = item.value.uint
        }

        const statusMap: Record<number, string> = { 0: "locked", 1: "released", 2: "killed" }
        if (onChainStatus >= 0 && statusMap[onChainStatus] !== vault.status) {
          issues.push({ vaultId: vault.id, appId: vault.app_id, type: "STATUS_MISMATCH", message: `DB: ${vault.status}, Chain: ${statusMap[onChainStatus] || "unknown"}` })
        }
      } catch (err) {
        issues.push({ vaultId: vault.id, appId: vault.app_id, type: "CHECK_FAILED", message: (err as Error).message })
      }
    }

    return new Response(JSON.stringify({ issues, checked: vaults.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
