import { createHash } from "node:crypto"
import type { NextRequest } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { clientIp } from "./rate-limit"
import type { PlanName } from "./stripe"

const FREE_SIGNUP_WINDOW_DAYS = 30
const MAX_FREE_SIGNUPS_PER_IP = 3
const DEVICE_ID_RE = /^[a-zA-Z0-9._:-]{12,128}$/

interface FreeAccountGuardArgs {
  email: string
  req: NextRequest
  deviceId?: unknown
}

interface FreeAccountClaimArgs extends FreeAccountGuardArgs {
  userId: string
}

export interface FreeAccountGuardResult {
  allowed: boolean
  error?: string
}

function guardSalt() {
  return process.env.SIGNUP_GUARD_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-signup-guard"
}

function hashValue(value: string) {
  return createHash("sha256").update(`${guardSalt()}:${value}`).digest("hex")
}

function canonicalEmail(email: string) {
  const clean = email.trim().toLowerCase()
  const [rawLocal, rawDomain] = clean.split("@")
  if (!rawLocal || !rawDomain) return clean

  const baseLocal = rawLocal.split("+")[0]

  if (rawDomain === "gmail.com" || rawDomain === "googlemail.com") {
    const local = baseLocal.replace(/\./g, "")
    return `${local}@gmail.com`
  }

  return `${baseLocal}@${rawDomain}`
}

function normalizeDeviceId(value: unknown) {
  if (typeof value !== "string") return null
  const clean = value.trim()
  return DEVICE_ID_RE.test(clean) ? clean : null
}

function requestDeviceId(req: NextRequest, fallback?: unknown) {
  return normalizeDeviceId(fallback) || normalizeDeviceId(req.headers.get("x-ls-device-id"))
}

function identityHashes(args: FreeAccountGuardArgs) {
  const ip = clientIp(args.req)
  const deviceId = requestDeviceId(args.req, args.deviceId)

  return {
    emailHash: hashValue(`email:${canonicalEmail(args.email)}`),
    ipHash: ip === "unknown" ? null : hashValue(`ip:${ip}`),
    deviceHash: deviceId ? hashValue(`device:${deviceId}`) : null,
  }
}

function cutoffIso() {
  const cutoff = Date.now() - FREE_SIGNUP_WINDOW_DAYS * 24 * 60 * 60 * 1000
  return new Date(cutoff).toISOString()
}

function isGuardTableMissing(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ""
  return error?.code === "42P01" || message.includes("free_account_claims") || message.includes("schema cache")
}

function allowIfGuardUnavailable(error: { message?: string; code?: string } | null | undefined): FreeAccountGuardResult | null {
  if (!error) return null
  if (isGuardTableMissing(error)) {
    console.warn("Free account signup guard table is missing; allowing request.")
    return { allowed: true }
  }
  console.warn("Free account signup guard check failed; allowing request.", error.message)
  return { allowed: true }
}

export async function checkFreeAccountAllowed(
  supabase: SupabaseClient,
  args: FreeAccountGuardArgs,
): Promise<FreeAccountGuardResult> {
  const { emailHash, ipHash, deviceHash } = identityHashes(args)

  const emailCheck = await supabase
    .from("free_account_claims")
    .select("id")
    .eq("email_hash", emailHash)
    .limit(1)

  const emailFallback = allowIfGuardUnavailable(emailCheck.error)
  if (emailFallback) return emailFallback
  if ((emailCheck.data ?? []).length > 0) {
    return {
      allowed: false,
      error: "A free account is already linked to that email. Sign in to the original account to keep using your credits.",
    }
  }

  if (deviceHash) {
    const deviceCheck = await supabase
      .from("free_account_claims")
      .select("id")
      .eq("device_hash", deviceHash)
      .gte("created_at", cutoffIso())
      .limit(1)

    const deviceFallback = allowIfGuardUnavailable(deviceCheck.error)
    if (deviceFallback) return deviceFallback
    if ((deviceCheck.data ?? []).length > 0) {
      return {
        allowed: false,
        error: "A free account was already created from this browser. Sign in to that account to keep using your credits.",
      }
    }
  }

  if (ipHash) {
    const ipCheck = await supabase
      .from("free_account_claims")
      .select("id")
      .eq("ip_hash", ipHash)
      .gte("created_at", cutoffIso())
      .limit(MAX_FREE_SIGNUPS_PER_IP)

    const ipFallback = allowIfGuardUnavailable(ipCheck.error)
    if (ipFallback) return ipFallback
    if ((ipCheck.data ?? []).length >= MAX_FREE_SIGNUPS_PER_IP) {
      return {
        allowed: false,
        error: "Too many free accounts were created from this network recently. Sign in to the original account to keep using your credits.",
      }
    }
  }

  return { allowed: true }
}

export async function recordFreeAccountClaim(
  supabase: SupabaseClient,
  args: FreeAccountClaimArgs,
): Promise<void> {
  const { emailHash, ipHash, deviceHash } = identityHashes(args)
  const { error } = await supabase
    .from("free_account_claims")
    .insert({
      user_id: args.userId,
      email_hash: emailHash,
      ip_hash: ipHash,
      device_hash: deviceHash,
    })

  if (error && !isGuardTableMissing(error)) {
    console.warn("Could not record free account claim.", error.message)
  }
}

export async function ensureFreeAccountAllowedForUsage(
  supabase: SupabaseClient,
  req: NextRequest,
  args: {
    userId: string
    email?: string | null
    plan: PlanName | "free"
  },
): Promise<FreeAccountGuardResult> {
  if (args.plan !== "free") return { allowed: true }
  if (!args.email) return { allowed: true }

  const existing = await supabase
    .from("free_account_claims")
    .select("id")
    .eq("user_id", args.userId)
    .limit(1)

  const existingFallback = allowIfGuardUnavailable(existing.error)
  if (existingFallback) return existingFallback
  if ((existing.data ?? []).length > 0) return { allowed: true }

  const allowed = await checkFreeAccountAllowed(supabase, {
    email: args.email,
    req,
  })

  if (!allowed.allowed) return allowed

  await recordFreeAccountClaim(supabase, {
    userId: args.userId,
    email: args.email,
    req,
  })

  return { allowed: true }
}
