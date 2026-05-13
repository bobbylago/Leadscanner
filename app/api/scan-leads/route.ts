import { NextRequest, NextResponse } from 'next/server'
import { findLeads } from '@/lib/lead-finder'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const city = (searchParams.get('city') || 'Austin').trim()
  const industry = searchParams.get('industry') || 'Plumbing'
  const verify = searchParams.get('verify') !== 'false'
  const includeChains = searchParams.get('chains') === 'true'
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

  try {
    const result = await findLeads(city, industry, {
      verifyWebsites: verify,
      includeChains,
      limit,
    })

    return NextResponse.json({
      leads: result.leads,
      center: result.center,
      city: result.geocode.displayName,
      stats: result.stats,
    })
  } catch (e: any) {
    const msg = e.message || 'Scan failed'
    const status = msg.toLowerCase().includes('not found') ? 404 : 502
    return NextResponse.json({ error: msg }, { status })
  }
}
