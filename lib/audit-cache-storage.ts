/**
 * Persist real website-audit results so leads stay audited across reloads
 * instead of re-fetching every session. Browser cache is account-scoped; remote
 * cache is stored in Supabase when the optional `lead_audits` table exists.
 */

import type { Lead } from "./types"
import { supabase } from "./supabase-client"

type RealAudit = NonNullable<Lead["realAudit"]>
export type AuditCache = Record<string, RealAudit>

const STORAGE_KEY = "ls_audit_cache_v2"
const LEGACY_STORAGE_KEYS = ["ls_audit_cache_v1", STORAGE_KEY]
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000 // 14 days
const MAX_ENTRIES = 1000

function storageKey(userId?: string) {
  return userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY
}

function freshAuditEntries(cache: AuditCache): AuditCache {
  const now = Date.now()
  const fresh: AuditCache = {}
  for (const [id, audit] of Object.entries(cache)) {
    if (audit && typeof audit.auditedAt === "number" && now - audit.auditedAt < MAX_AGE_MS) {
      fresh[id] = audit
    }
  }
  return fresh
}

function readLocalCache(key: string): AuditCache {
  try {
    return freshAuditEntries(JSON.parse(localStorage.getItem(key) || "{}") as AuditCache)
  } catch {
    return {}
  }
}

export function loadAuditCache(userId?: string): AuditCache {
  if (typeof window === "undefined") return {}

  const scoped = readLocalCache(storageKey(userId))
  if (Object.keys(scoped).length > 0) return scoped

  // Backfill old unscoped browser audits into the account-scoped cache.
  const legacy = readLocalCache(STORAGE_KEY)
  if (userId && Object.keys(legacy).length > 0) saveAuditCache(legacy, userId)
  return legacy
}

export function saveAuditCache(cache: AuditCache, userId?: string): void {
  if (typeof window === "undefined") return
  try {
    let entries = Object.entries(cache)
    // Cap size and keep the most recently audited entries.
    if (entries.length > MAX_ENTRIES) {
      entries = entries
        .sort((a, b) => (b[1]?.auditedAt ?? 0) - (a[1]?.auditedAt ?? 0))
        .slice(0, MAX_ENTRIES)
    }
    localStorage.setItem(storageKey(userId), JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // Quota or serialization failure is non-fatal; audits simply won't persist locally.
  }
}

export function clearAuditCache(userId?: string): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(storageKey(userId))
  for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key)
}

export function mergeAuditCaches(...caches: AuditCache[]): AuditCache {
  const merged: AuditCache = {}
  for (const cache of caches) {
    for (const [leadId, audit] of Object.entries(cache)) {
      const existing = merged[leadId]
      if (!existing || (audit.auditedAt ?? 0) > (existing.auditedAt ?? 0)) {
        merged[leadId] = audit
      }
    }
  }
  return freshAuditEntries(merged)
}

function websiteDomain(website: string | null | undefined): string | null {
  if (!website) return null
  try {
    return new URL(website.startsWith("http") ? website : `https://${website}`)
      .hostname
      .replace(/^www\./i, "")
      .toLowerCase()
  } catch {
    return null
  }
}

function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(?:llc|inc|ltd|co|company|corp|corporation)\b/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isAudit(value: unknown): value is RealAudit {
  if (!value || typeof value !== "object") return false
  const audit = value as Partial<RealAudit>
  return (
    typeof audit.seo === "number" &&
    typeof audit.mobileFriendliness === "number" &&
    typeof audit.chatbotPresence === "number" &&
    typeof audit.pageSpeed === "number" &&
    typeof audit.socialPresence === "number" &&
    typeof audit.auditedAt === "number"
  )
}

function isMissingAuditTable(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ""
  return error?.code === "42P01" || message.includes("lead_audits") || message.includes("schema cache")
}

export async function loadRemoteAuditCache(): Promise<AuditCache> {
  if (!supabase) return {}

  const { data, error } = await supabase
    .from("lead_audits")
    .select("lead_id, audit")
    .order("audited_at", { ascending: false })
    .limit(MAX_ENTRIES)

  if (error) {
    if (!isMissingAuditTable(error)) console.warn("Could not load lead audits", error.message)
    return {}
  }

  const cache: AuditCache = {}
  for (const row of data ?? []) {
    const audit = row.audit
    if (typeof row.lead_id === "string" && isAudit(audit)) {
      cache[row.lead_id] = audit
    }
  }
  return freshAuditEntries(cache)
}

export async function saveRemoteAudit(lead: Lead, audit: RealAudit): Promise<boolean> {
  if (!supabase) return false

  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return false

  const { error } = await supabase
    .from("lead_audits")
    .upsert({
      user_id: userData.user.id,
      lead_id: lead.id,
      website_domain: websiteDomain(lead.website),
      name_key: nameKey(lead.name),
      audit,
      audited_at: new Date(audit.auditedAt).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,lead_id" })

  if (error) {
    if (!isMissingAuditTable(error)) console.warn("Could not save lead audit", error.message)
    return false
  }

  return true
}
