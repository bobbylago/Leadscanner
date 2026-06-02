import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth-server"
import { generatePersonalizedOutreach, type OutreachTone } from "@/lib/gemini-outreach"
import type { Lead } from "@/lib/types"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import {
  completeOutreachUsage,
  getBillingStatus,
  releaseOutreachUsage,
  reserveOutreachUsage,
} from "@/lib/billing"
import { ensureFreeAccountAllowedForUsage } from "@/lib/signup-guard"

export const maxDuration = 30
const MAX_BODY_BYTES = 80_000

export async function POST(req: NextRequest) {
  const bodySize = Number(req.headers.get("content-length") ?? 0)
  if (Number.isFinite(bodySize) && bodySize > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request is too large" }, { status: 413 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase service role is not configured" }, { status: 500 })
  }

  const { user, supabase } = await getAuthenticatedUser(req)
  if (!user || !supabase) {
    return NextResponse.json({ error: "Sign in to generate outreach" }, { status: 401 })
  }

  // Cap Gemini calls per identity (paid external call — prevents cost abuse).
  const limit = rateLimit(`outreach:${user.id}`, 30, 60_000)
  if (!limit.ok) {
    const { body, headers } = tooManyRequests(limit.resetMs)
    return NextResponse.json(body, { status: 429, headers })
  }

  try {
    const rawBody = await req.text()
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request is too large" }, { status: 413 })
    }

    let body: Record<string, unknown>
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    if (!body?.lead) {
      return NextResponse.json({ error: "Missing lead" }, { status: 400 })
    }

    const toneValue = typeof body.tone === "string" ? body.tone : ""
    const tone = (["direct", "friendly", "premium"].includes(toneValue) ? toneValue : "direct") as OutreachTone

    const lead = body.lead as Lead
    const billing = await getBillingStatus(supabase, user.id)
    const freeGuard = await ensureFreeAccountAllowedForUsage(supabase, req, {
      userId: user.id,
      email: user.email,
      plan: billing.plan,
    })
    if (!freeGuard.allowed) {
      return NextResponse.json({ error: freeGuard.error }, { status: 409 })
    }

    if (billing.outreachRemaining <= 0) {
      return NextResponse.json({
        error: "Monthly AI script limit reached",
        billing,
      }, { status: 402 })
    }

    const usageMetadata = {
      leadId: lead.id,
      leadName: lead.name,
      leadWebsite: lead.website,
      tone,
    }
    const reservationId = await reserveOutreachUsage(supabase, user.id, usageMetadata)
    const afterReserve = await getBillingStatus(supabase, user.id)
    if (afterReserve.outreachUsed > afterReserve.outreachLimit) {
      await releaseOutreachUsage(supabase, reservationId)
      return NextResponse.json({
        error: "Monthly AI script limit reached",
        billing: afterReserve,
      }, { status: 402 })
    }

    let result: Awaited<ReturnType<typeof generatePersonalizedOutreach>>
    try {
      result = await generatePersonalizedOutreach({
        lead,
        senderName: typeof body.senderName === "string" ? body.senderName : "",
        tone,
        fallbackSubjectTemplate: typeof body.subjectTemplate === "string" ? body.subjectTemplate : "",
        fallbackBodyTemplate: typeof body.bodyTemplate === "string" ? body.bodyTemplate : "",
      })
    } catch (e) {
      await releaseOutreachUsage(supabase, reservationId)
      throw e
    }

    await completeOutreachUsage(supabase, reservationId, {
      ...usageMetadata,
      subjectLength: result.subject.length,
      bodyLength: result.body.length,
    })
    const finalBilling = await getBillingStatus(supabase, user.id)

    return NextResponse.json({
      ...result,
      billing: finalBilling,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not generate outreach"
    const status = message.includes("GEMINI_API_KEY") ? 503 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
