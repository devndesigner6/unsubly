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

CRITICAL RULES — violating any of these will cause a hard failure:
1. Respond with ONLY a single valid JSON object. No markdown, no code fences, no prose outside the JSON.
2. All number fields must be plain numeric literals (e.g. 19.99). NEVER use expressions, fractions, or division (e.g. NEVER write 199/75).
3. All string fields must be non-null strings. NEVER use null for any field — use "Unknown" for missing categories, "N/A" for missing values.
4. "riskScore" must be an integer between 0 and 100.
5. "risk" must be exactly one of: "low", "medium", or "high".
6. "priority" must be exactly one of: "high", "medium", or "low".
7. "recommended" must be exactly one of: "standard", "time-locked", "multi-sig", "dispute", "asa".
8. "riskLabel" must be exactly one of: "Low", "Medium", or "High".

Return exactly this structure:
{
  "spending": {
    "summary": "one sentence summary of total spend",
    "topCategory": "highest spend category name or Unknown",
    "monthlyTotal": 0.00,
    "annualTotal": 0.00,
    "breakdown": [
      { "name": "subscription name", "monthly": 0.00, "category": "category or Unknown", "risk": "low" }
    ]
  },
  "savings": [
    { "title": "short title", "description": "specific actionable recommendation", "saving": "$19/mo", "priority": "high" }
  ],
  "vaultStrategy": [
    { "subscription": "name", "recommended": "standard", "reason": "one sentence why" }
  ],
  "riskScore": 50,
  "riskLabel": "Medium",
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
      temperature: 0.1,
      max_tokens: 1500,
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
