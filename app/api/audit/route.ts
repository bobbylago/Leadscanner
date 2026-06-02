import { NextRequest, NextResponse } from 'next/server'
import { auditWebsite } from '@/lib/audit-engine'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const { user } = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Sign in to run an audit' }, { status: 401 })
  }

  // Cap audits per user to prevent using the server as an SSRF/abuse proxy.
  const limit = rateLimit(`audit:${user.id}`, 30, 60_000)
  if (!limit.ok) {
    const { body, headers } = tooManyRequests(limit.resetMs)
    return NextResponse.json(body, { status: 429, headers })
  }

  const url = new URL(req.url).searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })

  try {
    const result = await auditWebsite(url)
    return NextResponse.json(result)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Audit failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
