import { PLAN_LIMITS, type PlanName } from "./stripe"
import type { SupabaseClient } from "@supabase/supabase-js"

export interface BillingStatus {
  plan: PlanName | "free"
  status: string
  isActive: boolean
  scanLimit: number
  scansUsed: number
  scansRemaining: number
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

  const { data: usageEvents, error: usageError } = await supabase
    .from("usage_events")
    .select("metadata")
    .eq("user_id", userId)
    .eq("event_type", "scan")
    .eq("month_key", monthKey())

  if (usageError) {
    throw new Error(usageError.message)
  }

  const scansUsed = (usageEvents ?? []).reduce(
    (total, event) => total + usageCredits(event.metadata),
    0,
  )

  return {
    plan: effectivePlan,
    status,
    isActive,
    scanLimit,
    scansUsed,
    scansRemaining: Math.max(0, scanLimit - scansUsed),
    currentPeriodEnd: sub?.current_period_end ?? null,
  }
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
  const { data, error } = await supabase
    .from("usage_events")
    .insert({
      user_id: userId,
      event_type: "scan",
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
