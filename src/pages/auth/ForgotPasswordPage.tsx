import { Button } from "@/components/Button"
import { Logo } from "@/components/Logo"
import {
  RiArrowRightLine, RiArrowLeftLine, RiMailLine,
  RiCheckLine, RiRefreshLine, RiExternalLinkLine,
} from "@remixicon/react"
import { Link, useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useState, useRef } from "react"

type Step = "email" | "sent" | "done"

const inputClass =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10"

const labelClass =
  "mb-2 block text-xs font-medium tracking-wide uppercase text-muted-foreground"

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [resendCooldown, setResendCooldown] = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startCooldown() {
    setResendCooldown(60)
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setResendCooldown((n) => {
        if (n <= 1) { clearInterval(cooldownRef.current!); return 0 }
        return n - 1
      })
    }, 1000)
  }

  async function sendResetEmail(targetEmail: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: window.location.origin + "/auth/callback",
    })
    return error
  }

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const err = await sendResetEmail(email)
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    startCooldown()
    setStep("sent")
  }

  async function handleResend() {
    if (resendCooldown > 0) return
    setError("")
    const err = await sendResetEmail(email)
    if (err) { setError(err.message); return }
    startCooldown()
  }

  const LogoHeader = () => (
    <div className="mb-10 text-center">
      <Link to="/" className="inline-flex items-center gap-3 group">
        <div className="flex size-10 items-center justify-center rounded-xl bg-foreground transition-transform group-hover:scale-105">
          <Logo className="size-5 text-background" />
        </div>
        <span className="font-display text-xl text-foreground">Unsubscribely</span>
      </Link>
    </div>
  )

  const ErrorBox = () =>
    error ? (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    ) : null

  /* ── Step: Sent (check email) ── */
  if (step === "sent") {
    return (
      <div className="w-full max-w-md px-6">
        <LogoHeader />
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
            <RiMailLine className="size-7 text-primary" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-foreground tracking-tight">
            Check your email
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a password reset link to{" "}
            <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-muted/30 px-5 py-4 text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground text-xs uppercase tracking-wide">What to do next</p>
          <ol className="list-decimal list-inside space-y-1.5">
            <li>Open the email from <span className="font-medium text-foreground">Unsubscribely</span></li>
            <li>Click the <span className="font-medium text-foreground">Reset Password</span> button</li>
            <li>You'll be brought back here to set your new password</li>
          </ol>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RiRefreshLine className="size-3.5" />
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend email"}
          </button>
          {error && <ErrorBox />}
          <button
            type="button"
            onClick={() => { setStep("email"); setError("") }}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RiArrowLeftLine className="size-3.5" />
            Change email
          </button>
        </div>
      </div>
    )
  }

  /* ── Step: Email Entry ── */
  return (
    <div className="w-full max-w-md px-6">
      <LogoHeader />
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl sm:text-4xl text-foreground tracking-tight">
          Reset password
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      <form onSubmit={handleSendLink} className="space-y-5">
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoFocus
            className={inputClass}
          />
        </div>
        <ErrorBox />
        <Button
          type="submit"
          className="w-full rounded-full bg-foreground text-background hover:bg-foreground/90 py-6 text-sm font-medium gap-2 group"
          disabled={loading}
        >
          <div className="flex size-6 items-center justify-center rounded-md bg-background/20">
            <RiArrowRightLine className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
          {loading ? "Sending…" : "Send Reset Link"}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <RiArrowLeftLine className="size-3.5" />
          Back to Sign In
        </Link>
      </div>
    </div>
  )
}
