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

  return {
    server: {
      host: "0.0.0.0",
      port: 5000,
      allowedHosts: true,
    },
    plugins: [
      react(),
      {
        name: "ai-optimizer-api",
        configureServer(server) {
          server.middlewares.use("/api/ai-optimizer", (req: any, res: any) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              res.end("Method Not Allowed");
              return;
            }

            const GROQ_API_KEY = process.env.GROQ_API_KEY;
            if (!GROQ_API_KEY) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "AI service not configured on server" }));
              return;
            }

            let body = "";
            req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
            req.on("end", async () => {
              try {
                const payload = JSON.parse(body || "{}");
                const {
                  subscriptions = [],
                  vaults = [],
                  userCurrency = "USD",
                  totalMonthly = 0,
                  totalVaultLocked = 0,
                } = payload;

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
- Active Subscriptions: ${subscriptions.filter((s: any) => s.status === "active").length}
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
                  console.error("Groq error:", aiRes.status, errText);
                  throw new Error(`AI service error ${aiRes.status}`);
                }

                const aiData = await aiRes.json() as any;
                const analysis = aiData.choices?.[0]?.message?.content || "Unable to generate analysis.";

                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ analysis }));
              } catch (err: any) {
                console.error("AI optimizer middleware error:", err);
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: err?.message || "Analysis failed" }));
              }
            });
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
