import { NextRequest, NextResponse } from 'next/server'
import { generateAuditScores } from '@/lib/utils'

export const maxDuration = 60

const INDUSTRY_TAGS: Record<string, Array<[string, string]>> = {
  Plumbing: [["craft","plumber"],["shop","plumber"]],
  Electrician: [["craft","electrician"],["shop","electrician"]],
  HVAC: [["craft","hvac"],["craft","heating_engineer"],["shop","hvac"]],
  Dental: [["amenity","dentist"]],
  Roofing: [["craft","roofer"],["craft","roofing"]],
  "Home Services": [["craft","carpenter"],["craft","painter"],["craft","cleaning"],["craft","landscaper"]],
}

const SOCIAL_DOMAINS = ["facebook.com","instagram.com","yelp.com","twitter.com","linktr.ee","wix.com/"]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const city = (searchParams.get('city') || 'Austin').trim()
  const industry = searchParams.get('industry') || 'Plumbing'

  // Step 1: geocode via Nominatim
  let nomData: any[]
  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1&addressdetails=1`,
      { headers: { 'User-Agent': 'LeadScanner/1.0' } }
    )
    if (!nomRes.ok) throw new Error('Nominatim HTTP ' + nomRes.status)
    nomData = await nomRes.json()
  } catch (e: any) {
    return NextResponse.json({ error: 'Geocoding service unavailable: ' + e.message }, { status: 502 })
  }

  if (!nomData?.length) {
    return NextResponse.json({ error: `City "${city}" not found. Try a more specific name.` }, { status: 404 })
  }

  const place = nomData[0]
  const centerLat = parseFloat(place.lat)
  const centerLon = parseFloat(place.lon)
  const [bbMinLat, bbMaxLat, bbMinLon, bbMaxLon] = (place.boundingbox as string[]).map(Number)

  // Pad bbox by 10% for better coverage
  const latPad = (bbMaxLat - bbMinLat) * 0.1
  const lonPad = (bbMaxLon - bbMinLon) * 0.1
  const bbox = `${bbMinLat - latPad},${bbMinLon - lonPad},${bbMaxLat + latPad},${bbMaxLon + lonPad}`

  // Step 2: Overpass query
  const tags = INDUSTRY_TAGS[industry] ?? INDUSTRY_TAGS.Plumbing
  const tagFilters = tags.flatMap(([k, v]) => [
    `node["${k}"="${v}"](${bbox});`,
    `way["${k}"="${v}"](${bbox});`,
  ]).join('\n')

  const query = `[out:json][timeout:30];\n(\n${tagFilters}\n);\nout body center qt 60;`

  let ovData: any
  const OVERPASS_ENDPOINTS = [
    'https://overpass.openstreetmap.fr/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ]
  let lastError = ''
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const ovRes = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'LeadScanner/1.0', 'Accept': '*/*' },
      })
      if (!ovRes.ok) { lastError = `HTTP ${ovRes.status} from ${endpoint}`; continue }
      ovData = await ovRes.json()
      break
    } catch (e: any) {
      lastError = e.message
    }
  }
  if (!ovData) {
    return NextResponse.json({ error: 'OpenStreetMap query failed: ' + lastError }, { status: 502 })
  }

  const elements: any[] = (ovData.elements ?? [])
    .filter((el: any) => el.tags?.name)

  if (!elements.length) {
    return NextResponse.json({
      leads: [],
      center: { lat: centerLat, lon: centerLon },
      message: `No ${industry} businesses found in OpenStreetMap for "${city}". Try a larger city.`,
    })
  }

  // Compute bounding box of results for map normalization
  const withCoords = elements
    .map((el: any) => ({ ...el, lat: el.lat ?? el.center?.lat, lon: el.lon ?? el.center?.lon }))
    .filter((el: any) => el.lat != null && el.lon != null)
    .slice(0, 50)

  const lats = withCoords.map((el: any) => el.lat as number)
  const lons = withCoords.map((el: any) => el.lon as number)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLon = Math.min(...lons), maxLon = Math.max(...lons)
  const latRange = maxLat - minLat || 0.01
  const lonRange = maxLon - minLon || 0.01
  const PAD = 8

  const leads = withCoords.map((el: any) => {
    const t = el.tags
    const name: string = t.name
    const rawWebsite: string | null = t.website || t['contact:website'] || t['url'] || null
    const phone: string | null = t.phone || t['contact:phone'] || t['contact:mobile'] || null

    // Determine if website is real or just a social profile
    const isSocial = rawWebsite != null && SOCIAL_DOMAINS.some(d => rawWebsite.includes(d))
    const website: string | null = isSocial ? null : rawWebsite

    const hasWebsite = !!website
    const isOldSite = hasWebsite && website!.startsWith('http://')
    const status = !hasWebsite ? 'No Website' : isOldSite ? 'Old Website' : 'Needs AI Chatbot'

    // Seed from name for deterministic scores
    const seed = name.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0)
    const reviews = 5 + (seed % 400)
    // Bias rating towards 3.8-4.9 range (realistic for local businesses)
    const rating = parseFloat(Math.min(5.0, 3.6 + ((seed % 13) / 10)).toFixed(1))

    // Normalize to percentage map position (lat increases upward, so invert)
    const topPct = PAD + (1 - (el.lat - minLat) / latRange) * (100 - 2 * PAD)
    const leftPct = PAD + ((el.lon - minLon) / lonRange) * (100 - 2 * PAD)

    const partial = { name, website, phone, rating, reviews, status }

    return {
      id: `scan-${el.type ?? 'node'}-${el.id}`,
      name,
      website,
      phone,
      rating,
      reviews,
      category: industry,
      status,
      isCustom: false,
      mapPos: {
        top: `${Math.max(PAD, Math.min(100 - PAD, topPct)).toFixed(1)}%`,
        left: `${Math.max(PAD, Math.min(100 - PAD, leftPct)).toFixed(1)}%`,
      },
      audit: generateAuditScores(partial),
    }
  })

  return NextResponse.json({
    leads,
    center: { lat: centerLat, lon: centerLon },
  })
}
