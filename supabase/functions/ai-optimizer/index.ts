import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get("authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Fetch user's subscriptions
    const { data: subscriptions } = await supabase
      .from("subscriptions")
      .select("name, amount, billing_cycle, category, status, currency, start_date, next_billing_date")
      .eq("user_id", user.id)

    // Fetch user's profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("currency")
      .eq("id", user.id)
      .single()

    // Fetch vault data
    const { data: vaults } = await supabase
      .from("escrow_vaults")
      .select("amount, status, vault_type, currency")
      .eq("user_id", user.id)

    const currency = profile?.currency || "USD"

    // Build context for AI analysis
    const subsSummary = (subscriptions || []).map(s => {
      let monthly = s.amount
      if (s.billing_cycle === "yearly") monthly = s.amount / 12
      else if (s.billing_cycle === "quarterly") monthly = s.amount / 3
      else if (s.billing_cycle === "weekly") monthly = s.amount * 4.33
      return { ...s, monthly_cost: Math.round(monthly * 100) / 100 }
    })

    const totalMonthly = subsSummary.reduce((sum, s) => sum + s.monthly_cost, 0)
    const activeCount = subsSummary.filter(s => s.status === "active").length
    const vaultTotal = (vaults || []).filter(v => v.status === "locked").reduce((sum, v) => sum + Number(v.amount), 0)

    const prompt = `You are a financial AI agent specializing in subscription optimization and blockchain-based payment strategies. Analyze the following subscription portfolio and provide actionable insights.

USER PORTFOLIO:
- Currency: ${currency}
- Total Monthly Spend: ${totalMonthly.toFixed(2)} ${currency}
- Active Subscriptions: ${activeCount}
- Total Subscriptions: ${subsSummary.length}
- Locked in Algorand Escrow Vaults: ${vaultTotal.toFixed(4)} ALGO

SUBSCRIPTIONS:
${subsSummary.map(s => `- ${s.name}: ${s.monthly_cost.toFixed(2)} ${currency}/mo (${s.billing_cycle}, ${s.status}, category: ${s.category || "uncategorized"})`).join("\n")}

ESCROW VAULTS:
${(vaults || []).map(v => `- ${v.vault_type} vault: ${v.amount} ${v.currency} (${v.status})`).join("\n") || "No vaults"}

Provide a JSON response with these fields:
1. "summary": A 2-3 sentence overview of spending health
2. "monthly_savings_potential": estimated monthly savings in ${currency}
3. "risk_score": 1-10 (1=very healthy, 10=very risky spending)
4. "recommendations": Array of 3-5 objects with { "title", "description", "impact": "high"|"medium"|"low", "category": "cost"|"security"|"optimization" }
5. "vault_insights": A sentence about their Algorand escrow usage and suggestions
6. "category_analysis": Array of { "category", "monthly_total", "percentage", "verdict": "optimal"|"review"|"reduce" }

Focus on:
- Identifying duplicate or overlapping services
- Suggesting billing cycle optimizations (yearly vs monthly discounts)
- Escrow vault strategies for recurring payments
- Cost-saving alternatives
- Security benefits of on-chain payment verification`

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a subscription optimization AI agent. Always respond with valid JSON only, no markdown formatting." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_analysis",
              description: "Provide subscription spending analysis and optimization recommendations",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "2-3 sentence overview of spending health" },
                  monthly_savings_potential: { type: "number", description: "Estimated monthly savings" },
                  risk_score: { type: "number", description: "Risk score 1-10" },
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        impact: { type: "string", enum: ["high", "medium", "low"] },
                        category: { type: "string", enum: ["cost", "security", "optimization"] },
                      },
                      required: ["title", "description", "impact", "category"],
                      additionalProperties: false,
                    },
                  },
                  vault_insights: { type: "string", description: "Insights about escrow vault usage" },
                  category_analysis: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string" },
                        monthly_total: { type: "number" },
                        percentage: { type: "number" },
                        verdict: { type: "string", enum: ["optimal", "review", "reduce"] },
                      },
                      required: ["category", "monthly_total", "percentage", "verdict"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["summary", "monthly_savings_potential", "risk_score", "recommendations", "vault_insights", "category_analysis"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_analysis" } },
      }),
    })

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      const errText = await aiResponse.text()
      console.error("AI gateway error:", aiResponse.status, errText)
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const aiResult = await aiResponse.json()

    // Extract tool call result
    let analysis: any = null
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0]
    if (toolCall?.function?.arguments) {
      try {
        analysis = JSON.parse(toolCall.function.arguments)
      } catch {
        console.error("Failed to parse tool call arguments")
      }
    }

    if (!analysis) {
      // Fallback: try to parse content directly
      const content = aiResult.choices?.[0]?.message?.content || ""
      try {
        analysis = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim())
      } catch {
        return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
    }

    return new Response(JSON.stringify({
      analysis,
      meta: {
        total_subscriptions: subsSummary.length,
        total_monthly: totalMonthly,
        currency,
        analyzed_at: new Date().toISOString(),
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("ai-optimizer error:", error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
