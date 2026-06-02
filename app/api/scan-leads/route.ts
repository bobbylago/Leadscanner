import { NextRequest, NextResponse } from 'next/server'
import { findLeads } from '@/lib/lead-finder'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { getBillingStatus, reserveScanUsage, releaseScanUsage, updateScanUsage } from '@/lib/billing'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'

export const maxDuration = 60

const PLAN_RESULT_CAPS = {
  free: 50,
  starter: 100,
  pro: 150,
  agency: 200,
} as const

export async function GET(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase service role is not configured' }, { status: 500 })
  }

  const { user, supabase } = await getAuthenticatedUser(req)
  if (!user || !supabase) {
    return NextResponse.json({ error: 'Sign in to scan for leads' }, { status: 401 })
  }

  // Throttle scans independently of the monthly quota to curb burst abuse.
  const limit = rateLimit(`scan:${user.id}`, 10, 60_000)
  if (!limit.ok) {
    const { body, headers } = tooManyRequests(limit.resetMs)
    return NextResponse.json(body, { status: 429, headers })
  }

  const { searchParams } = new URL(req.url)
  const city = (searchParams.get('city') || 'Austin').trim()
  const industry = searchParams.get('industry') || 'Plumbing'
  const verify = searchParams.get('verify') !== 'false'
  const includeChains = searchParams.get('chains') === 'true'
  const deepScan = searchParams.get('deep') === 'true'
  const sourceParam = searchParams.get('source')
  const source: 'auto' | 'google' | 'public' =
    sourceParam === 'google' || sourceParam === 'public' ? sourceParam : 'auto'
  const requestedLimit = parseInt(searchParams.get('limit') || (deepScan ? '150' : '50'), 10)

  try {
    const billing = await getBillingStatus(supabase, user.id)
    if (billing.scansRemaining <= 0) {
      return NextResponse.json({
        error: 'Monthly lead credit limit reached',
        billing,
      }, { status: 402 })
    }

    const planResultCap = PLAN_RESULT_CAPS[billing.plan] ?? PLAN_RESULT_CAPS.free
    const hardResultCap = deepScan ? 200 : 100
    const scanLimit = Math.max(1, Math.min(
      Number.isFinite(requestedLimit) ? requestedLimit : (deepScan ? 150 : 50),
      hardResultCap,
      planResultCap,
      billing.scansRemaining,
    ))

    // Reserve the lead credits up front, then re-check the count so the limit is
    // enforced after the insert (prevents concurrent requests bypassing quota).
    const reservationId = await reserveScanUsage(supabase, user.id, {
      city,
      industry,
      requestedLimit,
      scanLimit,
      deepScan,
      source,
    }, scanLimit)
    const afterReserve = await getBillingStatus(supabase, user.id)
    if (afterReserve.scansUsed > afterReserve.scanLimit) {
      await releaseScanUsage(supabase, reservationId)
      return NextResponse.json({
        error: 'Monthly lead credit limit reached',
        billing: afterReserve,
      }, { status: 402 })
    }

    let result
    try {
      result = await findLeads(city, industry, {
        verifyWebsites: verify,
        includeChains,
        limit: scanLimit,
        deepScan,
        source,
      })
    } catch (e) {
      // Don't charge the user for a failed scan.
      await releaseScanUsage(supabase, reservationId)
      throw e
    }

    const leadCredits = result.leads.length
    try {
      await updateScanUsage(supabase, reservationId, {
        city,
        industry,
        requestedLimit,
        scanLimit,
        deepScan,
        source,
        leadCount: leadCredits,
        dataSource: result.stats.dataSource,
      }, leadCredits)
    } catch (e) {
      await releaseScanUsage(supabase, reservationId)
      throw e
    }

    const finalBilling = await getBillingStatus(supabase, user.id)

    return NextResponse.json({
      leads: result.leads,
      center: result.center,
      city: result.geocode.displayName,
      stats: result.stats,
      billing: finalBilling,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Scan failed'
    const status = msg.toLowerCase().includes('not found') ? 404 : 502
    return NextResponse.json({ error: msg }, { status })
  }
}
