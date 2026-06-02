import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit"
import { checkFreeAccountAllowed, recordFreeAccountClaim } from "@/lib/signup-guard"

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 })
  }

  // Throttle auth attempts per IP to slow credential stuffing / brute force.
  const limit = rateLimit(`auth:${clientIp(req)}`, 10, 60_000)
  if (!limit.ok) {
    const { body, headers } = tooManyRequests(limit.resetMs)
    return NextResponse.json(body, { status: 429, headers })
  }

  const body = await req.json().catch(() => null)
  const mode = body?.mode === "sign-up" ? "sign-up" : "sign-in"
  const email = String(body?.email ?? "").trim().toLowerCase()
  const password = String(body?.password ?? "")

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 })
  }

  if (mode === "sign-up") {
    const guard = await checkFreeAccountAllowed(supabase, {
      email,
      req,
      deviceId: body?.signupDeviceId,
    })
    if (!guard.allowed) {
      return NextResponse.json({ error: guard.error }, { status: 409 })
    }
  }

  const result = mode === "sign-in"
    ? await supabase.auth.signInWithPassword({ email, password })
    : await supabase.auth.signUp({ email, password })

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 400 })
  }

  if (mode === "sign-up" && result.data.user?.id) {
    await recordFreeAccountClaim(supabase, {
      userId: result.data.user.id,
      email,
      req,
      deviceId: body?.signupDeviceId,
    })
  }

  if (!result.data.session) {
    return NextResponse.json({
      error: "Check your email to confirm your account, then sign in.",
    }, { status: 202 })
  }

  return NextResponse.json({
    session: result.data.session,
    user: result.data.user,
  })
}
