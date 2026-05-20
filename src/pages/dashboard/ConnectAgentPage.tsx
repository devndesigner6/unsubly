import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { usePageTitle } from "@/hooks/usePageTitle"
import { toast } from "sonner"
import {
  RiCheckLine, RiFileCopyLine, RiDeleteBinLine,
  RiArrowRightLine, RiArrowRightUpLine, RiCloseLine,
} from "@remixicon/react"

const MCP_ENDPOINT = import.meta.env.VITE_OPENCLAW_RAILWAY_URL
  ? `${import.meta.env.VITE_OPENCLAW_RAILWAY_URL}/mcp`
  : "https://unsubscribely-agent-agent-production.up.railway.app/mcp"

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const SCOPE_GROUPS = [
  {
    id: "read",
    label: "Read",
    desc: "View subscriptions, spending, vault status",
    tools: ["List subscriptions", "Spending summary", "Vault status", "Upcoming renewals", "Payment history", "Health score", "Agent status"],
  },
  {
    id: "write",
    label: "Write",
    desc: "Cancel, pause, update alert preferences",
    tools: ["Cancel subscription", "Pause / unpause"],
  },
  {
    id: "admin",
    label: "Admin",
    desc: "Release or kill vaults (moves ALGO on-chain)",
    tools: ["Release vault", "Kill vault", "Verify proof"],
  },
]

export default function ConnectAgentPage() {
  usePageTitle("MCP")
  const { user } = useAuth()
  const [tokens, setTokens] = useState<any[]>([])
  const [creating, setCreating] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [serverOnline, setServerOnline] = useState<boolean | null>(null)
  const [dbReady, setDbReady] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [showConnect, setShowConnect] = useState(false)
  const [showTokens, setShowTokens] = useState(false)
  const [tokenName, setTokenName] = useState("")
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["read"])
  const [showBanner, setShowBanner] = useState(() => !localStorage.getItem("ub:mcp-banner-dismissed"))

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(MCP_ENDPOINT.replace("/mcp", "/mcp/health"), { signal: AbortSignal.timeout(5000) })
        setServerOnline(res.ok)
      } catch { setServerOnline(false) }
    }
    check()
  }, [])

  useEffect(() => { if (user) fetchTokens() }, [user])

  const fetchTokens = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await fetch("/api/mcp-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      })
      const data = await res.json()
      if (data.tokens) setTokens(data.tokens)
      if (data.message?.includes("not set up") || data.error?.includes("migration")) setDbReady(false)
    } catch { setDbReady(false) }
  }, [])

  async function handleCreate() {
    if (!user || creating) return
    setCreating(true); setNewToken(null); setVerified(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error("Not authenticated")
      const scopes = selectedScopes.length === 3 ? ["all"] : selectedScopes
      const res = await fetch("/api/mcp-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: tokenName || "MCP Token", scopes }),
      })
      const data = await res.json()
      if (data.token) { setNewToken(data.token); toast.success("Token created"); fetchTokens(); setTokenName("") }
      else toast.error(data.error || "Failed")
    } catch (e: any) { toast.error(e.message) }
    finally { setCreating(false) }
  }

  async function handleVerify() {
    if (!newToken) return
    setVerifying(true)
    try {
      // Call MCP server directly with the token to verify it works
      const res = await fetch(MCP_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${newToken}` },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const data = await res.json()
        const toolCount = data?.result?.tools?.length || 0
        if (toolCount > 0) { setVerified(true); toast.success(`Valid — ${toolCount} tools`) }
        else { toast.error("Token rejected by server") }
      } else {
        toast.error(`Server returned ${res.status}`)
      }
    } catch { toast.error("Could not reach MCP server") }
    finally { setVerifying(false) }
  }

  async function handleRevoke(id: string) {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch("/api/mcp-token", {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token || ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", token_id: id }),
    })
    setTokens(prev => prev.filter(t => t.id !== id))
    toast.success("Revoked")
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text); setCopied(key)
    toast.success("Copied"); setTimeout(() => setCopied(null), 2000)
  }

  function dismissBanner() {
    setShowBanner(false)
    localStorage.setItem("ub:mcp-banner-dismissed", "1")
  }

  function toggleScope(id: string) {
    setSelectedScopes(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id)
      return [...prev, id]
    })
  }

  const configJson = (token: string) => JSON.stringify({
    mcpServers: { unsubscribely: { url: MCP_ENDPOINT, transport: "http", headers: { Authorization: `Bearer ${token}` } } }
  }, null, 2)

  const activeTokens = tokens.filter(t => t.is_active)
  const selectedToolCount = SCOPE_GROUPS.filter(g => selectedScopes.includes(g.id)).reduce((sum, g) => sum + g.tools.length, 0)

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1: MCP Overview
  // ═══════════════════════════════════════════════════════════════════════════
  if (!showConnect) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">

          {/* #9 — First-time banner */}
          {showBanner && (
            <div className="mb-8 rounded-xl border border-border bg-card p-4 flex items-start gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">What is MCP?</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  MCP lets AI assistants like Claude or ChatGPT manage your subscriptions. 
                  It's like giving your AI a remote control for your account — it can check spending, 
                  cancel services, and verify on-chain proofs, all scoped to your data only.
                </p>
              </div>
              <button onClick={dismissBanner} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                <RiCloseLine className="size-4" />
              </button>
            </div>
          )}

          {/* Top right link */}
          <div className="flex justify-end mb-8">
            <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              Learn about MCP <span className="text-lg">⟶</span>
            </a>
          </div>

          {/* Badge */}
          <div className="mb-6 relative overflow-hidden">
            <span className="ghost-text">AGENT</span>
            <svg className="absolute -z-10 -top-4 -right-4 opacity-[0.03] text-foreground pointer-events-none" width="160" height="160" viewBox="0 0 48 48" fill="currentColor">
              <circle cx="24" cy="8" r="3" /><circle cx="8" cy="36" r="3" /><circle cx="40" cy="36" r="3" />
              <path d="M24 11v10M14 30l8-7M34 30l-8-7" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
            <span className="inline-block rounded border border-border px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-foreground font-medium">MCP</span>
          </div>

          {/* Hero heading — original text preserved */}
          <h1 className="font-display text-[2.75rem] sm:text-[3.5rem] lg:text-[4rem] text-foreground leading-[1.1] mb-8">
            Connect your AI
            <br />
            <span className="text-muted-foreground">smooth</span>{" "}
            <span className="inline-flex items-center gap-1 align-middle -mt-1">
              <img src="/icons/claude.svg" alt="" className="size-8 sm:size-9 rounded-xl shadow-sm" />
              <img src="/icons/openai.svg" alt="" className="size-8 sm:size-9 rounded-xl shadow-sm" />
              <img src="/icons/mcp.svg" alt="" className="size-8 sm:size-9 rounded-xl shadow-sm" />
            </span>{" "}
            <span className="font-semibold">workflow</span>
            <br />
            <span className="text-muted-foreground">manage subscriptions with</span>
            <br />
            <span className="font-semibold">MCP servers.</span>
          </h1>

          {/* Two cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Connect card */}
            <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-foreground">
                    <img src="/icons/mcp.svg" alt="" className="size-5 invert dark:invert-0" />
                  </div>
                  <span className="text-lg font-semibold text-foreground">Connect</span>
                </div>
                <span className="text-sm text-muted-foreground">12 tools</span>
              </div>
              <button onClick={() => setShowConnect(true)} className="w-full rounded-full border border-border py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors mb-5">
                Get <span className="font-semibold">Started</span>
              </button>
              <ul className="space-y-2.5">
                {["Generate a token in one click", "Paste config into Claude or ChatGPT", "AI manages your subscriptions", "On-chain vault operations"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <RiCheckLine className="size-3.5 text-foreground shrink-0" />{item}
                  </li>
                ))}
              </ul>
            </div>

            {/* #8 — Enhanced Status card */}
            <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-foreground">
                    <RiArrowRightUpLine className="size-5 text-background" />
                  </div>
                  <span className="text-lg font-semibold text-foreground">Status</span>
                </div>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={`size-2 rounded-full ${serverOnline ? "bg-foreground" : "bg-muted-foreground/30"}`} />
                  {serverOnline ? "Online" : "Offline"}
                </span>
              </div>
              <button onClick={() => setShowTokens(!showTokens)} className="w-full rounded-full border border-border py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors mb-5">
                {showTokens ? "Hide" : "View"} <span className="font-semibold">Tokens</span>
              </button>
              {!showTokens ? (
                <ul className="space-y-2.5">
                  <li className="flex items-center gap-2 text-xs text-muted-foreground"><RiCheckLine className="size-3.5 text-foreground shrink-0" />{activeTokens.length} active token{activeTokens.length !== 1 ? "s" : ""}</li>
                  <li className="flex items-center gap-2 text-xs text-muted-foreground"><RiCheckLine className="size-3.5 text-foreground shrink-0" />Endpoint: /mcp/v1</li>
                  <li className="flex items-center gap-2 text-xs text-muted-foreground"><RiCheckLine className="size-3.5 text-foreground shrink-0" />Rate limit: 30 req/min</li>
                  <li className="flex items-center gap-2 text-xs text-muted-foreground"><RiCheckLine className="size-3.5 text-foreground shrink-0" />Protocol: JSON-RPC 2.0</li>
                </ul>
              ) : (
                <div className="space-y-2">
                  {activeTokens.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No tokens yet.</p>
                  ) : activeTokens.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                      <div>
                        <p className="text-xs font-medium text-foreground">{t.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {t.scopes?.join(", ")} · {t.last_used_at ? `Used ${timeAgo(t.last_used_at)}` : "Never used"}
                        </p>
                      </div>
                      <button onClick={() => handleRevoke(t.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                        <RiDeleteBinLine className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  {activeTokens.length < 5 && (
                    <button onClick={() => setShowConnect(true)} className="w-full rounded-lg border border-dashed border-border py-2 text-[10px] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors">
                      + New token
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 2: Connect flow
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <button onClick={() => setShowConnect(false)} className="text-xs text-muted-foreground hover:text-foreground mb-8 transition-colors">← Back</button>

        {/* Main container */}
        <div className="rounded-3xl border-2 border-border bg-card p-2 sm:p-3 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3">

            {/* Left card */}
            <div className="rounded-2xl bg-muted/30 p-6 sm:p-8">
              <p className="text-xs text-muted-foreground mb-1">Setup</p>
              <h3 className="text-xl font-semibold text-foreground mb-3 leading-tight">
                AI agents managing<br />your subscriptions
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-5">
                Generate a token, paste the config into Claude Desktop or ChatGPT, 
                and your AI assistant can manage subscriptions, release vaults, 
                and verify on-chain proofs on your behalf.
              </p>

              {!newToken ? (
                <div className="space-y-4">
                  {/* #6 — Token name */}
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 block">Token name</label>
                    <input
                      type="text"
                      value={tokenName}
                      onChange={(e) => setTokenName(e.target.value)}
                      placeholder="e.g. Claude on laptop"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  {/* #1 + #7 — Scope picker with explanations */}
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 block">Permissions</label>
                    <div className="space-y-2">
                      {SCOPE_GROUPS.map((group) => (
                        <button
                          key={group.id}
                          onClick={() => toggleScope(group.id)}
                          className={`w-full rounded-lg border px-3 py-2.5 text-left transition-all ${
                            selectedScopes.includes(group.id) ? "border-foreground/30 bg-background" : "border-border hover:border-foreground/15"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-medium text-foreground">{group.label}</span>
                              <span className="text-[10px] text-muted-foreground ml-2">{group.desc}</span>
                            </div>
                            <div className={`size-4 rounded border flex items-center justify-center transition-colors ${
                              selectedScopes.includes(group.id) ? "border-foreground bg-foreground" : "border-border"
                            }`}>
                              {selectedScopes.includes(group.id) && <RiCheckLine className="size-2.5 text-background" />}
                            </div>
                          </div>
                          {selectedScopes.includes(group.id) && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {group.tools.map((t) => (
                                <span key={t} className="text-[9px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">{t}</span>
                              ))}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">{selectedToolCount} tool{selectedToolCount !== 1 ? "s" : ""} selected</p>
                  </div>

                  <button
                    onClick={handleCreate}
                    disabled={creating || !dbReady || selectedScopes.length === 0}
                    className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-xs font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
                  >
                    {creating ? "Generating..." : "Generate Token"}
                    <RiArrowRightLine className="size-3" />
                  </button>
                  {!dbReady && <p className="text-[9px] text-muted-foreground mt-2">Run SQL migration first.</p>}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Token display */}
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[10px] font-mono text-foreground break-all select-all">
                      {newToken}
                    </code>
                    <button onClick={() => copy(newToken, "token")} className="shrink-0 rounded-lg border border-border p-1.5 hover:bg-muted transition-colors">
                      {copied === "token" ? <RiCheckLine className="size-3.5" /> : <RiFileCopyLine className="size-3.5" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleVerify} disabled={verifying} className="rounded-full border border-border px-3 py-1 text-[10px] hover:bg-muted transition-colors disabled:opacity-50">
                      {verifying ? "..." : "Verify"}
                    </button>
                    {verified && <span className="text-[10px] text-muted-foreground">✓ Valid</span>}
                  </div>
                  {/* Next steps */}
                  <div className="border-t border-border pt-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Next steps</p>
                    <ol className="space-y-1.5 text-[11px] text-muted-foreground list-decimal list-inside">
                      <li>Copy the token above</li>
                      <li>Open Claude Desktop → Settings → Developer → Edit Config</li>
                      <li>Paste the config shown on the right</li>
                      <li>Ask your AI: "List my subscriptions"</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>

            {/* Right card — dark */}
            <div className="rounded-2xl bg-[#1a1a1a] dark:bg-foreground/5 dark:border dark:border-border p-6 sm:p-8 text-white dark:text-foreground">
              <h3 className="text-lg font-semibold mb-2">{selectedToolCount} tools. One endpoint.</h3>
              <p className="text-xs opacity-60 leading-relaxed mb-5">
                Your AI agent gets access to subscription management, vault operations, 
                and on-chain verification through a single MCP endpoint.
              </p>

              {/* Concentric circles */}
              <div className="relative w-full aspect-[2/1] mb-5 flex items-center justify-center">
                <div className="absolute size-32 rounded-full border border-white/10 dark:border-border" />
                <div className="absolute size-24 rounded-full border border-white/15 dark:border-border" />
                <div className="absolute size-16 rounded-full border border-white/20 dark:border-border" />
                <div className="absolute size-8 rounded-full border border-white/30 dark:border-border flex items-center justify-center">
                  <span className="text-[10px] font-bold opacity-70">{selectedToolCount}</span>
                </div>
                {selectedScopes.includes("read") && <span className="absolute top-2 left-4 text-[9px] opacity-50 border border-white/20 dark:border-border rounded px-1.5 py-0.5">Read</span>}
                {selectedScopes.includes("write") && <span className="absolute top-2 right-4 text-[9px] opacity-50 border border-white/20 dark:border-border rounded px-1.5 py-0.5">Write</span>}
                {selectedScopes.includes("admin") && <span className="absolute bottom-2 left-4 text-[9px] opacity-50 border border-white/20 dark:border-border rounded px-1.5 py-0.5">Admin</span>}
                <span className="absolute bottom-2 right-4 text-[9px] opacity-50 border border-white/20 dark:border-border rounded px-1.5 py-0.5">Proofs</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] opacity-60">
                  <span className={`size-1.5 rounded-full ${serverOnline ? "bg-emerald-400" : "bg-red-400"}`} />
                  {serverOnline ? "Server online" : "Offline"}
                </span>
                {newToken && (
                  <button
                    onClick={() => copy(configJson(newToken), "config")}
                    className="rounded-full border border-white/20 dark:border-border px-3 py-1 text-[10px] font-medium hover:bg-white/10 dark:hover:bg-muted transition-colors"
                  >
                    {copied === "config" ? "Copied!" : "Copy config →"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* #10 — Prominent copy config block */}
        {newToken && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Paste into your AI assistant config</p>
              <button
                onClick={() => copy(configJson(newToken), "config-main")}
                className="rounded-full bg-foreground text-background px-4 py-1.5 text-[10px] font-medium hover:bg-foreground/90 transition-colors"
              >
                {copied === "config-main" ? "Copied!" : "Copy config"}
              </button>
            </div>
            <pre className="rounded-lg border border-border bg-muted/20 p-4 text-[11px] font-mono text-foreground overflow-x-auto leading-relaxed">
              {configJson(newToken)}
            </pre>
          </div>
        )}

        {/* Active tokens */}
        {activeTokens.length > 0 && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Active tokens</p>
            <div className="space-y-2">
              {activeTokens.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="text-xs font-medium text-foreground">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground">{t.scopes?.join(", ")} · {new Date(t.created_at).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => handleRevoke(t.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <RiDeleteBinLine className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
