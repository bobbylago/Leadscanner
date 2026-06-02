"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { CityPicker } from "@/components/city-picker"
import { type Lead, INDUSTRIES } from "@/lib/types"
import { cn } from "@/lib/utils"
import { getHighValueLeadProfile } from "@/lib/lead-scoring"
import { authedFetch } from "@/lib/api-client"
import type { BillingStatus } from "@/lib/billing-types"
import { Radar, MapPin, Loader2, CheckCircle2, AlertCircle, Plus, Globe, Phone, Check, Flame } from "lucide-react"

type Phase = "idle" | "scanning" | "done" | "error"

interface ScanStats {
  rawElements: number
  afterDedup: number
  afterChainFilter: number
  afterWebsiteFilter: number
  finalCount: number
  websitesVerified: number
  websitesDead: number
  dataSource?: string
  googleQueries?: number
  googleRawPlaces?: number
  googleUniquePlaces?: number
  fallbackUsed?: boolean
  warning?: string
}

const SCAN_MESSAGES = [
  "Querying Google Places and public maps...",
  "Discovering businesses in this market...",
  "Checking website statuses...",
  "Ranking high-value targets...",
  "Building lead profiles...",
  "Analyzing digital presence...",
  "Finalizing results...",
]

interface FindLeadsDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (leads: Lead[], city: string, center?: { lat: number; lon: number }) => void
  currentCity: string
  onLimitReached?: (status: BillingStatus) => void
  onBillingUpdate?: (status: BillingStatus) => void
}

export function FindLeadsDialog({ open, onClose, onAdd, currentCity, onLimitReached, onBillingUpdate }: FindLeadsDialogProps) {
  const [city, setCity] = useState(currentCity)
  const [industry, setIndustry] = useState("Plumbing")
  const [deepScan, setDeepScan] = useState(true)
  const [phase, setPhase] = useState<Phase>("idle")
  const [leads, setLeads] = useState<Lead[]>([])
  const [visible, setVisible] = useState<Lead[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState("")
  const [progress, setProgress] = useState(0)
  const [msgIdx, setMsgIdx] = useState(0)
  const [center, setCenter] = useState<{ lat: number; lon: number } | undefined>()
  const [stats, setStats] = useState<ScanStats | null>(null)
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const msgTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (phase === "idle") setCity(currentCity)
  }, [currentCity, phase])

  useEffect(() => {
    if (!open) {
      clearInterval(progressTimer.current!)
      clearInterval(msgTimer.current!)
      setPhase("idle")
      setLeads([])
      setVisible([])
      setSelected(new Set())
      setProgress(0)
      setMsgIdx(0)
      setError("")
      setCenter(undefined)
      setStats(null)
    }
  }, [open])

  const handleScan = async () => {
    setPhase("scanning")
    setLeads([])
    setVisible([])
    setProgress(0)
    setMsgIdx(0)
    setError("")

    progressTimer.current = setInterval(() => setProgress(p => Math.min(p + 1.2, 88)), 100)
    msgTimer.current = setInterval(() => setMsgIdx(i => (i + 1) % SCAN_MESSAGES.length), 1400)

    try {
      const params = new URLSearchParams({
        city: city.trim(),
        industry,
        deep: String(deepScan),
        limit: deepScan ? "150" : "50",
      })
      const res = await authedFetch(`/api/scan-leads?${params.toString()}`)
      clearInterval(progressTimer.current!)
      clearInterval(msgTimer.current!)

      const data = await res.json()
      if (res.status === 402 && data.billing) {
        onLimitReached?.(data.billing)
        return
      }
      if (!res.ok) throw new Error(data.error || 'Scan failed')
      if (data.billing) onBillingUpdate?.(data.billing)

      setProgress(100)
      setCenter(data.center)
      setStats(data.stats ?? null)
      setLeads(data.leads)
      // Auto-select the highest-value targets by default.
      const hotLeads = data.leads.filter((l: Lead) => getHighValueLeadProfile(l).score >= 54)
      const toSelect = hotLeads.length > 0 ? hotLeads : data.leads
      setSelected(new Set(toSelect.map((l: Lead) => l.id)))
      setPhase("done")

      // Reveal leads with staggered animation
      data.leads.forEach((lead: Lead, i: number) => {
        setTimeout(() => setVisible(prev => [...prev, lead]), i * 60)
      })
    } catch (e: unknown) {
      clearInterval(progressTimer.current!)
      clearInterval(msgTimer.current!)
      setError(e instanceof Error ? e.message : "Scan failed. Try a different city name.")
      setPhase("error")
    }
  }

  const toggleLead = (id: string) =>
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const toggleAll = () =>
    setSelected(selected.size === leads.length ? new Set() : new Set(leads.map(l => l.id)))

  const handleAdd = () => {
    onAdd(leads.filter(l => selected.has(l.id)), city.trim(), center)
    onClose()
  }

  const statusPill = (status: string) => {
    if (status === "No Website") return "bg-red-500/10 text-red-400 border-red-500/20"
    if (status === "Old Website") return "bg-orange-500/10 text-orange-400 border-orange-500/20"
    return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
  }

  const statusLabel = (status: string) =>
    status === "Needs AI Chatbot" ? "No Chatbot" : status

  const hotLeadCount = leads.filter(lead => getHighValueLeadProfile(lead).tier === "Hot").length

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="bg-slate-900 border-white/10 text-white max-w-lg flex flex-col p-0 overflow-hidden"
        style={{ maxHeight: "88vh" }}>
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-white/8 shrink-0">
          <DialogTitle className="flex items-center gap-2.5 text-white text-sm">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center shrink-0">
              <Radar className="w-4 h-4 text-cyan-400" />
            </div>
            Find leads
            <span className="ml-auto text-[9px] font-normal text-white/30 bg-white/5 px-2 py-0.5 rounded-md border border-white/8">
              Live scan
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* ── IDLE ── */}
          {phase === "idle" && (
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-white/55 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> City or Location
                </Label>
                <CityPicker
                  value={city}
                  onChange={setCity}
                  className="w-full"
                  triggerClassName="w-full h-10 rounded-lg bg-white/5 border-white/10 text-white/80"
                />
                <p className="text-[10px] text-white/30">Any city worldwide. Results are based on available public business data.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/55">Industry</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white focus:ring-0 focus:border-cyan-500/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10">
                    {INDUSTRIES.map(i => (
                      <SelectItem key={i} value={i} className="text-white focus:bg-cyan-500/15">{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-xl bg-white/3 border border-white/6 px-3.5 py-3 text-[10px] text-white/40 space-y-1">
                <p className="font-semibold text-white/50">What you get</p>
                <p>- Google Places results when configured, with public-data fallback</p>
                <p>- Website, phone, and public profile data when available</p>
                <p>- A high-value target score and outreach angle for each lead</p>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-cyan-500/[0.055] border border-cyan-500/15 px-3.5 py-3">
                <div>
                  <Label className="text-xs text-white/75">Deep Scan</Label>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-white/38">
                    Wider area and keyword fallback. Lead-credit and plan caps apply.
                  </p>
                </div>
                <Switch checked={deepScan} onCheckedChange={setDeepScan} />
              </div>
            </div>
          )}

          {/* ── SCANNING ── */}
          {phase === "scanning" && (
            <div className="px-6 py-10 flex flex-col items-center gap-7">
              <div className="relative w-36 h-36">
                {/* Rings */}
                {[0, 0.15, 0.30, 0.45].map((inset, i) => (
                  <div key={i} className="absolute rounded-full border border-cyan-500/20"
                    style={{ inset: `${inset * 100}%` }} />
                ))}
                {/* Rotating sweep */}
                <div className="absolute inset-0 rounded-full overflow-hidden"
                  style={{ animation: "spin 2.4s linear infinite" }}>
                  <div className="absolute inset-0 rounded-full" style={{
                    background: "conic-gradient(from 0deg, transparent 0deg, rgba(6,182,212,0.4) 55deg, transparent 80deg)",
                  }} />
                </div>
                {/* Blips */}
                {[
                  { top: "22%", left: "68%", delay: "0s" },
                  { top: "62%", left: "28%", delay: "0.5s" },
                  { top: "38%", left: "52%", delay: "1s" },
                  { top: "74%", left: "60%", delay: "0.2s" },
                  { top: "30%", left: "38%", delay: "0.8s" },
                ].map((b, i) => (
                  <div key={i} className="absolute w-1.5 h-1.5 rounded-full bg-cyan-400/90"
                    style={{ top: b.top, left: b.left, animation: `ping 1.8s ease-in-out infinite`, animationDelay: b.delay }} />
                ))}
                {/* Center */}
                <div className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)]" />
              </div>

              <div className="text-center space-y-2">
                <p className="text-sm font-bold text-white">Scanning {city.split(",")[0]}…</p>
                <p className="text-[11px] text-cyan-400/70 font-mono h-4">{SCAN_MESSAGES[msgIdx]}</p>
                {deepScan && (
                  <p className="text-[10px] text-white/30">Deep Scan is checking a wider market and keyword fallbacks.</p>
                )}
              </div>

              <div className="w-full space-y-1.5">
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full transition-all duration-200"
                    style={{ width: `${progress}%` }} />
                </div>
                <p className="text-[9px] text-white/25 text-right font-mono">{Math.round(progress)}%</p>
              </div>
            </div>
          )}

          {/* ── ERROR ── */}
          {phase === "error" && (
            <div className="px-6 py-10 flex flex-col items-center gap-4 text-center">
              <AlertCircle className="w-12 h-12 text-red-400/60" />
              <div>
                <p className="text-sm font-semibold text-red-400">Scan Failed</p>
                <p className="text-xs text-white/40 mt-1.5 max-w-xs">{error}</p>
              </div>
            </div>
          )}

          {/* ── DONE ── */}
          {phase === "done" && (
            <div className="px-6 py-4 space-y-3">
              <div className="flex items-center gap-2.5 py-2.5 px-3.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs text-white/70 flex-1">
                  <span className="font-bold text-white">{hotLeadCount}</span> hot /{" "}
                  <span className="font-bold text-white">{leads.length}</span> ranked{" "}
                  <span className="text-cyan-400 font-semibold">{industry}</span> leads in{" "}
                  <span className="font-bold text-white">{city.split(",")[0]}</span>
                </span>
                <button onClick={toggleAll}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 shrink-0 transition-colors cursor-pointer">
                  {selected.size === leads.length ? "Deselect all" : "Select all"}
                </button>
              </div>

              {/* Scan stats — show pipeline */}
              {stats && (
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3.5 py-2.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="text-[9px] text-white/30 uppercase tracking-wider font-mono">Scan Pipeline</div>
                    <span className="ml-auto text-[9px] text-cyan-400/80 font-mono">
                      {stats.dataSource ?? "Public data"}
                      {stats.googleQueries ? ` · ${stats.googleQueries} Google queries` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-white/55 flex-wrap">
                    <span>{stats.rawElements} found</span>
                    <span className="text-white/15">→</span>
                    <span>{stats.afterDedup} unique</span>
                    <span className="text-white/15">→</span>
                    <span>{stats.afterChainFilter} non-chain</span>
                    <span className="text-white/15">→</span>
                    <span className="text-cyan-400">{stats.finalCount} ranked</span>
                    {stats.websitesDead > 0 && (
                      <>
                        <span className="text-white/15">·</span>
                        <span className="text-red-400/80">{stats.websitesDead} dead sites</span>
                      </>
                    )}
                  </div>
                  {stats.warning && (
                    <div className="mt-1.5 text-[10px] leading-relaxed text-orange-300/75">
                      {stats.warning}
                    </div>
                  )}
                </div>
              )}

              {leads.length === 0 && (
                <div className="text-center py-6 text-white/40 text-sm">
                  No results. Try a different city or industry.
                </div>
              )}

              <div className="space-y-1.5 pb-1">
                {visible.map(lead => {
                  const valueProfile = getHighValueLeadProfile(lead)
                  return (
                  <button
                    key={lead.id}
                    onClick={() => toggleLead(lead.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-150 text-left",
                      "animate-in fade-in slide-in-from-bottom-2 duration-300",
                      selected.has(lead.id)
                        ? "bg-cyan-500/8 border-cyan-500/20"
                        : "bg-white/2 border-white/6 opacity-45 hover:opacity-70"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-[4px] border-2 flex items-center justify-center shrink-0 transition-all",
                      selected.has(lead.id)
                        ? "bg-cyan-500 border-cyan-500"
                        : "border-white/20"
                    )}>
                      {selected.has(lead.id) && <Check className="w-2.5 h-2.5 text-slate-950" strokeWidth={3} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-white truncate">{lead.name}</p>
                        {valueProfile.tier === "Hot" && (
                          <Flame className="w-3 h-3 text-orange-400 shrink-0" strokeWidth={2.5} />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {lead.website
                          ? <><Globe className="w-2.5 h-2.5 text-white/25 shrink-0" />
                            <span className="text-[9px] text-white/30 truncate font-mono">
                              {lead.website.replace(/^https?:\/\//, '').split('/')[0]}
                            </span></>
                          : <span className="text-[9px] text-white/25 italic">No site found</span>
                        }
                        {lead.phone && (
                          <><span className="text-[9px] text-white/15">·</span>
                          <Phone className="w-2.5 h-2.5 text-white/25 shrink-0" />
                          <span className="text-[9px] text-white/30 truncate font-mono">{lead.phone}</span></>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className={cn(
                        "text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border",
                        statusPill(lead.status)
                      )}>
                        {statusLabel(lead.status)}
                      </span>
                      <span className={cn(
                        "text-[8px] font-mono font-bold",
                        valueProfile.tier === "Hot" ? "text-orange-400"
                        : valueProfile.tier === "Warm" ? "text-cyan-400"
                        : "text-white/25"
                      )}>
                        HV{valueProfile.score}
                      </span>
                    </div>
                  </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/8 shrink-0">
          {phase === "idle" && (
            <Button onClick={handleScan} disabled={!city.trim()}
              className="w-full bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold hover:scale-[1.02] transition-all disabled:opacity-35">
              <Radar className="w-4 h-4 mr-2" />
              {deepScan ? "Deep Scan for Leads" : "Scan for Real Leads"}
            </Button>
          )}
          {phase === "scanning" && (
            <Button disabled className="w-full bg-white/5 border border-white/10 text-white/40 cursor-not-allowed">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Scanning…
            </Button>
          )}
          {phase === "error" && (
            <div className="flex gap-2.5">
              <Button onClick={() => setPhase("idle")} variant="ghost"
                className="flex-1 border border-white/10 text-white/60 hover:text-white hover:bg-white/5">
                Back
              </Button>
              <Button onClick={handleScan}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold hover:scale-[1.02] transition-all">
                <Radar className="w-4 h-4 mr-2" /> Retry
              </Button>
            </div>
          )}
          {phase === "done" && (
            <div className="flex gap-2.5">
              <Button onClick={() => { setPhase("idle"); setLeads([]); setVisible([]) }}
                variant="ghost"
                className="border border-white/10 text-white/60 hover:text-white hover:bg-white/5 px-4">
                Rescan
              </Button>
              <Button onClick={handleAdd} disabled={selected.size === 0}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold hover:scale-[1.02] transition-all disabled:opacity-35">
                <Plus className="w-4 h-4 mr-1.5" />
                Add {selected.size} Lead{selected.size !== 1 ? "s" : ""}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
