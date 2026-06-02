/**
 * Persistent tracking of which leads have had outreach sent.
 * Stored per-email so the same business found in different scans
 * (different lead IDs) still gets deduped.
 */

import { supabase } from "./supabase-client"

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
  const full = { ...record, email: key, sentAt: Date.now() }
  const next = { ...map, [key]: full }
  saveContacted(next)
  void upsertContactedRemote(full)
  return next
}

/** Remove a contact record */
export function unmarkContacted(map: ContactedMap, opts: { email?: string; leadId?: string }): ContactedMap {
  const next = { ...map }
  const emails: string[] = []
  if (opts.email) {
    const key = normaliseEmail(opts.email)
    if (next[key]) emails.push(key)
    delete next[key]
  }
  if (opts.leadId) {
    for (const [k, v] of Object.entries(next)) {
      if (v.leadId === opts.leadId) { emails.push(k); delete next[k] }
    }
  }
  saveContacted(next)
  for (const e of emails) void deleteContactedRemote(e)
  return next
}

/** Clear every contact record */
export function clearAllContacted(): ContactedMap {
  saveContacted({})
  void clearContactedRemote()
  return {}
}

// ── Supabase sync (best-effort; localStorage stays the source for instant UI) ──

async function currentUserId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

/** Load this account's contacted records from Supabase, keyed by email. */
export async function loadContactedRemote(): Promise<ContactedMap> {
  if (!supabase) return {}
  const userId = await currentUserId()
  if (!userId) return {}

  const { data, error } = await supabase
    .from("contacted")
    .select("email, lead_id, lead_name, subject, sent_at")
    .limit(5000)

  if (error || !data) return {}
  const map: ContactedMap = {}
  for (const row of data) {
    const key = normaliseEmail(row.email)
    if (!key) continue
    map[key] = {
      email: key,
      leadId: row.lead_id ?? "",
      leadName: row.lead_name ?? "",
      subject: row.subject ?? undefined,
      sentAt: row.sent_at ? new Date(row.sent_at).getTime() : Date.now(),
    }
  }
  return map
}

async function upsertContactedRemote(record: ContactRecord): Promise<void> {
  if (!supabase) return
  const userId = await currentUserId()
  if (!userId) return
  await supabase.from("contacted").upsert({
    user_id: userId,
    email: record.email,
    lead_id: record.leadId || null,
    lead_name: record.leadName || null,
    subject: record.subject ?? null,
    sent_at: new Date(record.sentAt).toISOString(),
  }, { onConflict: "user_id,email" })
}

/** Push local-only records to Supabase (used to reconcile after loading remote). */
export async function pushContactedRemote(records: ContactRecord[]): Promise<void> {
  if (!supabase || records.length === 0) return
  const userId = await currentUserId()
  if (!userId) return
  await supabase.from("contacted").upsert(
    records.map(r => ({
      user_id: userId,
      email: r.email,
      lead_id: r.leadId || null,
      lead_name: r.leadName || null,
      subject: r.subject ?? null,
      sent_at: new Date(r.sentAt).toISOString(),
    })),
    { onConflict: "user_id,email" },
  )
}

async function deleteContactedRemote(email: string): Promise<void> {
  if (!supabase) return
  const userId = await currentUserId()
  if (!userId) return
  await supabase.from("contacted").delete().eq("user_id", userId).eq("email", email)
}

async function clearContactedRemote(): Promise<void> {
  if (!supabase) return
  const userId = await currentUserId()
  if (!userId) return
  await supabase.from("contacted").delete().eq("user_id", userId)
}

/** Merge two maps, preferring the most recently sent record per email. */
export function mergeContacted(a: ContactedMap, b: ContactedMap): ContactedMap {
  const out: ContactedMap = { ...a }
  for (const [k, v] of Object.entries(b)) {
    const existing = out[k]
    if (!existing || v.sentAt > existing.sentAt) out[k] = v
  }
  return out
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
