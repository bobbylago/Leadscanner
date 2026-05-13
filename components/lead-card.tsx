"use client"

import { type Lead, getStatusConfig } from "@/lib/types"
import { calcRevenueLeak, calcHealthScore, cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/country-utils"
import { Star, TrendingDown, Globe, AlertTriangle, Flame, ShieldCheck } from "lucide-react"

interface LeadCardProps {
  lead: Lead
  isSelected: boolean
  onClick: () => void
}

export function LeadCard({ lead, isSelected, onClick }: LeadCardProps) {
  const config = getStatusConfig(lead.status)
  const revenueLeak = calcRevenueLeak(lead)
  const healthScore = calcHealthScore(lead)
  const quality = lead.qualityScore
  const isHot = (quality ?? 0) >= 70
  const isVerified = !!lead.realAudit

  const scores = [
    lead.audit?.seo ?? 0,
    lead.audit?.mobileFriendliness ?? 0,
    lead.audit?.chatbotPresence ?? 0,
    lead.audit?.pageSpeed ?? 0,
    lead.audit?.socialPresence ?? 0,
  ]

  const stripeColor =
    lead.status === "No Website" ? "from-red-500 to-red-600"
    : lead.status === "Old Website" ? "from-orange-500 to-amber-500"
    : "from-cyan-400 to-teal-500"

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
        "w-full text-left rounded-xl border transition-all duration-200 group relative overflow-hidden cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50",
        isSelected
          ? "bg-gradient-to-br from-cyan-500/[0.10] via-slate-900/95 to-slate-950 border-cyan-500/35 shadow-[0_0_28px_rgba(6,182,212,0.14),0_4px_20px_rgba(0,0,0,0.5)]"
          : isHot
            ? "bg-gradient-to-br from-orange-500/[0.05] to-slate-900/70 border-orange-500/15 hover:border-orange-500/30 hover:from-orange-500/[0.07] hover:shadow-[0_4px_20px_rgba(251,146,60,0.10)]"
            : "bg-[#0c1119]/85 border-white/[0.06] hover:bg-slate-900/95 hover:border-white/12 hover:shadow-[0_4px_18px_rgba(0,0,0,0.4)]"
      )}
    >
      {/* Status stripe — gradient now */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b transition-all duration-200",
        stripeColor,
        isSelected ? "opacity-100 shadow-[2px_0_10px_currentColor]" : "opacity-50 group-hover:opacity-80"
      )} />

      {/* Selected: subtle inner glow */}
      {isSelected && (
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/[0.04] via-transparent to-transparent pointer-events-none rounded-xl" />
      )}

      <div className="pl-4 pr-4 py-3.5 relative">
        {/* Top row: name + status badge */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {isHot && (
              <Flame
                className="w-3.5 h-3.5 text-orange-400 shrink-0 drop-shadow-[0_0_6px_rgba(251,146,60,0.6)]"
                strokeWidth={2.5}
              />
            )}
            <h3 className={cn(
              "font-semibold text-sm leading-snug transition-colors duration-150 line-clamp-1",
              isSelected ? "text-white" : "text-white/85 group-hover:text-white"
            )}>
              {lead.name}
            </h3>
          </div>
          <span className={cn(
            "shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border",
            config.bgColor, config.color, "border-current/20"
          )}>
            {config.label}
          </span>
        </div>

        {/* Metadata row: rating + revenue + category */}
        <div className="flex items-center gap-3 mb-2.5">
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 drop-shadow-[0_0_2px_rgba(234,179,8,0.4)]" />
            <span className="text-xs font-bold text-white font-mono">{lead.rating}</span>
            <span className="text-[10px] text-white/30 font-mono">({lead.reviews || 0})</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-red-400/70" />
            <span className="text-[10px] font-bold font-mono text-red-400/85">
              -{formatCurrency(revenueLeak, lead.country)}/mo
            </span>
          </div>
          {lead.category && (
            <span className="text-[9px] text-white/20 uppercase tracking-wider ml-auto truncate font-mono">
              {lead.category}
            </span>
          )}
        </div>

        {/* Website + verification */}
        <div className="flex items-center gap-1.5 mb-2.5">
          {lead.website
            ? <Globe className="w-3 h-3 text-white/20 shrink-0" />
            : <AlertTriangle className="w-3 h-3 text-red-400/50 shrink-0" />}
          <span className={cn(
            "text-[10px] truncate font-mono flex-1",
            lead.website ? "text-white/25" : "text-red-400/55 italic"
          )}>
            {lead.website
              ? lead.website.replace(/^https?:\/\//, '').replace(/\?.*/, '').split('/')[0].slice(0, 32)
              : "No website detected"}
          </span>
          {isVerified && (
            <span title="Live site audited" className="shrink-0">
              <ShieldCheck className="w-3 h-3 text-emerald-400/70" strokeWidth={2.5} />
            </span>
          )}
        </div>

        {/* Health bar — only when site exists */}
        {lead.status !== "No Website" && (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-white/20 uppercase tracking-wider font-mono">Health</span>
              <div className="flex items-center gap-1.5">
                {quality !== undefined && (
                  <span className={cn(
                    "text-[9px] font-bold font-mono px-1 py-0.5 rounded",
                    isHot ? "text-orange-400 bg-orange-500/[0.08]"
                    : quality >= 50 ? "text-cyan-400/80 bg-cyan-500/[0.05]"
                    : "text-white/30"
                  )}>
                    Q{quality}
                  </span>
                )}
                <span className={cn("text-[10px] font-bold font-mono", healthTextColor)}>
                  {healthScore}%
                </span>
              </div>
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

        {/* No-website variant — show quality + opportunity hint */}
        {lead.status === "No Website" && quality !== undefined && (
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/[0.05]">
            <span className="text-[9px] text-red-400/70 uppercase tracking-wider font-mono">
              Opportunity
            </span>
            <span className={cn(
              "text-[9px] font-bold font-mono px-1.5 py-0.5 rounded",
              isHot ? "text-orange-400 bg-orange-500/[0.10] border border-orange-500/25"
              : "text-white/45 bg-white/[0.04]"
            )}>
              Q{quality}
            </span>
          </div>
        )}
      </div>
    </button>
  )
}
