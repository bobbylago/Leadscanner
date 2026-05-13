/**
 * Smart lead discovery.
 *
 * Strategy:
 *   1. Multiple OSM tag combinations per industry (cast wide net)
 *   2. Optional Nominatim free-text fallback (catches businesses without proper tags)
 *   3. Deduplicate by name similarity + geographic proximity
 *   4. Filter known chains/franchises
 *   5. Verify website status with HEAD requests (in parallel, cheap)
 *   6. Score every lead for "quality" — hot leads bubble up
 */

import { generateAuditScores } from "./utils"

// ── Industry definition ────────────────────────────────────────

interface IndustrySpec {
  /** OSM tag pairs (key, value) — searched in parallel */
  tags: Array<[string, string]>
  /** Free-text keywords for Nominatim fallback */
  keywords: string[]
  /** Name patterns that signal this is a chain (case-insensitive substring) */
  chainPatterns: string[]
}

const INDUSTRIES: Record<string, IndustrySpec> = {
  Plumbing: {
    tags: [
      ["craft", "plumber"], ["shop", "plumber"], ["office", "plumber"],
      ["craft", "pipe"], ["craft", "drainage"],
    ],
    keywords: ["plumber", "plumbing"],
    chainPatterns: ["roto-rooter", "mr. rooter", "benjamin franklin plumbing", "ars/rescue", "michael & son"],
  },
  Electrician: {
    tags: [
      ["craft", "electrician"], ["shop", "electrician"], ["office", "electrician"],
      ["craft", "electrical_engineer"],
    ],
    keywords: ["electrician", "electric"],
    chainPatterns: ["mister sparky", "mr. electric", "aaron's electric"],
  },
  HVAC: {
    tags: [
      ["craft", "hvac"], ["shop", "hvac"], ["craft", "heating_engineer"],
      ["craft", "air_conditioning"], ["shop", "air_conditioning"],
    ],
    keywords: ["hvac", "heating", "air conditioning", "ac repair"],
    chainPatterns: ["one hour heating", "horizon services", "service experts"],
  },
  Dental: {
    tags: [
      ["amenity", "dentist"], ["healthcare", "dentist"],
      ["office", "dentist"], ["shop", "medical_supply"],
    ],
    keywords: ["dentist", "dental"],
    chainPatterns: ["aspen dental", "western dental", "castle dental", "brident dental", "great expressions"],
  },
  Roofing: {
    tags: [
      ["craft", "roofer"], ["craft", "roofing"], ["shop", "roofing"],
    ],
    keywords: ["roofer", "roofing"],
    chainPatterns: ["sears home services", "lowe's", "home depot installation"],
  },
  "Home Services": {
    tags: [
      ["craft", "carpenter"], ["craft", "painter"], ["craft", "cleaning"],
      ["craft", "landscaper"], ["craft", "handyman"], ["shop", "hardware"],
      ["craft", "tiler"], ["craft", "stonemason"],
    ],
    keywords: ["handyman", "contractor"],
    chainPatterns: ["mr. handyman", "the maids", "merry maids", "molly maid", "trugreen", "lawn doctor"],
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
  audit: ReturnType<typeof generateAuditScores>
  /** 0-100 lead quality score (computed) */
  qualityScore: number
  /** Set after website verification */
  websiteVerified?: boolean
  /** ISO 3166 country code */
  country?: string
}

interface OSMElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
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
  let score = 30 // base

  if (args.hasPhone) score += 18
  if (args.hasWebsite) score += 10
  if (args.isHttps) score += 6
  if (args.isOldSite) score += 8           // OLD SITE = great target (needs rebuild)
  if (args.hasAddress) score += 8
  if (args.hasOpeningHours) score += 4

  // Suspiciously short names (1-2 words) are often incomplete records
  if (args.nameLength >= 8) score += 6
  if (args.nameLength >= 16) score += 4

  // Chains are bad targets — penalise heavily
  if (args.isChain) score -= 35

  // Verified live website
  if (args.websiteVerified === true) score += 6
  if (args.websiteVerified === false) score += 12 // dead site = even better target

  return Math.max(0, Math.min(100, score))
}

/** Quick HEAD request to check if a website is alive */
async function verifyWebsite(url: string): Promise<boolean | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LaggardScan/1.0)" },
    })
    clearTimeout(timeout)
    return res.status < 400
  } catch {
    return false
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
    } catch (e: any) {
      lastErr = `${endpoint}: ${e.message}`
    }
  }
  throw new Error(lastErr || "All Overpass endpoints failed")
}

function buildBboxQuery(tags: Array<[string, string]>, bbox: string): string {
  const filters = tags.flatMap(([k, v]) => [
    `node["${k}"="${v}"](${bbox});`,
    `way["${k}"="${v}"](${bbox});`,
  ]).join("\n")
  return `[out:json][timeout:25];\n(\n${filters}\n);\nout body center qt 100;`
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
  }
}

export async function findLeads(
  city: string,
  industry: string,
  options: ScanOptions = {}
): Promise<ScanResult> {
  const { verifyWebsites = true, limit = 50, includeChains = false } = options

  const spec = INDUSTRIES[industry]
  if (!spec) throw new Error(`Unknown industry: ${industry}`)

  // 1. Geocode city
  const geocode = await geocodeCity(city)
  if (!geocode) throw new Error(`City "${city}" not found`)

  const { minLat, maxLat, minLon, maxLon } = geocode.bbox
  const latPad = (maxLat - minLat) * 0.1
  const lonPad = (maxLon - minLon) * 0.1
  const bbox = `${minLat - latPad},${minLon - lonPad},${maxLat + latPad},${maxLon + lonPad}`

  // 2. Run Overpass query with all tag combinations
  const query = buildBboxQuery(spec.tags, bbox)
  const rawElements = await runOverpass(query)

  // 3. Deduplicate
  const dedup = deduplicate(rawElements)

  // 4. Filter chains
  const filtered = includeChains
    ? dedup
    : dedup.filter(el => !isChain(el.tags?.name ?? "", spec.chainPatterns))

  // 5. Take top N by raw signal richness, then audit each
  const ranked = filtered
    .map(el => ({ el, richness: Object.keys(el.tags ?? {}).length }))
    .sort((a, b) => b.richness - a.richness)
    .slice(0, limit * 2) // grab 2x then filter further
    .map(x => x.el)

  // 6. Verify websites in parallel (if enabled)
  const verificationResults: Map<string, boolean | null> = new Map()
  if (verifyWebsites) {
    const verifications = ranked
      .map(el => {
        const tags = el.tags ?? {}
        const website = tags.website || tags["contact:website"] || tags.url
        if (!website) return null
        const isSocial = SOCIAL_DOMAINS.some(d => website.includes(d))
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

    const rawWebsite = tags.website || tags["contact:website"] || tags.url || null
    const isSocial = rawWebsite != null && SOCIAL_DOMAINS.some(d => rawWebsite.includes(d))
    const website = isSocial ? null : rawWebsite
    const phone = tags.phone || tags["contact:phone"] || tags["contact:mobile"] || null

    const hasAddress = !!(tags["addr:street"] || tags["addr:housenumber"] || tags["addr:full"])
    const hasOpeningHours = !!tags.opening_hours
    const isHttps = !!website && website.startsWith("https://")
    const isOldSite = !!website && website.startsWith("http://")

    const verified = website ? verificationResults.get(String(el.id)) : null
    if (verified === true) websitesVerified++
    if (verified === false) websitesDead++

    // Status — refined by verification
    let status: string
    if (!website || verified === false) status = "No Website"
    else if (isOldSite) status = "Old Website"
    else status = "Needs AI Chatbot"

    // Quality score
    const qualityScore = computeQualityScore({
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

    // Deterministic placeholder rating/reviews (will be overridden by real audit later)
    const seed = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    const reviews = 5 + (seed % 400)
    const rating = parseFloat(Math.min(5.0, 3.6 + ((seed % 13) / 10)).toFixed(1))

    // Normalise lat/lon to percentage map position
    const topPct = PAD + (1 - (lat - leadMinLat) / latRange) * (100 - 2 * PAD)
    const leftPct = PAD + ((lon - leadMinLon) / lonRange) * (100 - 2 * PAD)

    const partial = { name, website, phone, rating, reviews, status }

    return {
      id: `scan-${el.type ?? "node"}-${el.id}`,
      name,
      website,
      phone,
      rating,
      reviews,
      category: industry,
      status,
      isCustom: false as const,
      mapPos: {
        top: `${Math.max(PAD, Math.min(100 - PAD, topPct)).toFixed(1)}%`,
        left: `${Math.max(PAD, Math.min(100 - PAD, leftPct)).toFixed(1)}%`,
      },
      audit: generateAuditScores(partial),
      qualityScore,
      websiteVerified: verified ?? undefined,
      country: geocode.countryCode || undefined,
    }
  })

  // 9. Sort by quality score, take top N
  const finalLeads = leads
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, limit)

  return {
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
    },
  }
}
