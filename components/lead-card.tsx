"use client"

import { type Lead, getStatusConfig } from "@/lib/types"
import { calcRevenueLeak, calcHealthScore, cn } from "@/lib/utils"
import { Star, TrendingDown, Globe, AlertTriangle } from "lucide-react"

interface LeadCardProps {
  lead: Lead
  isSelected: boolean
  onClick: () => void
}

export function LeadCard({ lead, isSelected, onClick }: LeadCardProps) {
  const config = getStatusConfig(lead.status)
  const revenueLeak = calcRevenueLeak(lead)
  const healthScore = calcHealthScore(lead)
  // 5-metric breakdown for tooltip
  const scores = [lead.audit?.seo??0, lead.audit?.mobileFriendliness??0, lead.audit?.chatbotPresence??0, lead.audit?.pageSpeed??0, lead.audit?.socialPresence??0]

  const statusLine = lead.status === "No Website"
    ? "bg-red-500"
    : (lead.audit?.seo ?? 0) < 70
      ? "bg-orange-500"
      : "bg-cyan-400"

  const healthBarColor = healthScore >= 70
    ? "bg-gradient-to-r from-emerald-500 to-teal-400"
    : healthScore >= 40
      ? "bg-gradient-to-r from-orange-500 to-amber-400"
      : "bg-gradient-to-r from-red-600 to-red-400"

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-200 group relative overflow-hidden",
        "hover:border-cyan-500/25",
        isSelected
          ? "bg-gradient-to-br from-cyan-500/10 via-teal-500/5 to-transparent border-cyan-500/35 shadow-lg shadow-cyan-500/10"
          : "bg-slate-900/50 border-white/5 hover:bg-white/[0.025]"
      )}
    >
      {/* Left status stripe */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl transition-opacity duration-200",
        statusLine,
        isSelected ? "opacity-100" : "opacity-50 group-hover:opacity-80"
      )} />

      <div className="pl-3">
        {/* Top row: name + status badge */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className={cn(
            "font-semibold text-sm leading-tight transition-colors line-clamp-1",
            isSelected ? "text-white" : "text-white/85 group-hover:text-white"
          )}>
            {lead.name}
          </h3>
          <span className={cn(
            "shrink-0 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border",
            config.bgColor, config.color,
            "border-current/20"
          )}>
            {config.label}
          </span>
        </div>

        {/* Middle row: rating + revenue leak */}
        <div className="flex items-center gap-3 mb-2.5">
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            <span className="text-xs font-bold text-white">{lead.rating}</span>
            <span className="text-[10px] text-white/35">({lead.reviews || 0})</span>
          </div>

          <div className="flex items-center gap-1 text-red-400/80">
            <TrendingDown className="w-3 h-3" />
            <span className="text-[10px] font-semibold">-${revenueLeak.toLocaleString()}/mo</span>
          </div>

          {lead.category && (
            <span className="text-[10px] text-white/25 uppercase tracking-wide ml-auto">
              {lead.category}
            </span>
          )}
        </div>

        {/* Website indicator */}
        <div className="flex items-center gap-1.5 mb-2.5">
          {lead.website ? (
            <Globe className="w-3 h-3 text-white/25 shrink-0" />
          ) : (
            <AlertTriangle className="w-3 h-3 text-red-400/60 shrink-0" />
          )}
          <span className={cn(
            "text-[10px] truncate",
            lead.website ? "text-white/30" : "text-red-400/60 italic"
          )}>
            {lead.website
              ? lead.website.replace(/^https?:\/\//, '').replace(/\?.*/, '').slice(0, 35)
              : "No website detected"}
          </span>
        </div>

        {/* Health score bar */}
        {lead.status !== "No Website" && (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-white/25 uppercase tracking-wide">5-Point Health</span>
              <span className={cn(
                "text-[10px] font-bold",
                healthScore >= 70 ? "text-emerald-400" : healthScore >= 40 ? "text-orange-400" : "text-red-400"
              )}>
                {healthScore}%
              </span>
            </div>
            {/* Segmented bar: 5 sections */}
            <div className="flex gap-0.5">
              {scores.map((s, i) => (
                <div key={i} className="flex-1 h-1 rounded-sm overflow-hidden bg-white/5">
                  <div
                    className={cn("h-full rounded-sm transition-all duration-700", healthBarColor)}
                    style={{ width: `${Math.max(s, 2)}%` }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </button>
  )
}
