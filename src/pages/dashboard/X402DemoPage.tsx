import { useEffect, useMemo, useState } from "react"
import {
  RiCoinLine, RiSendPlaneLine, RiCheckboxCircleLine, RiErrorWarningLine,
  RiExternalLinkLine, RiRefreshLine, RiLoader4Line, RiFileCopyLine, RiCheckLine,
} from "@remixicon/react"
import { toast } from "sonner"
import algosdk from "algosdk"
import { useAlgorand } from "@/lib/algorand/context"
import { microalgosToAlgo } from "@/lib/algorand/constants"
import { Button } from "@/components/Button"

const NETWORK = (import.meta.env.VITE_ALGORAND_NETWORK as string) || "testnet"
const explorerTx = (id: string) =>
  NETWORK === "mainnet"
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
  quote?: string
  served_at?: string
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

function StepDot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <span
      className={[
        "size-2.5 rounded-full",
        done
          ? "bg-gray-900 dark:bg-gray-50"
          : active
            ? "bg-gray-900 dark:bg-gray-50 animate-pulse"
            : "bg-gray-300 dark:bg-gray-700",
      ].join(" ")}
    />
  )
}

export default function X402DemoPage() {
  const { walletAddress, algodClient, peraWallet } = useAlgorand()
  const [step, setStep] = useState<Step>("idle")
  const [challenge, setChallenge] = useState<Challenge402 | null>(null)
  const [result, setResult] = useState<ServerResponse | null>(null)
  const [txid, setTxid] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const requirement = challenge?.accepts?.[0] ?? null
  const priceMicroalgos = requirement ? Number(requirement.maxAmountRequired) : 0
  const priceAlgo = useMemo(() => microalgosToAlgo(priceMicroalgos), [priceMicroalgos])

  const reset = () => {
    setStep("idle")
    setChallenge(null)
    setResult(null)
    setTxid(null)
    setErrorDetail(null)
  }

  // Step 1: probe the endpoint with no header → expect 402.
  const requestChallenge = async () => {
    reset()
    try {
      const res = await fetch("/api/x402-demo", { method: "GET" })
      if (res.status === 200) {
        const body = (await res.json()) as ServerResponse
        setResult(body)
        setStep("success")
        return
      }
      if (res.status !== 402) {
        const txt = await res.text()
        setErrorDetail(`Unexpected status ${res.status}: ${txt.slice(0, 200)}`)
        setStep("failed")
        return
      }
      const body = (await res.json()) as Challenge402
      setChallenge(body)
      setStep("challenged")
    } catch (err: any) {
      setErrorDetail(err?.message || String(err))
      setStep("failed")
    }
  }

  // Step 2 + 3: build, sign, base64-encode payment; retry with X-PAYMENT.
  const payAndRetry = async () => {
    if (!requirement) return
    if (!walletAddress) {
      toast.error("Connect your wallet first (Settings → Algorand)")
      return
    }
    setStep("signing")
    setErrorDetail(null)
    try {
      const params = await algodClient.getTransactionParams().do()
      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: walletAddress,
        receiver: requirement.payTo,
        amount: priceMicroalgos,
        suggestedParams: params,
        note: new TextEncoder().encode("x402:unsubscribely-demo"),
      })

      const signedArr = await peraWallet.signTransaction([[{ txn }]])
      const signed = signedArr[0] // single signed txn
      const xPayment = bytesToBase64(signed)

      setStep("submitting")
      const res = await fetch("/api/x402-demo", {
        method: "GET",
        headers: { "X-PAYMENT": xPayment },
      })
      const receipt = res.headers.get("X-PAYMENT-RESPONSE")
      if (receipt) {
        try {
          const r = JSON.parse(receipt) as { txid?: string }
          if (r.txid) setTxid(r.txid)
        } catch { /* ignore */ }
      }
      const body = (await res.json()) as ServerResponse
      if (res.status === 200) {
        setResult(body)
        setStep("success")
      } else {
        setErrorDetail(body?.error || `Server returned ${res.status}`)
        setStep("failed")
      }
    } catch (err: any) {
      setErrorDetail(err?.message || String(err))
      setStep("failed")
    }
  }

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch { /* noop */ }
  }

  useEffect(() => {
    // Probe once on mount so the user immediately sees the 402 challenge.
    requestChallenge()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stepIndex =
    step === "idle" ? 0
    : step === "challenged" ? 1
    : step === "signing" || step === "submitting" ? 2
    : 3

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
          x402 Demo
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          A live walkthrough of the HTTP 402 → on-chain payment → retry handshake.
          The endpoint <code className="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-900">/api/x402-demo</code>{" "}
          serves a "premium quote" and is gated by an Algorand payment of{" "}
          {requirement ? `${priceAlgo} ALGO` : "a small fee"}.
        </p>
      </header>

      {/* Stepper */}
      <ol className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-950">
        <li className="flex items-center gap-2">
          <StepDot active={stepIndex === 0} done={stepIndex > 0} />
          <span className={stepIndex >= 0 ? "text-gray-900 dark:text-gray-100" : "text-gray-500"}>Request</span>
        </li>
        <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
        <li className="flex items-center gap-2">
          <StepDot active={stepIndex === 1} done={stepIndex > 1} />
          <span className={stepIndex >= 1 ? "text-gray-900 dark:text-gray-100" : "text-gray-500"}>402 Challenge</span>
        </li>
        <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
        <li className="flex items-center gap-2">
          <StepDot active={stepIndex === 2} done={stepIndex > 2} />
          <span className={stepIndex >= 2 ? "text-gray-900 dark:text-gray-100" : "text-gray-500"}>Sign &amp; Pay</span>
        </li>
        <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
        <li className="flex items-center gap-2">
          <StepDot active={stepIndex === 3 && step === "success"} done={step === "success"} />
          <span className={step === "success" ? "text-gray-900 dark:text-gray-100" : "text-gray-500"}>200 OK</span>
        </li>
      </ol>

      {/* Challenge card */}
      {challenge && requirement && (
        <section className="space-y-3 rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              <RiCoinLine className="size-4" />
              Server replied 402, Payment required
            </h2>
            <button
              onClick={requestChallenge}
              title="Re-fetch the 402 challenge"
              className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
            >
              <RiRefreshLine className="size-4" />
            </button>
          </div>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">Network</dt>
              <dd className="font-mono text-gray-900 dark:text-gray-100">{requirement.network}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">Price</dt>
              <dd className="font-mono text-gray-900 dark:text-gray-100">
                {priceAlgo} ALGO <span className="text-gray-500">({priceMicroalgos} µALGO)</span>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-gray-500">Pay to</dt>
              <dd className="flex items-center gap-2">
                <code className="truncate font-mono text-xs text-gray-900 dark:text-gray-100">
                  {requirement.payTo}
                </code>
                <button
                  onClick={() => copy(requirement.payTo, "payTo")}
                  title="Copy address"
                  className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  {copied === "payTo" ? <RiCheckLine className="size-3.5" /> : <RiFileCopyLine className="size-3.5" />}
                </button>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-gray-500">Description</dt>
              <dd className="text-gray-900 dark:text-gray-100">{requirement.description}</dd>
            </div>
          </dl>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="primary"
              onClick={payAndRetry}
              disabled={step === "signing" || step === "submitting" || !walletAddress}
              title={!walletAddress ? "Connect your Algorand wallet first" : "Sign payment and retry"}
            >
              {step === "signing" ? (
                <><RiLoader4Line className="mr-2 size-4 animate-spin" /> Sign in wallet…</>
              ) : step === "submitting" ? (
                <><RiLoader4Line className="mr-2 size-4 animate-spin" /> Submitting…</>
              ) : (
                <><RiSendPlaneLine className="mr-2 size-4" /> Pay &amp; retry</>
              )}
            </Button>
          </div>
          {!walletAddress && (
            <p className="text-xs text-gray-500">
              Connect your Algorand wallet from the Escrow Vaults page to pay.
            </p>
          )}
        </section>
      )}

      {/* Success card */}
      {step === "success" && result && (
        <section className="space-y-3 rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
          <h2 className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
            <RiCheckboxCircleLine className="size-4" />
            200 OK, content unlocked
          </h2>
          {result.quote && (
            <blockquote className="border-l-2 border-gray-300 pl-3 text-sm italic text-gray-800 dark:border-gray-700 dark:text-gray-200">
              {result.quote}
            </blockquote>
          )}
          {result.served_at && (
            <p className="text-xs text-gray-500">Served at {result.served_at}</p>
          )}
          {txid && (
            <div className="flex items-center justify-between gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-800 dark:bg-gray-900">
              <div className="min-w-0 flex-1">
                <div className="text-gray-500">On-chain receipt (txid)</div>
                <code className="block truncate font-mono text-gray-900 dark:text-gray-100">{txid}</code>
              </div>
              <a
                href={explorerTx(txid)}
                target="_blank" rel="noopener noreferrer"
                title="Open transaction in explorer"
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                <RiExternalLinkLine className="size-4" />
              </a>
            </div>
          )}
          <div className="flex items-center justify-end pt-1">
            <Button variant="secondary" onClick={requestChallenge} title="Run the demo again">
              <RiRefreshLine className="mr-2 size-4" /> Run again
            </Button>
          </div>
        </section>
      )}

      {/* Error card */}
      {step === "failed" && (
        <section className="space-y-3 rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
          <h2 className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
            <RiErrorWarningLine className="size-4" />
            Failed
          </h2>
          <p className="text-sm text-red-700 dark:text-red-300">{errorDetail || "Unknown error"}</p>
          <div className="flex items-center justify-end">
            <Button variant="secondary" onClick={requestChallenge} title="Try again from the start">
              <RiRefreshLine className="mr-2 size-4" /> Try again
            </Button>
          </div>
        </section>
      )}

      {/* Spec */}
      <details className="rounded-md border border-gray-200 bg-white p-4 text-sm dark:border-gray-800 dark:bg-gray-950">
        <summary className="cursor-pointer font-medium text-gray-900 dark:text-gray-100">
          How the wire format works
        </summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-gray-700 dark:text-gray-300">
          <li>Client calls <code>GET /api/x402-demo</code> with no header.</li>
          <li>Server replies <code>HTTP 402</code> + JSON body listing the accepted payment (network, address, price).</li>
          <li>Client builds an Algorand payment transaction for the exact amount, signs it with their wallet, and base64-encodes the signed bytes.</li>
          <li>Client retries the same request with header <code>X-PAYMENT: &lt;base64&gt;</code>.</li>
          <li>Server submits the txn, waits for confirmation, verifies receiver + amount, then returns the content with header <code>X-PAYMENT-RESPONSE</code> containing the txid as a permanent receipt.</li>
        </ol>
      </details>
    </main>
  )
}
