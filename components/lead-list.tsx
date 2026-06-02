"use client"

import { useState, useMemo } from "react"
import { Lead } from "@/lib/types"
import { calcRevenueLeak } from "@/lib/utils"
import { getHighValueLeadProfile } from "@/lib/lead-scoring"
import { LeadCard } from "./lead-card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Search, TrendingDown, Star, ArrowUpDown, Flame, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface LeadListProps {
  leads: Lead[]
  selectedLead: Lead | null
  onSelectLead: (lead: Lead) => void
  multiSelectMode?: boolean
  multiSelected?: Set<string>
  onToggleMultiSelect?: (id: string) => void
  onSelectAll?: (ids: string[]) => void
  contactedLeadIds?: Set<string>
}

type SortKey = "quality" | "leak" | "rating" | "name"
type StatusFilter = "all" | "hot" | "No Website" | "Needs AI Chatbot" | "Old Website" | "contacted" | "not-contacted"

const SORTS: { value: SortKey; label: string; icon: React.ReactNode }[] = [
  { value: "quality", label: "Hot", icon: <Flame className="w-3 h-3" /> },
  { value: "leak", label: "Value", icon: <TrendingDown className="w-3 h-3" /> },
  { value: "rating", label: "Rating", icon: <Star className="w-3 h-3" /> },
  { value: "name", label: "A-Z", icon: <ArrowUpDown className="w-3 h-3" /> },
]

export function LeadList({
  leads, selectedLead, onSelectLead,
  multiSelectMode, multiSelected, onToggleMultiSelect, onSelectAll,
  contactedLeadIds,
}: LeadListProps) {
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<SortKey>("quality")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const counts = useMemo(() => ({
    hot: leads.filter(l => getHighValueLeadProfile(l).tier === "Hot").length,
    noSite: leads.filter(l => l.status === "No Website").length,
    chatbot: leads.filter(l => l.status === "Needs AI Chatbot").length,
    oldSite: leads.filter(l => l.status === "Old Website").length,
  }), [leads])

  const processedLeads = useMemo(() => {
    let result = [...leads]
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(l => l.name.toLowerCase().includes(q) || l.category?.toLowerCase().includes(q))
    }
    if (statusFilter === "contacted") {
      result = result.filter(l => contactedLeadIds?.has(l.id))
    } else if (statusFilter === "not-contacted") {
      result = result.filter(l => !contactedLeadIds?.has(l.id))
    } else if (statusFilter === "hot") {
      result = result.filter(l => getHighValueLeadProfile(l).tier === "Hot")
    } else if (statusFilter !== "all") {
      result = result.filter(l => l.status === statusFilter)
    }
    result.sort((a, b) => {
      if (sortBy === "quality") return getHighValueLeadProfile(b).score - getHighValueLeadProfile(a).score
      if (sortBy === "leak") return calcRevenueLeak(b) - calcRevenueLeak(a)
      if (sortBy === "rating") return b.rating - a.rating
      return a.name.localeCompare(b.name)
    })
    return result
  }, [leads, search, sortBy, statusFilter, contactedLeadIds])

  const contactedCount = leads.filter(l => contactedLeadIds?.has(l.id)).length

  const filterPills: { value: StatusFilter; label: string; count?: number }[] = [
    { value: "all", label: "All" },
    { value: "not-contacted", label: "New", count: leads.length - contactedCount },
    { value: "hot", label: "Hot", count: counts.hot },
    { value: "No Website", label: "No Site", count: counts.noSite },
    { value: "Old Website", label: "Old Site", count: counts.oldSite },
    { value: "Needs AI Chatbot", label: "Chatbot", count: counts.chatbot },
    { value: "contacted", label: "Sent", count: contactedCount },
  ]

  const allFilteredSelected = processedLeads.length > 0 &&
    processedLeads.every(l => multiSelected?.has(l.id))

  const handleLeadClick = (lead: Lead) => {
    if (multiSelectMode) {
      onToggleMultiSelect?.(lead.id)
    } else {
      onSelectLead(lead)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search businesses..."
            className="pl-8 h-9 rounded-md text-xs bg-white/[0.035] border-white/[0.09] focus:border-cyan-500/35 focus:bg-white/[0.05] text-white placeholder:text-white/25 transition-colors font-mono"
          />
        </div>
      </div>

      <div className="px-3 pb-2 flex items-center gap-2">
        <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
          {filterPills.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-colors duration-150 cursor-pointer",
                statusFilter === f.value
                  ? "bg-cyan-400/[0.10] text-cyan-300 border border-cyan-400/25"
                  : "bg-white/[0.03] text-white/38 border border-white/[0.08] hover:bg-white/[0.05] hover:border-white/14 hover:text-white/58"
              )}
            >
              <span className="font-mono">{f.label}</span>
              {f.count !== undefined && f.count > 0 && (
                <span className={cn(
                  "text-[9px] font-mono px-1 rounded",
                  statusFilter === f.value ? "text-cyan-300/70" : "text-white/25"
                )}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-px bg-white/[0.03] rounded-md border border-white/[0.08] p-0.5 shrink-0">
          {SORTS.map(s => (
            <button
              key={s.value}
              onClick={() => setSortBy(s.value)}
              title={s.label}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-colors duration-150 cursor-pointer font-mono",
                sortBy === s.value
                  ? "bg-white/[0.10] text-white"
                  : "text-white/25 hover:text-white/55"
              )}
            >
              {s.icon}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 pb-1.5 flex items-center justify-between">
        <span className="text-[10px] text-white/20 font-mono">
          {processedLeads.length} / {leads.length} targets
        </span>
        {multiSelectMode && processedLeads.length > 0 && (
          <button
            onClick={() => {
              const ids = processedLeads.map(l => l.id)
              if (allFilteredSelected) onSelectAll?.([])
              else onSelectAll?.(ids)
            }}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono cursor-pointer transition-colors"
          >
            {allFilteredSelected ? "Deselect all visible" : "Select all visible"}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="px-3 pb-3 flex flex-col gap-2">
            {processedLeads.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-white/30 text-xs font-semibold">No leads match this view</p>
                <p className="text-white/18 text-[10px] mt-1">Adjust the search, filter, or scan another niche</p>
              </div>
            ) : (
              processedLeads.map(lead => (
                <div key={lead.id} className="relative">
                  {multiSelectMode && (
                    <div
                      onClick={() => onToggleMultiSelect?.(lead.id)}
                      className="absolute top-3 right-3 z-10 cursor-pointer"
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors duration-150",
                        multiSelected?.has(lead.id)
                          ? "bg-cyan-400 border-cyan-400"
                          : "border-white/25 bg-slate-950/80 hover:border-cyan-400/60"
                      )}>
                        {multiSelected?.has(lead.id) && (
                          <Check className="w-3 h-3 text-slate-950" strokeWidth={3.5} />
                        )}
                      </div>
                    </div>
                  )}
                  <LeadCard
                    lead={lead}
                    isSelected={!multiSelectMode && selectedLead?.id === lead.id}
                    onClick={() => handleLeadClick(lead)}
                    isContacted={contactedLeadIds?.has(lead.id)}
                  />
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
