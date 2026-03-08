import { useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { RiShieldCheckLine, RiAlertLine, RiLoader4Line, RiRefreshLine } from "@remixicon/react"

interface HealthIssue {
  vaultId: string
  appId: number
  type: string
  message: string
}

export function VaultHealthBanner() {
  const [issues, setIssues] = useState<HealthIssue[]>([])
  const [checked, setChecked] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasRun, setHasRun] = useState(false)

  async function runCheck() {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke("vault-health")
      if (error) throw error
      setIssues(data.issues || [])
      setChecked(data.checked || 0)
      setHasRun(true)
    } catch (err) {
      console.error("Health check failed:", err)
    } finally {
      setLoading(false)
    }
  }

  if (!hasRun) {
    return (
      <button
        onClick={runCheck}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
      >
        {loading ? <RiLoader4Line className="size-4 animate-spin" /> : <RiShieldCheckLine className="size-4 text-primary" />}
        {loading ? "Checking..." : "Run Health Check"}
      </button>
    )
  }

  return (
    <div className={`rounded-xl border p-4 ${issues.length > 0 ? "border-destructive/30 bg-destructive/5" : "border-green-500/30 bg-green-500/5"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {issues.length > 0 ? (
            <RiAlertLine className="size-5 text-destructive" />
          ) : (
            <RiShieldCheckLine className="size-5 text-green-600 dark:text-green-400" />
          )}
          <span className="text-sm font-medium text-foreground">
            {issues.length > 0 ? `${issues.length} issue(s) found` : `All ${checked} vaults healthy`}
          </span>
        </div>
        <button onClick={runCheck} disabled={loading} className="text-muted-foreground hover:text-foreground">
          <RiRefreshLine className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      {issues.length > 0 && (
        <div className="mt-3 space-y-2">
          {issues.map((issue, i) => (
            <div key={i} className="rounded-lg bg-card px-3 py-2 text-xs">
              <span className="font-mono text-destructive">[{issue.type}]</span>{" "}
              <span className="text-muted-foreground">App {issue.appId}:</span>{" "}
              <span className="text-foreground">{issue.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
