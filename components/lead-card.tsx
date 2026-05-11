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
  const scores = [
    lead.audit?.seo ?? 0,
    lead.audit?.mobileFriendliness ?? 0,
    lead.audit?.chatbotPresence ?? 0,
    lead.audit?.pageSpeed ?? 0,
    lead.audit?.socialPresence ?? 0,
  ]

  const stripeColor =
    lead.status === "No Website" ? "bg-red-500"
    : (lead.audit?.seo ?? 0) < 70 ? "bg-orange-500"
    : "bg-cyan-400"

  const healthBarColor =
    healthScore >= 70 ? "bg-gradient-to-r from-emerald-500 to-teal-400"
    : healthScore >= 40 ? "bg-gradient-to-r from-orange-500 to-amber-400"
    : "bg-gradient-to-r from-red-600 to-red-400"

  const healthTextColor =
    healthScore >= 70 ? "text-emerald-400"
    : healthScore >= 40 ? "text-orange-400"
    : "text-red-400"

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-200 group relative overflow-hidden cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50",
        isSelected
          ? "bg-gradient-to-br from-cyan-500/[0.08] via-slate-900/90 to-slate-950 border-cyan-500/30 shadow-[0_0_28px_rgba(6,182,212,0.10),0_4px_20px_rgba(0,0,0,0.5)]"
          : "bg-[#0d1117]/80 border-white/[0.06] hover:bg-slate-900/90 hover:border-white/10 hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
      )}
    >
      {/* Left status stripe */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl transition-all duration-200",
        stripeColor,
        isSelected ? "opacity-100" : "opacity-35 group-hover:opacity-65"
      )} />

      {/* Subtle inner glow on selected */}
      {isSelected && (
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/[0.04] via-transparent to-transparent pointer-events-none rounded-xl" />
      )}

      <div className="pl-3 relative">
        {/* Name + badge */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className={cn(
            "font-semibold text-sm leading-snug transition-colors duration-150 line-clamp-1",
            isSelected ? "text-white" : "text-white/75 group-hover:text-white/95"
          )}>
            {lead.name}
          </h3>
          <span className={cn(
            "shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border",
            config.bgColor, config.color, "border-current/20"
          )}>
            {config.label}
          </span>
        </div>

        {/* Rating + revenue + category */}
        <div className="flex items-center gap-3 mb-2.5">
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            <span className="text-xs font-bold text-white font-mono">{lead.rating}</span>
            <span className="text-[10px] text-white/28 font-mono">({lead.reviews || 0})</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-red-400/70" />
            <span className="text-[10px] font-bold font-mono text-red-400/80">
              -${revenueLeak.toLocaleString()}/mo
            </span>
          </div>
          {lead.category && (
            <span className="text-[9px] text-white/18 uppercase tracking-wider ml-auto truncate">
              {lead.category}
            </span>
          )}
        </div>

        {/* Website */}
        <div className="flex items-center gap-1.5 mb-2.5">
          {lead.website
            ? <Globe className="w-3 h-3 text-white/18 shrink-0" />
            : <AlertTriangle className="w-3 h-3 text-red-400/45 shrink-0" />}
          <span className={cn(
            "text-[10px] truncate font-mono",
            lead.website ? "text-white/22" : "text-red-400/45 italic"
          )}>
            {lead.website
              ? lead.website.replace(/^https?:\/\//, '').replace(/\?.*/, '').slice(0, 35)
              : "No website detected"}
          </span>
        </div>

        {/* 5-point health bar */}
        {lead.status !== "No Website" && (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-white/18 uppercase tracking-wider font-mono">5-pt Health</span>
              <span className={cn("text-[10px] font-bold font-mono", healthTextColor)}>
                {healthScore}%
              </span>
            </div>
            <div className="flex gap-[3px]">
              {scores.map((s, i) => (
                <div key={i} className="flex-1 h-[5px] rounded-full overflow-hidden bg-white/[0.05]">
                  <div
                    className={cn("h-full rounded-full transition-all duration-700", healthBarColor)}
                    style={{ width: `${Math.max(s, 3)}%` }}
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
