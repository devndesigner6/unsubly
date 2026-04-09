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

    const today = new Date().toISOString().split('T')[0]

    // Fetch active subscriptions with next_billing_date <= today
    const { data: dueSubs, error: fetchErr } = await supabase
      .from('subscriptions')
      .select('id, billing_cycle, next_billing_date')
      .eq('status', 'active')
      .lte('next_billing_date', today)

    if (fetchErr) throw fetchErr

    let advanced = 0

    for (const sub of dueSubs || []) {
      const next = new Date(sub.next_billing_date)

      switch (sub.billing_cycle) {
        case 'weekly':
          next.setDate(next.getDate() + 7)
          break
        case 'monthly':
          next.setMonth(next.getMonth() + 1)
          break
        case 'quarterly':
          next.setMonth(next.getMonth() + 3)
          break
        case 'yearly':
          next.setFullYear(next.getFullYear() + 1)
          break
      }

      // Keep advancing if still in the past
      const todayDate = new Date(today)
      while (next <= todayDate) {
        switch (sub.billing_cycle) {
          case 'weekly':
            next.setDate(next.getDate() + 7)
            break
          case 'monthly':
            next.setMonth(next.getMonth() + 1)
            break
          case 'quarterly':
            next.setMonth(next.getMonth() + 3)
            break
          case 'yearly':
            next.setFullYear(next.getFullYear() + 1)
            break
        }
      }

      const { error: updateErr } = await supabase
        .from('subscriptions')
        .update({ next_billing_date: next.toISOString().split('T')[0] })
        .eq('id', sub.id)

      if (!updateErr) advanced++
    }

    return new Response(
      JSON.stringify({ success: true, advanced, total: dueSubs?.length || 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
