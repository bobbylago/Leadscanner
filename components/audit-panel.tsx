"use client"

import { useMemo, useState } from "react"
import { type Lead, getStatusConfig } from "@/lib/types"
import { calcRevenueLeak, calcHealthScore, scoreGradient, scoreStroke, cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  X, Star, Phone, Globe, Search, Smartphone, Bot, AlertTriangle, Sparkles,
  TrendingDown, Zap, Copy, Check, Mail, Map, ExternalLink, BarChart3,
  Gauge, Share2, Wrench
} from "lucide-react"

interface AuditPanelProps {
  lead: Lead
  onClose: () => void
}

function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const r = size * 0.37
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const stroke = scoreStroke(score)
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 absolute inset-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={size * 0.075} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stroke} strokeWidth={size * 0.075}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="relative text-center z-10">
        <div className="text-base font-black text-white leading-none">{score}%</div>
        <div className="text-[8px] text-white/40 uppercase tracking-wide mt-0.5">Health</div>
      </div>
    </div>
  )
}

function MiniBar({ value, gradient }: { value: number; gradient: string }) {
  return (
    <div className="h-1.5 w-full bg-white/6 rounded-full overflow-hidden mt-1.5">
      <div className={cn("h-full bg-gradient-to-r transition-all duration-700", gradient)}
        style={{ width: `${Math.max(value, 2)}%` }} />
    </div>
  )
}

export function AuditPanel({ lead, onClose }: AuditPanelProps) {
  const config = getStatusConfig(lead.status)
  const [copied, setCopied] = useState(false)

  const overallScore = useMemo(() => calcHealthScore(lead), [lead])
  const revenueLeak = useMemo(() => calcRevenueLeak(lead), [lead])

  const pitchText = useMemo(() => {
    const isNoSite = lead.status === "No Website"
    const isOldSite = lead.status === "Old Website"
    const problem = isNoSite
      ? "Your business currently has no website, making it invisible to customers searching online."
      : isOldSite
        ? "Your current website appears outdated and is likely hurting your conversion rate."
        : "Your site is missing an AI-powered booking system — leads arriving after hours go unanswered."
    return `Subject: Quick question about ${lead.name}'s online presence

Hi ${lead.name} team,

I was researching ${lead.category || "local businesses"} in your area and ran a quick digital health audit on your business.

Digital Health Score: ${overallScore}% (industry avg: 58%)
${problem}

Based on your ${lead.reviews} Google reviews, this gap is likely costing you an estimated $${revenueLeak.toLocaleString()}/month in missed conversions.

I've built a working prototype specifically for ${lead.name} that directly fixes this. Worth 5 minutes?

Best,
[Your Name]`
  }, [lead, overallScore, revenueLeak])

  const handleCopy = () => {
    navigator.clipboard.writeText(pitchText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const auditItems = useMemo(() => [
    {
      label: "SEO Score",
      value: lead.audit?.seo ?? 0,
      icon: Search,
      gradient: scoreGradient(lead.audit?.seo ?? 0),
      tip: (() => {
        const v = lead.audit?.seo ?? 0
        if (v < 25) return "Very poor — low review count and weak online presence"
        if (v < 50) return "Below average — limited visibility in local searches"
        if (v < 70) return "Moderate — some SEO signals but room to improve"
        return "Good — strong online presence and local signals"
      })(),
    },
    {
      label: "Mobile Friendliness",
      value: lead.audit?.mobileFriendliness ?? 0,
      icon: Smartphone,
      gradient: scoreGradient(lead.audit?.mobileFriendliness ?? 0),
      tip: (() => {
        const v = lead.audit?.mobileFriendliness ?? 0
        if (v < 30) return "Likely outdated or non-responsive site"
        if (v < 60) return "Partially mobile-ready — may frustrate mobile users"
        return "Appears mobile-friendly"
      })(),
    },
    {
      label: "AI Chatbot Presence",
      value: lead.audit?.chatbotPresence ?? 0,
      icon: Bot,
      gradient: scoreGradient(lead.audit?.chatbotPresence ?? 0),
      tip: (() => {
        const v = lead.audit?.chatbotPresence ?? 0
        if (v < 15) return "No automation detected — missing 24/7 lead capture entirely"
        if (v < 35) return "Basic or partial automation only"
        return "Has some chatbot or automation in place"
      })(),
    },
    {
      label: "Page Speed",
      value: lead.audit?.pageSpeed ?? 0,
      icon: Gauge,
      gradient: scoreGradient(lead.audit?.pageSpeed ?? 0),
      tip: (() => {
        const v = lead.audit?.pageSpeed ?? 0
        if (v < 30) return "Likely slow — old stack or unoptimized hosting"
        if (v < 60) return "Average speed — noticeable lag on mobile"
        return "Reasonable load speed"
      })(),
    },
    {
      label: "Social Presence",
      value: lead.audit?.socialPresence ?? 0,
      icon: Share2,
      gradient: scoreGradient(lead.audit?.socialPresence ?? 0),
      tip: (() => {
        const v = lead.audit?.socialPresence ?? 0
        if (v < 20) return "Minimal social signals — very limited online reputation"
        if (v < 45) return "Some social activity — not leveraging reviews fully"
        return "Active social presence and review base"
      })(),
    },
  ], [lead])

  const recommendations = useMemo(() => {
    const recs: { icon: typeof Globe; title: string; desc: string; priority: string }[] = []
    if (lead.status === "No Website") {
      recs.push({ icon: Globe, title: "Build a Professional Website", desc: "Critical: Zero digital presence. A conversion-optimised site is the #1 priority — without this, you cannot be found.", priority: "critical" })
    }
    if (lead.status === "Old Website") {
      recs.push({ icon: Wrench, title: "Rebuild or Modernise Website", desc: "Old sites hurt credibility and mobile conversion. Relaunch with a modern, fast, HTTPS stack.", priority: "high" })
    }
    if ((lead.audit?.chatbotPresence ?? 0) < 15 && lead.status !== "No Website") {
      recs.push({ icon: Bot, title: "Deploy AI Chatbot", desc: "Capture and qualify leads 24/7. Most bookings happen outside business hours — you're losing them.", priority: lead.status === "Old Website" ? "medium" : "high" })
    }
    if ((lead.audit?.seo ?? 0) < 45 && lead.status !== "No Website") {
      recs.push({ icon: Search, title: "Improve Local SEO", desc: "Optimise Google Business Profile, add structured data, build local citations and respond to reviews.", priority: "medium" })
    }
    if ((lead.audit?.pageSpeed ?? 0) < 35 && lead.status !== "No Website") {
      recs.push({ icon: Gauge, title: "Fix Page Speed", desc: "Slow sites lose 53% of mobile visitors. Compress images, enable caching, upgrade hosting.", priority: "medium" })
    }
    if (recs.length === 0) {
      recs.push({ icon: Zap, title: "Advanced CRM Automation", desc: "Business is mature digitally. Recommend follow-up sequences, upsell automation and Google Ads.", priority: "growth" })
    }
    return recs
  }, [lead])

  const priorityStyle: Record<string, string> = {
    critical: "text-red-400 bg-red-500/8 border-red-500/20",
    high: "text-orange-400 bg-orange-500/8 border-orange-500/20",
    medium: "text-yellow-400 bg-yellow-500/8 border-yellow-500/20",
    growth: "text-cyan-400 bg-cyan-500/8 border-cyan-500/20",
  }

  return (
    <div className="h-full flex flex-col bg-[#020617]/97 backdrop-blur-xl border-l border-white/10 shadow-2xl overflow-hidden">

      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-white/8 bg-gradient-to-r from-slate-900/80 to-transparent shrink-0">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {lead.isCustom && (
                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/25">
                  Custom
                </span>
              )}
            </div>
            <h2 className="font-bold text-base text-white leading-tight line-clamp-2 mb-2">{lead.name}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border",
                config.bgColor, config.color, "border-current/20"
              )}>
                <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
                {config.label}
              </span>
              {lead.category && <span className="text-[10px] text-white/35 uppercase tracking-wide">{lead.category}</span>}
            </div>
          </div>
          <div className="flex items-start gap-1.5 shrink-0">
            <ScoreRing score={overallScore} />
            <Button variant="ghost" size="icon" onClick={onClose}
              className="w-8 h-8 text-white/35 hover:text-white hover:bg-white/5">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-3 bg-white/5 border border-white/8 h-9 shrink-0">
          <TabsTrigger value="overview" className="flex-1 text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50">Overview</TabsTrigger>
          <TabsTrigger value="health" className="flex-1 text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50">Health Audit</TabsTrigger>
          <TabsTrigger value="outreach" className="flex-1 text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50">Outreach</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="flex-1 overflow-auto px-4 py-4 space-y-4 mt-0">
          {/* Revenue leak */}
          <div className="p-4 rounded-2xl bg-red-500/8 border border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">Monthly Revenue Leak</span>
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-3xl font-black text-white">${revenueLeak.toLocaleString()}</span>
              <span className="text-sm text-white/35">/month</span>
            </div>
            <p className="text-[10px] text-white/35">
              Estimated from {lead.reviews} reviews × visitor conversion gap
            </p>
          </div>

          {/* Business contact */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/35">Contact & Info</h3>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/4 border border-white/6">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 shrink-0" />
                <span className="text-sm font-bold text-white">{lead.rating}</span>
                <span className="text-xs text-white/40">({lead.reviews} reviews)</span>
                <div className="ml-auto flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={cn("w-3 h-3", i < Math.round(lead.rating) ? "text-yellow-500 fill-yellow-500" : "text-white/10")} />
                  ))}
                </div>
              </div>
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/4 border border-white/6 hover:border-cyan-500/25 transition-colors group">
                  <Phone className="w-4 h-4 text-white/40 group-hover:text-cyan-400 shrink-0" />
                  <span className="text-sm text-white/70 group-hover:text-white">{lead.phone}</span>
                </a>
              )}
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/4 border border-white/6">
                <Globe className="w-4 h-4 text-white/40 shrink-0" />
                {lead.website ? (
                  <a href={lead.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 truncate">
                    <span className="truncate">{lead.website.replace(/^https?:\/\//, '').replace(/\?.*/, '').slice(0, 38)}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm text-red-400 italic">
                    <AlertTriangle className="w-3.5 h-3.5" /> No website detected
                  </span>
                )}
              </div>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.name)}`} target="_blank"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/4 border border-white/6 hover:border-cyan-500/25 transition-colors group">
                <Map className="w-4 h-4 text-white/40 group-hover:text-cyan-400 shrink-0" />
                <span className="text-sm text-white/40 group-hover:text-white">View on Google Maps</span>
                <ExternalLink className="w-3 h-3 text-white/20 group-hover:text-white/60 ml-auto" />
              </a>
            </div>
          </div>

          {/* Quick score grid */}
          <div className="p-3.5 rounded-2xl bg-white/4 border border-white/8">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-3">5-Point Audit</h3>
            <div className="space-y-2">
              {auditItems.map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <item.icon className="w-3.5 h-3.5 text-white/35 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-white/55">{item.label}</span>
                      <span className={cn("font-bold",
                        item.value >= 70 ? "text-emerald-400" : item.value >= 40 ? "text-orange-400" : "text-red-400"
                      )}>{item.value}%</span>
                    </div>
                    <MiniBar value={item.value} gradient={item.gradient} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* HEALTH AUDIT */}
        <TabsContent value="health" className="flex-1 overflow-auto px-4 py-4 space-y-5 mt-0">
          <div className="space-y-5">
            {auditItems.map(item => (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <item.icon className="w-3.5 h-3.5 text-white/50" />
                    <span className="text-xs font-semibold text-white/75">{item.label}</span>
                  </div>
                  <span className={cn("text-sm font-black",
                    item.value >= 70 ? "text-emerald-400" : item.value >= 40 ? "text-orange-400" : "text-red-400"
                  )}>{item.value}%</span>
                </div>
                <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className={cn("h-full bg-gradient-to-r transition-all duration-1000", item.gradient)}
                    style={{ width: `${Math.max(item.value, 2)}%` }} />
                </div>
                <p className="text-[10px] text-white/35 leading-tight">{item.tip}</p>
              </div>
            ))}
          </div>

          <div className="h-px bg-white/8" />

          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/35 flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5" /> Strategic Recommendations
            </h3>
            {recommendations.map((rec, i) => (
              <div key={i} className={cn("flex items-start gap-3 p-3.5 rounded-xl border", priorityStyle[rec.priority] ?? "bg-white/4 border-white/8")}>
                <rec.icon className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white leading-tight">{rec.title}</p>
                  <p className="text-[10px] text-white/50 mt-1 leading-relaxed">{rec.desc}</p>
                </div>
                <span className="text-[8px] font-bold uppercase tracking-wide shrink-0 opacity-60 mt-0.5">{rec.priority}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* OUTREACH */}
        <TabsContent value="outreach" className="flex-1 overflow-auto px-4 py-4 space-y-4 mt-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">AI-Generated Pitch Email</h3>
          </div>
          <div className="text-[11px] text-white/70 leading-relaxed bg-white/4 rounded-2xl border border-white/8 p-4 font-mono whitespace-pre-wrap">
            {pitchText}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Button className="h-10 bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold hover:scale-[1.02] transition-all" onClick={handleCopy}>
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copied!" : "Copy Pitch"}
            </Button>
            <Button variant="outline" className="h-10 border-white/10 text-white/70 hover:text-white hover:bg-white/5" asChild>
              <a href={`mailto:?subject=${encodeURIComponent(`Quick question about ${lead.name}`)}&body=${encodeURIComponent(pitchText)}`}>
                <Mail className="w-4 h-4 mr-2" /> Open in Email
              </a>
            </Button>
          </div>
          <div className="h-px bg-white/8" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/35">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 text-xs text-white/60 hover:text-white hover:border-white/20 transition-all">
                <Phone className="w-3.5 h-3.5" /> Call Now
              </a>
            )}
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.name)}`} target="_blank"
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 text-xs text-white/60 hover:text-white hover:border-white/20 transition-all">
              <Map className="w-3.5 h-3.5" /> View on Maps
            </a>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
