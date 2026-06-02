import type { Lead } from "./types"
import { calcHealthScore, calcRevenueLeak } from "./utils"
import { formatCurrency, languageForCountry } from "./country-utils"
import { cleanBusinessName, normalizeSenderName, renderTemplate } from "./email-utils"

export type OutreachTone = "direct" | "friendly" | "premium"

export interface GeneratedOutreach {
  subject: string
  body: string
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash"
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

function toneLabel(tone: OutreachTone): string {
  if (tone === "premium") return "premium agency: polished, concise, confident, not hypey"
  if (tone === "friendly") return "friendly: warm, plainspoken, casual-professional"
  return "direct: concise, practical, specific, no fluff"
}

function issueSummary(lead: Lead): string[] {
  const issues: string[] = []
  const signals = lead.realAudit?.signals

  if (lead.status === "No Website") issues.push("No website found in the source data")
  if (lead.status === "Old Website") issues.push("Website appears outdated")
  if (lead.status === "Needs AI Chatbot") issues.push("No instant response path detected")

  if (signals) {
    if (!signals.hasContactForm && !signals.bookingProvider && !signals.chatbotProvider) {
      issues.push("No clear instant quote or booking path detected")
    } else {
      if (!signals.bookingProvider) issues.push("No online booking path detected")
      if (!signals.chatbotProvider) issues.push("No instant follow-up path detected")
    }
    if (!signals.hasPhoneLink) issues.push("Phone contact is not one-tap from the site")
    if (signals.responseTimeMs > 4000) issues.push("Site may respond slowly for visitors")
  }

  return Array.from(new Set(issues)).slice(0, 5)
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pickBySeed<T>(items: readonly T[], seed: number): T {
  return items[seed % items.length]
}

function leadFacts(lead: Lead): string[] {
  const facts: string[] = []
  const domain = lead.website?.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
  const signals = lead.realAudit?.signals

  if (domain) facts.push(`Website found: ${domain}`)
  if (lead.phone) facts.push("Phone number listed")
  if (lead.rating > 0 && lead.reviews > 0) facts.push(`Google profile shows ${lead.rating.toFixed(1)} rating from ${lead.reviews} reviews`)
  else if (lead.reviews > 0) facts.push(`Google profile shows ${lead.reviews} reviews`)
  if (signals?.hasContactForm) facts.push("Contact form detected")
  if ((signals?.emails?.length ?? 0) > 0) facts.push("Public contact email found")
  if (signals && !signals.chatbotProvider && !signals.bookingProvider) facts.push("No chatbot or booking provider detected")
  if (lead.status === "No Website") facts.push("No website found in the source data")
  if (lead.status === "Old Website") facts.push("Website URL appears to use an older setup")

  return facts.slice(0, 5)
}

function personalizationPlan(lead: Lead) {
  const category = lead.category ?? "local business"
  const seed = hashString(`${lead.id}:${lead.name}:${lead.website ?? ""}:${lead.phone ?? ""}`)
  const commonAngles = [
    "new inquiries that come in after hours",
    "missed calls that need a fast text-back",
    "website form requests that need an instant next step",
    "customers comparing providers and choosing whoever responds first",
  ] as const
  const anglesByCategory: Record<string, readonly string[]> = {
    HVAC: [
      "after-hours AC or heating quote requests",
      "urgent repair calls during busy weather",
      "missed calls from homeowners who need service quickly",
      "website visitors looking for a fast AC or furnace appointment",
    ],
    Plumbing: [
      "urgent leak, drain, or water heater requests",
      "missed calls from people who need a plumber quickly",
      "after-hours plumbing quote requests",
      "website visitors trying to book the next available plumber",
    ],
    Roofing: [
      "storm damage and roof repair inquiries",
      "homeowners asking for roof inspections or estimates",
      "after-hours roof repair quote requests",
      "website visitors comparing roofing contractors",
    ],
    Electrician: [
      "panel, wiring, or repair calls that need a quick response",
      "after-hours electrical service requests",
      "missed calls from people who need an electrician soon",
      "website visitors trying to schedule electrical work",
    ],
    Dental: [
      "new patient calls that reach the front desk at the wrong time",
      "appointment requests that need a fast reply",
      "missed calls from people looking for a dentist",
      "front desk overflow when patients ask about availability",
    ],
    "Home Care Agencies": [
      "client inquiries from families comparing care options",
      "caregiver applicants who need quick follow-up",
      "missed calls from families asking about availability",
      "intake requests that should get a fast next step",
    ],
  }

  const structures = [
    "observation -> business impact -> AI follow-up offer -> permission CTA",
    "quick question -> specific risk -> AI text-back offer -> short demo CTA",
    "website/contact path observation -> customer wait problem -> booking next-step offer -> audit CTA",
    "missed-call scenario -> why speed matters -> what the AI collects -> permission CTA",
  ] as const

  const openers = [
    "Start with a concrete observation about this business or its contact path.",
    "Start with a quick question instead of a statement.",
    "Start by naming the type of inquiry the business likely cares about.",
    "Start with the website/contact path, then move to the follow-up problem.",
  ] as const

  const ctas = [
    "Want me to send a 2-minute demo?",
    "Open to seeing a quick 2-minute example?",
    "Should I send over a short demo?",
    "Would it be useful if I sent a quick audit?",
  ] as const

  return {
    uniquenessSeed: seed,
    angleToUse: pickBySeed(anglesByCategory[category] ?? commonAngles, seed),
    structureToUse: pickBySeed(structures, seed >> 3),
    openingStyle: pickBySeed(openers, seed >> 6),
    ctaToUse: pickBySeed(ctas, seed >> 9),
    leadFacts: leadFacts(lead),
  }
}

function leadContext(lead: Lead, senderName: string, fallbackSubject: string, fallbackBody: string) {
  const country = lead.country ?? "US"
  const lang = languageForCountry(country)
  const category = lead.category ?? "local business"
  const homeServiceCategories = ["HVAC", "Plumbing", "Electrician", "Roofing", "Home Services"]
  const offerAngle = homeServiceCategories.includes(category)
    ? "AI missed-call, form, and after-hours quote recovery for home service companies"
    : category === "Dental"
      ? "AI missed-call and new patient inquiry recovery for dental offices"
      : category === "Home Care Agencies"
        ? "AI client inquiry and caregiver applicant follow-up for home care agencies"
        : "AI missed inquiry follow-up for local service businesses"

  return {
    businessName: lead.name,
    cleanFallbackSubject: fallbackSubject,
    cleanFallbackBody: fallbackBody,
    category,
    offerAngle,
    country,
    language: lang,
    website: lead.website,
    phone: lead.phone,
    rating: lead.rating > 0 ? lead.rating : null,
    status: lead.status,
    healthScore: calcHealthScore(lead) >= 0 ? calcHealthScore(lead) : null,
    estimatedOpportunity: formatCurrency(calcRevenueLeak(lead), country),
    issues: issueSummary(lead),
    personalization: personalizationPlan(lead),
    detectedProviders: {
      chatbot: lead.realAudit?.signals.chatbotProvider ?? null,
      booking: lead.realAudit?.signals.bookingProvider ?? null,
      analytics: lead.realAudit?.signals.analyticsProvider ?? null,
    },
    senderName: normalizeSenderName(senderName) || "[Your name]",
  }
}

function extractJson(text: string): GeneratedOutreach {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const raw = (fenced ?? text).trim()

  try {
    const parsed = JSON.parse(raw) as Partial<GeneratedOutreach> | string
    if (typeof parsed === "string") return extractJson(parsed)
    if (parsed.subject && parsed.body) {
      return {
        subject: parsed.subject.trim().slice(0, 120),
        body: parsed.body.trim(),
      }
    }
  } catch {}

  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) throw new Error("Gemini did not return JSON")

  const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<GeneratedOutreach>
  if (!parsed.subject || !parsed.body) throw new Error("Gemini response missing subject/body")

  return {
    subject: parsed.subject.trim().slice(0, 120),
    body: parsed.body.trim(),
  }
}

function cleanGeneratedOutreach(outreach: GeneratedOutreach, lead: Lead, senderName: string): GeneratedOutreach {
  const lang = languageForCountry(lead.country ?? "US")
  const businessName = cleanBusinessName(lead.name, lang)
  const rawSenderName = senderName.trim()
  const normalizedSenderName = normalizeSenderName(senderName)
  const spammySubject = /[:?!]|missed leads|chatbot|lead conversion/i.test(outreach.subject)
  const subject = spammySubject
    ? `Quick idea for ${businessName}`.slice(0, 120)
    : outreach.subject.replace(/[?!]/g, "").replace(/\s+/g, " ").trim().slice(0, 120)

  const body = outreach.body
    .replace(/\bchatbot\b/gi, "instant response path")
    .replace(/\black(?:s|ing)?\b/gi, "does not show")
    .replace(/\bbusinesses like yours\b/gi, "service companies")
    .replace(/\bFor (?:an? )?(?:HVAC|heating and cooling|plumbing|roofing|electrical|electrician|home services?) (?:company|business|contractor|service provider)s?,?\s*/gi, "")
    .replace(/\bFor (?:HVAC|plumbing|roofing|electrical|electrician|home service) companies,?\s*/gi, "")
    .replace(/\bFor plumbers,?\s*/gi, "")
    .replace(/\bFor electricians,?\s*/gi, "")
    .replace(/\bFor roofers,?\s*/gi, "")
    .replace(/\bpotential jobs\b/gi, "jobs")
    .replace(new RegExp(`\\s+for ${businessName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\??`, "gi"), "?")
    .replace(/\bmissed opportunities\b/gi, "missed calls and quote requests")
    .replace(/\bmissed leads\b/gi, "missed calls and quote requests")
    .replace(/\bI noticed (?:that )?(?:your|the) site (?:isn't using|doesn't use|is not using|does not use|is without|lacks)\s+HTTPS\b[^\n.]*[.]?/gi, "I noticed there isn't a clear instant response path for new inquiries.")
    .replace(/\bI noticed (?:that )?(?:your|the) site [^\n.]*\b(?:mobile viewport|viewport meta|SEO metadata|schema markup|schema\.org|meta description)\b[^\n.]*[.]?/gi, "I noticed the quote path could be clearer for new inquiries.")
    .replace(/\b(?:not using|isn't using|doesn't use|without)\s+HTTPS\b[^\n.]*[.]?/gi, "there isn't a clear instant response path for new inquiries.")
    .replace(/\b(?:missing|no|without)\s+(?:a\s+)?mobile viewport(?: meta tag)?\b[^\n.]*[.]?/gi, "the contact path could be easier on phones.")
    .replace(/\b(?:missing|no|without)\s+(?:core\s+)?SEO metadata\b[^\n.]*[.]?/gi, "the quote path could be clearer.")
    .replace(/\b(?:missing|no|without)\s+(?:local\s+)?schema(?: markup)?\b[^\n.]*[.]?/gi, "the quote path could be clearer.")
    .replace(/\b(?:your|the) site there isn't\b/gi, "there isn't")
    .replace(/\b(?:your|the) site the contact path\b/gi, "the contact path")
    .replace(/\bThat can mean a customer calls someone else\b/gi, "That can mean a customer waits, then calls someone else")
    .split(/\n+/)
    .filter(line => !/\b(ensure|ensures|guarantee|guarantees|capture more|every inquiry|viewport meta|schema\.org|meta description|open graph|favicon|html tag|for an hvac company|for a plumbing business|for a roofing company)\b/i.test(line))
    .join("\n\n")
    .trim()

  const polishedBody = rawSenderName && normalizedSenderName
    ? body.replace(new RegExp(rawSenderName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), normalizedSenderName)
    : body

  return { subject, body: polishedBody }
}

export async function generatePersonalizedOutreach(args: {
  lead: Lead
  senderName: string
  tone: OutreachTone
  fallbackSubjectTemplate: string
  fallbackBodyTemplate: string
}): Promise<GeneratedOutreach> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY")

  const normalizedSenderName = normalizeSenderName(args.senderName)
  const fallbackSubject = renderTemplate(args.fallbackSubjectTemplate, args.lead, { senderName: normalizedSenderName })
  const fallbackBody = renderTemplate(args.fallbackBodyTemplate, args.lead, { senderName: normalizedSenderName })
  const context = leadContext(args.lead, normalizedSenderName, fallbackSubject, fallbackBody)

  const prompt = [
    "You write cold email outreach for a founder selling an AI lead recovery service.",
    "Generate one personalized email for one local business lead.",
    "",
    "Rules:",
    "- Return valid JSON only with keys: subject, body.",
    "- Keep subject under 7 words.",
    "- Subject must be plain and human. Do not use a colon, question mark, exclamation mark, or the phrase 'missed leads'.",
    "- Good subject examples: 'Quick idea for {businessName}', 'Quick fix for {businessName}', 'Question for {businessName}'.",
    "- Keep body 45-75 words.",
    "- Do not invent facts, names, revenue, or audit findings.",
    "- The fallback subject/body are only a backup. Do not copy or lightly paraphrase the fallback body.",
    "- Make this email meaningfully different from other leads by using the personalization.angleToUse, structureToUse, openingStyle, ctaToUse, and at least one true leadFact when useful.",
    "- Vary sentence shape. Do not use the same first two sentences as a generic template.",
    "- For first-touch outreach, do not mention estimated money lost or monthly opportunity unless the fallback email already emphasizes it.",
    "- Mention at most 1 specific issue from the provided issue list.",
    "- Open with the business name or their website/contact path, not with a generic industry statement.",
    "- Do not mention technical audit details such as HTTPS, SSL, mobile viewport, meta tags, schema markup, page speed, scripts, OpenGraph, favicon, HTML, or SEO metadata.",
    "- Translate technical website signals into plain business impact: unclear quote path, slow response, after-hours inquiries, missed calls, or customers calling another company.",
    "- For HVAC leads, the safest opener is about after-hours AC/heating inquiries or no clear instant quote path.",
    "- For HVAC, Plumbing, Electrician, Roofing, and Home Services leads, frame the offer around missed calls, website forms, after-hours quote requests, and booked jobs.",
    "- For Dental leads, frame the offer around missed calls, new patient requests, and front desk overflow.",
    "- For Home Care Agencies, frame the offer around client inquiries and caregiver applicants.",
    "- Avoid these phrases: our platform, visitor engagement, lead conversion, streamline, optimized, in place, lead pipeline, businesses like yours, missed opportunities, slip away, how busy things get, missed leads, lacks, chatbot.",
    "- Avoid generic industry phrasing like 'For HVAC companies', 'For an HVAC company', 'For plumbing businesses', or 'For a roofing company'. Write directly to this business instead.",
    "- Do not start the second sentence with 'For a/an [industry] company/business'. Use 'That can mean...' instead.",
    "- Do not repeat the full business name in the CTA if it already appears in the greeting.",
    "- Prefer first person singular: 'I set up...' instead of 'we use...' or 'we help...'.",
    "- Mention AI at most once.",
    "- Do not repeat the same benefit in two different sentences.",
    "- Do not guarantee outcomes. Avoid 'ensures', 'guarantees', 'capture more', or 'every inquiry'.",
    "- Sound like a practical person writing one business owner, not a marketing brochure.",
    "- Do not sound spammy, pushy, or overhyped.",
    "- Avoid fake compliments and avoid saying you found something if it is not in context.",
    "- CTA should ask for permission to send a quick 2-minute audit or short demo. Prefer the provided ctaToUse.",
    "- Use the sender name exactly as provided in the lead context.",
    `- Tone: ${toneLabel(args.tone)}.`,
    "",
    "Lead context JSON:",
    JSON.stringify(context, null, 2),
  ].join("\n")

  const res = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: args.tone === "direct" ? 0.72 : 0.82,
        topP: 0.9,
        maxOutputTokens: 1000,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    }),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.error?.message || "Gemini outreach generation failed")
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("") ?? ""
  if (!text.trim()) throw new Error("Gemini returned an empty response")

  return cleanGeneratedOutreach(extractJson(text), args.lead, normalizedSenderName)
}
