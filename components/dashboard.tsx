"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { type Lead } from "@/lib/types"
import { getLeadsByCity } from "@/lib/mock-data"
import { calcRevenueLeak } from "@/lib/utils"
import { TopNav } from "./top-nav"
import { MapView } from "./map-view"
import { LeadList } from "./lead-list"
import { AuditPanel } from "./audit-panel"
import { AddLeadDialog } from "./add-lead-dialog"
import { FindLeadsDialog } from "./find-leads-dialog"
import { TrendingDown, Target, Zap, Users, Activity, Plus, Radar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "ls_custom_leads_v2"
const SCANNED_CITIES_KEY = "ls_scanned_cities_v1"
const MAP_CENTERS_KEY = "ls_map_centers_v1"

function loadCustomLeads(): Record<string, Lead[]> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") } catch { return {} }
}
function saveCustomLeads(data: Record<string, Lead[]>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
}
function loadScannedCities(): string[] {
  try { return JSON.parse(localStorage.getItem(SCANNED_CITIES_KEY) || "[]") } catch { return [] }
}
function saveScannedCities(cities: string[]) {
  try { localStorage.setItem(SCANNED_CITIES_KEY, JSON.stringify(cities)) } catch {}
}
function loadMapCenters(): Record<string, { lat: number; lon: number }> {
  try { return JSON.parse(localStorage.getItem(MAP_CENTERS_KEY) || "{}") } catch { return {} }
}
function saveMapCenters(data: Record<string, { lat: number; lon: number }>) {
  try { localStorage.setItem(MAP_CENTERS_KEY, JSON.stringify(data)) } catch {}
}

export function Dashboard() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [industry, setIndustry] = useState("All Industries")
  const [location, setLocation] = useState("Austin, TX")
  const [customLeadsMap, setCustomLeadsMap] = useState<Record<string, Lead[]>>({})
  const [scannedCities, setScannedCities] = useState<string[]>([])
  const [mapCenters, setMapCenters] = useState<Record<string, { lat: number; lon: number }>>({})
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showFindDialog, setShowFindDialog] = useState(false)
  // Map of leadId -> realAudit (cached in-memory for the session)
  const [auditCache, setAuditCache] = useState<Record<string, Lead["realAudit"]>>({})
  const [auditingId, setAuditingId] = useState<string | null>(null)

  useEffect(() => {
    setCustomLeadsMap(loadCustomLeads())
    setScannedCities(loadScannedCities())
    setMapCenters(loadMapCenters())
  }, [])

  // Auto-run real audit when a lead with a website is selected (once per lead)
  useEffect(() => {
    if (!selectedLead?.website) return
    if (auditCache[selectedLead.id]) return
    if (auditingId === selectedLead.id) return

    const ctrl = new AbortController()
    setAuditingId(selectedLead.id)

    fetch(`/api/audit?url=${encodeURIComponent(selectedLead.website)}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(data => {
        if (data?.signals) {
          setAuditCache(prev => ({
            ...prev,
            [selectedLead.id]: {
              seo: data.seo,
              mobileFriendliness: data.mobileFriendliness,
              chatbotPresence: data.chatbotPresence,
              pageSpeed: data.pageSpeed,
              socialPresence: data.socialPresence,
              signals: data.signals,
              auditedAt: Date.now(),
            },
          }))
        }
      })
      .catch(() => {})
      .finally(() => setAuditingId(prev => (prev === selectedLead.id ? null : prev)))

    return () => ctrl.abort()
  }, [selectedLead, auditCache, auditingId])

  // Merge cached realAudit onto the selected lead before passing it down
  const enrichedSelected = useMemo(() => {
    if (!selectedLead) return null
    const real = auditCache[selectedLead.id]
    return real ? { ...selectedLead, realAudit: real } : selectedLead
  }, [selectedLead, auditCache])

  const cityLeads = useMemo(() => getLeadsByCity(location), [location])
  const customLeads = customLeadsMap[location] ?? []
  const allCityLeads = useMemo(() => [...cityLeads, ...customLeads], [cityLeads, customLeads])

  const filteredLeads = useMemo(() => {
    if (industry === "All Industries") return allCityLeads
    return allCityLeads.filter(l => l.category === industry)
  }, [allCityLeads, industry])

  const stats = useMemo(() => {
    const totalRevenueLeak = filteredLeads.reduce((sum, l) => sum + calcRevenueLeak(l), 0)
    const noWebsite = filteredLeads.filter(l => l.status === "No Website").length
    const oldWebsite = filteredLeads.filter(l => l.status === "Old Website").length
    const needsChatbot = filteredLeads.filter(l => l.status === "Needs AI Chatbot").length
    const scoredLeads = filteredLeads.filter(l => l.status !== "No Website")
    const avgScore = scoredLeads.length === 0 ? 0 : Math.round(
      scoredLeads.reduce((sum, l) => {
        const a = l.audit
        return sum + (a.seo + a.mobileFriendliness + a.chatbotPresence + a.pageSpeed + a.socialPresence) / 5
      }, 0) / scoredLeads.length
    )
    return { totalRevenueLeak, noWebsite, oldWebsite, needsChatbot, avgScore }
  }, [filteredLeads])

  const handleAddLead = useCallback((lead: Lead) => {
    setCustomLeadsMap(prev => {
      const updated = { ...prev, [location]: [...(prev[location] ?? []), lead] }
      saveCustomLeads(updated)
      return updated
    })
  }, [location])

  const handleFindLeads = useCallback((leads: Lead[], city: string, center?: { lat: number; lon: number }) => {
    if (!leads.length) return

    setCustomLeadsMap(prev => {
      const updated = { ...prev, [city]: [...(prev[city] ?? []), ...leads] }
      saveCustomLeads(updated)
      return updated
    })

    // Register the scanned city so it appears in the selector
    setScannedCities(prev => {
      if (prev.includes(city)) return prev
      const updated = [...prev, city]
      saveScannedCities(updated)
      return updated
    })

    // Save map center for this city
    if (center) {
      setMapCenters(prev => {
        const updated = { ...prev, [city]: center }
        saveMapCenters(updated)
        return updated
      })
    }

    // Switch to the scanned city
    setLocation(city)
    setSelectedLead(null)
  }, [])

  const handleExport = () => {
    const headers = ["Name","Category","Rating","Reviews","Status","Phone","Website","SEO","Mobile","Chatbot","Page Speed","Social","Revenue Leak","Custom"]
    const rows = filteredLeads.map(lead => [
      lead.name, lead.category || "", lead.rating, lead.reviews || 0,
      lead.status, lead.phone || "N/A", lead.website || "N/A",
      lead.audit?.seo || 0, lead.audit?.mobileFriendliness || 0,
      lead.audit?.chatbotPresence || 0, lead.audit?.pageSpeed || 0,
      lead.audit?.socialPresence || 0, calcRevenueLeak(lead),
      lead.isCustom ? "Yes" : "No",
    ])
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `${location.split(",")[0]}-leads.csv`
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white overflow-hidden">
      <TopNav
        industry={industry} location={location}
        onIndustryChange={setIndustry}
        onLocationChange={newCity => { setLocation(newCity); setSelectedLead(null) }}
        onExport={handleExport}
        extraCities={scannedCities}
        onFindLeads={() => setShowFindDialog(true)}
      />

      {/* Stats Bar */}
      <div className="px-4 py-2.5 bg-[#05070f]/80 border-b border-white/[0.05] flex items-center gap-2.5 overflow-x-auto shrink-0 backdrop-blur-sm">
        <StatCard icon={<TrendingDown className="w-3.5 h-3.5 text-red-400" />} label="Revenue Leak"
          value={`$${stats.totalRevenueLeak.toLocaleString()}`} sub="/mo" accent="red" />
        <div className="w-px h-7 bg-white/[0.06] shrink-0" />
        <StatCard icon={<Users className="w-3.5 h-3.5 text-cyan-400" />} label="Total Targets"
          value={filteredLeads.length.toString()} accent="neutral" />
        <StatCard icon={<Target className="w-3.5 h-3.5 text-red-400/80" />} label="No Website"
          value={stats.noWebsite.toString()} accent="neutral" />
        <StatCard icon={<Target className="w-3.5 h-3.5 text-orange-400/80" />} label="Old Website"
          value={stats.oldWebsite.toString()} accent="neutral" />
        <StatCard icon={<Zap className="w-3.5 h-3.5 text-cyan-400/80" />} label="Need Chatbot"
          value={stats.needsChatbot.toString()} accent="neutral" />
        <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] shrink-0">
          <div className={cn(
            "w-2 h-2 rounded-full shadow-[0_0_6px_currentColor]",
            stats.avgScore >= 60 ? "bg-emerald-400 text-emerald-400"
            : stats.avgScore >= 40 ? "bg-orange-400 text-orange-400"
            : "bg-red-400 text-red-400"
          )} />
          <div>
            <p className="text-[9px] text-white/30 uppercase tracking-wider font-mono">Avg Health</p>
            <p className="text-sm font-black text-white font-mono">{stats.avgScore}%</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Sector HUD */}
        <div className="absolute top-4 left-4 z-40 pointer-events-none">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-cyan-500/20 shadow-lg shadow-cyan-500/5">
            <Activity className="w-3 h-3 text-cyan-400 animate-pulse" />
            <p className="text-[10px] font-black tracking-[0.12em] text-cyan-400 uppercase">
              {location.split(",")[0]}
            </p>
            {customLeads.length > 0 && (
              <span className="ml-1 text-[9px] text-white/40">+{customLeads.length} custom</span>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <MapView
            leads={filteredLeads}
            selectedLead={selectedLead}
            onSelectLead={setSelectedLead}
            currentCity={location}
            mapCenter={mapCenters[location]}
          />
        </div>

        {/* Lead List Sidebar */}
        <div className="w-[390px] border-l border-white/5 bg-slate-950/90 backdrop-blur-xl z-30 flex flex-col">
          <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-white/50">Detected Targets</h2>
              <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md">
                {filteredLeads.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                onClick={() => setShowFindDialog(true)}
                size="sm"
                className="h-7 px-2.5 bg-gradient-to-r from-cyan-500/20 to-teal-500/10 border border-cyan-500/30 text-cyan-400 hover:from-cyan-500/30 hover:to-teal-500/20 font-bold text-xs gap-1.5"
                variant="ghost"
              >
                <Radar className="w-3 h-3" />
                Find Leads
              </Button>
              <Button
                onClick={() => setShowAddDialog(true)}
                size="sm"
                className="h-7 px-2.5 bg-white/5 border border-white/10 text-white/60 hover:bg-white/8 hover:text-white font-bold text-xs gap-1"
                variant="ghost"
              >
                <Plus className="w-3 h-3" />
                Add
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <LeadList leads={filteredLeads} selectedLead={selectedLead} onSelectLead={setSelectedLead} />
          </div>
        </div>

        {/* Audit Panel */}
        {enrichedSelected && (
          <div className="absolute inset-y-0 right-0 w-[430px] z-50 animate-in slide-in-from-right duration-200">
            <AuditPanel
              lead={enrichedSelected}
              onClose={() => setSelectedLead(null)}
              isAuditing={auditingId === enrichedSelected.id}
            />
          </div>
        )}
      </div>

      <AddLeadDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={handleAddLead}
        currentCity={location}
      />

      <FindLeadsDialog
        open={showFindDialog}
        onClose={() => setShowFindDialog(false)}
        onAdd={handleFindLeads}
        currentCity={location}
      />
    </div>
  )
}

function StatCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent: "red" | "neutral"
}) {
  return (
    <div className={cn(
      "flex items-center gap-2.5 px-3 py-1.5 rounded-lg border shrink-0 transition-colors",
      accent === "red"
        ? "bg-red-500/[0.07] border-red-500/20 shadow-[0_0_16px_rgba(239,68,68,0.05)]"
        : "bg-white/[0.03] border-white/[0.07]"
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
