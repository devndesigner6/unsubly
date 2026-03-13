import { Button } from "@/components/Button"
import { Logo } from "@/components/Logo"
import { RiArrowRightLine } from "@remixicon/react"
import { Link, useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useState } from "react"

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
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
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to manage your subscriptions
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleEmailSignIn} className="space-y-5">
        <div>
          <label className="mb-2 block text-xs font-medium tracking-wide uppercase text-muted-foreground">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10"
          />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-xs font-medium tracking-wide uppercase text-muted-foreground">
              Password
            </label>
            <Link to="/forgot-password" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full rounded-full bg-foreground text-background hover:bg-foreground/90 py-6 text-sm font-medium gap-2 group"
          disabled={loading}
        >
          <div className="flex size-6 items-center justify-center rounded-md bg-background/20">
            <RiArrowRightLine className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Link to="/register" className="font-medium text-foreground hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  )
}
