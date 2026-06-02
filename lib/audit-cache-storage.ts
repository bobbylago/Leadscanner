/**
 * Persist real website-audit results so leads stay "audited" across reloads
 * instead of re-fetching every session. Keyed by lead id; entries expire so
 * stale audits are eventually refreshed.
 */

import type { Lead } from "./types"

type RealAudit = NonNullable<Lead["realAudit"]>
export type AuditCache = Record<string, RealAudit>

const STORAGE_KEY = "ls_audit_cache_v2"
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000 // 14 days
const MAX_ENTRIES = 1000

export function loadAuditCache(): AuditCache {
  if (typeof window === "undefined") return {}
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as AuditCache
    const now = Date.now()
    const fresh: AuditCache = {}
    for (const [id, audit] of Object.entries(raw)) {
      if (audit && typeof audit.auditedAt === "number" && now - audit.auditedAt < MAX_AGE_MS) {
        fresh[id] = audit
      }
    }
    return fresh
  } catch {
    return {}
  }
}

export function saveAuditCache(cache: AuditCache): void {
  if (typeof window === "undefined") return
  try {
    let entries = Object.entries(cache)
    // Cap size — keep the most recently audited entries.
    if (entries.length > MAX_ENTRIES) {
      entries = entries
        .sort((a, b) => (b[1]?.auditedAt ?? 0) - (a[1]?.auditedAt ?? 0))
        .slice(0, MAX_ENTRIES)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // Quota or serialization failure — non-fatal, audits simply won't persist.
  }
}
