"use client"

import { useState, useEffect } from "react"
import { Dashboard } from "@/components/dashboard"
import { LoginScreen } from "@/components/login-screen"

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Check if user was previously authenticated in this session
  useEffect(() => {
    const authStatus = sessionStorage.getItem("laggardScanAuth")
    if (authStatus === "true") {
      setIsAuthenticated(true)
    }
    setIsLoading(false)
  }, [])

  const handleLogin = () => {
    sessionStorage.setItem("laggardScanAuth", "true")
    setIsAuthenticated(true)
  }

  // Show nothing while checking auth status to prevent flash
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />
  }

  return <Dashboard />
}
