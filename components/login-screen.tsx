"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Radar, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase, isSupabaseConfigured } from "@/lib/supabase-client"

interface LoginScreenProps {
  onLogin: () => void
}

type View = "sign-in" | "sign-up" | "reset"

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const searchParams = useSearchParams()
  const initialMode: View = searchParams.get("mode") === "sign-up" ? "sign-up" : "sign-in"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [view, setView] = useState<View>(initialMode)

  const switchView = (next: View) => {
    setView(next)
    setError("")
    setNotice("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !supabase) return
    const mode = view === "sign-up" ? "sign-up" : "sign-in"
    setIsLoading(true)
    setError("")

    try {
      const authPromise = fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, email, password }),
      })

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Login request timed out. Check the local server and Supabase project.")), 12000)
      })

      const result = await Promise.race([authPromise, timeoutPromise])
      const data = await result.json().catch(() => null)

      if (result.status === 202) {
        setNotice(data?.error || "Check your email to confirm your account, then sign in.")
        setIsLoading(false)
        return
      }

      if (!result.ok || !data?.session) {
        setError(data?.error || "Could not authenticate.")
        setIsLoading(false)
        return
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })

      if (sessionError) {
        setError(sessionError.message)
        setIsLoading(false)
        return
      }

      onLogin()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not authenticate.")
      setIsLoading(false)
      return
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !supabase) return
    setIsLoading(true)
    setError("")
    setNotice("")

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/dashboard`,
    })

    setIsLoading(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setNotice("If an account exists for that email, a password reset link is on its way.")
  }

  const isReset = view === "reset"

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.4] bg-[linear-gradient(rgba(6,182,212,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.07)_1px,transparent_1px)] bg-[size:48px_48px]" />

      {/* Radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-teal-500/8 rounded-full blur-2xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/8 rounded-2xl shadow-2xl shadow-black/50 p-8">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-cyan-500/30 rounded-2xl blur-xl" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center shadow-xl shadow-cyan-500/25">
                <Radar className="w-8 h-8 text-slate-950" strokeWidth={2} />
              </div>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">LaggardScan</h1>
            <p className="text-xs text-white/40 mt-1 tracking-widest uppercase font-medium">
              {isReset ? "Reset your password" : "Lead Intelligence"}
            </p>
          </div>

          {!isSupabaseConfigured && (
            <div className="mb-4 flex items-start gap-2 text-amber-300 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="text-xs">
                Add Supabase keys from .env.example to enable account access.
              </span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={isReset ? handleReset : handleSubmit} className="space-y-4">
            {!isReset && (
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                {(["sign-in", "sign-up"] as const).map(value => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => switchView(value)}
                    className={cn(
                      "h-8 rounded-lg text-xs font-bold transition-colors",
                      view === value ? "bg-cyan-500 text-slate-950" : "text-white/45 hover:text-white"
                    )}
                  >
                    {value === "sign-in" ? "Sign In" : "Create Account"}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Email</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(""); setNotice("") }}
                className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-cyan-500/40 focus:bg-white/6 transition-colors"
                autoFocus
              />
            </div>

            {!isReset && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Password</label>
                  {view === "sign-in" && (
                    <button
                      type="button"
                      onClick={() => switchView("reset")}
                      className="text-[11px] font-medium text-cyan-400/80 hover:text-cyan-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter access code"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(""); setNotice("") }}
                    className={cn(
                      "pl-10 pr-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/20",
                      "focus:border-cyan-500/40 focus:bg-white/6 transition-colors",
                      error && "border-red-500/50 focus:border-red-500/50"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {!!error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="text-xs">{error}</span>
              </div>
            )}

            {!!notice && (
              <div className="flex items-center gap-2 text-emerald-300 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="text-xs">{notice}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading || !email || (!isReset && !password) || !isSupabaseConfigured}
              className="w-full h-12 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:scale-100"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                  {isReset ? "Sending..." : "Authenticating..."}
                </span>
              ) : (
                isReset ? "Send reset link" : view === "sign-in" ? "Access Dashboard" : "Create LaggardScan Account"
              )}
            </Button>

            {isReset && (
              <button
                type="button"
                onClick={() => switchView("sign-in")}
                className="flex items-center justify-center gap-1.5 w-full text-xs font-medium text-white/45 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to sign in
              </button>
            )}
          </form>

          <p className="text-[10px] text-center text-white/20 mt-6 tracking-wide">
            Protected access - Authorized users only
          </p>
        </div>
      </div>
    </div>
  )
}
