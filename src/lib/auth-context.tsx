import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { supabase } from "@/integrations/supabase/client"
import type { User, Session } from "@supabase/supabase-js"

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isGoogleUser: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isGoogleUser: false,
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

/**
 * Detect if the current user signed in via Google OAuth.
 */
function detectIsGoogleUser(user: User | null): boolean {
  if (!user) return false
  const provider = user.app_metadata?.provider
  if (provider === "google") return true
  const identities = user.identities || []
  return identities.some((id: any) => id.provider === "google")
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isGoogleUser, setIsGoogleUser] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: any, session: any) => {
        setSession(session)
        setUser(session?.user ?? null)
        setIsGoogleUser(detectIsGoogleUser(session?.user ?? null))
        setLoading(false)

        if (event === "TOKEN_REFRESHED" && !session) {
          window.location.href = "/login"
        }
        if (event === "SIGNED_OUT") {
          window.location.href = "/login"
        }

        if (event === "SIGNED_IN" && session) {
          // provider_token is ONLY present on the initial OAuth callback — not on
          // subsequent session restores. We must capture it here before the redirect.
          if (session.provider_token && session.user) {
            // Persist the Google access token so the server can call Gmail API
            supabase
              .from("profiles")
              .update({ google_access_token: session.provider_token })
              .eq("id", session.user.id)
              .then(({ error }: any) => {
                if (error) console.warn("[auth] Failed to store google_access_token:", error.message)
              })

            // Set the import-pending flag BEFORE the redirect so it survives the
            // page reload. The dashboard reads this flag and runs the Gmail scan.
            // Only set once — if already imported, don't re-scan on every Google login.
            const flagKey = `ub:gmail_import_pending:${session.user.id}`
            const doneKey = `ub:gmail_imported:${session.user.id}`
            if (!localStorage.getItem(flagKey) && !localStorage.getItem(doneKey)) {
              localStorage.setItem(flagKey, "1")
              console.log("[auth] Gmail import flag set for", session.user.id)
            }
          }

          const path = window.location.pathname
          const hash = window.location.hash
          if (
            hash.includes("access_token") ||
            path === "/" ||
            path === "/login" ||
            path === "/register" ||
            path === "/auth/callback"
          ) {
            window.location.replace("/dashboard")
          }
        }
      }
    )

    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsGoogleUser(detectIsGoogleUser(session?.user ?? null))
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, isGoogleUser, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  )
}
