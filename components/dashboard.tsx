"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { type Lead } from "@/lib/types"
import { calcRevenueLeak } from "@/lib/utils"
import { TopNav } from "./top-nav"
import { MapView } from "./map-view"
import { LeadList } from "./lead-list"
import { AuditPanel } from "./audit-panel"
import { AddLeadDialog } from "./add-lead-dialog"
import { FindLeadsDialog } from "./find-leads-dialog"
import { BatchOutreachDialog } from "./batch-outreach-dialog"
import { BillingDialog } from "./billing-dialog"
import { SavedScansDialog } from "./saved-scans-dialog"
import { OnboardingDialog } from "./onboarding-dialog"
import {
  loadContacted, saveContacted, loadContactedRemote, mergeContacted, pushContactedRemote,
  type ContactedMap,
} from "@/lib/contacted-storage"
import { clearSavedScans, loadSavedScans, saveScan, type SavedScan } from "@/lib/saved-scans"
import { loadAuditCache, saveAuditCache } from "@/lib/audit-cache-storage"
import { buildOutreachQueue, buildOutreachQueueCsv } from "@/lib/outreach-queue"
import { getHighValueLeadProfile, isLeadRelevantToCategory } from "@/lib/lead-scoring"
import { authedFetch } from "@/lib/api-client"
import { FREE_BILLING_STATUS, type BillingStatus } from "@/lib/billing-types"
import { TrendingDown, Target, Zap, Users, Plus, Radar, Mail, X, Map as MapIcon, ListChecks, Sparkles, Download, Flame } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "ls_custom_leads_v2"
const SCANNED_CITIES_KEY = "ls_scanned_cities_v1"
const MAP_CENTERS_KEY = "ls_map_centers_v1"
const ONBOARDED_KEY = "ls_onboarded_v1"
const BACKGROUND_AUDIT_WAVE_SIZE = 40
const BACKGROUND_AUDIT_CONCURRENCY = 4
const BACKGROUND_AUDIT_WAVE_DELAY_MS = 2500

function accountKey(base: string, userId: string): string {
  return `${base}:${userId}`
}

function removeAccountWorkspaceStorage(userId: string) {
  for (const key of [STORAGE_KEY, SCANNED_CITIES_KEY, MAP_CENTERS_KEY]) {
    localStorage.removeItem(accountKey(key, userId))
    // Remove legacy unscoped storage too so old browser data does not leak into new accounts.
    localStorage.removeItem(key)
  }
}

function loadCustomLeads(userId: string): Record<string, Lead[]> {
  try { return JSON.parse(localStorage.getItem(accountKey(STORAGE_KEY, userId)) || "{}") } catch { return {} }
}
function saveCustomLeads(userId: string, data: Record<string, Lead[]>) {
  try { localStorage.setItem(accountKey(STORAGE_KEY, userId), JSON.stringify(data)) } catch {}
}
function loadScannedCities(userId: string): string[] {
  try { return JSON.parse(localStorage.getItem(accountKey(SCANNED_CITIES_KEY, userId)) || "[]") } catch { return [] }
}
function saveScannedCities(userId: string, cities: string[]) {
  try { localStorage.setItem(accountKey(SCANNED_CITIES_KEY, userId), JSON.stringify(cities)) } catch {}
}
function loadMapCenters(userId: string): Record<string, { lat: number; lon: number }> {
  try { return JSON.parse(localStorage.getItem(accountKey(MAP_CENTERS_KEY, userId)) || "{}") } catch { return {} }
}
function saveMapCenters(userId: string, data: Record<string, { lat: number; lon: number }>) {
  try { localStorage.setItem(accountKey(MAP_CENTERS_KEY, userId), JSON.stringify(data)) } catch {}
}

function normaliseLeadName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(?:llc|inc|ltd|co|company|corp|corporation)\b/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function leadDomain(lead: Lead): string {
  if (!lead.website) return ""
  try {
    return new URL(lead.website.startsWith("http") ? lead.website : `https://${lead.website}`)
      .hostname
      .replace(/^www\./i, "")
      .toLowerCase()
  } catch {
    return ""
  }
}

function normalisePhone(phone: string | null): string {
  return phone?.replace(/\D/g, "").slice(-10) ?? ""
}

function leadDedupeKeys(lead: Lead): string[] {
  const keys = new Set<string>()
  keys.add(`id:${lead.id}`)

  const domain = leadDomain(lead)
  if (domain) keys.add(`domain:${domain}`)

  const phone = normalisePhone(lead.phone)
  if (phone.length >= 7) keys.add(`phone:${phone}`)

  const name = normaliseLeadName(lead.name)
  const category = lead.category ?? ""
  if (name) keys.add(`name:${category}:${name}`)

  return Array.from(keys)
}

function mergeLeadRecords(existing: Lead, incoming: Lead): Lead {
  return {
    ...existing,
    ...incoming,
    id: existing.id,
    name: existing.name.length >= incoming.name.length ? existing.name : incoming.name,
    website: existing.website ?? incoming.website,
    phone: existing.phone ?? incoming.phone,
    rating: Math.max(existing.rating ?? 0, incoming.rating ?? 0),
    reviews: Math.max(existing.reviews ?? 0, incoming.reviews ?? 0),
    qualityScore: Math.max(existing.qualityScore ?? 0, incoming.qualityScore ?? 0),
    websiteVerified: existing.websiteVerified ?? incoming.websiteVerified,
    realAudit: existing.realAudit ?? incoming.realAudit,
  }
}

function mergeLeads(existing: Lead[], incoming: Lead[]): Lead[] {
  const merged: Lead[] = []
  const keyToIndex = new Map<string, number>()

  const add = (lead: Lead) => {
    const keys = leadDedupeKeys(lead)
    const existingIndex = keys
      .map(key => keyToIndex.get(key))
      .find((index): index is number => index !== undefined)

    if (existingIndex === undefined) {
      const nextIndex = merged.length
      merged.push(lead)
      for (const key of keys) keyToIndex.set(key, nextIndex)
      return
    }

    const next = mergeLeadRecords(merged[existingIndex], lead)
    merged[existingIndex] = next
    for (const key of leadDedupeKeys(next)) keyToIndex.set(key, existingIndex)
  }

  for (const lead of existing) add(lead)
  for (const lead of incoming) add(lead)
  return merged
}

interface DashboardProps {
  userId: string
}

export function Dashboard({ userId }: DashboardProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [industry, setIndustry] = useState("All Industries")
  const [location, setLocation] = useState("Austin, TX")
  const [customLeadsMap, setCustomLeadsMap] = useState<Record<string, Lead[]>>({})
  const [scannedCities, setScannedCities] = useState<string[]>([])
  const [mapCenters, setMapCenters] = useState<Record<string, { lat: number; lon: number }>>({})
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showFindDialog, setShowFindDialog] = useState(false)
  const [showOutreachDialog, setShowOutreachDialog] = useState(false)
  const [showBillingDialog, setShowBillingDialog] = useState(false)
  const [billingHeadline, setBillingHeadline] = useState("Billing")
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [billingStatus, setBillingStatus] = useState<BillingStatus>(FREE_BILLING_STATUS)
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set())
  const [contacted, setContacted] = useState<ContactedMap>({})
  const [viewMode, setViewMode] = useState<"leads" | "map">("leads")

  // Sync contacted map from localStorage + same-tab and cross-tab updates
  useEffect(() => {
    const local = loadContacted()
    setContacted(local)

    // Pull the account's contacted records (cross-device) and reconcile with local.
    loadContactedRemote().then(remote => {
      if (Object.keys(remote).length === 0 && Object.keys(local).length === 0) return
      const merged = mergeContacted(local, remote)
      setContacted(merged)
      saveContacted(merged)
      // Push up any records that exist locally but not (or older) on the server.
      const localOnly = Object.values(local).filter(r => {
        const remoteRec = remote[r.email]
        return !remoteRec || r.sentAt > remoteRec.sentAt
      })
      void pushContactedRemote(localOnly)
    }).catch(() => { /* offline / not configured — localStorage still works */ })

    const refresh = () => setContacted(loadContacted())
    const onStorage = (e: StorageEvent) => {
      if (e.key === "ls_contacted_v1") refresh()
    }
    window.addEventListener("ls_contacted_changed", refresh)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener("ls_contacted_changed", refresh)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  // Build a Set of contacted lead IDs for fast lookup in render
  const contactedLeadIds = useMemo(() => {
    const set = new Set<string>()
    for (const rec of Object.values(contacted)) set.add(rec.leadId)
    return set
  }, [contacted])
  // Map of leadId -> realAudit (persisted to localStorage so audits survive reloads).
  // Lazy init reads storage on first client render, before the persist effect runs.
  const [auditCache, setAuditCache] = useState<Record<string, Lead["realAudit"]>>(() => loadAuditCache())
  const [auditingId, setAuditingId] = useState<string | null>(null)
  const [bulkAuditStatus, setBulkAuditStatus] = useState<{ done: number; total: number; wave: number } | null>(null)
  // Mirror of auditCache for the audit effect to read without re-subscribing.
  const auditCacheRef = useRef(auditCache)
  // Track which leads we've already kicked off a fetch for (avoids dep-loop)
  const auditFetchedRef = useRef<Set<string>>(new Set())
  // Debounce timer so rapid clicks don't spam the audit endpoint
  const auditDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const backgroundAuditRunRef = useRef(0)

  // Persist the audit cache whenever it changes, and keep the ref mirror in sync.
  useEffect(() => {
    auditCacheRef.current = auditCache
    saveAuditCache(auditCache as Record<string, NonNullable<Lead["realAudit"]>>)
  }, [auditCache])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("clearLeads") === "1") {
      backgroundAuditRunRef.current += 1
      removeAccountWorkspaceStorage(userId)
      localStorage.removeItem("ls_audit_cache_v1")
      setCustomLeadsMap({})
      setScannedCities([])
      setMapCenters({})
      setAuditCache({})
      auditCacheRef.current = {}
      auditFetchedRef.current.clear()
      setSelectedLead(null)
      setMultiSelected(new Set())
      setMultiSelectMode(false)
      setBulkAuditStatus(null)
      setShowOutreachDialog(false)
      setShowOnboarding(localStorage.getItem(accountKey(ONBOARDED_KEY, userId)) !== "true")

      void clearSavedScans().finally(() => {
        params.delete("clearLeads")
        const query = params.toString()
        window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
      })
      return
    }

    setCustomLeadsMap(loadCustomLeads(userId))
    setScannedCities(loadScannedCities(userId))
    setMapCenters(loadMapCenters(userId))
    setShowOnboarding(localStorage.getItem(accountKey(ONBOARDED_KEY, userId)) !== "true")

    loadSavedScans().then(scans => {
      if (!scans.length) return

      setCustomLeadsMap(prev => {
        const updated = { ...prev }
        for (const scan of scans) {
          updated[scan.city] = mergeLeads(updated[scan.city] ?? [], scan.leads)
        }
        saveCustomLeads(userId, updated)
        return updated
      })

      setScannedCities(prev => {
        const updated = Array.from(new Set([...prev, ...scans.map(scan => scan.city)]))
        saveScannedCities(userId, updated)
        return updated
      })

      setMapCenters(prev => {
        const updated = { ...prev }
        for (const scan of scans) {
          if (scan.map_center) updated[scan.city] = scan.map_center
        }
        saveMapCenters(userId, updated)
        return updated
      })
    })
  }, [userId])

  const refreshBillingStatus = useCallback(async () => {
    const res = await authedFetch("/api/billing/status")
    if (!res.ok) return
    setBillingStatus(await res.json())
  }, [])

  useEffect(() => {
    refreshBillingStatus()
  }, [refreshBillingStatus])

  // Auto-audit selected lead — debounced, deduped, only depends on lead.id
  useEffect(() => {
    if (!selectedLead?.website) return
    const id = selectedLead.id
    const url = selectedLead.website
    if (auditFetchedRef.current.has(id)) return
    // Already audited (incl. restored from a previous session) — no re-fetch.
    if (auditCacheRef.current[id]) return

    // Debounce so flipping between leads quickly cancels prior pending fetches
    if (auditDebounceRef.current) clearTimeout(auditDebounceRef.current)
    const ctrl = new AbortController()

    auditDebounceRef.current = setTimeout(() => {
      if (auditFetchedRef.current.has(id)) return
      auditFetchedRef.current.add(id)
      setAuditingId(id)

      authedFetch(`/api/audit?url=${encodeURIComponent(url)}`, { signal: ctrl.signal })
        .then(r => r.json())
        .then(data => {
          if (!data?.signals) return
          setAuditCache(prev => ({
            ...prev,
            [id]: {
              seo: data.seo,
              mobileFriendliness: data.mobileFriendliness,
              chatbotPresence: data.chatbotPresence,
              pageSpeed: data.pageSpeed,
              socialPresence: data.socialPresence,
              signals: data.signals,
              auditedAt: Date.now(),
            },
          }))
        })
        .catch(() => {
          // Allow a retry if the request was aborted (user re-selected this lead)
          if (ctrl.signal.aborted) auditFetchedRef.current.delete(id)
        })
        .finally(() => setAuditingId(prev => (prev === id ? null : prev)))
    }, 250)

    return () => {
      if (auditDebounceRef.current) clearTimeout(auditDebounceRef.current)
      ctrl.abort()
    }
  }, [selectedLead?.id, selectedLead?.website])

  // Look up the audit for the selected lead only — stable when other entries change
  const selectedRealAudit = selectedLead ? auditCache[selectedLead.id] : undefined

  // Merge real audit onto selected lead — only changes when selectedLead or its audit changes
  const enrichedSelected = useMemo<Lead | null>(() => {
    if (!selectedLead) return null
    return selectedRealAudit ? { ...selectedLead, realAudit: selectedRealAudit } : selectedLead
  }, [selectedLead, selectedRealAudit])

  const customLeads = useMemo(() => customLeadsMap[location] ?? [], [customLeadsMap, location])
  // Infer country for non-scanned leads from the city string ("Austin, TX" → US, etc.)
  const inferredCountry = useMemo(() => {
    const parts = location.split(",").map(p => p.trim())
    const last = parts[parts.length - 1]?.toUpperCase() ?? ""
    const US_STATES = new Set(["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"])
    if (US_STATES.has(last)) return "US"
    if (last === "UK") return "GB"
    if (last.length === 2) return last
    return "US"
  }, [location])
  const allCityLeads = useMemo(
    () => customLeads
      .filter(isLeadRelevantToCategory)
      .map(l => l.country ? l : { ...l, country: inferredCountry }),
    [customLeads, inferredCountry]
  )

  const baseFilteredLeads = useMemo(() => {
    if (industry === "All Industries") return allCityLeads
    return allCityLeads.filter(l => l.category === industry)
  }, [allCityLeads, industry])

  // Merge any cached real audits onto leads so list cards / map reflect real
  // scores once a lead has been audited (and keep them after deselect).
  const filteredLeads = useMemo(
    () => baseFilteredLeads.map(l => {
      const ra = auditCache[l.id]
      return ra ? { ...l, realAudit: ra } : l
    }),
    [baseFilteredLeads, auditCache],
  )

  const outreachQueue = useMemo(
    () => buildOutreachQueue(filteredLeads, contactedLeadIds),
    [filteredLeads, contactedLeadIds],
  )

  const queueStats = useMemo(() => {
    const ready = outreachQueue.filter(item => !contactedLeadIds.has(item.lead.id))
    return {
      readyCount: ready.length,
      realEmailCount: ready.filter(item => item.emailSource === "found").length,
      topScore: ready[0]?.score ?? 0,
    }
  }, [contactedLeadIds, outreachQueue])

  const stats = useMemo(() => {
    const totalRevenueLeak = filteredLeads.reduce((sum, l) => sum + calcRevenueLeak(l), 0)
    const noWebsite = filteredLeads.filter(l => l.status === "No Website").length
    const oldWebsite = filteredLeads.filter(l => l.status === "Old Website").length
    const needsChatbot = filteredLeads.filter(l => l.status === "Needs AI Chatbot").length
    const highValue = filteredLeads.filter(l => getHighValueLeadProfile(l).tier === "Hot").length
    const avgTargetScore = filteredLeads.length === 0 ? 0 : Math.round(
      filteredLeads.reduce((sum, l) => sum + getHighValueLeadProfile(l).score, 0) / filteredLeads.length
    )
    // Average only over leads that have a real audit — avoids reporting a score
    // for businesses we have not actually audited yet.
    const auditedLeads = filteredLeads.filter(l => l.realAudit)
    const avgScore = auditedLeads.length === 0 ? 0 : Math.round(
      auditedLeads.reduce((sum, l) => {
        const a = l.realAudit!
        return sum + (a.seo + a.mobileFriendliness + a.chatbotPresence + a.pageSpeed + a.socialPresence) / 5
      }, 0) / auditedLeads.length
    )
    return { totalRevenueLeak, noWebsite, oldWebsite, needsChatbot, highValue, avgTargetScore, avgScore, auditedCount: auditedLeads.length }
  }, [filteredLeads])

  const handleAddLead = useCallback((lead: Lead) => {
    setCustomLeadsMap(prev => {
      const updated = { ...prev, [location]: mergeLeads(prev[location] ?? [], [lead]) }
      saveCustomLeads(userId, updated)
      return updated
    })
  }, [location, userId])

  const auditLeadsInBackground = useCallback(async (leadsToAudit: Lead[], options: { force?: boolean } = {}) => {
    const runId = backgroundAuditRunRef.current + 1
    backgroundAuditRunRef.current = runId
    const force = options.force === true
    const targets = leadsToAudit
      .filter(lead => lead.website && (force || !auditCacheRef.current[lead.id]) && (force || !auditFetchedRef.current.has(lead.id)))

    if (!targets.length) return

    setBulkAuditStatus({ done: 0, total: targets.length, wave: 1 })
    let done = 0
    let wave = 0

    for (let waveStart = 0; waveStart < targets.length; waveStart += BACKGROUND_AUDIT_WAVE_SIZE) {
      if (backgroundAuditRunRef.current !== runId) return

      wave += 1
      const waveTargets = targets.slice(waveStart, waveStart + BACKGROUND_AUDIT_WAVE_SIZE)
      setBulkAuditStatus({ done, total: targets.length, wave })

      for (let i = 0; i < waveTargets.length; i += BACKGROUND_AUDIT_CONCURRENCY) {
        if (backgroundAuditRunRef.current !== runId) return

        const batch = waveTargets.slice(i, i + BACKGROUND_AUDIT_CONCURRENCY)
        await Promise.all(batch.map(async lead => {
          if (!lead.website) return
          auditFetchedRef.current.add(lead.id)
          try {
            const res = await authedFetch(`/api/audit?url=${encodeURIComponent(lead.website)}`)
            const data = await res.json().catch(() => null)
            if (!res.ok || !data?.signals) return
            const realAudit: NonNullable<Lead["realAudit"]> = {
              seo: data.seo,
              mobileFriendliness: data.mobileFriendliness,
              chatbotPresence: data.chatbotPresence,
              pageSpeed: data.pageSpeed,
              socialPresence: data.socialPresence,
              signals: data.signals,
              auditedAt: Date.now(),
            }
            setAuditCache(prev => ({ ...prev, [lead.id]: realAudit }))
            auditCacheRef.current = { ...auditCacheRef.current, [lead.id]: realAudit }
          } catch {
            auditFetchedRef.current.delete(lead.id)
          } finally {
            done += 1
            setBulkAuditStatus({ done, total: targets.length, wave })
          }
        }))
      }

      if (waveStart + BACKGROUND_AUDIT_WAVE_SIZE < targets.length) {
        await new Promise(resolve => setTimeout(resolve, BACKGROUND_AUDIT_WAVE_DELAY_MS))
      }
    }

    if (backgroundAuditRunRef.current === runId) {
      setTimeout(() => {
        if (backgroundAuditRunRef.current === runId) setBulkAuditStatus(null)
      }, 3000)
    }
  }, [])

  const handleFindLeads = useCallback((leads: Lead[], city: string, center?: { lat: number; lon: number }) => {
    if (!leads.length) return

    setCustomLeadsMap(prev => {
      const updated = { ...prev, [city]: mergeLeads(prev[city] ?? [], leads) }
      saveCustomLeads(userId, updated)
      return updated
    })

    // Register the scanned city so it appears in the selector
    setScannedCities(prev => {
      if (prev.includes(city)) return prev
      const updated = [...prev, city]
      saveScannedCities(userId, updated)
      return updated
    })

    // Save map center for this city
    if (center) {
      setMapCenters(prev => {
        const updated = { ...prev, [city]: center }
        saveMapCenters(userId, updated)
        return updated
      })
    }

    saveScan({
      city,
      industry: leads[0]?.category || industry,
      leads,
      center,
    })

    // Switch to the scanned city
    setLocation(city)
    setSelectedLead(null)
    void auditLeadsInBackground(leads)
    refreshBillingStatus()
  }, [auditLeadsInBackground, industry, refreshBillingStatus, userId])

  const openSavedScan = useCallback((scan: SavedScan) => {
    setCustomLeadsMap(prev => {
      const updated = { ...prev, [scan.city]: mergeLeads(prev[scan.city] ?? [], scan.leads) }
      saveCustomLeads(userId, updated)
      return updated
    })
    setScannedCities(prev => {
      const updated = prev.includes(scan.city) ? prev : [...prev, scan.city]
      saveScannedCities(userId, updated)
      return updated
    })
    if (scan.map_center) {
      setMapCenters(prev => {
        const updated = { ...prev, [scan.city]: scan.map_center! }
        saveMapCenters(userId, updated)
        return updated
      })
    }
    setLocation(scan.city)
    setIndustry(scan.industry)
    setSelectedLead(null)
  }, [userId])

  const handleExport = () => {
    const exportLeads = billingStatus.plan === "free" ? filteredLeads.slice(0, 10) : filteredLeads
    const headers = ["Name","Category","Rating","Reviews","Status","Phone","Website","Audited","SEO","Mobile","Chatbot","Page Speed","Social","Estimated Opportunity","Custom"]
    const rows = exportLeads.map(lead => {
      const a = lead.realAudit
      const cell = (v: number | undefined) => (a ? v ?? "" : "")
      return [
        lead.name, lead.category || "", lead.rating || "", lead.reviews || "",
        lead.status, lead.phone || "N/A", lead.website || "N/A",
        a ? "Yes" : "No",
        cell(a?.seo), cell(a?.mobileFriendliness),
        cell(a?.chatbotPresence), cell(a?.pageSpeed),
        cell(a?.socialPresence), calcRevenueLeak(lead),
        lead.isCustom ? "Yes" : "No",
      ]
    })
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `${location.split(",")[0]}-leads.csv`
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
    if (billingStatus.plan === "free" && filteredLeads.length > 10) {
      setBillingHeadline("Upgrade to export all leads")
      setShowBillingDialog(true)
    }
  }

  const handleExportQueue = () => {
    const uncontactedQueue = outreachQueue.filter(item => !contactedLeadIds.has(item.lead.id))
    const exportItems = billingStatus.plan === "free" ? uncontactedQueue.slice(0, 10) : uncontactedQueue
    if (!exportItems.length) return

    const csv = buildOutreachQueueCsv(exportItems)
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${location.split(",")[0]}-${industry === "All Industries" ? "campaign" : industry.toLowerCase().replace(/\s+/g, "-")}-queue.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    if (billingStatus.plan === "free" && uncontactedQueue.length > 10) {
      setBillingHeadline("Upgrade to export the full campaign queue")
      setShowBillingDialog(true)
    }
  }

  const handleFindEmails = () => {
    void auditLeadsInBackground(filteredLeads, { force: true })
  }

  const selectOutreachQueue = useCallback(() => {
    const ids = outreachQueue
      .filter(item => !contactedLeadIds.has(item.lead.id))
      .slice(0, 100)
      .map(item => item.lead.id)
    setMultiSelected(new Set(ids))
  }, [contactedLeadIds, outreachQueue])

  return (
    <div className="h-screen flex flex-col bg-[#080b10] text-white overflow-hidden">
      <TopNav
        industry={industry} location={location}
        onIndustryChange={setIndustry}
        onLocationChange={newCity => { setLocation(newCity); setSelectedLead(null) }}
        onExport={handleExport}
        extraCities={scannedCities}
        onFindLeads={() => setShowFindDialog(true)}
        onBilling={() => setShowBillingDialog(true)}
        onHistory={() => setShowHistoryDialog(true)}
        billingStatus={billingStatus}
      />

      {/* Stats Bar */}
      <div className="px-5 py-3 bg-[#0b0f16] border-b border-white/[0.07] flex items-center gap-3 overflow-x-auto shrink-0">
        <StatCard icon={<TrendingDown className="w-3.5 h-3.5 text-red-400" />} label="Pipeline Potential"
          value={`$${stats.totalRevenueLeak.toLocaleString()}`} sub="/mo" accent="red" />
        <div className="w-px h-8 bg-white/[0.08] shrink-0" />
        <StatCard icon={<Users className="w-3.5 h-3.5 text-cyan-400" />} label="Total Leads"
          value={filteredLeads.length.toString()} accent="neutral" />
        <StatCard icon={<Flame className="w-3.5 h-3.5 text-orange-400" />} label="Hot Targets"
          value={stats.highValue.toString()} accent="neutral" />
        <StatCard icon={<Target className="w-3.5 h-3.5 text-red-400/80" />} label="No Site Found"
          value={stats.noWebsite.toString()} accent="neutral" />
        <StatCard icon={<Target className="w-3.5 h-3.5 text-orange-400/80" />} label="Old Website"
          value={stats.oldWebsite.toString()} accent="neutral" />
        <StatCard icon={<Zap className="w-3.5 h-3.5 text-cyan-400/80" />} label="Need Chatbot"
          value={stats.needsChatbot.toString()} accent="neutral" />
        <div className="ml-auto flex items-center gap-2 px-3 py-2 rounded-md bg-white/[0.035] border border-white/[0.09] shrink-0">
          <div className={cn(
            "w-2 h-2 rounded-full",
            stats.avgTargetScore >= 72 ? "bg-orange-400"
            : stats.avgTargetScore >= 54 ? "bg-cyan-400"
            : "bg-red-400"
          )} />
          <div>
            <p className="text-[9px] text-white/30 uppercase tracking-wider font-mono">Target Score</p>
            <p className="text-sm font-black text-white font-mono">
              {stats.avgTargetScore}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col bg-[#080b10]">
          <div className="px-5 py-4 border-b border-white/[0.07] bg-[#0b0f16] shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-black text-white">Prospecting workspace</h1>
                  <span className="rounded-md border border-white/[0.09] bg-white/[0.035] px-2 py-0.5 text-xs font-mono text-white/55">
                    {filteredLeads.length} leads
                  </span>
                  {customLeads.length > 0 && (
                    <span className="rounded-md border border-violet-400/20 bg-violet-400/[0.08] px-2 py-0.5 text-[10px] font-bold text-violet-200">
                      {customLeads.length} added
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-white/42">
                  Pick a lead, review the website gaps, then generate outreach.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center rounded-md border border-white/[0.09] bg-white/[0.03] p-0.5">
                  <button
                    onClick={() => setViewMode("leads")}
                    className={cn(
                      "h-8 px-3 rounded-[5px] text-xs font-bold transition-colors flex items-center gap-1.5",
                      viewMode === "leads" ? "bg-white/[0.10] text-white" : "text-white/40 hover:text-white"
                    )}
                  >
                    <ListChecks className="w-3.5 h-3.5" />
                    Leads
                  </button>
                  <button
                    onClick={() => setViewMode("map")}
                    className={cn(
                      "h-8 px-3 rounded-[5px] text-xs font-bold transition-colors flex items-center gap-1.5",
                      viewMode === "map" ? "bg-white/[0.10] text-white" : "text-white/40 hover:text-white"
                    )}
                  >
                    <MapIcon className="w-3.5 h-3.5" />
                    Map
                  </button>
                </div>

                {!multiSelectMode ? (
                  <>
                    <Button
                      onClick={handleExportQueue}
                      disabled={queueStats.readyCount === 0}
                      variant="ghost"
                      className="h-9 px-3 rounded-md border border-emerald-400/18 bg-emerald-400/[0.055] text-emerald-200 hover:bg-emerald-400/[0.09] hover:text-emerald-100 text-xs font-bold gap-1.5 disabled:opacity-35"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export Queue
                    </Button>
                    <Button
                      onClick={() => { setMultiSelectMode(true); setSelectedLead(null); setViewMode("leads") }}
                      variant="ghost"
                      className="h-9 px-3 rounded-md border border-white/[0.09] bg-white/[0.035] text-white/62 hover:bg-white/[0.06] hover:text-white text-xs font-bold gap-1.5"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Outreach
                    </Button>
                    <Button
                      onClick={() => setShowAddDialog(true)}
                      variant="ghost"
                      className="h-9 w-9 p-0 rounded-md border border-white/[0.09] bg-white/[0.035] text-white/45 hover:bg-white/[0.06] hover:text-white"
                      title="Add lead manually"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={selectOutreachQueue}
                      variant="ghost"
                      className="h-9 px-3 rounded-md border border-orange-400/20 bg-orange-400/[0.08] text-orange-300 hover:bg-orange-400/12 text-xs font-bold"
                    >
                      Select queue
                    </Button>
                    <Button
                      onClick={() => setShowOutreachDialog(true)}
                      disabled={multiSelected.size === 0}
                      className="h-9 px-3 rounded-md bg-cyan-400 text-slate-950 hover:bg-cyan-300 text-xs font-black disabled:opacity-35"
                    >
                      Compose ({multiSelected.size})
                    </Button>
                    <Button
                      onClick={() => { setMultiSelectMode(false); setMultiSelected(new Set()) }}
                      variant="ghost"
                      className="h-9 px-3 rounded-md border border-white/[0.09] bg-white/[0.035] text-white/55 hover:bg-white/[0.06] hover:text-white text-xs font-bold"
                    >
                      <X className="w-3.5 h-3.5 mr-1.5" />
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 px-5 py-3 border-b border-white/[0.06] bg-[#090d13] shrink-0">
            {[
              ["1", "Choose market", `${location.split(",")[0]} / ${industry === "All Industries" ? "all industries" : industry}`],
              ["2", "Find leads", `${filteredLeads.length} businesses found`],
              ["3", "Review gaps", selectedLead ? selectedLead.name : "Choose a lead"],
              ["4", "Send outreach", multiSelectMode ? `${multiSelected.size} selected` : "Use Outreach"],
            ].map(([step, title, body]) => (
              <div key={step} className="rounded-md border border-white/[0.08] bg-white/[0.025] px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-cyan-400/[0.12] text-[10px] font-black text-cyan-200">
                    {step}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/45">{title}</span>
                </div>
                <p className="mt-1 truncate text-xs text-white/62">{body}</p>
              </div>
            ))}
          </div>

          {filteredLeads.length > 0 && (
            <div className="px-5 py-3 border-b border-white/[0.06] bg-emerald-400/[0.035] shrink-0">
              <div className="flex flex-col gap-2 rounded-md border border-emerald-400/14 bg-[#07110f]/70 px-3 py-2.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black text-white">Campaign queue</span>
                    <span className="rounded bg-emerald-400/[0.12] px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">
                      {queueStats.readyCount} ready
                    </span>
                    <span className="rounded bg-white/[0.055] px-1.5 py-0.5 text-[10px] font-mono text-white/45">
                      {queueStats.realEmailCount} real emails
                    </span>
                    <span className="rounded bg-white/[0.055] px-1.5 py-0.5 text-[10px] font-mono text-white/45">
                      top score {queueStats.topScore}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-white/38">
                    Sorted by high-value fit, found email, no instant response path, site quality, and whether you already contacted them.
                    {bulkAuditStatus && (
                      <span className="ml-1 text-cyan-300">
                        Background audits wave {bulkAuditStatus.wave}: {bulkAuditStatus.done}/{bulkAuditStatus.total}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    onClick={handleFindEmails}
                    disabled={!!bulkAuditStatus || filteredLeads.every(lead => !lead.website)}
                    variant="ghost"
                    className="h-8 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 text-xs font-black text-cyan-100 hover:bg-cyan-300/[0.12] disabled:opacity-35"
                  >
                    <Mail className="mr-1.5 h-3.5 w-3.5" />
                    Find Emails
                  </Button>
                  <Button
                    onClick={handleExportQueue}
                    disabled={queueStats.readyCount === 0}
                    className="h-8 rounded-md bg-emerald-300 px-3 text-xs font-black text-slate-950 hover:bg-emerald-200 disabled:opacity-35"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-hidden">
            {filteredLeads.length === 0 ? (
              <div className="h-full flex items-center justify-center px-6">
                <div className="max-w-xl text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.10] text-cyan-300">
                    <Radar className="w-5 h-5" />
                  </div>
                  <h2 className="mt-5 text-2xl font-black text-white">Run your first scan</h2>
                  <p className="mt-3 text-sm leading-6 text-white/52">
                    Pick a city and industry to find businesses in that market. Your results will appear here after the scan finishes.
                  </p>
                  <div className="mt-6 grid gap-2 text-left sm:grid-cols-3">
                    {[
                      ["1", "Choose market", "City and niche"],
                      ["2", "Find leads", "Public business data"],
                      ["3", "Review gaps", "Audit and outreach"],
                    ].map(([step, title, body]) => (
                      <div key={step} className="rounded-lg border border-white/[0.09] bg-white/[0.03] p-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-400/[0.12] text-xs font-black text-cyan-200">
                          {step}
                        </span>
                        <p className="mt-3 text-sm font-bold text-white">{title}</p>
                        <p className="mt-1 text-xs text-white/42">{body}</p>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={() => setShowFindDialog(true)}
                    className="mt-7 h-11 rounded-md bg-cyan-400 px-5 text-slate-950 hover:bg-cyan-300 font-black"
                  >
                    <Radar className="w-4 h-4 mr-2" />
                    Find leads
                  </Button>
                </div>
              </div>
            ) : viewMode === "leads" ? (
              <LeadList
                leads={filteredLeads}
                selectedLead={selectedLead}
                onSelectLead={setSelectedLead}
                multiSelectMode={multiSelectMode}
                multiSelected={multiSelected}
                onToggleMultiSelect={(id) => {
                  setMultiSelected(prev => {
                    const next = new Set(prev)
                    if (next.has(id)) next.delete(id)
                    else next.add(id)
                    return next
                  })
                }}
                onSelectAll={(ids) => setMultiSelected(new Set(ids))}
                contactedLeadIds={contactedLeadIds}
              />
            ) : (
              <MapView
                leads={filteredLeads}
                selectedLead={selectedLead}
                onSelectLead={setSelectedLead}
                currentCity={location}
                mapCenter={mapCenters[location]}
              />
            )}
          </div>
        </div>

        <div className="hidden lg:block w-[430px] border-l border-white/[0.08] bg-[#060912] shrink-0">
          {enrichedSelected ? (
            <AuditPanel
              lead={enrichedSelected}
              onClose={() => setSelectedLead(null)}
              isAuditing={auditingId === enrichedSelected.id}
            />
          ) : (
            <div className="h-full flex flex-col justify-center px-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-400/[0.10] text-cyan-300 border border-cyan-400/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="mt-5 text-lg font-black text-white">Select a lead to start</h2>
              <p className="mt-2 text-sm leading-6 text-white/48">
                The audit and outreach tools appear here after you choose a business from the list.
              </p>
              <Button
                onClick={() => setShowFindDialog(true)}
                className="mt-6 h-10 rounded-md bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-black"
              >
                <Radar className="w-4 h-4 mr-2" />
                Find leads
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: audit panel as a full-screen overlay when a lead is selected */}
      {enrichedSelected && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-[#060912]">
          <AuditPanel
            lead={enrichedSelected}
            onClose={() => setSelectedLead(null)}
            isAuditing={auditingId === enrichedSelected.id}
          />
        </div>
      )}

      <AddLeadDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={handleAddLead}
      />

      <FindLeadsDialog
        open={showFindDialog}
        onClose={() => setShowFindDialog(false)}
        onAdd={handleFindLeads}
        currentCity={location}
        onBillingUpdate={setBillingStatus}
        onLimitReached={(status) => {
          setBillingStatus(status)
          setBillingHeadline("Monthly lead credit limit reached")
          setShowFindDialog(false)
          setShowBillingDialog(true)
        }}
      />

      <BatchOutreachDialog
        open={showOutreachDialog}
        onClose={() => setShowOutreachDialog(false)}
        leads={filteredLeads.filter(l => multiSelected.has(l.id))}
      />

      <BillingDialog
        open={showBillingDialog}
        onClose={() => {
          setShowBillingDialog(false)
          setBillingHeadline("Billing")
        }}
        status={billingStatus}
        onStatusChange={setBillingStatus}
        headline={billingHeadline}
      />

      <SavedScansDialog
        open={showHistoryDialog}
        onClose={() => setShowHistoryDialog(false)}
        onOpenScan={openSavedScan}
      />

      <OnboardingDialog
        open={showOnboarding}
        onClose={() => {
          localStorage.setItem(accountKey(ONBOARDED_KEY, userId), "true")
          setShowOnboarding(false)
        }}
        onStartScan={() => setShowFindDialog(true)}
      />
    </div>
  )
}

function StatCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent: "red" | "neutral"
}) {
  return (
    <div className={cn(
      "flex items-center gap-2.5 px-3 py-2 rounded-md border shrink-0 transition-colors",
      accent === "red"
        ? "bg-red-500/[0.055] border-red-500/18"
        : "bg-white/[0.028] border-white/[0.08]"
    )}>
      {icon}
      <div>
        <p className="text-[9px] text-white/28 uppercase tracking-wider font-mono">{label}</p>
        <p className="text-sm font-black text-white leading-tight font-mono">
          {value}
          {sub && <span className="text-[10px] text-white/28 font-normal ml-0.5">{sub}</span>}
        </p>
      </div>
    </div>
  )
}
