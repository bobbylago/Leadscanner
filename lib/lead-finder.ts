/**
 * Smart lead discovery.
 *
 * Strategy:
 *   1. Multiple OSM tag combinations per industry (cast wide net)
 *   2. Optional Nominatim free-text fallback (catches businesses without proper tags)
 *   3. Deduplicate by name similarity + geographic proximity
 *   4. Filter known chains/franchises
 *   5. Verify website status with lightweight requests (best effort)
 *   6. Score every lead for "quality" — hot leads bubble up
 */

import { EMPTY_AUDIT } from "./types"
import { safeFetch } from "./net-guard"
import {
  getIndustryValueBonus,
  hasLikelyChainName,
  isBusinessTextRelevantToIndustry,
  scoreHighValueKeywords,
} from "./lead-scoring"
import { findGooglePlacesLeads, hasGooglePlacesKey } from "./google-places"

// ── Industry definition ────────────────────────────────────────

interface IndustrySpec {
  /** OSM tag pairs (key, value) — searched in parallel */
  tags: Array<[string, string]>
  /** Free-text keywords for Nominatim fallback */
  keywords: string[]
  /** Name/brand/operator text patterns for Deep Scan */
  namePatterns: string[]
  /** Name patterns that signal this is a chain (case-insensitive substring) */
  chainPatterns: string[]
}

const INDUSTRIES: Record<string, IndustrySpec> = {
  Plumbing: {
    tags: [
      ["craft", "plumber"], ["shop", "plumber"], ["office", "plumber"],
      ["craft", "drainage"],
    ],
    keywords: ["plumber", "plumbing", "drain cleaning", "water heater repair", "emergency plumber", "24 hour plumber", "commercial plumber", "sewer repair"],
    namePatterns: ["plumb", "plumbing", "plumber", "drain", "sewer", "rooter", "water heater", "repiping", "pipe repair", "24 hour"],
    chainPatterns: ["roto-rooter", "mr. rooter", "benjamin franklin plumbing", "ars/rescue", "michael & son"],
  },
  Electrician: {
    tags: [
      ["craft", "electrician"], ["shop", "electrician"], ["office", "electrician"],
      ["craft", "electrical_engineer"],
    ],
    keywords: ["electrician", "electric", "electrical contractor", "emergency electrician", "residential electrician"],
    namePatterns: ["electric", "electrical", "electrician", "wiring", "power"],
    chainPatterns: ["mister sparky", "mr. electric", "aaron's electric"],
  },
  HVAC: {
    tags: [
      ["craft", "hvac"], ["shop", "hvac"], ["craft", "heating_engineer"],
      ["craft", "air_conditioning"], ["shop", "air_conditioning"],
    ],
    keywords: ["hvac", "heating", "air conditioning", "ac repair", "emergency ac repair", "commercial hvac", "furnace repair", "air conditioning contractor", "heating contractor"],
    namePatterns: ["hvac", "heating", "cooling", "air conditioning", "air condition", "a/c", "furnace", "ventilation", "air duct", "24 hour"],
    chainPatterns: ["one hour heating", "horizon services", "service experts"],
  },
  Dental: {
    tags: [
      ["amenity", "dentist"], ["healthcare", "dentist"],
      ["office", "dentist"], ["shop", "medical_supply"],
    ],
    keywords: ["dentist", "dental", "family dentist", "cosmetic dentist", "dental clinic", "emergency dentist"],
    namePatterns: ["dentist", "dental", "orthodont", "smiles", "endodont", "periodont"],
    chainPatterns: ["aspen dental", "western dental", "castle dental", "brident dental", "great expressions"],
  },
  Roofing: {
    tags: [
      ["craft", "roofer"], ["craft", "roofing"], ["shop", "roofing"],
    ],
    keywords: ["roofer", "roofing", "roof repair", "roofing contractor", "storm damage roof", "commercial roofing", "emergency roof repair"],
    namePatterns: ["roof", "roofing", "roofer", "shingle", "gutter", "storm"],
    chainPatterns: ["sears home services", "lowe's", "home depot installation"],
  },
  "Home Services": {
    tags: [
      ["craft", "carpenter"], ["craft", "painter"], ["craft", "cleaning"],
      ["craft", "landscaper"], ["craft", "handyman"], ["shop", "hardware"],
      ["craft", "tiler"], ["craft", "stonemason"],
    ],
    keywords: ["handyman", "contractor", "home repair", "remodeling contractor", "painter", "landscaping"],
    namePatterns: ["handyman", "contractor", "remodel", "renovation", "repair", "painter", "landscap", "home services"],
    chainPatterns: ["mr. handyman", "the maids", "merry maids", "molly maid", "trugreen", "lawn doctor"],
  },
  "Home Care Agencies": {
    tags: [
      ["healthcare", "home_care"],
      ["healthcare", "home_healthcare"],
      ["healthcare", "nursing"],
      ["amenity", "social_facility"],
      ["social_facility", "assisted_living"],
      ["social_facility", "outreach"],
      ["office", "healthcare"],
      ["office", "employment_agency"],
    ],
    keywords: [
      "home care agency",
      "senior home care",
      "in home care",
      "home health care",
      "caregiver agency",
      "private duty care",
    ],
    namePatterns: ["home care", "home health", "senior care", "caregiver", "private duty", "companion care"],
    chainPatterns: [
      "home instead",
      "visiting angels",
      "comfort keepers",
      "right at home",
      "senior helpers",
      "firstlight home care",
      "griswold home care",
      "brightstar care",
      "bayada",
      "always best care",
    ],
  },
}

// Generic chain patterns regardless of industry
const UNIVERSAL_CHAIN_PATTERNS = [
  "mcdonald", "subway", "starbucks", "walmart", "target", "kroger",
  "7-eleven", "circle k", "shell", "exxon", "chevron",
  "amazon", "fedex", "ups store", "usps",
]

const SOCIAL_DOMAINS = [
  "facebook.com", "instagram.com", "yelp.com", "twitter.com", "x.com",
  "linktr.ee", "wix.com/website", "sites.google.com", "linkedin.com",
]

const WEBSITE_TAGS = [
  "website",
  "contact:website",
  "url",
  "contact:url",
  "website:en",
  "brand:website",
  "operator:website",
]

// ── Types ──────────────────────────────────────────────────────

export interface RawLead {
  id: string
  name: string
  website: string | null
  phone: string | null
  rating: number
  reviews: number
  status: string
  category: string
  isCustom: false
  mapPos: { top: string; left: string }
  audit: { seo: number; mobileFriendliness: number; chatbotPresence: number; pageSpeed: number; socialPresence: number }
  /** 0-100 high-value target score (computed) */
  qualityScore: number
  /** Set after website verification */
  websiteVerified?: boolean
  /** ISO 3166 country code */
  country?: string
  /** Source used to discover the lead */
  source?: "google-places" | "public-data"
}

interface OSMElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

interface NominatimPlace {
  place_id?: number
  osm_id?: number
  osm_type?: string
  lat?: string
  lon?: string
  display_name?: string
  name?: string
  extratags?: Record<string, string>
  address?: Record<string, string>
}

// ── Helpers ────────────────────────────────────────────────────

function normaliseName(name: string): string {
  return name.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isChain(name: string, industryPatterns: string[]): boolean {
  const n = name.toLowerCase()
  return [...UNIVERSAL_CHAIN_PATTERNS, ...industryPatterns].some(p => n.includes(p))
}

function hasExactIndustryTag(tags: Record<string, string>, spec: IndustrySpec): boolean {
  return spec.tags.some(([key, value]) => tags[key]?.toLowerCase() === value.toLowerCase())
}

function isRelevantElement(el: OSMElement, spec: IndustrySpec, industry: string): boolean {
  const tags = el.tags ?? {}
  const text = [
    tags.name,
    tags.brand,
    tags.operator,
    tags.description,
    tags.website,
    tags.url,
    Object.entries(tags).map(([key, value]) => `${key} ${value}`).join(" "),
  ].filter(Boolean).join(" ")

  return isBusinessTextRelevantToIndustry(text, industry, {
    exactTagMatch: hasExactIndustryTag(tags, spec),
    requirePositive: true,
  })
}

function normaliseWebsite(raw: string | null | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  if (/^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(value)) return `https://${value}`
  return null
}

function websiteFromTags(tags: Record<string, string>): string | null {
  for (const key of WEBSITE_TAGS) {
    const website = normaliseWebsite(tags[key])
    if (website) return website
  }
  return null
}

function isSocialWebsite(website: string): boolean {
  try {
    const host = new URL(website).hostname.replace(/^www\./, "").toLowerCase()
    return SOCIAL_DOMAINS.some(domain => host === domain || host.endsWith(`.${domain}`))
  } catch {
    return false
  }
}

/** Approximate distance in km between two lat/lon points (Haversine) */
function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLon = (b.lon - a.lon) * Math.PI / 180
  const lat1 = a.lat * Math.PI / 180
  const lat2 = b.lat * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

/**
 * Compute a 0–100 lead quality score based on signals.
 * Higher = more likely to be a real, contactable, convertible business.
 */
function computeQualityScore(args: {
  industry: string
  name: string
  tagText: string
  hasPhone: boolean
  hasWebsite: boolean
  isHttps: boolean
  isOldSite: boolean
  nameLength: number
  hasAddress: boolean
  hasOpeningHours: boolean
  isChain: boolean
  websiteVerified?: boolean
}): number {
  let score = 18 // base

  score += getIndustryValueBonus(args.industry)
  score += scoreHighValueKeywords(`${args.name} ${args.tagText}`, args.industry)

  if (args.hasPhone) score += 16
  else score -= 8
  if (args.hasWebsite) score += 15
  else score -= 12
  if (args.isHttps) score += 4
  if (args.isOldSite) score += 5
  if (args.hasAddress) score += 6
  if (args.hasOpeningHours) score += 4

  // Suspiciously short names (1-2 words) are often incomplete records
  if (args.nameLength >= 8) score += 6
  if (args.nameLength >= 16) score += 4

  // Chains are bad targets — penalise heavily
  if (args.isChain || hasLikelyChainName(args.name)) score -= 35

  // For the AI lead recovery offer, a live website is better than a dead one.
  if (args.websiteVerified === true) score += 6
  if (args.websiteVerified === false) score -= 5

  return Math.max(0, Math.min(100, score))
}

/** Quick best-effort request to check if a website is alive. Null means inconclusive. */
async function verifyWebsite(url: string): Promise<boolean | null> {
  try {
    // safeFetch enforces SSRF protection - OSM-sourced URLs are still untrusted.
    const head = await safeFetch(url, {
      method: "HEAD",
      timeoutMs: 4000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LaggardScan/1.0)" },
    })
    if (head.status < 400) return true
    if (head.status === 404 || head.status === 410) return false

    // Many real sites reject HEAD. Fall back to GET before calling it dead.
    const get = await safeFetch(url, {
      method: "GET",
      timeoutMs: 5000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    })
    if (get.status < 400) return true
    if (get.status === 404 || get.status === 410) return false
    return null
  } catch {
    return null
  }
}

// ── Overpass query ─────────────────────────────────────────────

const OVERPASS_ENDPOINTS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
]

async function runOverpass(query: string): Promise<OSMElement[]> {
  let lastErr = ""
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
        headers: { "User-Agent": "LaggardScan/1.0", "Accept": "*/*" },
      })
      if (!res.ok) { lastErr = `${endpoint}: HTTP ${res.status}`; continue }
      const data = await res.json()
      return data.elements ?? []
    } catch (e: unknown) {
      lastErr = `${endpoint}: ${e instanceof Error ? e.message : "request failed"}`
    }
  }
  throw new Error(lastErr || "All Overpass endpoints failed")
}

function buildBboxQuery(tags: Array<[string, string]>, bbox: string, outputLimit: number): string {
  const filters = tags.flatMap(([k, v]) => [
    `node["${k}"="${v}"](${bbox});`,
    `way["${k}"="${v}"](${bbox});`,
  ]).join("\n")
  return `[out:json][timeout:25];\n(\n${filters}\n);\nout body center qt ${outputLimit};`
}

function escapeOverpassRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/"/g, '\\"')
}

function buildNameSearchQuery(patterns: string[], bbox: string, outputLimit: number): string {
  const regex = patterns.map(escapeOverpassRegex).join("|")
  const fields = ["name", "brand", "operator", "description"]
  const filters = fields.flatMap(field => [
    `node["${field}"~"${regex}",i](${bbox});`,
    `way["${field}"~"${regex}",i](${bbox});`,
  ]).join("\n")
  return `[out:json][timeout:25];\n(\n${filters}\n);\nout body center qt ${outputLimit};`
}

async function runOptionalOverpass(query: string): Promise<OSMElement[]> {
  try {
    return await runOverpass(query)
  } catch {
    return []
  }
}

async function runNominatimKeywordFallback(
  city: string,
  keywords: string[],
  limit: number,
  deepScan = false,
): Promise<OSMElement[]> {
  const places: OSMElement[] = []
  const maxKeywords = deepScan ? keywords.length : 5
  const perKeywordLimit = deepScan ? Math.min(35, Math.max(12, Math.ceil(limit / 4))) : Math.min(12, limit)

  for (const keyword of keywords.slice(0, maxKeywords)) {
    const url = new URL("https://nominatim.openstreetmap.org/search")
    url.searchParams.set("q", `${keyword} ${city}`)
    url.searchParams.set("format", "jsonv2")
    url.searchParams.set("limit", String(perKeywordLimit))
    url.searchParams.set("addressdetails", "1")
    url.searchParams.set("extratags", "1")

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "LaggardScan/1.0",
          "Accept": "application/json",
        },
      })
      if (!res.ok) continue

      const data = (await res.json()) as NominatimPlace[]
      for (const place of data) {
        const lat = Number(place.lat)
        const lon = Number(place.lon)
        const name =
          place.name ||
          place.extratags?.name ||
          place.display_name?.split(",")[0]?.trim()

        if (!name || Number.isNaN(lat) || Number.isNaN(lon)) continue

        places.push({
          type: `nominatim-${place.osm_type || "place"}`,
          id: place.osm_id ?? place.place_id ?? places.length,
          lat,
          lon,
          tags: {
            ...(place.extratags ?? {}),
            name,
            website:
              place.extratags?.website ||
              place.extratags?.["contact:website"] ||
              place.extratags?.url ||
              "",
            phone:
              place.extratags?.phone ||
              place.extratags?.["contact:phone"] ||
              place.extratags?.["contact:mobile"] ||
              "",
            "addr:street": place.address?.road ?? "",
            "addr:housenumber": place.address?.house_number ?? "",
            "addr:full": place.display_name ?? "",
          },
        })
      }
    } catch {
      // Keyword fallback is best effort; Overpass results remain the primary source.
    }
  }

  return places
}

// ── Geocoding ──────────────────────────────────────────────────

export interface GeocodeResult {
  lat: number
  lon: number
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number }
  displayName: string
  countryCode: string
}

export async function geocodeCity(city: string): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1&addressdetails=1`
  const res = await fetch(url, { headers: { "User-Agent": "LaggardScan/1.0" } })
  if (!res.ok) return null
  const data = await res.json()
  if (!data?.length) return null
  const p = data[0]
  const [minLat, maxLat, minLon, maxLon] = (p.boundingbox as string[]).map(Number)
  return {
    lat: parseFloat(p.lat),
    lon: parseFloat(p.lon),
    bbox: { minLat, maxLat, minLon, maxLon },
    displayName: p.display_name,
    countryCode: (p.address?.country_code ?? "").toUpperCase(),
  }
}

// ── Deduplication ──────────────────────────────────────────────

/**
 * Merge duplicate entries. Same business is often returned by multiple tag
 * combinations or appears as both node and way.
 */
function deduplicate(elements: OSMElement[]): OSMElement[] {
  const seen = new Map<string, OSMElement>()

  for (const el of elements) {
    const name = el.tags?.name
    if (!name) continue
    const lat = el.lat ?? el.center?.lat
    const lon = el.lon ?? el.center?.lon
    if (lat == null || lon == null) continue

    const key = normaliseName(name)
    const existing = seen.get(key)

    if (!existing) {
      seen.set(key, el)
      continue
    }

    // Same name — check geographic proximity (within 0.5km = same business)
    const existingLat = existing.lat ?? existing.center?.lat
    const existingLon = existing.lon ?? existing.center?.lon
    if (existingLat == null || existingLon == null) {
      seen.set(key, el)
      continue
    }

    if (distanceKm({ lat, lon }, { lat: existingLat, lon: existingLon }) < 0.5) {
      // Merge tags — prefer the one with more data
      const existingTags = Object.keys(existing.tags ?? {}).length
      const newTags = Object.keys(el.tags ?? {}).length
      if (newTags > existingTags) {
        // New entry has more data; keep it but merge website/phone from existing
        seen.set(key, {
          ...el,
          tags: { ...existing.tags, ...el.tags },
        })
      } else {
        // Existing is richer; just merge in any new tags from this one
        seen.set(key, {
          ...existing,
          tags: { ...el.tags, ...existing.tags },
        })
      }
    } else {
      // Same name, far apart — different locations, keep both
      seen.set(`${key}__${el.id}`, el)
    }
  }

  return Array.from(seen.values())
}

// ── Main entry point ───────────────────────────────────────────

export interface ScanOptions {
  /** Verify websites are alive (slower but more accurate status). Default: true */
  verifyWebsites?: boolean
  /** Max leads returned. Default: 50 */
  limit?: number
  /** Include chains. Default: false */
  includeChains?: boolean
  /** Wider bbox + keyword fallback across the industry. Default: false */
  deepScan?: boolean
  /** auto = Google Places when configured, with public fallback. */
  source?: "auto" | "google" | "public"
}

export interface ScanResult {
  leads: RawLead[]
  center: { lat: number; lon: number }
  geocode: GeocodeResult
  stats: {
    rawElements: number
    afterDedup: number
    afterChainFilter: number
    afterWebsiteFilter: number
    finalCount: number
    websitesVerified: number
    websitesDead: number
    dataSource?: string
    googleQueries?: number
    googleRawPlaces?: number
    googleUniquePlaces?: number
    fallbackUsed?: boolean
    warning?: string
  }
}

function domainFromWebsite(website: string | null | undefined): string | null {
  if (!website) return null
  try {
    return new URL(website).hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return null
  }
}

function rawLeadDedupeKeys(lead: RawLead): string[] {
  const phone = lead.phone?.replace(/\D/g, "")
  const domain = domainFromWebsite(lead.website)
  const name = normaliseName(lead.name)
  return [
    domain ? `site:${domain}` : "",
    phone && phone.length >= 7 ? `phone:${phone}` : "",
    `name:${name}:${lead.category ?? ""}`,
  ].filter(Boolean)
}

function mergeRawLead(existing: RawLead, incoming: RawLead): RawLead {
  const better = (incoming.qualityScore ?? 0) > (existing.qualityScore ?? 0) ? incoming : existing
  return {
    ...better,
    website: existing.website ?? incoming.website,
    phone: existing.phone ?? incoming.phone,
    rating: Math.max(existing.rating ?? 0, incoming.rating ?? 0),
    reviews: Math.max(existing.reviews ?? 0, incoming.reviews ?? 0),
    qualityScore: Math.max(existing.qualityScore ?? 0, incoming.qualityScore ?? 0),
    websiteVerified: existing.websiteVerified ?? incoming.websiteVerified,
    source: existing.source ?? incoming.source,
  }
}

function dedupeRawLeads(leads: RawLead[]): RawLead[] {
  const aliases = new Map<string, string>()
  const seen = new Map<string, RawLead>()

  for (const lead of leads) {
    const keys = rawLeadDedupeKeys(lead)
    const matchedAlias = keys.map(key => aliases.get(key) ?? key).find(key => seen.has(key))
    const primaryKey = matchedAlias ?? keys[0] ?? lead.id
    const existing = seen.get(primaryKey)
    seen.set(primaryKey, existing ? mergeRawLead(existing, lead) : lead)
    keys.forEach(key => aliases.set(key, primaryKey))
  }

  return Array.from(seen.values())
}

function mergeScanResults(
  googleResult: ScanResult,
  publicResult: ScanResult,
  limit: number,
  googleWarning: string | null,
): ScanResult {
  const leads = dedupeRawLeads([...googleResult.leads, ...publicResult.leads])
    .sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0))
    .slice(0, limit)

  return {
    leads,
    center: googleResult.center,
    geocode: googleResult.geocode,
    stats: {
      rawElements: (googleResult.stats.rawElements ?? 0) + (publicResult.stats.rawElements ?? 0),
      afterDedup: leads.length,
      afterChainFilter: (googleResult.stats.afterChainFilter ?? 0) + (publicResult.stats.afterChainFilter ?? 0),
      afterWebsiteFilter: (googleResult.stats.afterWebsiteFilter ?? 0) + (publicResult.stats.afterWebsiteFilter ?? 0),
      finalCount: leads.length,
      websitesVerified: publicResult.stats.websitesVerified,
      websitesDead: publicResult.stats.websitesDead,
      dataSource: "Google Places + public fallback",
      googleQueries: googleResult.stats.googleQueries,
      googleRawPlaces: googleResult.stats.googleRawPlaces,
      googleUniquePlaces: googleResult.stats.googleUniquePlaces,
      fallbackUsed: true,
      warning: googleWarning ?? publicResult.stats.warning,
    },
  }
}

export async function findLeads(
  city: string,
  industry: string,
  options: ScanOptions = {}
): Promise<ScanResult> {
  const { verifyWebsites = true, limit = 50, includeChains = false, deepScan = false, source = "auto" } = options

  const spec = INDUSTRIES[industry]
  if (!spec) throw new Error(`Unknown industry: ${industry}`)

  // 1. Geocode city
  const geocode = await geocodeCity(city)
  if (!geocode) throw new Error(`City "${city}" not found`)

  let googleResult: ScanResult | null = null
  let googleWarning: string | null = null
  if (source !== "public") {
    if (!hasGooglePlacesKey()) {
      if (source === "google") throw new Error("Missing GOOGLE_PLACES_API_KEY")
    } else {
      try {
        googleResult = await findGooglePlacesLeads(city, industry, geocode, options)
        const enoughGoogleLeads = googleResult.leads.length >= Math.min(limit, deepScan ? 45 : 25)
        if (source === "google" || enoughGoogleLeads) return googleResult
      } catch (e: unknown) {
        googleWarning = e instanceof Error ? e.message : "Google Places scan failed"
        if (source === "google") throw e
      }
    }
  }

  const { minLat, maxLat, minLon, maxLon } = geocode.bbox
  const padMultiplier = deepScan ? 0.45 : 0.1
  const latPad = (maxLat - minLat) * padMultiplier
  const lonPad = (maxLon - minLon) * padMultiplier
  const bbox = `${minLat - latPad},${minLon - lonPad},${maxLat + latPad},${maxLon + lonPad}`

  // 2. Run Overpass query with all tag combinations
  const query = buildBboxQuery(spec.tags, bbox, Math.max(100, limit * (deepScan ? 4 : 3)))
  const nameQuery = buildNameSearchQuery(spec.namePatterns, bbox, Math.max(100, limit * (deepScan ? 4 : 2)))
  const [overpassElements, nameMatchElements] = await Promise.all([
    runOverpass(query),
    deepScan ? runOptionalOverpass(nameQuery) : Promise.resolve([]),
  ])
  const keywordElements =
    deepScan || industry === "Home Care Agencies"
      ? await runNominatimKeywordFallback(city, spec.keywords, limit, deepScan)
      : []
  const rawElements = [...overpassElements, ...nameMatchElements, ...keywordElements]

  // 3. Deduplicate
  const dedup = deduplicate(rawElements)

  // 4. Filter noisy fallback matches, then chains
  const relevant = dedup.filter(el => isRelevantElement(el, spec, industry))

  const filtered = includeChains
    ? relevant
    : relevant.filter(el => !isChain(el.tags?.name ?? "", spec.chainPatterns))

  // 5. Take top N by raw signal richness + buying-potential signals, then audit each
  const ranked = filtered
    .map(el => {
      const tags = el.tags ?? {}
      const name = tags.name ?? ""
      const tagText = Object.values(tags).join(" ")
      const website = websiteFromTags(tags)
      const phone = tags.phone || tags["contact:phone"] || tags["contact:mobile"] || ""
      const valueSignal =
        getIndustryValueBonus(industry)
        + scoreHighValueKeywords(`${name} ${tagText}`, industry)
        + (website && !isSocialWebsite(website) ? 12 : 0)
        + (phone ? 10 : 0)
        + (tags.opening_hours ? 4 : 0)
      return { el, richness: Object.keys(tags).length + valueSignal }
    })
    .sort((a, b) => b.richness - a.richness)
    .slice(0, limit * 2) // grab 2x then filter further
    .map(x => x.el)

  if (ranked.length === 0) {
    const publicResult: ScanResult = {
      leads: [],
      center: { lat: geocode.lat, lon: geocode.lon },
      geocode,
      stats: {
        rawElements: rawElements.length,
        afterDedup: dedup.length,
        afterChainFilter: filtered.length,
        afterWebsiteFilter: 0,
        finalCount: 0,
        websitesVerified: 0,
        websitesDead: 0,
        dataSource: "Public data",
        warning: googleWarning ?? undefined,
      },
    }
    return googleResult
      ? mergeScanResults(googleResult, publicResult, limit, googleWarning)
      : publicResult
  }

  // 6. Verify websites in parallel (if enabled)
  const verificationResults: Map<string, boolean | null> = new Map()
  if (verifyWebsites) {
    const verifications = ranked
      .map(el => {
        const tags = el.tags ?? {}
        const website = websiteFromTags(tags)
        if (!website) return null
        const isSocial = isSocialWebsite(website)
        if (isSocial) return null
        return { id: el.id, website }
      })
      .filter((x): x is { id: number; website: string } => x !== null)

    // Run all verifications in parallel, capped
    const results = await Promise.all(
      verifications.slice(0, 60).map(async ({ id, website }) => ({
        id,
        alive: await verifyWebsite(website),
      }))
    )
    for (const { id, alive } of results) verificationResults.set(String(id), alive)
  }

  // 7. Compute bounding box of results for map positioning
  const lats = ranked
    .map(el => el.lat ?? el.center?.lat)
    .filter((x): x is number => x != null)
  const lons = ranked
    .map(el => el.lon ?? el.center?.lon)
    .filter((x): x is number => x != null)
  const leadMinLat = Math.min(...lats)
  const leadMaxLat = Math.max(...lats)
  const leadMinLon = Math.min(...lons)
  const leadMaxLon = Math.max(...lons)
  const latRange = leadMaxLat - leadMinLat || 0.01
  const lonRange = leadMaxLon - leadMinLon || 0.01
  const PAD = 8

  // 8. Build leads with quality scores
  let websitesVerified = 0
  let websitesDead = 0

  const leads: RawLead[] = ranked.map(el => {
    const tags = el.tags ?? {}
    const name = tags.name
    const lat = (el.lat ?? el.center?.lat)!
    const lon = (el.lon ?? el.center?.lon)!

    const rawWebsite = websiteFromTags(tags)
    const isSocial = rawWebsite != null && isSocialWebsite(rawWebsite)
    const website = isSocial ? null : rawWebsite
    const phone = tags.phone || tags["contact:phone"] || tags["contact:mobile"] || null

    const hasAddress = !!(tags["addr:street"] || tags["addr:housenumber"] || tags["addr:full"])
    const hasOpeningHours = !!tags.opening_hours
    const isHttps = !!website && website.startsWith("https://")
    const isOldSite = !!website && website.startsWith("http://")

    const verified = website ? verificationResults.get(String(el.id)) : null
    if (verified === true) websitesVerified++
    if (verified === false) websitesDead++

    // Status. "No Website" should only mean no usable URL was found. A failed
    // verification can be bot-blocking, timeout, DNS weirdness, or HEAD blocking,
    // so we keep the website status instead of creating false "No Website" leads.
    let status: string
    if (!website) status = "No Website"
    else if (isOldSite) status = "Old Website"
    else status = "Needs AI Chatbot"

    // Quality score
    const qualityScore = computeQualityScore({
      industry,
      name,
      tagText: Object.values(tags).join(" "),
      hasPhone: !!phone,
      hasWebsite: !!website,
      isHttps,
      isOldSite,
      nameLength: name.length,
      hasAddress,
      hasOpeningHours,
      isChain: isChain(name, spec.chainPatterns),
      websiteVerified: verified ?? undefined,
    })

    // Normalise lat/lon to percentage map position
    const topPct = PAD + (1 - (lat - leadMinLat) / latRange) * (100 - 2 * PAD)
    const leftPct = PAD + ((lon - leadMinLon) / lonRange) * (100 - 2 * PAD)

    return {
      id: `scan-${el.type ?? "node"}-${el.id}`,
      name,
      website,
      phone,
      // OSM provides no rating/review data, and audit scores require a real
      // website audit — both are surfaced as 0/empty so the UI shows a
      // "not audited yet" state instead of invented numbers.
      rating: 0,
      reviews: 0,
      category: industry,
      status,
      isCustom: false as const,
      mapPos: {
        top: `${Math.max(PAD, Math.min(100 - PAD, topPct)).toFixed(1)}%`,
        left: `${Math.max(PAD, Math.min(100 - PAD, leftPct)).toFixed(1)}%`,
      },
      audit: { ...EMPTY_AUDIT },
      qualityScore,
      websiteVerified: verified ?? undefined,
      country: geocode.countryCode || undefined,
      source: "public-data",
    }
  })

  // 9. Sort by quality score, take top N
  const finalLeads = leads
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, limit)

  const publicResult: ScanResult = {
    leads: finalLeads,
    center: { lat: geocode.lat, lon: geocode.lon },
    geocode,
    stats: {
      rawElements: rawElements.length,
      afterDedup: dedup.length,
      afterChainFilter: filtered.length,
      afterWebsiteFilter: ranked.length,
      finalCount: finalLeads.length,
      websitesVerified,
      websitesDead,
      dataSource: "Public data",
      warning: googleWarning ?? undefined,
    },
  }

  return googleResult
    ? mergeScanResults(googleResult, publicResult, limit, googleWarning)
    : publicResult
}
