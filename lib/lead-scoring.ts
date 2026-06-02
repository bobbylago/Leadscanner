import type { Lead } from "./types"

export type LeadValueTier = "Hot" | "Warm" | "Low"

export interface LeadValueProfile {
  score: number
  tier: LeadValueTier
  reasons: string[]
  penalties: string[]
}

const INDUSTRY_VALUE_BONUS: Record<string, number> = {
  Plumbing: 24,
  HVAC: 24,
  Roofing: 22,
  Dental: 21,
  Electrician: 18,
  "Home Care Agencies": 16,
  "Home Services": 12,
}

const HIGH_VALUE_TERMS: Record<string, string[]> = {
  Plumbing: [
    "24 hour", "24/7", "emergency", "same day", "drain", "sewer",
    "water heater", "repiping", "commercial", "leak", "rooter",
  ],
  HVAC: [
    "24 hour", "24/7", "emergency", "same day", "ac repair",
    "air conditioning", "furnace", "commercial", "heating", "cooling",
  ],
  Roofing: [
    "storm", "emergency", "commercial", "insurance", "repair",
    "replacement", "gutter", "hail", "leak",
  ],
  Dental: [
    "emergency", "cosmetic", "implant", "orthodont", "family",
    "sedation", "new patient",
  ],
  Electrician: [
    "emergency", "24 hour", "24/7", "commercial", "panel",
    "generator", "wiring", "same day",
  ],
  "Home Care Agencies": [
    "private duty", "senior care", "home health", "caregiver",
    "companion", "24 hour", "live in",
  ],
  "Home Services": [
    "emergency", "same day", "remodel", "repair", "commercial",
    "restoration", "water damage",
  ],
}

const INDUSTRY_RELEVANCE_TERMS: Record<string, string[]> = {
  Plumbing: [
    "plumber", "plumbing", "drain", "sewer", "rooter", "pipe repair",
    "pipe replacement", "water heater", "repiping", "leak repair",
  ],
  HVAC: [
    "hvac", "heating", "cooling", "air conditioning", "air condition",
    "ac repair", "a c repair", "furnace", "ventilation", "air duct",
  ],
  Roofing: [
    "roof", "roofing", "roofer", "shingle", "gutter", "storm damage",
  ],
  Dental: [
    "dentist", "dental", "orthodont", "smiles", "endodont", "periodont",
    "implant", "cosmetic dentistry",
  ],
  Electrician: [
    "electric", "electrical", "electrician", "wiring", "generator", "panel",
  ],
  "Home Care Agencies": [
    "home care", "home health", "senior care", "caregiver", "private duty",
    "companion care", "in home care",
  ],
  "Home Services": [
    "handyman", "contractor", "remodel", "renovation", "repair", "painter",
    "landscap", "home services", "cleaning", "restoration",
  ],
}

const CONFLICTING_TERMS_BY_INDUSTRY: Record<string, string[]> = {
  HVAC: [
    "dentist", "dental", "smiles", "orthodont", "dry cleaner", "dry cleaners",
    "laundry", "laundromat", "clothes", "clothing", "garment", "alteration",
    "tailor", "carpet cleaning", "house cleaning", "maid service", "janitorial",
    "car wash", "auto body", "body shop", "collision", "frame repair",
    "restaurant", "cafe", "salon", "spa",
  ],
  Plumbing: [
    "dentist", "dental", "smiles", "orthodont", "dry cleaner", "laundry",
    "clothing", "restaurant", "salon", "spa", "smoke shop", "tobacco",
    "vape", "vapor", "cigar", "hookah", "cbd", "cannabis", "head shop",
  ],
  Roofing: [
    "dentist", "dental", "smiles", "dry cleaner", "laundry", "clothing",
    "restaurant", "salon", "spa",
  ],
  Electrician: [
    "dentist", "dental", "smiles", "dry cleaner", "laundry", "clothing",
    "restaurant", "salon", "spa",
  ],
}

const RETAIL_BAD_FIT_TERMS = [
  "smoke shop", "tobacco shop", "vape shop", "vapor shop", "cigar shop",
  "hookah", "cbd", "cannabis", "dispensary", "head shop", "glass pipe",
]

const GENERAL_BUYER_TERMS = [
  "emergency", "24 hour", "24/7", "same day", "commercial",
  "repair", "service", "replacement", "installation",
]

const CHAIN_MARKERS = [
  "roto-rooter", "mr. rooter", "benjamin franklin", "one hour heating",
  "service experts", "mister sparky", "mr. electric", "aspen dental",
  "western dental", "home instead", "visiting angels", "comfort keepers",
  "right at home", "senior helpers", "home depot", "lowe's", "sears",
]

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizedText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim()
}

function includesTerm(text: string, term: string): boolean {
  return normalizedText(text).includes(normalizedText(term))
}

function matchesAnyTerm(text: string, terms: string[]): boolean {
  return terms.some(term => includesTerm(text, term))
}

export function getIndustryValueBonus(category?: string): number {
  return INDUSTRY_VALUE_BONUS[category ?? ""] ?? 8
}

export function getHighValueKeywordMatches(text: string, category?: string): string[] {
  const haystack = normalizedText(text)
  const terms = [
    ...(HIGH_VALUE_TERMS[category ?? ""] ?? []),
    ...GENERAL_BUYER_TERMS,
  ]
  return Array.from(new Set(terms.filter(term => includesTerm(haystack, term))))
}

export function hasPositiveIndustrySignal(text: string, category?: string): boolean {
  return matchesAnyTerm(text, INDUSTRY_RELEVANCE_TERMS[category ?? ""] ?? [])
}

export function hasConflictingIndustrySignal(text: string, category?: string): boolean {
  return matchesAnyTerm(text, [
    ...RETAIL_BAD_FIT_TERMS,
    ...(CONFLICTING_TERMS_BY_INDUSTRY[category ?? ""] ?? []),
  ])
}

export function isBusinessTextRelevantToIndustry(
  text: string,
  category?: string,
  opts: { exactTagMatch?: boolean; requirePositive?: boolean } = {},
): boolean {
  if (!category) return true
  if (hasConflictingIndustrySignal(text, category)) return false
  if (!opts.requirePositive) return true
  return opts.exactTagMatch === true || hasPositiveIndustrySignal(text, category)
}

export function isLeadRelevantToCategory(lead: Lead): boolean {
  const strictScannedCategories = new Set([
    "Plumbing",
    "HVAC",
    "Roofing",
    "Dental",
    "Electrician",
    "Home Care Agencies",
  ])

  return isBusinessTextRelevantToIndustry(
    `${lead.name} ${lead.website ?? ""}`,
    lead.category,
    { requirePositive: !lead.isCustom && strictScannedCategories.has(lead.category ?? "") },
  )
}

export function scoreHighValueKeywords(text: string, category?: string): number {
  const matches = getHighValueKeywordMatches(text, category)
  return Math.min(18, matches.length * 4)
}

export function hasLikelyChainName(name: string): boolean {
  const text = normalizedText(name)
  return CHAIN_MARKERS.some(marker => text.includes(marker))
}

export function getLeadValueTier(score: number): LeadValueTier {
  if (score >= 72) return "Hot"
  if (score >= 54) return "Warm"
  return "Low"
}

export function getHighValueLeadProfile(lead: Lead): LeadValueProfile {
  const reasons: string[] = []
  const penalties: string[] = []
  let score = 18

  const categoryBonus = getIndustryValueBonus(lead.category)
  score += categoryBonus
  if (categoryBonus >= 20) reasons.push("high-ticket niche")
  else if (categoryBonus >= 16) reasons.push("service business niche")

  if (lead.phone) {
    score += 14
    reasons.push("phone number available")
  } else {
    score -= 8
    penalties.push("no phone found")
  }

  if (lead.website) {
    score += 14
    reasons.push("website found")
  } else {
    score -= 12
    penalties.push("no website found")
  }

  const signals = lead.realAudit?.signals
  const noInstantResponse = signals
    ? !signals.chatbotProvider && !signals.bookingProvider
    : lead.status === "Needs AI Chatbot"

  if (noInstantResponse && lead.website) {
    score += signals ? 20 : 10
    reasons.push(signals ? "no chatbot or booking found" : "likely needs instant follow-up")
  }

  if (signals?.bookingProvider || signals?.chatbotProvider) {
    score -= 14
    penalties.push("already has response automation")
  }
  if (signals?.hasContactForm) {
    score += 5
    reasons.push("contact form found")
  }
  if ((signals?.emails?.length ?? 0) > 0) {
    score += 7
    reasons.push("public email found")
  }

  if (lead.status === "Old Website") {
    score += 6
    reasons.push("old website angle")
  } else if (lead.status === "No Website") {
    score -= 8
    penalties.push("lead recovery offer is weaker without a site")
  }

  if (lead.reviews > 0) {
    if (lead.reviews >= 50 && lead.reviews <= 350) {
      score += 12
      reasons.push("strong local review base")
    } else if (lead.reviews > 350) {
      score += 7
      reasons.push("large local presence")
    } else if (lead.reviews >= 15) {
      score += 7
      reasons.push("active local business")
    } else {
      score -= 4
      penalties.push("low review signal")
    }
  }

  if (lead.rating >= 4.2) score += 4
  else if (lead.rating > 0 && lead.rating < 3.8) score -= 4

  const keywordMatches = getHighValueKeywordMatches(`${lead.name} ${lead.website ?? ""}`, lead.category)
  if (keywordMatches.length > 0) {
    score += Math.min(16, keywordMatches.length * 4)
    reasons.push(`${keywordMatches.slice(0, 2).join(", ")} intent`)
  }

  if ((lead.qualityScore ?? 0) >= 70) score += 6
  else if ((lead.qualityScore ?? 0) >= 55) score += 3

  if (lead.websiteVerified === true) {
    score += 4
    reasons.push("live website verified")
  } else if (lead.websiteVerified === false) {
    score -= 5
    penalties.push("website may be down")
  }

  if (hasLikelyChainName(lead.name)) {
    score -= 26
    penalties.push("likely chain or franchise")
  }

  const finalScore = clampScore(score)
  return {
    score: finalScore,
    tier: getLeadValueTier(finalScore),
    reasons: Array.from(new Set(reasons)).slice(0, 5),
    penalties: Array.from(new Set(penalties)).slice(0, 4),
  }
}
