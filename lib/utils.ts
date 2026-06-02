import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Lead } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calcRevenueLeak(lead: Lead): number {
  // Conservative monthly opportunity estimate. Review count is a proxy for
  // business size, but it is capped so large brands do not create absurd values.
  const reviews = lead.reviews || 10
  const estimatedMonthlyVisitors = Math.min(Math.max(Math.sqrt(reviews) * 55, 60), 3500)
  const avgLeadValue = lead.category === "Dental" ? 220 : 165
  let leakFactor = 0

  // Refine with audit signals ONLY when a real audit has run — otherwise the
  // estimate is driven purely by the (real) status so we never surface numbers
  // derived from placeholder scores.
  const audit = lead.realAudit
  const audited = !!audit

  if (lead.status === "No Website") {
    leakFactor = 0.10
  } else if (lead.status === "Old Website") {
    leakFactor = 0.045
    if (audited) {
      if (audit.chatbotPresence < 25) leakFactor += 0.025
      else if (audit.chatbotPresence < 50) leakFactor += 0.012
      if (audit.pageSpeed < 40) leakFactor += 0.012
      if (audit.mobileFriendliness < 50) leakFactor += 0.016
    }
  } else if (audited) {
    if (audit.chatbotPresence < 25) leakFactor += 0.035
    else if (audit.chatbotPresence < 50) leakFactor += 0.018
    if (audit.seo < 60) leakFactor += 0.018
    if (audit.pageSpeed < 40) leakFactor += 0.012
    if (audit.socialPresence < 30) leakFactor += 0.008
  } else {
    // Has a site, not yet audited — modest baseline pending real findings.
    leakFactor = 0.03
  }

  return Math.round(Math.min(estimatedMonthlyVisitors * leakFactor * avgLeadValue, 45000))
}

/**
 * 0–100 health score. Returns -1 when the lead has not had a real audit yet, so
 * callers can render a "not audited" state instead of a misleading number.
 */
export function calcHealthScore(lead: Lead): number {
  if (lead.status === "No Website") return 0
  if (!lead.realAudit) return -1
  const { seo, mobileFriendliness, chatbotPresence, pageSpeed, socialPresence } = lead.realAudit
  // Weighted for local-business lead value: search visibility, mobile usability,
  // conversion/contact readiness, speed, and trust signals.
  const weighted = (seo * 0.24) + (mobileFriendliness * 0.22) + (chatbotPresence * 0.22) + (pageSpeed * 0.18) + (socialPresence * 0.14)
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
