export type PlanId = "free" | "starter" | "pro" | "agency"

export interface BillingStatus {
  plan: PlanId
  status: string
  isActive?: boolean
  scanLimit: number
  scansUsed: number
  scansRemaining: number
  outreachLimit: number
  outreachUsed: number
  outreachRemaining: number
  currentPeriodEnd?: string | null
}

export const FREE_BILLING_STATUS: BillingStatus = {
  plan: "free",
  status: "free",
  isActive: false,
  scanLimit: 50,
  scansUsed: 0,
  scansRemaining: 50,
  outreachLimit: 10,
  outreachUsed: 0,
  outreachRemaining: 10,
  currentPeriodEnd: null,
}

export const PLAN_TEXT_COLORS: Record<PlanId, string> = {
  free: "text-white",
  starter: "text-emerald-400",
  pro: "text-cyan-400",
  agency: "text-violet-400",
}
