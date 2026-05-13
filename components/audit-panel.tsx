"use client"

import { useMemo, useState } from "react"
import { type Lead, getStatusConfig } from "@/lib/types"
import { calcRevenueLeak, calcHealthScore, scoreGradient, scoreStroke, cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  X, Star, Phone, Globe, Search, Smartphone, Bot, AlertTriangle, Sparkles,
  TrendingDown, Zap, Copy, Check, Mail, Map, ExternalLink, BarChart3,
  Gauge, Share2, Wrench, Loader2, ShieldCheck, Calendar, Activity,
  Code2, Image as ImageIcon, Clock
} from "lucide-react"

interface AuditPanelProps {
  lead: Lead
  onClose: () => void
  isAuditing?: boolean
}

function ScoreRing({ score, size = 76 }: { score: number; size?: number }) {
  const r = size * 0.37
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const stroke = scoreStroke(score)
  const glowColor =
    score >= 70 ? "rgba(52,211,153,0.4)"
    : score >= 40 ? "rgba(251,146,60,0.4)"
    : "rgba(248,113,113,0.4)"

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 absolute inset-0">
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="rgba(255,255,255,0.05)" strokeWidth={size * 0.07} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={stroke} strokeWidth={size * 0.07}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease", filter: `drop-shadow(0 0 4px ${glowColor})` }}
        />
      </svg>
      <div className="relative text-center z-10">
        <div className="text-base font-black text-white leading-none font-mono">{score}%</div>
        <div className="text-[8px] text-white/35 uppercase tracking-wider mt-0.5 font-mono">Health</div>
      </div>
    </div>
  )
}

function MiniBar({ value, gradient }: { value: number; gradient: string }) {
  return (
    <div className="h-[5px] w-full bg-white/[0.06] rounded-full overflow-hidden mt-1.5">
      <div className={cn("h-full bg-gradient-to-r rounded-full transition-all duration-700", gradient)}
        style={{ width: `${Math.max(value, 2)}%` }} />
    </div>
  )
}

export function AuditPanel({ lead, onClose, isAuditing }: AuditPanelProps) {
  const config = getStatusConfig(lead.status)
  const [copied, setCopied] = useState(false)

  // Prefer real audit when available — overrides synthetic scores
  const effectiveAudit = lead.realAudit ?? lead.audit
  const verified = !!lead.realAudit
  const signals = lead.realAudit?.signals

  // Build a "verified" lead for score calcs
  const auditedLead = useMemo<Lead>(() => ({ ...lead, audit: effectiveAudit }), [lead, effectiveAudit])

  const overallScore = useMemo(() => calcHealthScore(auditedLead), [auditedLead])
  const revenueLeak  = useMemo(() => calcRevenueLeak(auditedLead),  [auditedLead])

  const pitchText = useMemo(() => {
    const isNoSite  = lead.status === "No Website"
    const isOldSite = lead.status === "Old Website"

    // Build a concrete problem statement from real signals if available
    let problem: string
    if (isNoSite) {
      problem = "Your business currently has no website, making it invisible to customers searching online."
    } else if (signals) {
      const concrete: string[] = []
      if (!signals.isHttps) concrete.push("the site is served over HTTP — Chrome flags it as 'Not Secure'")
      if (!signals.hasViewport) concrete.push("there's no mobile viewport tag, so the site doesn't render correctly on phones")
      if (!signals.chatbotProvider && !signals.bookingProvider) concrete.push("no chatbot or booking system was found — every after-hours lead has no way to convert")
      if (!signals.hasSchemaMarkup) concrete.push("no schema.org markup — Google can't surface your business in rich local results")
      if (signals.responseTimeMs > 3000) concrete.push(`the homepage takes ${(signals.responseTimeMs/1000).toFixed(1)}s to respond — 53% of mobile users abandon at 3s`)
      if (signals.h1Count !== 1) concrete.push(`${signals.h1Count} H1 tags on the page (should be 1) — hurts SEO`)
      problem = concrete.length > 0
        ? "I pulled up your homepage and found:\n• " + concrete.slice(0, 3).map(c => c.charAt(0).toUpperCase() + c.slice(1)).join("\n• ")
        : "Your site is missing key conversion infrastructure — there's no automated lead capture."
    } else {
      problem = isOldSite
        ? "Your current website appears outdated and is likely hurting your conversion rate."
        : "Your site is missing an AI-powered booking system — leads arriving after hours go unanswered."
    }

    return `Subject: Quick question about ${lead.name}'s online presence

Hi ${lead.name} team,

I was researching ${lead.category || "local businesses"} in your area and ran a quick digital health audit on your business.

Digital Health Score: ${overallScore}% ${verified ? "(verified from your live site)" : "(industry avg: 58%)"}

${problem}

Based on your ${lead.reviews} Google reviews, this gap is likely costing you an estimated $${revenueLeak.toLocaleString()}/month in missed conversions.

I've built a working prototype specifically for ${lead.name} that directly fixes this. Worth 5 minutes?

Best,
[Your Name]`
  }, [lead, overallScore, revenueLeak, signals, verified])

  const handleCopy = () => {
    navigator.clipboard.writeText(pitchText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const auditItems = useMemo(() => {
    const seoTip = () => {
      const v = effectiveAudit.seo
      if (signals) {
        const issues: string[] = []
        if (!signals.hasTitle) issues.push("missing <title>")
        else if (signals.titleLength < 10 || signals.titleLength > 70) issues.push(`title ${signals.titleLength} chars (ideal 10–70)`)
        if (!signals.hasMetaDescription) issues.push("no meta description")
        else if (signals.metaDescriptionLength < 50 || signals.metaDescriptionLength > 160) issues.push("meta description length off")
        if (!signals.hasSchemaMarkup) issues.push("no schema.org markup")
        if (!signals.hasOgTags) issues.push("missing OpenGraph tags")
        if (!signals.hasCanonical) issues.push("no canonical URL")
        if (signals.h1Count === 0) issues.push("no H1 tag")
        else if (signals.h1Count > 1) issues.push(`${signals.h1Count} H1 tags (should be 1)`)
        if (!signals.isHttps) issues.push("not using HTTPS")
        return issues.length === 0
          ? "All major SEO basics present"
          : "Missing: " + issues.slice(0, 3).join(", ")
      }
      if (v < 25) return "Very poor — weak online presence"
      if (v < 50) return "Below average — limited search visibility"
      if (v < 70) return "Moderate — some SEO signals present"
      return "Good — strong on-page SEO foundations"
    }

    const mobileTip = () => {
      if (signals) {
        const issues: string[] = []
        if (!signals.hasViewport) issues.push("no mobile viewport meta")
        if (!signals.usesModernFramework) issues.push("no modern framework detected")
        if (!signals.hasManifest) issues.push("no PWA manifest")
        return issues.length === 0
          ? "Fully mobile-optimised stack"
          : issues.join(" · ")
      }
      const v = effectiveAudit.mobileFriendliness
      if (v < 30) return "Likely outdated or non-responsive site"
      if (v < 60) return "Partially mobile-ready"
      return "Appears mobile-friendly"
    }

    const chatbotTip = () => {
      if (signals) {
        if (signals.chatbotProvider) return `Detected: ${signals.chatbotProvider}`
        if (signals.bookingProvider) return `No chatbot. Booking system: ${signals.bookingProvider}`
        return "No chatbot, no booking system — 24/7 leads are slipping through"
      }
      const v = effectiveAudit.chatbotPresence
      if (v < 15) return "No automation detected"
      if (v < 35) return "Basic automation only"
      return "Has some chatbot or automation"
    }

    const speedTip = () => {
      if (signals) {
        const parts = [`${signals.responseTimeMs}ms TTFB`, `${signals.htmlSizeKb}KB HTML`, `${signals.scriptCount} scripts`]
        return parts.join(" · ")
      }
      const v = effectiveAudit.pageSpeed
      if (v < 30) return "Likely slow"
      if (v < 60) return "Average speed"
      return "Reasonable load speed"
    }

    const socialTip = () => {
      if (signals) {
        if (signals.socialLinkCount === 0) return "No social profiles linked from site"
        return `${signals.socialLinkCount} platform${signals.socialLinkCount !== 1 ? "s" : ""}: ` +
          signals.socialLinks.slice(0, 4).join(", ")
      }
      const v = effectiveAudit.socialPresence
      if (v < 20) return "Minimal social signals"
      if (v < 45) return "Some social activity"
      return "Active social presence"
    }

    return [
      { label: "SEO Score",            value: effectiveAudit.seo,                icon: Search,     gradient: scoreGradient(effectiveAudit.seo),                tip: seoTip()     },
      { label: "Mobile Friendliness",  value: effectiveAudit.mobileFriendliness, icon: Smartphone, gradient: scoreGradient(effectiveAudit.mobileFriendliness), tip: mobileTip()  },
      { label: "AI Chatbot Presence",  value: effectiveAudit.chatbotPresence,    icon: Bot,        gradient: scoreGradient(effectiveAudit.chatbotPresence),    tip: chatbotTip() },
      { label: "Page Speed",           value: effectiveAudit.pageSpeed,          icon: Gauge,      gradient: scoreGradient(effectiveAudit.pageSpeed),          tip: speedTip()   },
      { label: "Social Presence",      value: effectiveAudit.socialPresence,     icon: Share2,     gradient: scoreGradient(effectiveAudit.socialPresence),     tip: socialTip()  },
    ]
  }, [effectiveAudit, signals])

  const recommendations = useMemo(() => {
    const recs: { icon: typeof Globe; title: string; desc: string; priority: string }[] = []

    if (lead.status === "No Website") {
      recs.push({ icon: Globe, title: "Build a Professional Website", priority: "critical",
        desc: "Zero digital presence. A conversion-optimised site is priority #1 — without this, you cannot be found online." })
    } else if (signals) {
      // Evidence-based recommendations from real audit
      if (!signals.isHttps) {
        recs.push({ icon: ShieldCheck, title: "Migrate to HTTPS", priority: "critical",
          desc: "Site is served over HTTP. Google flags this as 'Not Secure' in Chrome — kills trust and ranking." })
      }
      if (!signals.hasViewport) {
        recs.push({ icon: Smartphone, title: "Add Mobile Viewport", priority: "critical",
          desc: "Missing <meta name='viewport'> — site renders as a desktop layout on phones. Mobile users will bounce." })
      }
      if (!signals.chatbotProvider && !signals.bookingProvider) {
        recs.push({ icon: Bot, title: "Deploy AI Chatbot or Booking", priority: "high",
          desc: "No chatbot or booking system detected. 60%+ of leads arrive after hours — they go unanswered." })
      }
      if (!signals.hasMetaDescription || !signals.hasTitle) {
        recs.push({ icon: Search, title: "Fix Core SEO Meta Tags", priority: "high",
          desc: `Missing ${!signals.hasTitle ? "<title>" : "meta description"}. These are the basics Google needs to rank you.` })
      }
      if (!signals.hasSchemaMarkup) {
        recs.push({ icon: Code2, title: "Add Schema.org Markup", priority: "medium",
          desc: "No structured data found. LocalBusiness schema is essential for local SEO and rich snippets." })
      }
      if (signals.responseTimeMs > 3000 || signals.htmlSizeKb > 400) {
        recs.push({ icon: Gauge, title: "Fix Page Speed", priority: "medium",
          desc: `${signals.responseTimeMs}ms response, ${signals.htmlSizeKb}KB HTML. Slow sites lose 53% of mobile visitors.` })
      }
      if (signals.imgWithoutAlt > 3) {
        recs.push({ icon: ImageIcon, title: "Add Image Alt Text", priority: "low",
          desc: `${signals.imgWithoutAlt} images missing alt text. Hurts SEO and accessibility.` })
      }
      if (signals.socialLinkCount === 0) {
        recs.push({ icon: Share2, title: "Link Social Profiles", priority: "low",
          desc: "No social media links on the site. Add them to build trust and reach." })
      }
    } else {
      // Pre-audit fallback (synthetic)
      if (lead.status === "Old Website") {
        recs.push({ icon: Wrench, title: "Rebuild or Modernise Website", priority: "high",
          desc: "Old sites hurt credibility and mobile conversion. Relaunch with a modern, fast, HTTPS stack." })
      }
      if ((effectiveAudit.chatbotPresence ?? 0) < 15) {
        recs.push({ icon: Bot, title: "Deploy AI Chatbot", priority: "high",
          desc: "Capture and qualify leads 24/7. Most bookings happen outside business hours — you're losing them." })
      }
    }

    if (recs.length === 0) {
      recs.push({ icon: Zap, title: "Advanced CRM Automation", priority: "growth",
        desc: "Business is mature digitally. Recommend follow-up sequences, upsell automation and Google Ads." })
    }
    return recs
  }, [lead, signals, effectiveAudit])

  const priorityStyle: Record<string, string> = {
    critical: "text-red-400 bg-red-500/[0.08] border-red-500/20",
    high:     "text-orange-400 bg-orange-500/[0.08] border-orange-500/20",
    medium:   "text-yellow-400 bg-yellow-500/[0.08] border-yellow-500/20",
    growth:   "text-cyan-400 bg-cyan-500/[0.08] border-cyan-500/20",
  }

  return (
    <div className="h-full flex flex-col bg-[#060912]/98 backdrop-blur-2xl border-l border-white/[0.08] shadow-[-8px_0_40px_rgba(0,0,0,0.6)] overflow-hidden">

      {/* Header */}
      <div className="px-5 pt-4 pb-4 border-b border-white/[0.07] bg-gradient-to-b from-white/[0.025] to-transparent shrink-0">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              {lead.isCustom && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/20">
                  Custom
                </span>
              )}
              {verified && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  <ShieldCheck className="w-2.5 h-2.5" /> Verified
                </span>
              )}
              {isAuditing && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" /> Scanning Site…
                </span>
              )}
            </div>
            <h2 className="font-bold text-[15px] text-white leading-snug line-clamp-2 mb-2">{lead.name}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border",
                config.bgColor, config.color, "border-current/20"
              )}>
                <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
                {config.label}
              </span>
              {lead.category && (
                <span className="text-[10px] text-white/30 uppercase tracking-wider font-mono">{lead.category}</span>
              )}
            </div>
          </div>
          <div className="flex items-start gap-1.5 shrink-0">
            <ScoreRing score={overallScore} />
            <Button variant="ghost" size="icon" onClick={onClose}
              className="w-8 h-8 text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-3 mb-1 bg-white/[0.04] border border-white/[0.07] h-9 shrink-0 rounded-xl p-[3px]">
          <TabsTrigger value="overview"
            className="flex-1 text-xs rounded-lg data-[state=active]:bg-white/[0.10] data-[state=active]:text-white data-[state=active]:shadow-sm text-white/40 transition-all cursor-pointer">
            Overview
          </TabsTrigger>
          <TabsTrigger value="health"
            className="flex-1 text-xs rounded-lg data-[state=active]:bg-white/[0.10] data-[state=active]:text-white data-[state=active]:shadow-sm text-white/40 transition-all cursor-pointer">
            Health Audit
          </TabsTrigger>
          <TabsTrigger value="outreach"
            className="flex-1 text-xs rounded-lg data-[state=active]:bg-white/[0.10] data-[state=active]:text-white data-[state=active]:shadow-sm text-white/40 transition-all cursor-pointer">
            Outreach
          </TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW ── */}
        <TabsContent value="overview" className="flex-1 overflow-auto px-4 py-4 space-y-4 mt-0">

          {/* Revenue leak */}
          <div className="p-4 rounded-2xl bg-red-500/[0.07] border border-red-500/20 shadow-[0_0_24px_rgba(239,68,68,0.06)]">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-400 font-mono">Monthly Revenue Leak</span>
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-3xl font-black text-white font-mono">${revenueLeak.toLocaleString()}</span>
              <span className="text-sm text-white/30">/month</span>
            </div>
            <p className="text-[10px] text-white/30 font-mono">
              Est. from {lead.reviews} reviews × visitor conversion gap
            </p>
          </div>

          {/* Contact & info */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/25 font-mono">Contact & Info</h3>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 shrink-0" />
                <span className="text-sm font-bold text-white font-mono">{lead.rating}</span>
                <span className="text-xs text-white/35 font-mono">({lead.reviews} reviews)</span>
                <div className="ml-auto flex gap-px">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={cn("w-3 h-3", i < Math.round(lead.rating) ? "text-yellow-500 fill-yellow-500" : "text-white/10")} />
                  ))}
                </div>
              </div>
              {lead.phone && (
                <a href={`tel:${lead.phone}`}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:border-cyan-500/25 hover:bg-cyan-500/[0.04] transition-all duration-150 group cursor-pointer">
                  <Phone className="w-4 h-4 text-white/35 group-hover:text-cyan-400 shrink-0 transition-colors" />
                  <span className="text-sm text-white/60 group-hover:text-white font-mono transition-colors">{lead.phone}</span>
                </a>
              )}
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                <Globe className="w-4 h-4 text-white/35 shrink-0" />
                {lead.website ? (
                  <a href={lead.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 truncate transition-colors cursor-pointer">
                    <span className="truncate font-mono text-xs">{lead.website.replace(/^https?:\/\//, '').replace(/\?.*/, '').slice(0, 38)}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm text-red-400/80 italic">
                    <AlertTriangle className="w-3.5 h-3.5" /> No website detected
                  </span>
                )}
              </div>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.name)}`}
                target="_blank"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:border-cyan-500/25 hover:bg-cyan-500/[0.04] transition-all duration-150 group cursor-pointer">
                <Map className="w-4 h-4 text-white/35 group-hover:text-cyan-400 shrink-0 transition-colors" />
                <span className="text-sm text-white/40 group-hover:text-white transition-colors">View on Google Maps</span>
                <ExternalLink className="w-3 h-3 text-white/15 group-hover:text-white/50 ml-auto transition-colors" />
              </a>
            </div>
          </div>

          {/* Quick 5-point grid */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3.5 font-mono">5-Point Audit</h3>
            <div className="space-y-2.5">
              {auditItems.map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <item.icon className="w-3.5 h-3.5 text-white/30 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-white/50">{item.label}</span>
                      <span className={cn("font-bold font-mono",
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

        {/* ── HEALTH AUDIT ── */}
        <TabsContent value="health" className="flex-1 overflow-auto px-4 py-4 space-y-5 mt-0">

          {/* Evidence panel — only when verified */}
          {signals && (
            <div className="rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/20 p-3.5 space-y-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 font-mono">Live Site Evidence</span>
                <span className="ml-auto text-[9px] text-white/30 font-mono">{signals.responseTimeMs}ms</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <EvidenceRow label="HTTPS"           ok={signals.isHttps} />
                <EvidenceRow label="Mobile viewport"  ok={signals.hasViewport} />
                <EvidenceRow label="Title tag"       ok={signals.hasTitle} detail={signals.hasTitle ? `${signals.titleLength}c` : undefined} />
                <EvidenceRow label="Meta description" ok={signals.hasMetaDescription} detail={signals.hasMetaDescription ? `${signals.metaDescriptionLength}c` : undefined} />
                <EvidenceRow label="OpenGraph"       ok={signals.hasOgTags} />
                <EvidenceRow label="Canonical URL"   ok={signals.hasCanonical} />
                <EvidenceRow label="Schema markup"   ok={signals.hasSchemaMarkup} />
                <EvidenceRow label="H1 tag"          ok={signals.h1Count === 1} detail={signals.h1Count !== 1 ? `${signals.h1Count} found` : undefined} />
                <EvidenceRow label="Modern framework" ok={signals.usesModernFramework} />
                <EvidenceRow label="PWA manifest"    ok={signals.hasManifest} />
              </div>
              {(signals.chatbotProvider || signals.bookingProvider || signals.analyticsProvider) && (
                <div className="pt-2 border-t border-emerald-500/15 space-y-1">
                  {signals.chatbotProvider && (
                    <div className="flex items-center gap-2 text-[10px]">
                      <Bot className="w-3 h-3 text-cyan-400" />
                      <span className="text-white/45">Chatbot:</span>
                      <span className="font-mono text-cyan-400">{signals.chatbotProvider}</span>
                    </div>
                  )}
                  {signals.bookingProvider && (
                    <div className="flex items-center gap-2 text-[10px]">
                      <Calendar className="w-3 h-3 text-emerald-400" />
                      <span className="text-white/45">Booking:</span>
                      <span className="font-mono text-emerald-400">{signals.bookingProvider}</span>
                    </div>
                  )}
                  {signals.analyticsProvider && (
                    <div className="flex items-center gap-2 text-[10px]">
                      <Activity className="w-3 h-3 text-purple-400" />
                      <span className="text-white/45">Analytics:</span>
                      <span className="font-mono text-purple-400">{signals.analyticsProvider}</span>
                    </div>
                  )}
                </div>
              )}
              {signals.socialLinks.length > 0 && (
                <div className="pt-2 border-t border-emerald-500/15 flex items-center gap-2 flex-wrap">
                  <Share2 className="w-3 h-3 text-white/40" />
                  {signals.socialLinks.map(p => (
                    <span key={p} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-white/55 border border-white/[0.08]">
                      {p}
                    </span>
                  ))}
                </div>
              )}
              <div className="pt-2 border-t border-emerald-500/15 grid grid-cols-3 gap-2 text-[9px] font-mono text-white/40">
                <span><Clock className="w-2.5 h-2.5 inline mr-0.5" />{signals.responseTimeMs}ms</span>
                <span><Code2 className="w-2.5 h-2.5 inline mr-0.5" />{signals.scriptCount} scripts</span>
                <span><ImageIcon className="w-2.5 h-2.5 inline mr-0.5" />{signals.imgCount} imgs</span>
              </div>
            </div>
          )}

          {/* No-website state */}
          {!signals && !lead.website && (
            <div className="rounded-2xl bg-red-500/[0.05] border border-red-500/20 p-4 text-center">
              <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <p className="text-xs text-white/70 font-semibold">No website to audit</p>
              <p className="text-[10px] text-white/35 mt-1">This business has zero digital presence — the entire pitch.</p>
            </div>
          )}

          {/* Loading state */}
          {isAuditing && !signals && lead.website && (
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-4 text-center">
              <Loader2 className="w-5 h-5 text-cyan-400 mx-auto mb-2 animate-spin" />
              <p className="text-xs text-white/65 font-mono">Fetching live site…</p>
              <p className="text-[10px] text-white/30 mt-1">Analysing HTML, scripts, meta tags</p>
            </div>
          )}

          {/* Audit error */}
          {signals && signals.error && (
            <div className="rounded-2xl bg-orange-500/[0.05] border border-orange-500/20 p-3.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span className="text-[11px] font-semibold text-orange-400">Live audit blocked</span>
              </div>
              <p className="text-[10px] text-white/45 mt-1.5 leading-relaxed">
                The site refused our request ({signals.error}). Many older or aggressively-firewalled
                sites block bot traffic — that alone is a strong signal of an outdated stack.
              </p>
            </div>
          )}

          {auditItems.map(item => (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <item.icon className="w-3.5 h-3.5 text-white/45" />
                  <span className="text-xs font-semibold text-white/70">{item.label}</span>
                </div>
                <span className={cn("text-sm font-black font-mono",
                  item.value >= 70 ? "text-emerald-400" : item.value >= 40 ? "text-orange-400" : "text-red-400"
                )}>{item.value}%</span>
              </div>
              <div className="h-2 w-full bg-white/[0.05] rounded-full overflow-hidden">
                <div className={cn("h-full bg-gradient-to-r transition-all duration-1000 rounded-full", item.gradient)}
                  style={{ width: `${Math.max(item.value, 2)}%` }} />
              </div>
              <p className="text-[10px] text-white/30 leading-relaxed">{item.tip}</p>
            </div>
          ))}

          <div className="h-px bg-white/[0.07]" />

          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30 flex items-center gap-2 font-mono">
              <BarChart3 className="w-3.5 h-3.5" /> Strategic Recommendations
            </h3>
            {recommendations.map((rec, i) => (
              <div key={i} className={cn("flex items-start gap-3 p-3.5 rounded-xl border", priorityStyle[rec.priority] ?? "bg-white/[0.04] border-white/[0.08]")}>
                <rec.icon className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white leading-tight">{rec.title}</p>
                  <p className="text-[10px] text-white/45 mt-1 leading-relaxed">{rec.desc}</p>
                </div>
                <span className="text-[8px] font-bold uppercase tracking-wider shrink-0 opacity-50 mt-0.5 font-mono">{rec.priority}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── OUTREACH ── */}
        <TabsContent value="outreach" className="flex-1 overflow-auto px-4 py-4 space-y-4 mt-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">AI-Generated Pitch Email</h3>
          </div>
          <div className="text-[11px] text-white/65 leading-relaxed bg-white/[0.03] rounded-2xl border border-white/[0.07] p-4 font-mono whitespace-pre-wrap">
            {pitchText}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Button
              className="h-10 bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(6,182,212,0.35)] transition-all cursor-pointer"
              onClick={handleCopy}>
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copied!" : "Copy Pitch"}
            </Button>
            <Button variant="outline"
              className="h-10 border-white/10 text-white/60 hover:text-white hover:bg-white/[0.05] hover:border-white/20 transition-all cursor-pointer" asChild>
              <a href={`mailto:?subject=${encodeURIComponent(`Quick question about ${lead.name}`)}&body=${encodeURIComponent(pitchText)}`}>
                <Mail className="w-4 h-4 mr-2" /> Open in Email
              </a>
            </Button>
          </div>
          <div className="h-px bg-white/[0.07]" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/25 font-mono">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            {lead.phone && (
              <a href={`tel:${lead.phone}`}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07] text-xs text-white/50 hover:text-white hover:border-white/18 hover:bg-white/[0.07] transition-all duration-150 cursor-pointer">
                <Phone className="w-3.5 h-3.5" /> Call Now
              </a>
            )}
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.name)}`}
              target="_blank"
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07] text-xs text-white/50 hover:text-white hover:border-white/18 hover:bg-white/[0.07] transition-all duration-150 cursor-pointer">
              <Map className="w-3.5 h-3.5" /> View on Maps
            </a>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EvidenceRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.02]">
      {ok
        ? <Check className="w-2.5 h-2.5 text-emerald-400 shrink-0" strokeWidth={3} />
        : <X     className="w-2.5 h-2.5 text-red-400/80 shrink-0" strokeWidth={3} />}
      <span className={cn("truncate", ok ? "text-white/55" : "text-white/35")}>{label}</span>
      {detail && <span className="ml-auto font-mono text-[9px] text-white/30">{detail}</span>}
    </div>
  )
}
