import { useEffect, useState } from "react"
import { RiShieldCheckLine, RiSaveLine, RiCheckLine } from "@remixicon/react"
import { Button } from "@/components/Button"
import { getGuardrails, setGuardrails, type SubscriptionGuardrails } from "@/lib/budget"

interface Props {
  subscriptionId: string
  currency: string
}

export function GuardrailsSection({ subscriptionId, currency }: Props) {
  const [g, setG] = useState<SubscriptionGuardrails>({
    budgetCap: null, trialEndDate: null, pauseBeforePaidRenewal: false,
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    getGuardrails(subscriptionId).then((data) => {
      if (!cancelled) setG(data)
    })
    return () => { cancelled = true }
  }, [subscriptionId])

  const handleSave = async () => {
    await setGuardrails(subscriptionId, g)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <header className="flex items-center gap-2">
        <RiShieldCheckLine className="size-4 text-foreground" />
        <h2 className="text-sm font-semibold text-foreground">
          Agent Guardrails
        </h2>
      </header>
      <p className="text-xs text-muted-foreground">
        Limits the autonomous agent must respect before releasing funds for this
        subscription. Saved to Supabase so the OpenClaw agent always sees your settings.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Budget cap ({currency} per cycle)
          </span>
          <input
            type="number"
            step="0.01"
            min={0}
            value={g.budgetCap ?? ""}
            onChange={(e) => {
              const v = e.target.value
              setG({ ...g, budgetCap: v === "" ? null : Number(v) })
            }}
            placeholder="No cap"
            title="If the cycle's billed amount exceeds this, the agent will not auto-release."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Trial ends on
          </span>
          <input
            type="date"
            value={g.trialEndDate ?? ""}
            onChange={(e) => setG({ ...g, trialEndDate: e.target.value || null })}
            title="Last day of the free trial. Renewal Radar flags this as high-risk 3 days out."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={g.pauseBeforePaidRenewal}
          onChange={(e) => setG({ ...g, pauseBeforePaidRenewal: e.target.checked })}
          className="mt-0.5 size-4 rounded border-input"
        />
        <span>
          <span className="font-medium text-foreground">
            Pause before first paid renewal
          </span>
          <span className="ml-1 text-muted-foreground">
           , agent will not release the first paid charge after the trial; require manual approval.
          </span>
        </span>
      </label>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={handleSave} title="Save guardrails">
          {saved ? (
            <><RiCheckLine className="mr-2 size-4" /> Saved</>
          ) : (
            <><RiSaveLine className="mr-2 size-4" /> Save guardrails</>
          )}
        </Button>
      </div>
    </section>
  )
}
