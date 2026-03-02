import { useState } from "react"
import { Link, Navigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Logo } from "@/components/Logo"
import { useAuth } from "@/hooks/useAuth"

export default function RegisterPage() {
  const { user, loading } = useAuth()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!loading && user) return <Navigate to="/dashboard" replace />

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
    })
    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }
    setIsLoading(false)
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-full max-w-md px-4 text-center">
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Check your email</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">We've sent a confirmation link to <strong>{email}</strong></p>
            <Link to="/login" className="mt-4 inline-block text-blue-600 hover:underline">Back to login</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md px-4">
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-8 text-center">
            <Link to="/" className="mb-6 inline-flex items-center justify-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gray-900 dark:bg-white">
                <Logo className="size-5 text-white dark:text-gray-900" />
              </div>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">Unsubscribely</span>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Create an account</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Start tracking your subscriptions for free</p>
          </div>
          <form onSubmit={handleRegister} className="space-y-4">
            {error && <p className="text-sm text-red-600 rounded-lg bg-red-50 p-3 dark:bg-red-900/20 dark:text-red-400">{error}</p>}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
              <Input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <Button type="submit" className="w-full" isLoading={isLoading}>Create Account</Button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
