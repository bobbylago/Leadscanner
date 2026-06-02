import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { planFromPriceId, stripe } from "@/lib/stripe"
import Stripe from "stripe"

export async function POST(req: NextRequest) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe webhook is not configured" }, { status: 500 })
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase service role is not configured" }, { status: 500 })
  }

  const body = await req.text()
  const signature = req.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 })
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription
    const subscriptionWithPeriod = subscription as Stripe.Subscription & { current_period_end?: number }
    const userId = subscription.metadata.supabase_user_id
    const priceId = subscription.items.data[0]?.price.id

    if (userId) {
      const { error: upsertError } = await supabase.from("subscriptions").upsert({
        user_id: userId,
        stripe_customer_id: typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId ?? null,
        plan: planFromPriceId(priceId),
        status: subscription.status,
        current_period_end: subscriptionWithPeriod.current_period_end
          ? new Date(subscriptionWithPeriod.current_period_end * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" })

      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ received: true })
}
