"use client"

import { useState, useMemo } from "react"
import { Lead } from "@/lib/types"
import { calcRevenueLeak } from "@/lib/utils"
import { LeadCard } from "./lead-card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Search, SortAsc, TrendingDown, Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface LeadListProps {
  leads: Lead[]
  selectedLead: Lead | null
  onSelectLead: (lead: Lead) => void
}

type SortKey = "leak" | "rating" | "name"
type StatusFilter = "all" | "No Website" | "Needs AI Chatbot"

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "No Website", label: "No Site" },
  { value: "Needs AI Chatbot", label: "Chatbot" },
]

const SORTS: { value: SortKey; label: string; icon: React.ReactNode }[] = [
  { value: "leak", label: "Revenue", icon: <TrendingDown className="w-3 h-3" /> },
  { value: "rating", label: "Rating", icon: <Star className="w-3 h-3" /> },
  { value: "name", label: "A–Z", icon: <SortAsc className="w-3 h-3" /> },
]

export function LeadList({ leads, selectedLead, onSelectLead }: LeadListProps) {
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<SortKey>("leak")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const processedLeads = useMemo(() => {
    let result = [...leads]

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(l => l.name.toLowerCase().includes(q) || l.category?.toLowerCase().includes(q))
    }

    if (statusFilter !== "all") {
      result = result.filter(l => l.status === statusFilter)
    }

    result.sort((a, b) => {
      if (sortBy === "leak") return calcRevenueLeak(b) - calcRevenueLeak(a)
      if (sortBy === "rating") return b.rating - a.rating
      return a.name.localeCompare(b.name)
    })

    return result
  }, [leads, search, sortBy, statusFilter])

  const noSiteCount = leads.filter(l => l.status === "No Website").length
  const chatbotCount = leads.filter(l => l.status === "Needs AI Chatbot").length

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search businesses..."
            className="pl-8 h-8 text-xs bg-white/5 border-white/10 focus:border-cyan-500/40 text-white placeholder:text-white/30"
          />
        </div>
      </div>

      {/* Filters + Sort */}
      <div className="px-3 pb-2 flex items-center gap-2">
        {/* Status filter pills */}
        <div className="flex items-center gap-1 flex-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all",
                statusFilter === f.value
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                  : "bg-white/5 text-white/40 border border-white/5 hover:border-white/15 hover:text-white/60"
              )}
            >
              {f.value === "No Website" ? `${f.label} (${noSiteCount})` :
               f.value === "Needs AI Chatbot" ? `${f.label} (${chatbotCount})` :
               f.label}
            </button>
          ))}
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-0.5 bg-white/5 rounded-md border border-white/5 p-0.5">
          {SORTS.map(s => (
            <button
              key={s.value}
              onClick={() => setSortBy(s.value)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all",
                sortBy === s.value
                  ? "bg-white/10 text-white"
                  : "text-white/30 hover:text-white/60"
              )}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lead count */}
      <div className="px-3 pb-1.5">
        <span className="text-[10px] text-white/30">
          {processedLeads.length} of {leads.length} targets
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="px-3 pb-3 flex flex-col gap-1.5">
            {processedLeads.length === 0 ? (
              <div className="py-8 text-center text-white/30 text-xs">No matches found</div>
            ) : (
              processedLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  isSelected={selectedLead?.id === lead.id}
                  onClick={() => onSelectLead(lead)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
