import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth-server"
import { appUrl, stripe } from "@/lib/stripe"

export async function POST(req: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Supabase service role is not configured" }, { status: 500 })
    }

    const { user, supabase } = await getAuthenticatedUser(req)
    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!stripe) {
      return NextResponse.json({ error: "Stripe is not configured. Add STRIPE_SECRET_KEY in Vercel and redeploy." }, { status: 500 })
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
      return NextResponse.json({ error: "No Stripe customer found yet. Upgrade first, then use Manage Subscription." }, { status: 404 })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: appUrl(),
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe billing portal failed"
    return NextResponse.json({
      error: `Stripe billing portal failed: ${message}. Configure the Customer Portal in Stripe, then try again.`,
    }, { status: 500 })
  }
}
