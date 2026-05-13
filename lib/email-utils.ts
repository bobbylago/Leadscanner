import type { Lead } from "./types"
import { calcRevenueLeak, calcHealthScore } from "./utils"

/** Guess a contact email from a website URL */
export function guessEmail(website: string | null, prefix: string = "info"): string {
  if (!website) return ""
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`)
    let host = url.hostname.toLowerCase()
    if (host.startsWith("www.")) host = host.slice(4)
    return `${prefix}@${host}`
  } catch {
    return ""
  }
}

/** Common email prefixes to suggest */
export const EMAIL_PREFIXES = ["info", "contact", "hello", "office", "team", "admin"] as const

/** Render a template string with {variable} placeholders */
export function renderTemplate(template: string, lead: Lead, extras: Record<string, string> = {}): string {
  const revenueLeak = calcRevenueLeak(lead)
  const healthScore = calcHealthScore(lead)
  const signals = lead.realAudit?.signals

  // Build a concrete "issues" string from real signals if available
  let issues = ""
  if (signals) {
    const list: string[] = []
    if (!signals.isHttps) list.push("your site isn't using HTTPS")
    if (!signals.hasViewport) list.push("there's no mobile viewport tag")
    if (!signals.chatbotProvider && !signals.bookingProvider) list.push("no chatbot or booking system is installed")
    if (!signals.hasSchemaMarkup) list.push("no schema.org markup for local SEO")
    if (signals.responseTimeMs > 3000) list.push(`the homepage takes ${(signals.responseTimeMs/1000).toFixed(1)}s to respond`)
    issues = list.length > 0 ? list.slice(0, 2).join(" and ") : "your site is missing key conversion infrastructure"
  } else {
    if (lead.status === "No Website") issues = "your business has no website yet"
    else if (lead.status === "Old Website") issues = "your current website appears outdated"
    else issues = "your site has no automated lead capture"
  }

  const vars: Record<string, string> = {
    name: lead.name,
    category: lead.category ?? "local business",
    website: lead.website ?? "",
    domain: lead.website ? lead.website.replace(/^https?:\/\//, "").replace(/\/.*/, "") : "",
    phone: lead.phone ?? "",
    rating: String(lead.rating),
    reviews: String(lead.reviews),
    revenueLeak: revenueLeak.toLocaleString(),
    healthScore: String(healthScore),
    issues,
    ...extras,
  }

  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}

/** Build a Gmail compose URL (opens Gmail web with everything pre-filled) */
export function buildGmailUrl(opts: { to: string; subject: string; body: string }): string {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    tf: "1",
    to: opts.to,
    su: opts.subject,
    body: opts.body,
  })
  return `https://mail.google.com/mail/?${params.toString()}`
}

/** Build a mailto: URL as fallback (opens user's default mail app) */
export function buildMailtoUrl(opts: { to: string; subject: string; body: string }): string {
  const params = new URLSearchParams({ subject: opts.subject, body: opts.body })
  return `mailto:${opts.to}?${params.toString()}`
}

/** Default email templates */
export const DEFAULT_SUBJECT = "Quick question about {name}'s online presence"

export const DEFAULT_BODY = [
  "Hi {name} team,",
  "",
  "I was researching {category} businesses in your area and ran a quick digital audit on your site.",
  "",
  "I noticed {issues}.",
  "",
  "Based on your {reviews} reviews, this gap is likely costing you an estimated ${revenueLeak}/month in missed conversions.",
  "",
  "I've built a working prototype that fixes this — happy to share a quick 2-minute demo specifically for {name}. Worth a look?",
  "",
  "Best,",
  "[Your name]",
].join("\n")
