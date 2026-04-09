import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get("token")
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing share token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { data: share } = await supabase
      .from("resume_shares")
      .select("user_id, is_active")
      .eq("share_token", token)
      .single()

    if (!share || !share.is_active) {
      return new Response(JSON.stringify({ error: "Invalid or inactive share link" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const [{ data: payments }, { data: profile }, { data: vaults }] = await Promise.all([
      supabase.from("onchain_payments").select("algorand_txn_id, amount, sender_address, recipient_address, note, created_at")
        .eq("user_id", share.user_id).order("created_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("name, algorand_address").eq("id", share.user_id).single(),
      supabase.from("escrow_vaults").select("amount, status, vault_type, currency, created_at, released_at")
        .eq("user_id", share.user_id).order("created_at", { ascending: false }).limit(50),
    ])

    const totalPaid = (payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0)

    return new Response(JSON.stringify({
      name: profile?.name || "Anonymous",
      walletAddress: profile?.algorand_address || null,
      totalTransactions: payments?.length || 0,
      totalPaid,
      payments: payments || [],
      vaultSummary: {
        total: vaults?.length || 0,
        locked: (vaults || []).filter((v: any) => v.status === "locked").length,
        released: (vaults || []).filter((v: any) => v.status === "released").length,
        killed: (vaults || []).filter((v: any) => v.status === "killed").length,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
