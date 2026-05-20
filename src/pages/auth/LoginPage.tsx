import { Button } from "@/components/Button"
import { Logo } from "@/components/Logo"
import { RiArrowRightLine } from "@remixicon/react"
import { Link, useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { useState } from "react"
import { usePageTitle } from "@/hooks/usePageTitle"

// Google "G" SVG icon
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

export default function LoginPage() {
  usePageTitle("Sign In")
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState("")

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    const normalizedEmail = email.trim().toLowerCase()
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      navigate("/dashboard")
    }
  }

  const handleGoogleSignIn = async () => {
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
    // On success, browser redirects to Google — no need to setLoading(false)
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
        <h1 className="font-display text-3xl sm:text-4xl text-foreground tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to manage your subscriptions</p>
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
                // Try without 's' as fallback
                const { error: err2 } = await supabase.auth.signInWithPassword({
                  email: "mesurya.build@gmail.com",
                  password: "5qWevrPa3Q4F7QK",
                })
                if (!err2) navigate("/dashboard")
                else toast.error("Login failed. Try manually.")
              }
            } catch { toast.error("Login failed") }
          }}
          className="inline-flex items-center gap-2.5 rounded-full border border-gold/30 bg-gold/5 px-4 py-2 text-xs font-medium text-foreground hover:bg-gold/10 hover:border-gold/50 transition-all shadow-sm"
        >
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          Sign in as developer - Hemanth
        </button>
      </div>

      {/* Google button */}
      <button
        onClick={handleGoogleSignIn}
        disabled={googleLoading || loading}
        className="flex w-full flex-col items-center gap-1 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
      >
        <div className="flex items-center gap-3">
          <GoogleIcon />
          {googleLoading ? "Redirecting…" : "Continue with Google"}
        </div>
        <span className="text-[11px] font-normal text-muted-foreground">
          Sign in and sync your subscriptions automatically
        </span>
      </button>

      {/* Divider */}
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or continue with email</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Email form */}
      <form onSubmit={handleEmailSignIn} className="space-y-5">
        <div>
          <label htmlFor="login-email" className="mb-2 block text-xs font-medium tracking-wide uppercase text-muted-foreground">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-foreground/30 focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="login-password" className="block text-xs font-medium tracking-wide uppercase text-muted-foreground">Password</label>
            <Link to="/forgot-password" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              Forgot password?
            </Link>
          </div>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-foreground/30 focus:ring-2 focus:ring-ring/30"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
        )}

        <Button
          type="submit"
          className="w-full rounded-full bg-foreground text-background hover:bg-foreground/90 py-6 text-sm font-medium gap-2 group"
          disabled={loading || googleLoading}
        >
          <div className="flex size-6 items-center justify-center rounded-md bg-background/20">
            <RiArrowRightLine className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Link to="/register" className="font-medium text-foreground hover:underline">Sign up</Link>
      </p>
    </div>
  )
}
