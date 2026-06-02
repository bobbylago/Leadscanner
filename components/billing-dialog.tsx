"use client"

import { useCallback, useEffect, useState } from "react"
import { CreditCard, Loader2, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { authedFetch } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { FREE_BILLING_STATUS, PLAN_TEXT_COLORS, type BillingStatus } from "@/lib/billing-types"

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "$39",
    credits: "300 lead credits/mo",
    scripts: "300 AI scripts/mo",
    featured: false,
    card: "border-emerald-500/25 bg-emerald-500/[0.045]",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.08)]",
    text: "text-emerald-400",
    button: "bg-emerald-500 text-slate-950 hover:bg-emerald-400",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$79",
    credits: "1,500 lead credits/mo",
    scripts: "1,500 AI scripts/mo",
    featured: true,
    card: "border-cyan-500/35 bg-cyan-500/[0.06]",
    glow: "shadow-[0_0_24px_rgba(6,182,212,0.12)]",
    text: "text-cyan-400",
    button: "bg-cyan-500 text-slate-950 hover:bg-cyan-400",
  },
  {
    id: "agency",
    name: "Agency",
    price: "$149",
    credits: "5,000 lead credits/mo",
    scripts: "5,000 AI scripts/mo",
    featured: false,
    card: "border-violet-500/30 bg-violet-500/[0.05]",
    glow: "shadow-[0_0_22px_rgba(139,92,246,0.10)]",
    text: "text-violet-400",
    button: "bg-violet-500 text-white hover:bg-violet-400",
  },
] as const

interface BillingDialogProps {
  open: boolean
  onClose: () => void
  status?: BillingStatus
  onStatusChange?: (status: BillingStatus) => void
  headline?: string
}

async function readJson(res: Response) {
  return res.json().catch(() => null)
}

export function BillingDialog({
  open,
  onClose,
  status: externalStatus,
  onStatusChange,
  headline = "Billing",
}: BillingDialogProps) {
  const [localStatus, setLocalStatus] = useState<BillingStatus>(FREE_BILLING_STATUS)
  const status = externalStatus ?? localStatus
  const setStatus = onStatusChange ?? setLocalStatus
  const [isLoadingStatus, setIsLoadingStatus] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState("")

  const loadStatus = useCallback(async () => {
    setIsLoadingStatus(true)
    setError("")
    try {
      const res = await authedFetch("/api/billing/status")
      const data = await readJson(res)
      if (res.ok) {
        setStatus(data)
      } else {
        setError(data?.error || "Could not load billing status. Showing Free plan.")
      }
    } catch {
      setError("Could not reach billing. Check the deployment environment variables.")
    } finally {
      setIsLoadingStatus(false)
    }
  }, [setStatus])

  useEffect(() => {
    if (open) loadStatus()
  }, [loadStatus, open])

  const openCheckout = async (plan: string) => {
    setLoadingPlan(plan)
    setError("")
    try {
      const res = await authedFetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })
      const data = await readJson(res)

      if (!res.ok || !data?.url) {
        setError(data?.error || "Could not start checkout. Check Stripe price IDs and redeploy Vercel.")
        return
      }

      window.location.assign(data.url)
    } catch {
      setError("Could not start checkout. Check Stripe environment variables and redeploy Vercel.")
    } finally {
      setLoadingPlan(null)
    }
  }

  const openPortal = async () => {
    setLoadingPlan("portal")
    setError("")
    try {
      const res = await authedFetch("/api/billing/portal", { method: "POST" })
      const data = await readJson(res)

      if (!res.ok || !data?.url) {
        setError(data?.error || "Could not open billing portal. Make sure Stripe Customer Portal is configured.")
        return
      }

      window.location.assign(data.url)
    } catch {
      setError("Could not open billing portal. Make sure Stripe Customer Portal is configured.")
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={value => { if (!value) onClose() }}>
      <DialogContent className="bg-slate-900 border-white/10 text-white max-w-2xl max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain p-0 gap-0">
        <DialogHeader className="sticky top-0 z-10 border-b border-white/10 bg-slate-900 px-4 py-4 sm:px-6">
          <DialogTitle className="flex items-center gap-2 pr-8 text-white">
            <CreditCard className="w-5 h-5 text-cyan-400 shrink-0" />
            <span className="truncate">{headline}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 py-4 sm:px-6 space-y-4">
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-3 sm:p-4 grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider font-mono">Current Plan</p>
              <p className={cn("text-lg font-black capitalize", PLAN_TEXT_COLORS[status.plan])}>
                {isLoadingStatus ? "Free" : status.plan}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs text-white/40 uppercase tracking-wider font-mono">Lead credits</p>
              <p className="text-sm font-bold">
                {isLoadingStatus ? "..." : `${status.scansUsed} / ${status.scanLimit}`}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs text-white/40 uppercase tracking-wider font-mono">AI scripts</p>
              <p className="text-sm font-bold">
                {isLoadingStatus ? "..." : `${status.outreachUsed} / ${status.outreachLimit}`}
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {PLANS.map(plan => (
              <div
                key={plan.id}
                className={cn(
                  "rounded-xl border p-4 space-y-4 transition-all",
                  plan.card,
                  plan.glow
                )}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className={cn("font-black", plan.text)}>{plan.name}</p>
                    {plan.featured && <Zap className={cn("w-3.5 h-3.5", plan.text)} />}
                  </div>
                  <p className={cn("text-2xl font-black mt-1", plan.text)}>
                    {plan.price}
                    <span className="text-xs text-white/35 font-medium">/mo</span>
                  </p>
                  <p className="text-xs text-white/45 mt-1">{plan.credits}</p>
                  <p className="text-xs text-white/45 mt-1">{plan.scripts}</p>
                  <p className="text-[11px] text-white/35 mt-1">Google Places data included</p>
                </div>
                <Button
                  onClick={() => openCheckout(plan.id)}
                  disabled={loadingPlan !== null || status.plan === plan.id}
                  className={cn("w-full font-bold disabled:opacity-40", plan.button)}
                >
                  {loadingPlan === plan.id && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {status.plan === plan.id ? "Current" : "Upgrade"}
                </Button>
              </div>
            ))}
          </div>

          {status.plan !== "free" && (
            <Button
              onClick={openPortal}
              disabled={loadingPlan !== null}
              variant="ghost"
              className="w-full border border-white/10 text-white/65 hover:text-white sm:w-auto"
            >
              {loadingPlan === "portal" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Manage Subscription
            </Button>
          )}

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
