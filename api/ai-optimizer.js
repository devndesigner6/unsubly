export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    res.status(500).json({ error: "AI service not configured on server" });
    return;
  }

  try {
    const {
      subscriptions = [],
      vaults = [],
      userCurrency = "USD",
      totalMonthly = 0,
      totalVaultLocked = 0,
    } = req.body;

    const systemPrompt = `You are an AI financial advisor specializing in subscription management and blockchain escrow vaults on Algorand. Analyze user portfolios and provide concise, actionable recommendations.

Guidelines:
- Be specific with numbers and percentages
- Reference actual subscription names from the portfolio
- Suggest concrete vault strategies (time-locked for long-term, multi-sig for shared, dispute vaults for uncertain vendors)
- Keep recommendations prioritized and actionable
- Format with clear headers and bullet points`;

    const userPrompt = `Analyze this subscription portfolio:

**Summary:**
- Monthly Spend: ${Number(totalMonthly).toFixed(2)} ${userCurrency}
- Annual Projected: ${(Number(totalMonthly) * 12).toFixed(2)} ${userCurrency}
- Active Subscriptions: ${subscriptions.filter((s) => s.status === "active").length}
- Escrow Vaults: ${vaults.length} (${Number(totalVaultLocked).toFixed(4)} ALGO locked)

**Subscriptions:**
${JSON.stringify(subscriptions, null, 2)}

**Escrow Vaults:**
${JSON.stringify(vaults, null, 2)}

Provide:
1. **Spending Analysis** — breakdown and trends
2. **Cost Optimization** — specific savings opportunities
3. **Vault Strategy** — which vault type suits which subscriptions and why
4. **Risk Assessment** — financial exposure and mitigation
5. **Action Items** — prioritized next steps`;

    const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI service error ${aiRes.status}: ${errText}`);
    }

    const aiData = await aiRes.json();
    const analysis = aiData.choices?.[0]?.message?.content || "Unable to generate analysis.";

    res.status(200).json({ analysis });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Analysis failed" });
  }
}
