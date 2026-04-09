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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('name, amount, currency, billing_cycle, status, next_billing_date, category')
      .eq('user_id', user.id)

    const { data: vaults } = await supabase
      .from('escrow_vaults')
      .select('amount, currency, status, vault_type, created_at, unlock_time')
      .eq('user_id', user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('currency')
      .eq('id', user.id)
      .single()

    const userCurrency = profile?.currency || 'USD'

    const portfolioSummary = {
      subscriptions: (subscriptions || []).map(s => ({
        name: s.name,
        amount: s.amount,
        currency: s.currency || userCurrency,
        cycle: s.billing_cycle,
        status: s.status,
        nextBilling: s.next_billing_date,
        category: s.category,
      })),
      vaults: (vaults || []).map(v => ({
        amount: v.amount,
        currency: v.currency,
        status: v.status,
        type: v.vault_type,
        unlockTime: v.unlock_time,
      })),
      userCurrency,
    }

    const totalMonthly = (subscriptions || [])
      .filter(s => s.status === 'active')
      .reduce((sum, s) => {
        const amt = Number(s.amount)
        switch (s.billing_cycle) {
          case 'weekly': return sum + amt * 4.33
          case 'monthly': return sum + amt
          case 'quarterly': return sum + amt / 3
          case 'yearly': return sum + amt / 12
          default: return sum + amt
        }
      }, 0)

    const totalVaultLocked = (vaults || [])
      .filter(v => v.status === 'locked')
      .reduce((sum, v) => sum + Number(v.amount), 0)

    const systemPrompt = `You are an AI financial advisor specializing in subscription management and blockchain escrow vaults on Algorand. You analyze user portfolios and provide actionable recommendations.

Your capabilities:
- Identify duplicate or overlapping subscriptions
- Suggest cheaper alternatives or bundle opportunities
- Analyze spending trends and flag unusual patterns
- Recommend optimal vault strategies (time-locked for long-term, multi-sig for shared subscriptions, dispute vaults for uncertain vendors)
- Calculate potential savings
- Assess financial risk exposure from subscription commitments

Guidelines:
- Be specific with numbers and percentages
- Reference actual subscription names from the user's portfolio
- Suggest concrete vault strategies tied to their subscriptions
- Keep recommendations actionable and prioritized
- Format with bullet points and sections
- Always mention total monthly spend and potential savings`

    const userPrompt = `Analyze this subscription portfolio and provide optimization recommendations:

**Portfolio Summary:**
- Total Monthly Spend: ${totalMonthly.toFixed(2)} ${userCurrency}
- Annual Projected: ${(totalMonthly * 12).toFixed(2)} ${userCurrency}
- Active Subscriptions: ${(subscriptions || []).filter(s => s.status === 'active').length}
- Escrow Vaults: ${(vaults || []).length} (${totalVaultLocked.toFixed(4)} ALGO locked)

**Subscriptions:**
${JSON.stringify(portfolioSummary.subscriptions, null, 2)}

**Escrow Vaults:**
${JSON.stringify(portfolioSummary.vaults, null, 2)}

Please provide:
1. **Spending Analysis** - breakdown and trends
2. **Cost Optimization** - specific savings opportunities  
3. **Vault Strategy** - which subscriptions should use which vault type and why
4. **Risk Assessment** - financial exposure and mitigation
5. **Action Items** - prioritized next steps`

    const aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    })

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const errText = await aiResponse.text()
      console.error('Groq API error:', aiResponse.status, errText)
      throw new Error(`Groq API returned ${aiResponse.status}`)
    }

    const aiData = await aiResponse.json()
    const analysis = aiData.choices?.[0]?.message?.content || 'Unable to generate analysis.'

    return new Response(
      JSON.stringify({
        analysis,
        portfolio: {
          totalMonthly: totalMonthly.toFixed(2),
          annualProjected: (totalMonthly * 12).toFixed(2),
          activeSubscriptions: (subscriptions || []).filter(s => s.status === 'active').length,
          totalVaults: (vaults || []).length,
          lockedAlgo: totalVaultLocked.toFixed(4),
          currency: userCurrency,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('AI optimizer error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
