import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { Logo } from "@/components/Logo"
import { Link } from "react-router-dom"
import { RiArrowLeftLine } from "@remixicon/react"

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<"loading" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    // Supabase JS v2 automatically processes URL hash tokens (implicit flow)
    // and fires auth state change events. We just need to listen.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        // User clicked the reset-password link, send them to set a new password
        navigate("/reset-password", { replace: true })
      } else if (event === "SIGNED_IN" && session) {
        // Magic link sign-in (not password recovery)
        navigate("/dashboard", { replace: true })
      }
    })

    // Fallback: check if there's already a session (e.g. if auth state fired before we mounted)
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setErrorMsg(error.message)
        setStatus("error")
        return
      }
      if (session) {
        // Already have a session, go to dashboard
        navigate("/dashboard", { replace: true })
      }
    })

    // Also handle the case where the URL contains an error from Supabase
    // Check both hash and query string (OAuth errors come in query string)
    const hash = window.location.hash
    const search = window.location.search
    const errorSource = hash.includes("error=") ? hash.substring(1) : search.substring(1)
    if (hash.includes("error=") || search.includes("error=")) {
      const params = new URLSearchParams(errorSource)
      const desc = params.get("error_description") || params.get("error") || "Authentication failed."
      const errorCode = params.get("error_code") || ""
      let friendlyMsg = decodeURIComponent(desc).replace(/\+/g, " ")
      if (errorCode === "bad_oauth_state") {
        friendlyMsg = "Sign-in session expired. Please try again — this can happen if you took too long or switched browsers."
      }
      setErrorMsg(friendlyMsg)
      setStatus("error")
    }

    // Timeout: if nothing fires in 8s, show an error
    const timeout = setTimeout(() => {
      setStatus((s) => {
        if (s === "loading") {
          setErrorMsg("The link may have expired or is invalid. Please request a new one.")
          return "error"
        }
        return s
      })
    }, 8000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [navigate])

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md text-center">
          <div className="mb-10 flex justify-center">
            <Link to="/" className="inline-flex items-center gap-3 group">
              <div className="flex size-10 items-center justify-center rounded-xl bg-foreground transition-transform group-hover:scale-105">
                <Logo className="size-5 text-background" />
              </div>
              <span className="font-display text-xl text-foreground">Unsubscribely</span>
            </Link>
          </div>
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-5 text-sm text-destructive mb-6">
            {errorMsg}
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <RiArrowLeftLine className="size-3.5" />
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="flex size-10 items-center justify-center rounded-xl bg-foreground">
            <Logo className="size-5 text-background" />
          </div>
        </div>
        <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Verifying your link…</p>
      </div>
    </div>
  )
}
