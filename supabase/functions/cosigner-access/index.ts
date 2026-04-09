import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const url = new URL(req.url)
    const vaultId = url.searchParams.get('vault_id')

    if (!vaultId) {
      return new Response(
        JSON.stringify({ error: 'vault_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (req.method === 'GET') {
      // Fetch vault details for co-signer view (limited fields)
      const { data: vault, error: fetchErr } = await supabase
        .from('escrow_vaults')
        .select('id, amount, currency, status, vault_type, app_id, app_address, algorand_address, co_signer_address, co_signer_approved, created_at, unlock_time, arbitrator_address')
        .eq('id', vaultId)
        .single()

      if (fetchErr || !vault) {
        return new Response(
          JSON.stringify({ error: 'Vault not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // Only multi-sig and dispute vaults support co-signer/arbitrator access
      if (vault.vault_type !== 'multi_sig' && vault.vault_type !== 'dispute') {
        return new Response(
          JSON.stringify({ error: 'This vault type does not support co-signer access' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      return new Response(
        JSON.stringify({ vault }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (req.method === 'POST') {
      // Record co-signer approval in database
      const body = await req.json()
      const { txn_id, signer_address } = body

      if (!txn_id || !signer_address) {
        return new Response(
          JSON.stringify({ error: 'txn_id and signer_address are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // Verify vault exists and co-signer matches
      const { data: vault, error: fetchErr } = await supabase
        .from('escrow_vaults')
        .select('id, co_signer_address, user_id, subscription_id, app_id, app_address, amount')
        .eq('id', vaultId)
        .single()

      if (fetchErr || !vault) {
        return new Response(
          JSON.stringify({ error: 'Vault not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      if (vault.co_signer_address !== signer_address) {
        return new Response(
          JSON.stringify({ error: 'Wallet address does not match co-signer' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // Update vault
      await supabase
        .from('escrow_vaults')
        .update({ co_signer_approved: true, txn_id })
        .eq('id', vaultId)

      // Record payment
      await supabase
        .from('onchain_payments')
        .insert({
          user_id: vault.user_id,
          subscription_id: vault.subscription_id,
          algorand_txn_id: txn_id,
          amount: 0,
          sender_address: signer_address,
          recipient_address: vault.app_address,
          note: `Co-signer approval on App ${vault.app_id}`,
        })

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('Co-signer access error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
