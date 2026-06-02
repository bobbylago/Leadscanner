"use client"

import { useEffect, useState } from "react"
import { Dashboard } from "@/components/dashboard"
import { LoginScreen } from "@/components/login-screen"
import { UpdatePasswordScreen } from "@/components/update-password-screen"
import { clearSavedScans } from "@/lib/saved-scans"
import { supabase, isSupabaseConfigured } from "@/lib/supabase-client"

const CLEAR_SAVED_SCANS_PENDING_KEY = "ls_clear_saved_scans_pending_v1"

function clearLocalLeadStorage() {
  localStorage.removeItem("ls_custom_leads_v2")
  localStorage.removeItem("ls_scanned_cities_v1")
  localStorage.removeItem("ls_map_centers_v1")
  localStorage.removeItem("ls_audit_cache_v1")
  localStorage.removeItem("ls_audit_cache_v2")

  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("ls_generated_outreach_")) localStorage.removeItem(key)
  }
}

async function clearPendingSavedScans() {
  if (localStorage.getItem(CLEAR_SAVED_SCANS_PENDING_KEY) !== "true") return
  const cleared = await clearSavedScans()
  if (cleared) localStorage.removeItem(CLEAR_SAVED_SCANS_PENDING_KEY)
}

export function AppShell() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRecovering, setIsRecovering] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("clearLeads") === "1") {
      clearLocalLeadStorage()
      localStorage.setItem(CLEAR_SAVED_SCANS_PENDING_KEY, "true")
      params.delete("clearLeads")
      const query = params.toString()
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
    }

    if (!isSupabaseConfigured || !supabase) {
      setIsAuthenticated(false)
      setIsLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(Boolean(data.session))
      if (data.session) void clearPendingSavedScans()
      setIsLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // A recovery link signs the user in with a temporary session — prompt for
      // a new password before letting them into the app.
      if (event === "PASSWORD_RECOVERY") setIsRecovering(true)
      setIsAuthenticated(Boolean(session))
      if (session) void clearPendingSavedScans()
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080b10] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
          <p className="text-xs font-mono text-white/35">Loading LaggardScan</p>
        </div>
      </div>
    )
  }

  if (isRecovering) {
    return <UpdatePasswordScreen onDone={() => setIsRecovering(false)} />
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} />
  }

  return <Dashboard />
}
