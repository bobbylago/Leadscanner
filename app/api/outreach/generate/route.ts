import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth-server"
import { generatePersonalizedOutreach, type OutreachTone } from "@/lib/gemini-outreach"
import type { Lead } from "@/lib/types"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"

export const maxDuration = 30
const MAX_BODY_BYTES = 80_000

export async function POST(req: NextRequest) {
  const bodySize = Number(req.headers.get("content-length") ?? 0)
  if (Number.isFinite(bodySize) && bodySize > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request is too large" }, { status: 413 })
  }

  const { user } = await getAuthenticatedUser(req)
  if (!user) {
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
    const result = await generatePersonalizedOutreach({
      lead: body.lead as Lead,
      senderName: typeof body.senderName === "string" ? body.senderName : "",
      tone,
      fallbackSubjectTemplate: typeof body.subjectTemplate === "string" ? body.subjectTemplate : "",
      fallbackBodyTemplate: typeof body.bodyTemplate === "string" ? body.bodyTemplate : "",
    })

    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not generate outreach"
    const status = message.includes("GEMINI_API_KEY") ? 503 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
