"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Lock, Eye, EyeOff, AlertCircle, Radar } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoginScreenProps {
  onLogin: () => void
}

const CORRECT_PASSWORD = "Viggop123"

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return
    setIsLoading(true)
    setError(false)

    setTimeout(() => {
      if (password === CORRECT_PASSWORD) {
        onLogin()
      } else {
        setError(true)
        setIsLoading(false)
      }
    }, 500)
  }

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
            <p className="text-xs text-white/40 mt-1 tracking-widest uppercase font-medium">Intelligence Platform</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter access code"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(false) }}
                  className={cn(
                    "pl-10 pr-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/20",
                    "focus:border-cyan-500/40 focus:bg-white/6 transition-colors",
                    error && "border-red-500/50 focus:border-red-500/50"
                  )}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs">Incorrect password. Please try again.</span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading || !password}
              className="w-full h-12 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:scale-100"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : (
                "Access Dashboard"
              )}
            </Button>
          </form>

          <p className="text-[10px] text-center text-white/20 mt-6 tracking-wide">
            Protected access · Authorized users only
          </p>
        </div>
      </div>
    </div>
  )
}
