import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth-server"
import { appUrl, STRIPE_PRICE_IDS, stripe, type PlanName } from "@/lib/stripe"
import type { SupabaseClient } from "@supabase/supabase-js"

const PLAN_LABELS: Record<PlanName, string> = {
  starter: "Starter",
  pro: "Pro",
  agency: "Agency",
}

function isMissingStripeCustomer(error: unknown) {
  const record = error as { code?: unknown; message?: unknown; raw?: { code?: unknown; message?: unknown } }
  const code = String(record?.code ?? record?.raw?.code ?? "")
  const message = String(record?.message ?? record?.raw?.message ?? "")
  return code === "resource_missing" && /No such customer/i.test(message)
}

async function resetStaleStripeCustomer(supabase: SupabaseClient, userId: string) {
  await supabase
    .from("subscriptions")
    .update({
      stripe_customer_id: null,
      stripe_subscription_id: null,
      stripe_price_id: null,
      plan: "free",
      status: "free",
      current_period_end: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
}

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

    const body = await req.json().catch(() => null)
    const plan = body?.plan as PlanName
    if (!PLAN_LABELS[plan]) {
      return NextResponse.json({ error: "Unknown billing plan" }, { status: 400 })
    }

    const priceId = STRIPE_PRICE_IDS[plan]
    if (!priceId) {
      return NextResponse.json({
        error: `Missing Stripe price ID for ${PLAN_LABELS[plan]}. Add STRIPE_${plan.toUpperCase()}_PRICE_ID in Vercel and redeploy.`,
      }, { status: 500 })
    }

    const { data: existing, error: lookupError } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 })
    }

    let customerId = existing?.stripe_customer_id as string | undefined

    if (customerId) {
      try {
        const customer = await stripe.customers.retrieve(customerId)
        if ("deleted" in customer && customer.deleted) {
          await resetStaleStripeCustomer(supabase, user.id)
          customerId = undefined
        }
      } catch (error) {
        if (!isMissingStripeCustomer(error)) throw error
        await resetStaleStripeCustomer(supabase, user.id)
        customerId = undefined
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      const { error: customerError } = await supabase.from("subscriptions").upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        plan: "free",
        status: "incomplete",
      }, { onConflict: "user_id" })

      if (customerError) {
        return NextResponse.json({ error: customerError.message }, { status: 500 })
      }
    }

    const baseUrl = appUrl()
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/?billing=success`,
      cancel_url: `${baseUrl}/?billing=cancelled`,
      allow_promotion_codes: true,
      metadata: {
        supabase_user_id: user.id,
        plan,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan,
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe checkout failed"
    return NextResponse.json({ error: `Stripe checkout failed: ${message}` }, { status: 500 })
  }
}
