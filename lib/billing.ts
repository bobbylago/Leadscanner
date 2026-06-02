import { OUTREACH_LIMITS, PLAN_LIMITS, type PlanName } from "./stripe"
import type { SupabaseClient } from "@supabase/supabase-js"

export interface BillingStatus {
  plan: PlanName | "free"
  status: string
  isActive: boolean
  scanLimit: number
  scansUsed: number
  scansRemaining: number
  outreachLimit: number
  outreachUsed: number
  outreachRemaining: number
  currentPeriodEnd: string | null
}

export function monthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

function usageCredits(metadata: unknown): number {
  if (!metadata || typeof metadata !== "object") return 1
  const record = metadata as Record<string, unknown>
  const rawCredits = record.credits ?? record.leadCount
  const credits = typeof rawCredits === "number" ? rawCredits : Number(rawCredits)
  if (!Number.isFinite(credits)) return 1
  return Math.max(0, Math.ceil(credits))
}

async function getMonthlyUsage(
  supabase: SupabaseClient,
  userId: string,
  eventType: string,
): Promise<number> {
  const { data: usageEvents, error: usageError } = await supabase
    .from("usage_events")
    .select("metadata")
    .eq("user_id", userId)
    .eq("event_type", eventType)
    .eq("month_key", monthKey())

  if (usageError) {
    throw new Error(usageError.message)
  }

  return (usageEvents ?? []).reduce(
    (total, event) => total + usageCredits(event.metadata),
    0,
  )
}

export async function getBillingStatus(supabase: SupabaseClient, userId: string): Promise<BillingStatus> {
  const { data: sub, error: subError } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle()

  if (subError) {
    throw new Error(subError.message)
  }

  const plan = (sub?.plan ?? "free") as PlanName | "free"
  const status = sub?.status ?? "free"
  const isActive = status === "active" || status === "trialing"
  const effectivePlan = isActive ? plan : "free"
  const scanLimit = PLAN_LIMITS[effectivePlan]
  const outreachLimit = OUTREACH_LIMITS[effectivePlan]

  const [scansUsed, outreachUsed] = await Promise.all([
    getMonthlyUsage(supabase, userId, "scan"),
    getMonthlyUsage(supabase, userId, "outreach_generate"),
  ])

  return {
    plan: effectivePlan,
    status,
    isActive,
    scanLimit,
    scansUsed,
    scansRemaining: Math.max(0, scanLimit - scansUsed),
    outreachLimit,
    outreachUsed,
    outreachRemaining: Math.max(0, outreachLimit - outreachUsed),
    currentPeriodEnd: sub?.current_period_end ?? null,
  }
}

async function reserveUsage(
  supabase: SupabaseClient,
  userId: string,
  eventType: string,
  metadata: Record<string, unknown>,
  credits = 1,
): Promise<string> {
  const { data, error } = await supabase
    .from("usage_events")
    .insert({
      user_id: userId,
      event_type: eventType,
      month_key: monthKey(),
      metadata: {
        ...metadata,
        credits,
        reservedCredits: credits,
        status: "reserved",
      },
    })
    .select("id")
    .single()

  if (error) {
    throw new Error(error.message)
  }
  return data.id as string
}

/**
 * Reserve a scan by inserting the usage row up front, then returning its id.
 * Callers re-read the count afterwards (via getBillingStatus) so that the
 * limit check happens *after* the insert — closing the check-then-act race
 * where concurrent requests could both pass a pre-insert check. Release the
 * reservation if the work fails or the limit turns out to be exceeded.
 */
export async function reserveScanUsage(
  supabase: SupabaseClient,
  userId: string,
  metadata: Record<string, unknown>,
  credits = 1,
): Promise<string> {
  return reserveUsage(supabase, userId, "scan", metadata, credits)
}

export async function updateScanUsage(
  supabase: SupabaseClient,
  id: string,
  metadata: Record<string, unknown>,
  credits: number,
): Promise<void> {
  const { error } = await supabase
    .from("usage_events")
    .update({
      metadata: {
        ...metadata,
        credits,
        leadCount: credits,
        status: "completed",
      },
    })
    .eq("id", id)

  if (error) {
    throw new Error(error.message)
  }
}

export async function releaseScanUsage(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase.from("usage_events").delete().eq("id", id)
}

export async function reserveOutreachUsage(
  supabase: SupabaseClient,
  userId: string,
  metadata: Record<string, unknown>,
): Promise<string> {
  return reserveUsage(supabase, userId, "outreach_generate", metadata, 1)
}

export async function completeOutreachUsage(
  supabase: SupabaseClient,
  id: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("usage_events")
    .update({
      metadata: {
        ...metadata,
        credits: 1,
        status: "completed",
      },
    })
    .eq("id", id)

  if (error) {
    throw new Error(error.message)
  }
}

export async function releaseOutreachUsage(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase.from("usage_events").delete().eq("id", id)
}
