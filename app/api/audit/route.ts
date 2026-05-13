import { NextRequest, NextResponse } from 'next/server'
import { auditWebsite } from '@/lib/audit-engine'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const url = new URL(req.url).searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })

  try {
    const result = await auditWebsite(url)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Audit failed' }, { status: 500 })
  }
}
