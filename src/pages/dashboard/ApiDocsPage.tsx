import { useMemo, useState } from "react"
import { RiBookOpenLine, RiExternalLinkLine, RiFileCopyLine, RiCheckLine, RiSearchLine } from "@remixicon/react"
import {
  CONTRACTS,
  getDeployment,
  methodSignature,
  isReadonly,
  type ContractInfo,
  type Arc56Method,
} from "@/lib/algorand/abi"

const NETWORK = (import.meta.env.VITE_ALGORAND_NETWORK as string) || "testnet"
const explorerApp = (id: number) =>
  NETWORK === "mainnet"
    ? `https://allo.info/application/${id}`
    : `https://lora.algokit.io/testnet/application/${id}`

function MethodRow({ m }: { m: Arc56Method }) {
  const ro = isReadonly(m)
  const sig = methodSignature(m)
  return (
    <div className="grid grid-cols-12 gap-3 border-t border-gray-200 px-4 py-3 text-sm dark:border-gray-800">
      <div className="col-span-12 sm:col-span-4">
        <div className="flex items-center gap-2">
          <code className="font-mono font-medium text-gray-900 dark:text-gray-100">{m.name}</code>
          {ro ? (
            <span
              className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:text-gray-400"
              title="Read-only — does not modify on-chain state"
            >
              read
            </span>
          ) : null}
        </div>
        <code className="mt-1 block break-all text-xs text-gray-500">{sig}</code>
      </div>
      <div className="col-span-12 text-gray-700 dark:text-gray-300 sm:col-span-8">
        {m.desc ? <p className="whitespace-pre-line">{m.desc}</p> : <p className="italic text-gray-400">No description provided</p>}
        {m.args.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
            {m.args.map((a, i) => (
              <li key={i}>
                <code className="font-mono text-gray-900 dark:text-gray-100">{a.name || `arg${i}`}</code>
                <span className="text-gray-400">: </span>
                <code className="font-mono">{a.type}</code>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-1 text-xs text-gray-500">
          returns <code className="font-mono">{m.returns.type}</code>
          {m.returns.struct ? <span className="ml-1 text-gray-400">({m.returns.struct})</span> : null}
        </div>
      </div>
    </div>
  )
}

function ContractCard({ c }: { c: ContractInfo }) {
  const dep = getDeployment(c)
  const [copied, setCopied] = useState(false)
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }
  return (
    <section
      id={c.slug}
      className="overflow-hidden rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
    >
      <header className="space-y-2 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {c.schema.name}
          </h2>
          <div className="flex items-center gap-2">
            {dep?.appId ? (
              <>
                <code className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-900 dark:bg-gray-900 dark:text-gray-100">
                  app {dep.appId}
                </code>
                <button
                  onClick={() => copy(String(dep.appId))}
                  title="Copy app id"
                  className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  {copied ? <RiCheckLine className="size-4" /> : <RiFileCopyLine className="size-4" />}
                </button>
                <a
                  href={dep.lora_url || explorerApp(dep.appId)}
                  target="_blank" rel="noopener noreferrer"
                  title="Open in explorer"
                  className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  <RiExternalLinkLine className="size-4" />
                </a>
              </>
            ) : (
              <span
                className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:text-gray-400"
                title="Deployed per-user from the UI; no singleton instance"
              >
                per-user
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{c.description}</p>
      </header>
      <div>
        {c.schema.methods.map((m, i) => (
          <MethodRow key={`${c.key}-${m.name}-${i}`} m={m} />
        ))}
      </div>
    </section>
  )
}

export default function ApiDocsPage() {
  const [q, setQ] = useState("")
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return CONTRACTS
    return CONTRACTS
      .map((c) => {
        const matchesContract = c.schema.name.toLowerCase().includes(term) || c.description.toLowerCase().includes(term)
        const methods = c.schema.methods.filter(
          (m) =>
            m.name.toLowerCase().includes(term) ||
            (m.desc || "").toLowerCase().includes(term) ||
            methodSignature(m).toLowerCase().includes(term),
        )
        if (matchesContract) return c
        if (methods.length > 0) return { ...c, schema: { ...c.schema, methods } }
        return null
      })
      .filter(Boolean) as ContractInfo[]
  }, [q])

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <RiBookOpenLine className="size-5 text-gray-700 dark:text-gray-300" />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            On-chain API Reference
          </h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Generated from the ARC-56 schema for every Unsubscribely contract. Use these
          method signatures from your own agent or wallet — they are stable, versioned,
          and verifiable on-chain.
        </p>
      </header>

      <div className="relative">
        <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search methods, contracts, descriptions…"
          className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-100"
        />
      </div>

      <nav className="flex flex-wrap gap-2 text-xs">
        {CONTRACTS.map((c) => (
          <a
            key={c.slug}
            href={`#${c.slug}`}
            className="rounded border border-gray-200 px-2 py-1 text-gray-700 hover:border-gray-900 hover:text-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:border-gray-100 dark:hover:text-gray-100"
          >
            {c.schema.name}
          </a>
        ))}
      </nav>

      <div className="space-y-6">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500">No matches.</p>
        ) : (
          filtered.map((c) => <ContractCard key={c.slug} c={c} />)
        )}
      </div>
    </main>
  )
}
