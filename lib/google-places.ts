import { EMPTY_AUDIT } from "./types"
import {
  getIndustryValueBonus,
  hasLikelyChainName,
  isBusinessTextRelevantToIndustry,
  scoreHighValueKeywords,
} from "./lead-scoring"
import type { GeocodeResult, RawLead, ScanOptions, ScanResult } from "./lead-finder"

const GOOGLE_PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText"

// Keep this tight. websiteUri/phone/rating fields are higher-value fields, but
// they are exactly the contact and buying-signal data LeadScanner needs.
const GOOGLE_PLACES_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.googleMapsUri",
  "places.primaryType",
  "places.types",
  "places.pureServiceAreaBusiness",
].join(",")

const GOOGLE_INCLUDED_TYPES: Record<string, string> = {
  Plumbing: "plumber",
  Electrician: "electrician",
  Roofing: "roofing_contractor",
  Dental: "dentist",
}

const GOOGLE_QUERY_TEMPLATES: Record<string, string[]> = {
  Plumbing: [
    "plumbers in {city}",
    "plumbing companies in {city}",
    "drain cleaning in {city}",
    "water heater repair in {city}",
    "emergency plumber in {city}",
    "sewer repair in {city}",
    "commercial plumber in {city}",
    "24 hour plumber in {city}",
  ],
  Electrician: [
    "electricians in {city}",
    "electrical contractors in {city}",
    "emergency electrician in {city}",
    "residential electrician in {city}",
    "commercial electrician in {city}",
    "electrical panel repair in {city}",
  ],
  HVAC: [
    "hvac contractors in {city}",
    "air conditioning repair in {city}",
    "heating and cooling companies in {city}",
    "furnace repair in {city}",
    "commercial hvac in {city}",
    "emergency ac repair in {city}",
    "ac repair in {city}",
    "heating contractor in {city}",
  ],
  Roofing: [
    "roofing contractors in {city}",
    "roof repair in {city}",
    "roof replacement in {city}",
    "storm damage roof repair in {city}",
    "commercial roofing in {city}",
    "emergency roof repair in {city}",
  ],
  Dental: [
    "dentists in {city}",
    "dental clinics in {city}",
    "family dentist in {city}",
    "cosmetic dentist in {city}",
    "emergency dentist in {city}",
  ],
  "Home Services": [
    "handyman services in {city}",
    "home repair contractors in {city}",
    "remodeling contractors in {city}",
    "restoration companies in {city}",
    "water damage restoration in {city}",
    "home services companies in {city}",
  ],
  "Home Care Agencies": [
    "home care agencies in {city}",
    "senior home care in {city}",
    "in home care agencies in {city}",
    "home health care agencies in {city}",
    "caregiver agencies in {city}",
    "private duty care in {city}",
  ],
}

const SERVICE_AREA_INDUSTRIES = new Set([
  "Plumbing",
  "Electrician",
  "HVAC",
  "Roofing",
  "Home Services",
  "Home Care Agencies",
])

interface GooglePlace {
  id?: string
  displayName?: { text?: string; languageCode?: string }
  formattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  websiteUri?: string
  nationalPhoneNumber?: string
  rating?: number
  userRatingCount?: number
  businessStatus?: string
  googleMapsUri?: string
  primaryType?: string
  types?: string[]
  pureServiceAreaBusiness?: boolean
}

interface GoogleTextSearchResponse {
  places?: GooglePlace[]
  error?: { code?: number; message?: string; status?: string }
}

export function hasGooglePlacesKey(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim())
}

function normaliseWebsite(raw: string | null | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  if (/^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(value)) return `https://${value}`
  return null
}

function normaliseName(value: string): string {
  return value.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim()
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function fallbackLocation(place: GooglePlace, geocode: GeocodeResult, index: number): { lat: number; lon: number } {
  const lat = place.location?.latitude
  const lon = place.location?.longitude
  if (typeof lat === "number" && typeof lon === "number") return { lat, lon }

  const hash = stableHash(place.id ?? place.displayName?.text ?? String(index))
  const latJitter = ((hash % 900) / 900 - 0.5) * 0.12
  const lonJitter = (((hash >>> 10) % 900) / 900 - 0.5) * 0.12
  return { lat: geocode.lat + latJitter, lon: geocode.lon + lonJitter }
}

function selectQueries(city: string, industry: string, options: ScanOptions): string[] {
  const templates = GOOGLE_QUERY_TEMPLATES[industry] ?? [`${industry} companies in {city}`]
  const limit = options.limit ?? 50
  const deepScan = options.deepScan ?? false
  const maxByLimit = Math.ceil(limit / 18)
  const maxQueries = deepScan ? 8 : 3
  const count = Math.max(1, Math.min(templates.length, maxQueries, maxByLimit + (deepScan ? 2 : 0)))
  return templates.slice(0, count).map(template => template.replace("{city}", city))
}

async function searchGooglePlaces(args: {
  apiKey: string
  query: string
  industry: string
  geocode: GeocodeResult
  deepScan: boolean
}): Promise<GooglePlace[]> {
  const includedType = GOOGLE_INCLUDED_TYPES[args.industry]
  const radius = args.deepScan ? 50000 : 30000
  const body: Record<string, unknown> = {
    textQuery: args.query,
    pageSize: 20,
    includePureServiceAreaBusinesses: SERVICE_AREA_INDUSTRIES.has(args.industry),
    locationBias: {
      circle: {
        center: { latitude: args.geocode.lat, longitude: args.geocode.lon },
        radius,
      },
    },
  }

  if (args.geocode.countryCode) body.regionCode = args.geocode.countryCode
  if (includedType) {
    body.includedType = includedType
    body.strictTypeFiltering = true
  }

  const res = await fetch(GOOGLE_PLACES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": args.apiKey,
      "X-Goog-FieldMask": GOOGLE_PLACES_FIELD_MASK,
    },
    body: JSON.stringify(body),
  })

  const data = (await res.json().catch(() => ({}))) as GoogleTextSearchResponse
  if (!res.ok) {
    const message = data.error?.message || `HTTP ${res.status}`
    throw new Error(`Google Places scan failed: ${message}`)
  }
  return data.places ?? []
}

function dedupePlaces(places: GooglePlace[]): GooglePlace[] {
  const aliases = new Map<string, string>()
  const seen = new Map<string, GooglePlace>()

  for (const place of places) {
    const name = place.displayName?.text?.trim()
    if (!name) continue

    const website = normaliseWebsite(place.websiteUri)
    const phone = place.nationalPhoneNumber?.replace(/\D/g, "")
    const address = place.formattedAddress?.toLowerCase().trim()
    const keys = [
      place.id ? `id:${place.id}` : "",
      website ? `site:${new URL(website).hostname.replace(/^www\./, "").toLowerCase()}` : "",
      phone && phone.length >= 7 ? `phone:${phone}` : "",
      `name:${normaliseName(name)}:${address ?? ""}`,
    ].filter(Boolean)

    const primaryKey = keys.map(key => aliases.get(key) ?? key).find(key => seen.has(key)) ?? keys[0] ?? `place:${seen.size}`
    const existing = seen.get(primaryKey)
    if (!existing) {
      seen.set(primaryKey, place)
      keys.forEach(key => aliases.set(key, primaryKey))
      continue
    }

    const existingRichness = [
      existing.websiteUri,
      existing.nationalPhoneNumber,
      existing.rating,
      existing.userRatingCount,
      existing.formattedAddress,
    ].filter(Boolean).length
    const nextRichness = [
      place.websiteUri,
      place.nationalPhoneNumber,
      place.rating,
      place.userRatingCount,
      place.formattedAddress,
    ].filter(Boolean).length
    const keeper = nextRichness > existingRichness ? place : existing
    seen.set(primaryKey, keeper)
    keys.forEach(key => aliases.set(key, primaryKey))
  }

  return Array.from(seen.values())
}

function computePlacesQualityScore(args: {
  industry: string
  name: string
  text: string
  hasPhone: boolean
  hasWebsite: boolean
  isOldSite: boolean
  rating: number
  reviews: number
  exactTypeMatch: boolean
  operational: boolean
  isServiceArea: boolean
}): number {
  let score = 18
  score += getIndustryValueBonus(args.industry)
  score += scoreHighValueKeywords(`${args.name} ${args.text}`, args.industry)

  if (args.hasPhone) score += 16
  else score -= 8
  if (args.hasWebsite) score += 17
  else score -= 12
  if (args.isOldSite) score += 5
  if (args.exactTypeMatch) score += 8
  if (args.operational) score += 6
  if (args.isServiceArea) score += 3

  if (args.reviews >= 50 && args.reviews <= 350) score += 14
  else if (args.reviews > 350) score += 8
  else if (args.reviews >= 15) score += 8
  else if (args.reviews > 0) score -= 2

  if (args.rating >= 4.2) score += 4
  else if (args.rating > 0 && args.rating < 3.8) score -= 5

  if (hasLikelyChainName(args.name)) score -= 28

  return Math.max(0, Math.min(100, Math.round(score)))
}

export async function findGooglePlacesLeads(
  city: string,
  industry: string,
  geocode: GeocodeResult,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim()
  if (!apiKey) throw new Error("Missing GOOGLE_PLACES_API_KEY")

  const queries = selectQueries(city, industry, options)
  const rawPlaces: GooglePlace[] = []
  for (const query of queries) {
    rawPlaces.push(...await searchGooglePlaces({
      apiKey,
      query,
      industry,
      geocode,
      deepScan: options.deepScan ?? false,
    }))
  }

  const deduped = dedupePlaces(rawPlaces)
  const includedType = GOOGLE_INCLUDED_TYPES[industry]
  const active = deduped.filter(place => place.businessStatus !== "CLOSED_PERMANENTLY" && place.businessStatus !== "CLOSED_TEMPORARILY")
  const relevant = active.filter(place => {
    const name = place.displayName?.text?.trim() ?? ""
    const website = normaliseWebsite(place.websiteUri)
    const types = [place.primaryType, ...(place.types ?? [])].filter(Boolean).join(" ")
    const text = `${name} ${website ?? ""} ${place.formattedAddress ?? ""} ${types}`
    const exactTypeMatch = includedType
      ? place.primaryType === includedType || (place.types?.includes(includedType) ?? false)
      : false
    return isBusinessTextRelevantToIndustry(text, industry, {
      exactTagMatch: exactTypeMatch,
      requirePositive: false,
    })
  })

  const positioned = relevant.map((place, index) => ({
    place,
    pos: fallbackLocation(place, geocode, index),
  }))
  const lats = positioned.map(item => item.pos.lat)
  const lons = positioned.map(item => item.pos.lon)
  const minLat = Math.min(...lats, geocode.lat - 0.01)
  const maxLat = Math.max(...lats, geocode.lat + 0.01)
  const minLon = Math.min(...lons, geocode.lon - 0.01)
  const maxLon = Math.max(...lons, geocode.lon + 0.01)
  const latRange = maxLat - minLat || 0.01
  const lonRange = maxLon - minLon || 0.01
  const pad = 8

  const leads: RawLead[] = positioned.map(({ place, pos }) => {
    const name = place.displayName?.text?.trim() ?? "Unknown business"
    const website = normaliseWebsite(place.websiteUri)
    const phone = place.nationalPhoneNumber?.trim() || null
    const rating = typeof place.rating === "number" ? place.rating : 0
    const reviews = typeof place.userRatingCount === "number" ? place.userRatingCount : 0
    const isOldSite = !!website && website.startsWith("http://")
    const types = [place.primaryType, ...(place.types ?? [])].filter(Boolean).join(" ")
    const exactTypeMatch = includedType
      ? place.primaryType === includedType || (place.types?.includes(includedType) ?? false)
      : false
    const text = `${place.formattedAddress ?? ""} ${types} ${place.googleMapsUri ?? ""}`

    const topPct = pad + (1 - (pos.lat - minLat) / latRange) * (100 - 2 * pad)
    const leftPct = pad + ((pos.lon - minLon) / lonRange) * (100 - 2 * pad)

    return {
      id: `google-places-${place.id ?? stableHash(`${name}:${place.formattedAddress ?? ""}`)}`,
      name,
      website,
      phone,
      rating,
      reviews,
      category: industry,
      status: !website ? "No Website" : isOldSite ? "Old Website" : "Needs AI Chatbot",
      isCustom: false,
      mapPos: {
        top: `${Math.max(pad, Math.min(100 - pad, topPct)).toFixed(1)}%`,
        left: `${Math.max(pad, Math.min(100 - pad, leftPct)).toFixed(1)}%`,
      },
      audit: { ...EMPTY_AUDIT },
      qualityScore: computePlacesQualityScore({
        industry,
        name,
        text,
        hasPhone: !!phone,
        hasWebsite: !!website,
        isOldSite,
        rating,
        reviews,
        exactTypeMatch,
        operational: place.businessStatus === "OPERATIONAL",
        isServiceArea: place.pureServiceAreaBusiness === true,
      }),
      country: geocode.countryCode || undefined,
      source: "google-places",
    }
  })

  const limit = options.limit ?? 50
  const finalLeads = leads.sort((a, b) => b.qualityScore - a.qualityScore).slice(0, limit)

  return {
    leads: finalLeads,
    center: { lat: geocode.lat, lon: geocode.lon },
    geocode,
    stats: {
      rawElements: rawPlaces.length,
      afterDedup: deduped.length,
      afterChainFilter: active.length,
      afterWebsiteFilter: relevant.length,
      finalCount: finalLeads.length,
      websitesVerified: 0,
      websitesDead: 0,
      dataSource: "Google Places",
      googleQueries: queries.length,
      googleRawPlaces: rawPlaces.length,
      googleUniquePlaces: deduped.length,
    },
  }
}
