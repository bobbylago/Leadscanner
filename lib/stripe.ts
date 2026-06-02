import Stripe from "stripe"

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-05-27.dahlia",
    })
  : null

export const STRIPE_PRICE_IDS = {
  starter: process.env.STRIPE_STARTER_PRICE_ID,
  pro: process.env.STRIPE_PRO_PRICE_ID,
  agency: process.env.STRIPE_AGENCY_PRICE_ID,
} as const

export type PlanName = keyof typeof STRIPE_PRICE_IDS

// Monthly lead credits. A scan that returns 50 leads spends 50 credits.
export const PLAN_LIMITS: Record<PlanName | "free", number> = {
  free: 50,
  starter: 300,
  pro: 1500,
  agency: 5000,
}

export function planFromPriceId(priceId: string | null | undefined): PlanName | "free" {
  const entry = Object.entries(STRIPE_PRICE_IDS).find(([, value]) => value && value === priceId)
  return (entry?.[0] as PlanName | undefined) ?? "free"
}

export function appUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}
