import { Button } from "@/components/Button"
import { Logo } from "@/components/Logo"
import {
  RiArrowRightLine, RiArrowLeftLine, RiMailLine,
  RiCheckLine, RiLockLine, RiRefreshLine,
} from "@remixicon/react"
import { Link, useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useState, useRef } from "react"

type Step = "email" | "otp" | "password" | "done"

const inputClass =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10"

const labelClass =
  "mb-2 block text-xs font-medium tracking-wide uppercase text-muted-foreground"

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
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

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
    setLoading(false)
    if (error) {
      setError(
        error.message === "Signups not allowed for otp"
          ? "No account found with this email address."
          : error.message
      )
      return
    }
    startCooldown()
    setStep("otp")
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (otp.length !== 6) { setError("Please enter the full 6-digit code."); return }
    setLoading(true)
    setError("")
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: "email" })
    setLoading(false)
    if (error) { setError("Invalid or expired code. Please try again."); return }
    setStep("password")
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) { setError("Passwords do not match."); return }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return }
    setLoading(true)
    setError("")
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setStep("done")
    setTimeout(() => navigate("/dashboard"), 2500)
  }

  async function handleResend() {
    if (resendCooldown > 0) return
    setError("")
    setOtp("")
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
    if (error) { setError(error.message); return }
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

  const SubmitButton = ({ label, loadingLabel }: { label: string; loadingLabel: string }) => (
    <Button
      type="submit"
      className="w-full rounded-full bg-foreground text-background hover:bg-foreground/90 py-6 text-sm font-medium gap-2 group"
      disabled={loading}
    >
      <div className="flex size-6 items-center justify-center rounded-md bg-background/20">
        <RiArrowRightLine className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
      {loading ? loadingLabel : label}
    </Button>
  )

  /* ── Step: Done ── */
  if (step === "done") {
    return (
      <div className="w-full max-w-md px-6 text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-500/10">
            <RiCheckLine className="size-8 text-emerald-600" />
          </div>
        </div>
        <h1 className="font-display text-3xl text-foreground tracking-tight">Password updated</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your password has been reset successfully. Redirecting to dashboard…
        </p>
      </div>
    )
  }

  /* ── Step: New Password ── */
  if (step === "password") {
    return (
      <div className="w-full max-w-md px-6">
        <LogoHeader />
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
            <RiLockLine className="size-7 text-primary" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-foreground tracking-tight">
            Set new password
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a strong password for your account
          </p>
        </div>
        <form onSubmit={handleSetPassword} className="space-y-5">
          <div>
            <label className={labelClass}>New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className={inputClass}
            />
          </div>
          <ErrorBox />
          <SubmitButton label="Update Password" loadingLabel="Updating…" />
        </form>
      </div>
    )
  }

  /* ── Step: OTP Entry ── */
  if (step === "otp") {
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
            We sent a 6-digit code to{" "}
            <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>

        <form onSubmit={handleVerifyOtp} className="space-y-5">
          <div>
            <label className={labelClass}>Verification Code</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={otp}
              onChange={(e) => {
                setError("")
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }}
              placeholder="000000"
              required
              autoFocus
              className={`${inputClass} text-center text-2xl tracking-[0.6em] font-mono`}
            />
          </div>
          <ErrorBox />
          <SubmitButton label="Verify Code" loadingLabel="Verifying…" />
        </form>

        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RiRefreshLine className="size-3.5" />
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
          </button>
          <button
            type="button"
            onClick={() => { setStep("email"); setOtp(""); setError("") }}
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
          Enter your email and we'll send you a verification code
        </p>
      </div>

      <form onSubmit={handleSendOtp} className="space-y-5">
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className={inputClass}
          />
        </div>
        <ErrorBox />
        <SubmitButton label="Send Code" loadingLabel="Sending…" />
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
