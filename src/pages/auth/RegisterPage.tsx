import { Button } from "@/components/Button"
import { Logo } from "@/components/Logo"
import { RiArrowRightLine, RiCheckLine, RiCloseLine } from "@remixicon/react"
import { Link, useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useState, useMemo } from "react"
import { toast } from "sonner"
import { usePageTitle } from "@/hooks/usePageTitle"

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

const COMMON_PASSWORDS = new Set([
  "password", "123456", "12345678", "qwerty", "abc123", "monkey", "master",
  "dragon", "111111", "baseball", "iloveyou", "trustno1", "sunshine", "letmein",
  "password1", "superman", "princess", "welcome", "shadow", "123456789",
])

function getPasswordStrength(pw: string) {
  const checks = {
    minLength: pw.length >= 8,
    hasUpper: /[A-Z]/.test(pw),
    hasLower: /[a-z]/.test(pw),
    hasNumber: /\d/.test(pw),
    hasSpecial: /[^A-Za-z0-9]/.test(pw),
    notCommon: !COMMON_PASSWORDS.has(pw.toLowerCase()),
  }
  const passed = Object.values(checks).filter(Boolean).length
  return { checks, passed, total: 6 }
}

export default function RegisterPage() {
  usePageTitle("Sign Up")
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState("")

  const strength = useMemo(() => getPasswordStrength(password), [password])
  const isPasswordSecure = strength.passed >= 5

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true)
    setError("")
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "email profile https://www.googleapis.com/auth/gmail.readonly",
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isPasswordSecure) {
      setError("Please choose a stronger password.")
      return
    }
    setLoading(true)
    setError("")

    const normalizedEmail = email.trim().toLowerCase()

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: window.location.origin,
      },
    })

    const isExistingUser =
      !data?.session &&
      !!data?.user &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (isExistingUser) {
      setError("This email is already registered. Please sign in or use Forgot Password.")
      setLoading(false)
      return
    }

    toast.success("Account created. You can sign in now.")
    setLoading(false)
    navigate("/login")
  }

  return (
    <div className="w-full max-w-md px-6">
      {/* Logo */}
      <div className="mb-10 text-center">
        <Link to="/" className="inline-flex items-center gap-3 group">
          <div className="flex size-10 items-center justify-center rounded-xl bg-foreground transition-transform group-hover:scale-105">
            <Logo className="size-5 text-background" />
          </div>
          <span className="font-display text-xl text-foreground">Unsubscribely</span>
        </Link>
      </div>

      {/* Heading */}
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl sm:text-4xl text-foreground tracking-tight">
          Create an account
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Start tracking your subscriptions for free
        </p>
      </div>

      {/* Developer access pill */}
      <div className="mb-6 flex justify-center">
        <button
          onClick={async () => {
            try {
              const { error } = await supabase.auth.signInWithPassword({
                email: "mesurya.builds@gmail.com",
                password: "5qWevrPa3Q4F7QK",
              })
              if (!error) navigate("/dashboard")
              else {
                const { error: err2 } = await supabase.auth.signInWithPassword({
                  email: "mesurya.build@gmail.com",
                  password: "5qWevrPa3Q4F7QK",
                })
                if (!err2) navigate("/dashboard")
              }
            } catch {}
          }}
          className="inline-flex items-center gap-2.5 rounded-full border border-gold/30 bg-gold/5 px-4 py-2 text-xs font-medium text-foreground hover:bg-gold/10 hover:border-gold/50 transition-all shadow-sm"
        >
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          Sign in as developer - Hemanth
        </button>
      </div>

      {/* Google button */}
      <button
        type="button"
        onClick={handleGoogleSignUp}
        disabled={googleLoading || loading}
        className="flex w-full flex-col items-center gap-1 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
      >
        <div className="flex items-center gap-3">
          <GoogleIcon />
          {googleLoading ? "Redirecting…" : "Continue with Google"}
        </div>
        <span className="text-[11px] font-normal text-muted-foreground">
          Connect Google &amp; import your subscriptions automatically
        </span>
      </button>

      {/* Divider */}
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or sign up with email</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Form */}
      <form onSubmit={handleSignUp} className="space-y-5">
        <div>
          <label htmlFor="reg-name" className="mb-2 block text-xs font-medium tracking-wide uppercase text-muted-foreground">
            Name
          </label>
          <input
            id="reg-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="off"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-foreground/30 focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div>
          <label htmlFor="reg-email" className="mb-2 block text-xs font-medium tracking-wide uppercase text-muted-foreground">
            Email
          </label>
          <input
            id="reg-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="off"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-foreground/30 focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div>
          <label htmlFor="reg-password" className="mb-2 block text-xs font-medium tracking-wide uppercase text-muted-foreground">
            Password
          </label>
          <input
            id="reg-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters, mixed case + number"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-foreground/30 focus:ring-2 focus:ring-ring/30"
          />
          {password.length > 0 && (
            <div className="mt-3 space-y-2">
              {/* Strength bar */}
              <div className="flex gap-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i < strength.passed
                        ? strength.passed <= 2 ? "bg-destructive" : strength.passed <= 4 ? "bg-amber-500" : "bg-emerald-500"
                        : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              {/* Checklist */}
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {([
                  ["minLength", "8+ characters"],
                  ["hasUpper", "Uppercase letter"],
                  ["hasLower", "Lowercase letter"],
                  ["hasNumber", "A number"],
                  ["hasSpecial", "Special character"],
                  ["notCommon", "Not a common password"],
                ] as const).map(([key, label]) => (
                  <li key={key} className={`flex items-center gap-1.5 ${strength.checks[key] ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {strength.checks[key] ? <RiCheckLine className="size-3" /> : <RiCloseLine className="size-3" />}
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full rounded-full bg-foreground text-background hover:bg-foreground/90 py-6 text-sm font-medium gap-2 group"
          disabled={loading || googleLoading || (password.length > 0 && !isPasswordSecure)}
        >
          <div className="flex size-6 items-center justify-center rounded-md bg-background/20">
            <RiArrowRightLine className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
          {loading ? "Creating account..." : "Create Account"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
