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
    setG(getGuardrails(subscriptionId))
  }, [subscriptionId])

  const handleSave = () => {
    setGuardrails(subscriptionId, g)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <section className="space-y-4 rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
      <header className="flex items-center gap-2">
        <RiShieldCheckLine className="size-4 text-gray-700 dark:text-gray-300" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Agent Guardrails
        </h2>
      </header>
      <p className="text-xs text-gray-500">
        Limits the autonomous agent must respect before releasing funds for this
        subscription. Saved locally; production deployments persist these in the
        subscription_config table.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
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
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:focus:border-gray-100"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
            Trial ends on
          </span>
          <input
            type="date"
            value={g.trialEndDate ?? ""}
            onChange={(e) => setG({ ...g, trialEndDate: e.target.value || null })}
            title="Last day of the free trial. Renewal Radar flags this as high-risk 3 days out."
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:focus:border-gray-100"
          />
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={g.pauseBeforePaidRenewal}
          onChange={(e) => setG({ ...g, pauseBeforePaidRenewal: e.target.checked })}
          className="mt-0.5 size-4 rounded border-gray-300 dark:border-gray-700"
        />
        <span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            Pause before first paid renewal
          </span>
          <span className="ml-1 text-gray-500">
           , agent will not release the first paid charge after the trial; require manual approval.
          </span>
        </span>
      </label>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={handleSave} title="Save guardrails to local storage">
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
