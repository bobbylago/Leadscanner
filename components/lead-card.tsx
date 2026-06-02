"use client"

import { type Lead, getStatusConfig } from "@/lib/types"
import { calcRevenueLeak, calcHealthScore, cn } from "@/lib/utils"
import { getHighValueLeadProfile } from "@/lib/lead-scoring"
import { formatCurrency } from "@/lib/country-utils"
import { Star, TrendingDown, Globe, AlertTriangle, Flame, ShieldCheck, Mail } from "lucide-react"

interface LeadCardProps {
  lead: Lead
  isSelected: boolean
  onClick: () => void
  isContacted?: boolean
}

export function LeadCard({ lead, isSelected, onClick, isContacted }: LeadCardProps) {
  const config = getStatusConfig(lead.status)
  const revenueLeak = calcRevenueLeak(lead)
  const healthScore = calcHealthScore(lead)
  const valueProfile = getHighValueLeadProfile(lead)
  const quality = valueProfile.score
  const isHot = valueProfile.tier === "Hot"
  const isVerified = !!lead.realAudit
  // Health bars only reflect a real audit. Until then we show a neutral state.
  const audited = !!lead.realAudit
  const ra = lead.realAudit
  const scores = ra
    ? [ra.seo, ra.mobileFriendliness, ra.chatbotPresence, ra.pageSpeed, ra.socialPresence]
    : []

  const stripeColor =
    lead.status === "No Website" ? "bg-red-400"
    : lead.status === "Old Website" ? "bg-orange-400"
    : "bg-cyan-400"

  const healthBarColor =
    healthScore >= 70 ? "bg-emerald-400"
    : healthScore >= 40 ? "bg-orange-400"
    : "bg-red-400"

  const healthTextColor =
    healthScore >= 70 ? "text-emerald-400"
    : healthScore >= 40 ? "text-orange-400"
    : "text-red-400"

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border transition-colors duration-150 group relative overflow-hidden cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/35",
        isContacted && !isSelected && "opacity-65 hover:opacity-90",
        isSelected
          ? "bg-cyan-400/[0.075] border-cyan-400/35"
          : isHot
            ? "bg-orange-400/[0.04] border-orange-400/16 hover:bg-orange-400/[0.055] hover:border-orange-400/28"
            : "bg-white/[0.025] border-white/[0.08] hover:bg-white/[0.04] hover:border-white/14"
      )}
    >
      {/* Status stripe — gradient now */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-[3px] transition-opacity duration-150",
        stripeColor,
        isSelected ? "opacity-100" : "opacity-45 group-hover:opacity-75"
      )} />

      {/* Selected: subtle inner glow */}
      {isSelected && (
        <div className="absolute inset-0 bg-cyan-400/[0.025] pointer-events-none rounded-lg" />
      )}

      <div className="pl-4 pr-4 py-3.5 relative">
        {/* Top row: name + status badge */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {isHot && (
              <Flame
                className="w-3.5 h-3.5 text-orange-400 shrink-0"
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
          <div className="flex items-center gap-1.5 shrink-0">
            {isContacted && (
              <span title="Already contacted"
                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                <Mail className="w-2.5 h-2.5" />
                Sent
              </span>
            )}
            <span className={cn(
              "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border",
              config.bgColor, config.color, "border-current/20"
            )}>
              {config.label}
            </span>
          </div>
        </div>

        {/* Metadata row: rating + revenue + category */}
        <div className="flex items-center gap-3 mb-2.5">
          {lead.rating > 0 && (
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              <span className="text-xs font-bold text-white font-mono">{lead.rating}</span>
              {lead.reviews > 0 && (
                <span className="text-[10px] text-white/30 font-mono">({lead.reviews})</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-white/35" />
            <span className="text-[10px] font-semibold font-mono text-white/45">
              {formatCurrency(revenueLeak, lead.country)}/mo est.
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
              : "No site found in source data"}
          </span>
          {isVerified && (
            <span title="Live site audited" className="shrink-0">
              <ShieldCheck className="w-3 h-3 text-emerald-400/70" strokeWidth={2.5} />
            </span>
          )}
        </div>

        {/* Health bar — only when site exists AND a real audit has run */}
        {lead.status !== "No Website" && audited && (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-white/20 uppercase tracking-wider font-mono">Health</span>
              <div className="flex items-center gap-1.5">
                {quality !== undefined && (
                  <span className={cn(
                    "text-[9px] font-bold font-mono px-1 py-0.5 rounded",
                    isHot ? "text-orange-400 bg-orange-500/[0.08]"
                    : quality >= 54 ? "text-cyan-400/80 bg-cyan-500/[0.05]"
                    : "text-white/30"
                  )}>
                    HV{quality}
                  </span>
                )}
                <span className={cn("text-[10px] font-bold font-mono", healthTextColor)}>
                  {healthScore}%
                </span>
              </div>
            </div>
            <div className="flex gap-[3px]">
              {scores.map((s, i) => (
                <div key={i} className="flex-1 h-[4px] rounded-full overflow-hidden bg-white/[0.08]">
                  <div
                    className={cn("h-full rounded-full transition-all duration-700", healthBarColor)}
                    style={{ width: `${Math.max(s, 3)}%` }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Not-yet-audited (has site) — show quality + a clear pending hint, no fake bars */}
        {lead.status !== "No Website" && !audited && (
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/[0.07]">
            <span className="text-[9px] text-white/30 uppercase tracking-wider font-mono">
              Select to run audit
            </span>
            {quality !== undefined && (
              <span className={cn(
                "text-[9px] font-bold font-mono px-1.5 py-0.5 rounded",
                isHot ? "text-orange-400 bg-orange-500/[0.10] border border-orange-500/25"
                : quality >= 54 ? "text-cyan-400/80 bg-cyan-500/[0.05]"
                : "text-white/40 bg-white/[0.04]"
              )}>
                HV{quality}
              </span>
            )}
          </div>
        )}

        {/* No-website variant — show quality + opportunity hint */}
        {lead.status === "No Website" && quality !== undefined && (
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/[0.07]">
            <span className="text-[9px] text-white/35 uppercase tracking-wider font-mono">
              Target Fit
            </span>
            <span className={cn(
              "text-[9px] font-bold font-mono px-1.5 py-0.5 rounded",
              isHot ? "text-orange-400 bg-orange-500/[0.10] border border-orange-500/25"
              : "text-white/45 bg-white/[0.04]"
            )}>
              HV{quality}
            </span>
          </div>
        )}
      </div>
    </button>
  )
}
