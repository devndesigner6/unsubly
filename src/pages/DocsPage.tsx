import { Link } from "react-router-dom"
import { RiExternalLinkLine, RiArrowRightLine } from "@remixicon/react"

const MCP_TOOLS = [
  { name: "list_subscriptions", desc: "Get all user subscriptions with status, amount, billing cycle" },
  { name: "get_spending_summary", desc: "Monthly/yearly totals, category breakdown, currency split" },
  { name: "get_vault_status", desc: "All escrow vaults with lock/release/kill status and ALGO amounts" },
  { name: "get_upcoming_renewals", desc: "Subscriptions renewing in the next 7 days" },
  { name: "get_payment_history", desc: "On-chain payment records with txids and timestamps" },
  { name: "get_health_score", desc: "Subscription health score (0-100) based on vault coverage" },
  { name: "get_agent_status", desc: "Agent uptime, last tick, on-chain release count" },
  { name: "cancel_subscription", desc: "Mark a subscription as cancelled, trigger guided cancel flow" },
  { name: "pause_subscription", desc: "Pause billing alerts for a subscription" },
  { name: "update_alert_preferences", desc: "Change alert timing (1/3/7 days before renewal)" },
  { name: "release_vault", desc: "Release ALGO from a locked vault (agent-managed types only)" },
  { name: "kill_vault", desc: "Kill switch - return all ALGO to creator immediately" },
]

const SECTIONS = [
  {
    title: "MCP Server",
    description: "Connect Claude, ChatGPT, Cursor, or any MCP-compatible AI to manage subscriptions autonomously.",
    links: [
      { label: "Endpoint", value: "/mcp/v1", mono: true },
      { label: "Protocol", value: "JSON-RPC 2.0" },
      { label: "Auth", value: "Bearer token (generate in app)" },
      { label: "Rate limit", value: "30 req/min" },
    ],
  },
  {
    title: "x402 Protocol",
    description: "HTTP 402 payment-gated API. Pay 0.001 ALGO per request for live Algorand network data. No API keys needed.",
    links: [
      { label: "Endpoint", value: "/api/x402-demo", mono: true },
      { label: "Price", value: "1000 microALGO (0.001 ALGO)" },
      { label: "Network", value: "algorand-testnet" },
      { label: "Spec", value: "x402.org", href: "https://docs.x402.org" },
    ],
  },
  {
    title: "Smart Contracts",
    description: "PuyaPy compiled contracts on Algorand TestNet. ARC-4 ABI, Box Storage for billing history.",
    links: [
      { label: "ServiceRegistry", value: "App 759205676", href: "https://lora.algokit.io/testnet/application/759205676" },
      { label: "AgentEscrowVaultV2", value: "App 759205677", href: "https://lora.algokit.io/testnet/application/759205677" },
      { label: "Agent Wallet", value: "RVHOYLPY...YVAE5U", href: "https://testnet.explorer.perawallet.app/accounts/RVHOYLPY4L47JYCYEMCP7EMEC2AZ3HV53YHSL2ZISX6PSO5EQ6H5YVAE5U/" },
      { label: "Toolchain", value: "AlgoKit + PuyaPy" },
    ],
  },
  {
    title: "Telegram Bot",
    description: "Natural language subscription management via Telegram. Cerebras AI-powered.",
    links: [
      { label: "Bot", value: "@unsublyybot", href: "https://t.me/unsublyybot" },
      { label: "Commands", value: "cancel <name>, done, keep <name>" },
      { label: "Features", value: "Voice messages, browser automation, renewal alerts" },
      { label: "AI Model", value: "Cerebras gpt-oss-120b" },
    ],
  },
  {
    title: "REST API",
    description: "Vercel serverless endpoints for the web app. Authenticated via Supabase JWT.",
    links: [
      { label: "/api/agent-run", value: "Trigger vault release cycle" },
      { label: "/api/ai-optimizer", value: "AI spending analysis (x402-gated)" },
      { label: "/api/telegram-webhook", value: "Telegram bot webhook" },
      { label: "/api/gmail-scan", value: "Gmail receipt import" },
    ],
  },
]

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 lg:px-8">
      <div className="mb-12">
        <h1 className="font-display text-4xl text-foreground tracking-tight">Documentation</h1>
        <p className="mt-3 text-base text-muted-foreground max-w-2xl">
          Technical reference for integrating with Unsubscribely. MCP server, x402 protocol, smart contracts, and APIs.
        </p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-12">
        <a href="https://github.com/devndesigner6/unsubly" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-border p-4 hover:border-foreground/20 transition-colors">
          <span className="text-sm font-medium text-foreground">GitHub Repo</span>
          <RiExternalLinkLine className="size-3.5 text-muted-foreground ml-auto" />
        </a>
        <Link to="/connect-agent" className="flex items-center gap-2 rounded-xl border border-border p-4 hover:border-foreground/20 transition-colors">
          <span className="text-sm font-medium text-foreground">Generate MCP Token</span>
          <RiArrowRightLine className="size-3.5 text-muted-foreground ml-auto" />
        </Link>
        <Link to="/x402-demo" className="flex items-center gap-2 rounded-xl border border-border p-4 hover:border-foreground/20 transition-colors">
          <span className="text-sm font-medium text-foreground">Try x402 Live</span>
          <RiArrowRightLine className="size-3.5 text-muted-foreground ml-auto" />
        </Link>
        <a href="/gtm-plan.pdf" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-border p-4 hover:border-foreground/20 transition-colors">
          <span className="text-sm font-medium text-foreground">GTM Plan (PDF)</span>
          <RiExternalLinkLine className="size-3.5 text-muted-foreground ml-auto" />
        </a>
        <a href="/Unsubscribely-GTM-Plan.pdf" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-border p-4 hover:border-foreground/20 transition-colors">
          <span className="text-sm font-medium text-foreground">GTM Plan (PDF)</span>
          <RiExternalLinkLine className="size-3.5 text-muted-foreground ml-auto" />
        </a>
      </div>

      {/* Sections */}
      <div className="space-y-10">
        {SECTIONS.map((section) => (
          <div key={section.title} className="rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-1">{section.title}</h2>
            <p className="text-sm text-muted-foreground mb-4">{section.description}</p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {section.links.map((link) => (
                <div key={link.label} className="flex items-start gap-2">
                  <dt className="text-xs text-muted-foreground shrink-0 w-24">{link.label}</dt>
                  <dd className={`text-xs text-foreground ${link.mono ? "font-mono" : ""}`}>
                    {link.href ? (
                      <a href={link.href} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                        {link.value} <RiExternalLinkLine className="size-2.5" />
                      </a>
                    ) : link.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}

        {/* MCP Tools Reference */}
        <div className="rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">MCP Tools (12)</h2>
          <p className="text-sm text-muted-foreground mb-4">Available via JSON-RPC 2.0 at the MCP endpoint.</p>
          <div className="space-y-2">
            {MCP_TOOLS.map((tool) => (
              <div key={tool.name} className="flex items-start gap-3 py-1.5 border-b border-border/50 last:border-0">
                <code className="text-[11px] font-mono bg-muted dark:bg-white/5 px-2 py-0.5 rounded text-foreground shrink-0">{tool.name}</code>
                <span className="text-xs text-muted-foreground">{tool.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* MCP Config Example */}
        <div className="rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">Quick Start: Claude Desktop</h2>
          <p className="text-sm text-muted-foreground mb-4">Add this to your Claude Desktop MCP config:</p>
          <pre className="rounded-lg bg-[#0a0a0a] p-4 text-[11px] text-green-400 font-mono overflow-x-auto">
{`{
  "mcpServers": {
    "unsubscribely": {
      "url": "https://unsubscribely-agent-agent-production.up.railway.app/mcp/v1",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}`}
          </pre>
          <p className="mt-3 text-xs text-muted-foreground">
            Generate a token at <Link to="/connect-agent" className="text-foreground hover:underline">/connect-agent</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
