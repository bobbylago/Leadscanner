import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Lead } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calcRevenueLeak(lead: Lead): number {
  // Estimate monthly revenue exposure from weak digital presence
  const estimatedMonthlyVisitors = Math.max(((lead.reviews || 10) / 12) * 20, 50)
  const avgJobValue = 275 // $ per converted visitor
  let leakFactor = 0

  if (lead.status === "No Website") {
    leakFactor = 0.35 // losing ~35% of potential customers
  } else if (lead.status === "Old Website") {
    leakFactor = 0.12
    if ((lead.audit?.chatbotPresence ?? 0) < 20) leakFactor += 0.08
    if ((lead.audit?.pageSpeed ?? 0) < 40) leakFactor += 0.05
    if ((lead.audit?.mobileFriendliness ?? 0) < 50) leakFactor += 0.06
  } else {
    // Needs AI Chatbot
    if ((lead.audit?.chatbotPresence ?? 0) < 20) leakFactor += 0.15
    if ((lead.audit?.seo ?? 100) < 60) leakFactor += 0.06
    if ((lead.audit?.pageSpeed ?? 100) < 40) leakFactor += 0.04
    if ((lead.audit?.socialPresence ?? 100) < 30) leakFactor += 0.03
  }

  return Math.round(estimatedMonthlyVisitors * leakFactor * avgJobValue)
}

export function calcHealthScore(lead: Lead): number {
  if (lead.status === "No Website") return 0
  const { seo, mobileFriendliness, chatbotPresence, pageSpeed, socialPresence } = lead.audit
  // Weighted: SEO and page speed matter most for discoverability
  const weighted = (seo * 0.25) + (mobileFriendliness * 0.20) + (chatbotPresence * 0.20) + (pageSpeed * 0.20) + (socialPresence * 0.15)
  return Math.round(weighted)
}

export function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-400"
  if (score >= 40) return "text-orange-400"
  return "text-red-400"
}

export function scoreGradient(score: number): string {
  if (score >= 70) return "from-emerald-500 to-teal-400"
  if (score >= 40) return "from-orange-500 to-amber-400"
  return "from-red-600 to-red-400"
}

export function scoreStroke(score: number): string {
  if (score >= 70) return "#34d399"
  if (score >= 40) return "#fb923c"
  return "#f87171"
}

/** Generate deterministic, realistic audit scores from available lead data */
export function generateAuditScores(lead: {
  name: string
  website: string | null
  phone: string | null
  rating: number
  reviews: number
  status: string
}) {
  const seed = lead.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  // Two independent pseudo-random streams
  const rng1 = ((seed * 1664525 + 1013904223) >>> 0) % 100
  const rng2 = ((seed * 22695477 + 1) >>> 0) % 100
  const rng3 = ((seed * 214013 + 2531011) >>> 0) % 100

  const isNoSite = lead.status === "No Website"
  const isOldSite = lead.status === "Old Website"
  const needsBot = lead.status === "Needs AI Chatbot"

  const hasWebsite = !!lead.website
  const isHttps = hasWebsite && lead.website!.startsWith('https://')
  const hasPhone = !!lead.phone

  // Signals
  const reviewsSignal = Math.min(100, Math.log1p(lead.reviews || 1) / Math.log1p(1000) * 100)
  const ratingSignal = lead.rating ? Math.min(100, ((lead.rating - 1) / 4) * 100) : 0
  const establishedSignal = (lead.reviews || 0) > 100 ? 15 : (lead.reviews || 0) > 30 ? 8 : 0

  if (isNoSite) {
    // No website — technically zero for web metrics, but social can exist
    return {
      seo: 0,
      mobileFriendliness: 0,
      chatbotPresence: 0,
      pageSpeed: 0,
      socialPresence: Math.max(5, Math.min(45,
        Math.round((lead.reviews || 0) > 50 ? 30 + (rng1 % 15) : 8 + (rng1 % 18))
      )),
    }
  }

  // SEO: driven by reviews, rating, HTTPS, domain age signals
  const seo = Math.max(12, Math.min(92, Math.round(
    reviewsSignal * 0.35 +
    ratingSignal * 0.30 +
    (isHttps ? 18 : 0) +
    (isOldSite ? -15 : 0) +
    (hasPhone ? 5 : 0) +
    establishedSignal +
    (rng1 % 14) - 5
  )))

  // Mobile: HTTPS sites generally have responsive design; old sites don't
  const mobileFriendliness = Math.max(10, Math.min(92, Math.round(
    (isHttps ? 52 : 22) +
    (isOldSite ? -28 : 0) +
    ratingSignal * 0.18 +
    (rng2 % 18) - 6
  )))

  // Chatbot: businesses needing one have very low scores; those with one score high
  const chatbotPresence = needsBot
    ? Math.max(0, Math.min(18, Math.round(2 + (rng3 % 14))))
    : isOldSite
      ? Math.max(0, Math.min(28, Math.round(6 + (rng1 % 20))))
      : Math.max(35, Math.min(92, Math.round(42 + reviewsSignal * 0.22 + (rng2 % 22))))

  // Page speed: HTTPS modern sites are faster; old HTTP sites tend to be slow
  const pageSpeed = Math.max(8, Math.min(94, Math.round(
    (isHttps ? 50 : 18) +
    (isOldSite ? -25 : 0) +
    (lead.rating >= 4.5 ? 8 : lead.rating >= 4.0 ? 4 : 0) +
    (rng3 % 22) - 8
  )))

  // Social: correlated with review volume and overall business visibility
  const socialPresence = Math.max(8, Math.min(92, Math.round(
    (reviewsSignal > 60 ? 55 : reviewsSignal > 35 ? 38 : reviewsSignal > 15 ? 22 : 10) +
    (lead.rating >= 4.5 ? 12 : lead.rating >= 4.0 ? 6 : 0) +
    (hasWebsite ? 10 : 0) +
    (rng1 % 16) - 5
  )))

  return { seo, mobileFriendliness, chatbotPresence, pageSpeed, socialPresence }
}
