import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth-server"
import { appUrl, stripe } from "@/lib/stripe"

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase service role is not configured" }, { status: 500 })
  }

  const { user, supabase } = await getAuthenticatedUser(req)
  if (!user || !supabase) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 })
  }

  const { data: sub, error } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: "No Stripe customer found" }, { status: 404 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: appUrl(),
  })

  return NextResponse.json({ url: session.url })
}
