import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth-server"
import { getBillingStatus } from "@/lib/billing"

export async function GET(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase service role is not configured" }, { status: 500 })
  }

  const { user, supabase } = await getAuthenticatedUser(req)

  if (!user || !supabase) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const status = await getBillingStatus(supabase, user.id)
    return NextResponse.json(status)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load billing status"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
