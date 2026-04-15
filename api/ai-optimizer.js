export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" })
    return
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY
  if (!GROQ_API_KEY) {
    res.status(500).json({ error: "AI service not configured on server" })
    return
  }

  try {
    const {
      subscriptions = [],
      vaults = [],
      userCurrency = "USD",
      totalMonthly = 0,
      totalVaultLocked = 0,
    } = req.body

    const activeSubs = subscriptions.filter((s) => s.status === "active")

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
}`

    const userPrompt = `Portfolio data:
Monthly: ${Number(totalMonthly).toFixed(2)} ${userCurrency}
Annual: ${(Number(totalMonthly) * 12).toFixed(2)} ${userCurrency}
Active subscriptions: ${activeSubs.length}
Locked ALGO: ${Number(totalVaultLocked).toFixed(4)}

Subscriptions: ${JSON.stringify(activeSubs.map(s => ({ name: s.name, amount: s.amount, currency: s.currency, cycle: s.billing_cycle, category: s.category })))}
Vaults: ${JSON.stringify(vaults.map(v => ({ type: v.vault_type, amount: v.amount, status: v.status })))}

Respond with ONLY the JSON structure specified.`

    const groqPayload = {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    }

    // Try once, and if rate-limited (429) wait 8s and retry once
    async function callGroq() {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(groqPayload),
      })
      return r
    }

    let aiRes = await callGroq()
    if (aiRes.status === 429) {
      await new Promise((r) => setTimeout(r, 8000))
      aiRes = await callGroq()
    }

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      if (aiRes.status === 401) throw new Error("AI service key is invalid — check GROQ_API_KEY in Vercel environment variables and redeploy.")
      if (aiRes.status === 429) throw new Error("AI rate limit reached — please wait 30 seconds before running again.")
      throw new Error(`AI service error ${aiRes.status}: ${errText}`)
    }

    const aiData = await aiRes.json()
    const raw = aiData.choices?.[0]?.message?.content || "{}"

    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      parsed = match ? JSON.parse(match[0]) : {}
    }

    res.status(200).json({ analysis: parsed })
  } catch (err) {
    res.status(500).json({ error: err?.message || "Analysis failed" })
  }
}
