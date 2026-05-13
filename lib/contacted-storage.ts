/**
 * Persistent tracking of which leads have had outreach sent.
 * Stored per-email so the same business found in different scans
 * (different lead IDs) still gets deduped.
 */

const STORAGE_KEY = "ls_contacted_v1"

export interface ContactRecord {
  email: string
  leadId: string
  leadName: string
  sentAt: number
  subject?: string
}

/** All records — keyed by normalised email (lowercase, trimmed) */
export type ContactedMap = Record<string, ContactRecord>

function normaliseEmail(e: string): string {
  return e.toLowerCase().trim()
}

export function loadContacted(): ContactedMap {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
  } catch { return {} }
}

export function saveContacted(data: ContactedMap): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    // Notify listeners in this tab (storage event only fires cross-tab)
    window.dispatchEvent(new CustomEvent("ls_contacted_changed"))
  } catch {}
}

/** Look up by lead ID (linear scan but cheap for typical sizes) */
export function findByLeadId(map: ContactedMap, leadId: string): ContactRecord | null {
  for (const r of Object.values(map)) {
    if (r.leadId === leadId) return r
  }
  return null
}

/** Has either this email or this lead ID been contacted? */
export function isContacted(map: ContactedMap, opts: { email?: string; leadId?: string }): boolean {
  if (opts.email) {
    const key = normaliseEmail(opts.email)
    if (key && map[key]) return true
  }
  if (opts.leadId && findByLeadId(map, opts.leadId)) return true
  return false
}

/** Mark a lead as contacted */
export function markContacted(map: ContactedMap, record: Omit<ContactRecord, "sentAt">): ContactedMap {
  const key = normaliseEmail(record.email)
  if (!key) return map
  const next = { ...map, [key]: { ...record, sentAt: Date.now() } }
  saveContacted(next)
  return next
}

/** Remove a contact record */
export function unmarkContacted(map: ContactedMap, opts: { email?: string; leadId?: string }): ContactedMap {
  const next = { ...map }
  if (opts.email) {
    const key = normaliseEmail(opts.email)
    delete next[key]
  }
  if (opts.leadId) {
    for (const [k, v] of Object.entries(next)) {
      if (v.leadId === opts.leadId) delete next[k]
    }
  }
  saveContacted(next)
  return next
}

/** Clear every contact record */
export function clearAllContacted(): ContactedMap {
  saveContacted({})
  return {}
}

/** Format a "sent X days ago" string */
export function formatSentAgo(sentAt: number): string {
  const ms = Date.now() - sentAt
  const days = Math.floor(ms / 86400000)
  if (days === 0) {
    const hours = Math.floor(ms / 3600000)
    if (hours === 0) return "just now"
    if (hours === 1) return "1 hour ago"
    return `${hours} hours ago`
  }
  if (days === 1) return "yesterday"
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}
