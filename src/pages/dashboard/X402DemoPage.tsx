import { useEffect, useMemo, useState, useRef } from "react"
import {
  RiCoinLine, RiSendPlaneLine, RiCheckboxCircleLine, RiErrorWarningLine,
  RiExternalLinkLine, RiRefreshLine, RiLoader4Line, RiFileCopyLine, RiCheckLine,
  RiWalletLine, RiPlayLine,
} from "@remixicon/react"
import { toast } from "sonner"
import algosdk from "algosdk"
import { useAlgorand } from "@/lib/algorand/context"
import { microalgosToAlgo } from "@/lib/algorand/constants"
import { Button } from "@/components/Button"
import { motion, AnimatePresence } from "motion/react"

import type { AlgorandNetwork } from "@/lib/algorand/constants"

const explorerTx = (id: string, network: AlgorandNetwork) =>
  network === "mainnet"
    ? `https://allo.info/tx/${id}`
    : `https://testnet.explorer.perawallet.app/tx/${id}/`

interface PaymentRequirement {
  scheme: string
  network: string
  maxAmountRequired: string
  resource: string
  description: string
  payTo: string
  asset: string
  maxTimeoutSeconds: number
}

interface Challenge402 {
  x402Version: number
  error: string
  accepts: PaymentRequirement[]
}

interface ServerResponse {
  ok?: boolean
  served_at?: string
  network?: string
  algorand?: { round?: number | null; genesis_id?: string | null; algod_url?: string | null }
  agent?: { pay_to_address?: string; x402_price_microalgos?: number }
  service_registry?: { app_id?: number | null; registered_services?: number | null }
  note?: string
  error?: string
  txid?: string
}

type Step = "idle" | "challenged" | "signing" | "submitting" | "success" | "failed"

function bytesToBase64(bytes: Uint8Array): string {
  let s = ""
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

// Step indicator with numbered circles and connecting lines
const STEPS = ["Request", "402 Challenge", "Sign & Pay", "200 OK"]

function StepIndicator({ currentIndex, failed }: { currentIndex: number; failed: boolean }) {
  return (
    <div className="flex items-center w-full">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`flex size-8 items-center justify-center rounded-full text-xs font-medium transition-all duration-300 ${
                i < currentIndex
                  ? "bg-foreground text-background"
                  : i === currentIndex && !failed
                    ? "bg-foreground text-background ring-4 ring-foreground/10"
                    : i === currentIndex && failed
                      ? "bg-red-500 text-white ring-4 ring-red-500/10"
                      : "border-2 border-border text-muted-foreground"
              }`}
            >
              {i < currentIndex ? (
                <RiCheckLine className="size-4" />
              ) : (
                i + 1
              )}
            </div>
            <span className={`text-[10px] font-medium whitespace-nowrap ${
              i <= currentIndex ? "text-foreground" : "text-muted-foreground"
            }`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 flex-1 mx-2 mt-[-18px] transition-colors duration-300 ${
              i < currentIndex ? "bg-foreground" : "bg-border"
            }`} />
          )}
        </div>
      ))}
    </div>
  )
}

// Terminal-style log panel
function LogPanel({ logs }: { logs: string[] }) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [logs])

  return (
    <div className="rounded-lg border border-border bg-[#0a0a0a] dark:bg-[#0a0a0a] p-3 font-mono text-[11px] text-green-400 max-h-48 overflow-y-auto">
      {logs.length === 0 && <span className="text-white/30">Waiting for request...</span>}
      {logs.map((log, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className={`py-0.5 ${log.startsWith("←") ? "text-amber-300" : log.startsWith("✓") ? "text-emerald-400" : log.startsWith("✗") ? "text-red-400" : "text-green-400"}`}
        >
          {log}
        </motion.div>
      ))}
      <div ref={endRef} />
    </div>
  )
}

export default function X402DemoPage() {
  const { walletAddress, algodClient, peraWallet, network, setShowWalletSelector } = useAlgorand()
  const [step, setStep] = useState<Step>("idle")
  const [challenge, setChallenge] = useState<Challenge402 | null>(null)
  const [result, setResult] = useState<ServerResponse | null>(null)
  const [txid, setTxid] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [demoRunning, setDemoRunning] = useState(false)

  const requirement = challenge?.accepts?.[0] ?? null
  const priceMicroalgos = requirement ? Number(requirement.maxAmountRequired) : 0
  const priceAlgo = useMemo(() => microalgosToAlgo(priceMicroalgos), [priceMicroalgos])

  const addLog = (msg: string) => setLogs((prev) => [...prev, msg])

  const reset = () => {
    setStep("idle")
    setChallenge(null)
    setResult(null)
    setTxid(null)
    setErrorDetail(null)
    setLogs([])
  }

  const requestChallenge = async () => {
    reset()
    addLog("→ GET /api/x402-demo")
    try {
      const res = await fetch("/api/x402-demo", { method: "GET" })
      if (res.status === 200) {
        const body = (await res.json()) as ServerResponse
        setResult(body)
        setStep("success")
        addLog("← HTTP 200 OK (already paid or bypassed)")
        return
      }
      if (res.status !== 402) {
        const txt = await res.text()
        setErrorDetail(`Unexpected status ${res.status}: ${txt.slice(0, 200)}`)
        setStep("failed")
        addLog(`✗ HTTP ${res.status} (unexpected)`)
        return
      }
      const body = (await res.json()) as Challenge402
      setChallenge(body)
      setStep("challenged")
      addLog(`← HTTP 402 Payment Required`)
      addLog(`  network: ${body.accepts?.[0]?.network || "unknown"}`)
      addLog(`  price: ${body.accepts?.[0]?.maxAmountRequired || "?"} microALGO`)
      addLog(`  payTo: ${body.accepts?.[0]?.payTo?.slice(0, 12)}...`)
    } catch (err: any) {
      setErrorDetail(err?.message || String(err))
      setStep("failed")
      addLog(`✗ Network error: ${err?.message}`)
    }
  }

  const payAndRetry = async () => {
    if (!requirement || !walletAddress) return
    const amountMicroalgos = Number(requirement.maxAmountRequired) || 1000
    if (amountMicroalgos <= 0) {
      setErrorDetail("Invalid payment amount")
      setStep("failed")
      return
    }
    setStep("signing")
    setErrorDetail(null)
    addLog("→ Building payment transaction...")
    addLog(`  sender: ${walletAddress.slice(0, 8)}...`)
    addLog(`  amount: ${amountMicroalgos} microALGO`)
    try {
      const params = await algodClient.getTransactionParams().do()
      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: walletAddress,
        receiver: requirement.payTo,
        amount: BigInt(amountMicroalgos),
        suggestedParams: params,
        note: new TextEncoder().encode("x402:unsubscribely"),
      })
      addLog("→ Signing with Pera Wallet...")
      const signedArr = await peraWallet.signTransaction([[{ txn }]])
      const signed = signedArr[0]
      const xPayment = bytesToBase64(signed)

      setStep("submitting")
      addLog("✓ Signed. Retrying with X-PAYMENT header...")
      addLog(`→ GET /api/x402-demo [X-PAYMENT: ${xPayment.slice(0, 20)}...]`)

      const res = await fetch("/api/x402-demo", {
        method: "GET",
        headers: { "X-PAYMENT": xPayment },
      })
      const receipt = res.headers.get("X-PAYMENT-RESPONSE")
      if (receipt) {
        try {
          const r = JSON.parse(receipt) as { txid?: string }
          if (r.txid) setTxid(r.txid)
        } catch {}
      }
      const body = (await res.json()) as ServerResponse
      if (res.status === 200) {
        setResult(body)
        setStep("success")
        addLog(`← HTTP 200 OK`)
        if (receipt) {
          try {
            const r = JSON.parse(receipt)
            addLog(`✓ txid: ${r.txid || "confirmed"}`)
          } catch {}
        }
        addLog(`✓ Content unlocked. Round: ${body.algorand?.round || "?"}`)
      } else {
        setErrorDetail(body?.error || `Server returned ${res.status}`)
        setStep("failed")
        addLog(`✗ HTTP ${res.status}: ${body?.error || "failed"}`)
      }
    } catch (err: any) {
      setErrorDetail(err?.message || String(err))
      setStep("failed")
      addLog(`✗ Error: ${err?.message}`)
    }
  }

  // Demo mode - simulates the flow without a wallet
  const runDemo = async () => {
    if (demoRunning) return
    setDemoRunning(true)
    reset()
    addLog("▶ Demo mode (simulated, no real payment)")
    await new Promise((r) => setTimeout(r, 600))
    addLog("→ GET /api/x402-demo")
    setStep("challenged")
    await new Promise((r) => setTimeout(r, 800))
    addLog("← HTTP 402 Payment Required")
    addLog("  network: algorand-testnet")
    addLog("  price: 1000 microALGO (0.001 ALGO)")
    addLog("  payTo: 7LO7JT...TYEBDQ")
    setChallenge({ x402Version: 1, error: "Payment required", accepts: [{ scheme: "exact", network: "algorand-testnet", maxAmountRequired: "1000", resource: "/api/x402-demo", description: "Live Algorand network snapshot", payTo: "7LO7JTTYEBDQ...", asset: "ALGO", maxTimeoutSeconds: 60 }] })
    await new Promise((r) => setTimeout(r, 1200))
    addLog("→ Signing transaction (simulated)...")
    setStep("signing")
    await new Promise((r) => setTimeout(r, 1000))
    addLog("✓ Signed. Retrying with X-PAYMENT header...")
    setStep("submitting")
    await new Promise((r) => setTimeout(r, 1500))
    addLog("← HTTP 200 OK")
    addLog("✓ Payment confirmed on-chain (simulated)")
    addLog("✓ Content unlocked. Round: 45,823,910")
    setTxid(null)
    setResult({ ok: true, served_at: new Date().toISOString(), network: "algorand-testnet", algorand: { round: 45823910, genesis_id: "testnet-v1.0" }, agent: { pay_to_address: "7LO7JT...TYEBDQ", x402_price_microalgos: 1000 }, service_registry: { app_id: 759205676, registered_services: 5 }, note: "This is a simulated demo. Connect your Pera Wallet and pay 0.001 ALGO to see a real transaction." })
    setStep("success")
    setDemoRunning(false)
  }

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500) } catch {}
  }

  useEffect(() => { requestChallenge() }, [])

  const stepIndex = step === "idle" ? 0 : step === "challenged" ? 1 : step === "signing" || step === "submitting" ? 2 : 3

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold text-foreground">x402 Protocol</h1>
        <p className="text-sm text-muted-foreground">
          Live HTTP 402 payment protocol on Algorand. Pay{" "}
          <span className="font-mono-pixel text-foreground">{requirement ? priceAlgo : "0.001"} ALGO</span>{" "}
          per request for a fresh on-chain network snapshot. No API keys, no subscriptions.
        </p>
      </header>

      {/* Step indicator */}
      <div className="rounded-xl border border-border bg-card p-4">
        <StepIndicator currentIndex={stepIndex} failed={step === "failed"} />
      </div>

      {/* Live log terminal */}
      <LogPanel logs={logs} />

      {/* Challenge card */}
      <AnimatePresence mode="wait">
        {step === "challenged" && challenge && requirement && (
          <motion.section
            key="challenge"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
                <RiCoinLine className="size-4 text-gold" />
                402 Payment Required
              </h2>
            </div>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Network</dt>
                <dd className="font-mono text-foreground">{requirement.network}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Price</dt>
                <dd className="font-mono-pixel text-foreground">{priceAlgo} ALGO</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Pay to</dt>
                <dd className="flex items-center gap-2">
                  <code className="truncate font-mono text-xs text-foreground">{requirement.payTo}</code>
                  <button onClick={() => copy(requirement.payTo, "payTo")} className="text-muted-foreground hover:text-foreground">
                    {copied === "payTo" ? <RiCheckLine className="size-3.5" /> : <RiFileCopyLine className="size-3.5" />}
                  </button>
                </dd>
              </div>
            </dl>

            <div className="flex items-center gap-2 pt-2">
              {!walletAddress ? (
                <Button variant="primary" onClick={() => setShowWalletSelector(true)}>
                  <RiWalletLine className="mr-2 size-4" /> Connect Pera Wallet
                </Button>
              ) : (
                <Button variant="primary" onClick={payAndRetry} disabled={step === "signing" || step === "submitting"}>
                  {step === "signing" ? (
                    <><RiLoader4Line className="mr-2 size-4 animate-spin" /> Signing...</>
                  ) : step === "submitting" ? (
                    <><RiLoader4Line className="mr-2 size-4 animate-spin" /> Submitting...</>
                  ) : (
                    <><RiSendPlaneLine className="mr-2 size-4" /> Pay & Retry</>
                  )}
                </Button>
              )}
              <Button variant="secondary" onClick={runDemo} disabled={demoRunning}>
                <RiPlayLine className="mr-1.5 size-4" /> Watch Demo
              </Button>
            </div>
          </motion.section>
        )}

        {/* Success card */}
        {step === "success" && result && (
          <motion.section
            key="success"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3 rounded-xl border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-950/10 p-4"
          >
            <h2 className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <RiCheckboxCircleLine className="size-4" />
              200 OK - Payment Verified
            </h2>

            {/* Response payload */}
            <div className="rounded-lg bg-[#0a0a0a] p-3 font-mono text-[11px] text-emerald-300 overflow-x-auto">
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </div>

            {/* Transaction receipt */}
            {txid && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Transaction ID</div>
                  <code className="block truncate font-mono-pixel text-xs text-foreground">{txid}</code>
                </div>
                <a
                  href={txid.startsWith("DEMO") ? "#" : explorerTx(txid, network)}
                  target={txid.startsWith("DEMO") ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[10px] font-medium text-foreground hover:bg-muted transition-colors"
                >
                  View on Explorer <RiExternalLinkLine className="size-3" />
                </a>
              </div>
            )}

            <Button variant="secondary" onClick={requestChallenge} className="mt-2">
              <RiRefreshLine className="mr-2 size-4" /> Run Again
            </Button>
          </motion.section>
        )}

        {/* Error card */}
        {step === "failed" && (
          <motion.section
            key="failed"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3 rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/10 p-4"
          >
            <h2 className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
              <RiErrorWarningLine className="size-4" /> Failed
            </h2>
            <p className="text-sm text-red-600 dark:text-red-400">{errorDetail || "Unknown error"}</p>
            <Button variant="secondary" onClick={requestChallenge}>
              <RiRefreshLine className="mr-2 size-4" /> Try Again
            </Button>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Wire format explanation */}
      <details className="rounded-xl border border-border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium text-foreground">How x402 wire format works</summary>
        <div className="mt-4 space-y-3 text-muted-foreground">
          <div className="flex gap-3">
            <span className="shrink-0 font-mono-pixel text-xs text-foreground/50">1.</span>
            <span>Client calls <code className="rounded bg-muted px-1 py-0.5 text-xs">GET /api/x402-demo</code> with no payment header.</span>
          </div>
          <div className="flex gap-3">
            <span className="shrink-0 font-mono-pixel text-xs text-foreground/50">2.</span>
            <span>Server replies <code className="rounded bg-muted px-1 py-0.5 text-xs">HTTP 402</code> + JSON body with payment requirements (network, address, price).</span>
          </div>
          <div className="flex gap-3">
            <span className="shrink-0 font-mono-pixel text-xs text-foreground/50">3.</span>
            <span>Client builds an Algorand payment txn, signs with Pera Wallet, base64-encodes the signed bytes.</span>
          </div>
          <div className="flex gap-3">
            <span className="shrink-0 font-mono-pixel text-xs text-foreground/50">4.</span>
            <span>Client retries with header <code className="rounded bg-muted px-1 py-0.5 text-xs">X-PAYMENT: &lt;base64&gt;</code>.</span>
          </div>
          <div className="flex gap-3">
            <span className="shrink-0 font-mono-pixel text-xs text-foreground/50">5.</span>
            <span>Server submits txn on-chain, verifies receiver + amount, returns content with <code className="rounded bg-muted px-1 py-0.5 text-xs">X-PAYMENT-RESPONSE</code> header containing the txid.</span>
          </div>
        </div>
      </details>
    </main>
  )
}
