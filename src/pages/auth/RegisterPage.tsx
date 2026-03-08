import { Button } from "@/components/Button"
import { Logo } from "@/components/Logo"
import { RiArrowRightLine, RiMailCheckLine } from "@remixicon/react"
import { Link, useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useState } from "react"

export default function RegisterPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: window.location.origin,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-md px-6 text-center">
        <div className="mb-8 flex justify-center">
          <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-muted">
            <RiMailCheckLine className="size-8 text-foreground" />
          </div>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl text-foreground tracking-tight">
          Check your email
        </h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
          We've sent a confirmation link to <span className="text-foreground font-medium">{email}</span>. Please verify your account to continue.
        </p>
        <Button asChild className="mt-8 rounded-full bg-foreground text-background hover:bg-foreground/90 px-7 py-6 text-sm font-medium gap-2 group">
          <Link to="/login">
            <div className="flex size-6 items-center justify-center rounded-md bg-background/20">
              <RiArrowRightLine className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
            Back to Sign In
          </Link>
        </Button>
      </div>
    )
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

      {/* Form */}
      <form onSubmit={handleSignUp} className="space-y-5">
        <div>
          <label className="mb-2 block text-xs font-medium tracking-wide uppercase text-muted-foreground">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10"
          />
        </div>
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
          <label className="mb-2 block text-xs font-medium tracking-wide uppercase text-muted-foreground">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 6 characters"
            required
            minLength={6}
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
