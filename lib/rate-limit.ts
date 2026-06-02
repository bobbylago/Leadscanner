/**
 * Lightweight in-memory fixed-window rate limiter.
 *
 * NOTE: state lives per server instance, so on serverless/multi-instance
 * deploys this is best-effort (each instance enforces the limit independently).
 * It still meaningfully caps abuse and runaway cost from a single instance.
 * For hard global limits, back this with Redis/Upstash.
 */

import type { NextRequest } from "next/server"

interface Window {
  count: number
  resetAt: number
}

const buckets = new Map<string, Window>()
let lastSweep = 0

function sweep(now: number) {
  // Opportunistically drop expired windows so the map does not grow unbounded.
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, win] of buckets) {
    if (win.resetAt <= now) buckets.delete(key)
  }
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetMs: number
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, resetMs: windowMs }
  }

  existing.count += 1
  const remaining = Math.max(0, limit - existing.count)
  return { ok: existing.count <= limit, remaining, resetMs: existing.resetAt - now }
}

/** Best-effort client identifier: prefer a stable id (e.g. user id), else IP. */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  return req.headers.get("x-real-ip")?.trim() || "unknown"
}

/** Build a 429 JSON Response body + headers for a blocked request. */
export function tooManyRequests(resetMs: number) {
  return {
    body: { error: "Too many requests. Please slow down." },
    headers: { "Retry-After": String(Math.ceil(resetMs / 1000)) },
  }
}
