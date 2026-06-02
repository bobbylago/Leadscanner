"use client"

import { useCallback, useState, useMemo, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Lead } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  Mail, ExternalLink, X, Check, Eye, Send, Copy,
  Building2, AlertCircle, Sparkles, RotateCcw, User,
  Zap, Loader2,
} from "lucide-react"
import {
  guessEmail, bestEmailForLead, getDiscoveredEmailsForLead,
  renderTemplate, buildGmailUrl, buildMailtoUrl,
  getTemplate, ALL_LANGUAGES, languageName,
} from "@/lib/email-utils"
import { authedFetch } from "@/lib/api-client"
import type { BillingStatus } from "@/lib/billing-types"
import type { GeneratedOutreach, OutreachTone } from "@/lib/gemini-outreach"
import {
  emailPrefixesForCountry, languageForCountry, type LangCode,
} from "@/lib/country-utils"
import {
  loadContacted, markContacted, isContacted, findByLeadId, formatSentAgo,
  type ContactedMap,
} from "@/lib/contacted-storage"

interface BatchOutreachDialogProps {
  open: boolean
  onClose: () => void
  leads: Lead[]
  onBillingUpdate?: (status: BillingStatus) => void
  onLimitReached?: (status: BillingStatus) => void
}

type Mode = "compose" | "preview" | "sequence" | "blitz"
type GeneratedMap = Record<string, GeneratedOutreach>

const GENERATED_OUTREACH_KEY = "ls_generated_outreach_v9"

function loadGeneratedOutreach(): GeneratedMap {
  try { return JSON.parse(localStorage.getItem(GENERATED_OUTREACH_KEY) || "{}") } catch { return {} }
}

function saveGeneratedOutreach(data: GeneratedMap) {
  try { localStorage.setItem(GENERATED_OUTREACH_KEY, JSON.stringify(data)) } catch {}
}

export function BatchOutreachDialog({
  open,
  onClose,
  leads,
  onBillingUpdate,
  onLimitReached,
}: BatchOutreachDialogProps) {
  // Detect dominant language from selected leads (majority vote)
  const detectedLang = useMemo<LangCode>(() => {
    if (!leads.length) return "en"
    const counts: Record<string, number> = {}
    for (const l of leads) {
      const lang = languageForCountry(l.country)
      counts[lang] = (counts[lang] ?? 0) + 1
    }
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "en") as LangCode
  }, [leads])

  const [lang, setLang]           = useState<LangCode>(detectedLang)
  const [subject, setSubject]     = useState(getTemplate(detectedLang).subject)
  const [body, setBody]           = useState(getTemplate(detectedLang).body)
  const [prefix, setPrefix]       = useState<string>("info")
  const [senderName, setSenderName] = useState<string>("")
  const [contacted, setContacted] = useState<ContactedMap>({})
  const [allowResend, setAllowResend] = useState(false)
  // User edit tracking — so language switch doesn't blow away manual changes
  const [subjectEdited, setSubjectEdited] = useState(false)
  const [bodyEdited, setBodyEdited]       = useState(false)
  const [emails, setEmails]       = useState<Record<string, string>>({})
  const [skipped, setSkipped]     = useState<Set<string>>(new Set())
  const [mode, setMode]           = useState<Mode>("compose")
  const [previewIdx, setPreviewIdx] = useState(0)
  const [sentSet, setSentSet]     = useState<Set<string>>(new Set())
  const [sequenceIdx, setSequenceIdx] = useState(0)
  const [tone, setTone] = useState<OutreachTone>("direct")
  const [generatedOutreach, setGeneratedOutreach] = useState<GeneratedMap>({})
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [bulkGenerating, setBulkGenerating] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)
  const [generationError, setGenerationError] = useState("")
  const [blitzProgress, setBlitzProgress] = useState(0)
  const [blitzing, setBlitzing] = useState(false)
  const [blitzBlocked, setBlitzBlocked] = useState(0)

  // Country-aware email prefix list — picks Swedish "kontakt@" for SE leads, etc.
  const availablePrefixes = useMemo(() => {
    if (!leads.length) return ["info","contact","hello"] as readonly string[]
    // Use first lead's country for prefix suggestions
    return emailPrefixesForCountry(leads[0].country)
  }, [leads])

  // Load sender name from localStorage on first open
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const saved = localStorage.getItem("ls_sender_name")
      if (saved) setSenderName(saved)
    } catch {}
  }, [])

  // Sync contacted map (cross-tab + same-tab via custom event)
  useEffect(() => {
    setContacted(loadContacted())
    const refresh = () => setContacted(loadContacted())
    window.addEventListener("ls_contacted_changed", refresh)
    return () => window.removeEventListener("ls_contacted_changed", refresh)
  }, [open])

  // Save sender name on change
  useEffect(() => {
    if (typeof window === "undefined") return
    try { localStorage.setItem("ls_sender_name", senderName) } catch {}
  }, [senderName])

  // Init emails per lead when dialog opens / leads change
  useEffect(() => {
    if (!open) return
    setGeneratedOutreach(loadGeneratedOutreach())
    setGenerationError("")
    const map = loadContacted()
    const initial: Record<string, string> = {}
    const initialSkipped = new Set<string>()
    for (const lead of leads) {
      const guess = bestEmailForLead(lead, prefix)
      initial[lead.id] = guess
      if (!guess) initialSkipped.add(lead.id)
      // Auto-skip already-contacted leads (unless allowResend is on)
      else if (!allowResend && (findByLeadId(map, lead.id) || isContacted(map, { email: guess }))) {
        initialSkipped.add(lead.id)
      }
    }
    setEmails(initial)
    setSkipped(initialSkipped)
    setSentSet(new Set())
    setSequenceIdx(0)
    setBulkGenerating(false)
    setBulkProgress(null)
    setBlitzProgress(0)
    setBlitzBlocked(0)
    setBlitzing(false)
    setMode("compose")
    setLang(detectedLang)
    setSubject(getTemplate(detectedLang).subject)
    setBody(getTemplate(detectedLang).body)
    setSubjectEdited(false)
    setBodyEdited(false)
  }, [open, leads, detectedLang, allowResend, prefix])

  // Switch template when language changes (only if user hasn't edited)
  useEffect(() => {
    if (!open) return
    const tpl = getTemplate(lang)
    if (!subjectEdited) setSubject(tpl.subject)
    if (!bodyEdited) setBody(tpl.body)
  }, [bodyEdited, lang, open, subjectEdited])

  // Rebuild emails when prefix changes
  useEffect(() => {
    if (!open) return
    setEmails(prev => {
      const next: Record<string, string> = { ...prev }
      for (const lead of leads) {
        const cur = next[lead.id]
        const allPrefixes = [...availablePrefixes, "info","contact","hello","office","team","admin"]
        const guessedAny = allPrefixes.some(p => guessEmail(lead.website, p) === cur)
        const discoveredAny = cur ? getDiscoveredEmailsForLead(lead).includes(cur) : false
        if (guessedAny || discoveredAny || !cur) next[lead.id] = bestEmailForLead(lead, prefix)
      }
      return next
    })
  }, [prefix, leads, open, availablePrefixes])

  const validLeads = useMemo(() =>
    leads.filter(l => !skipped.has(l.id) && emails[l.id]?.includes("@")),
    [leads, skipped, emails]
  )

  const generatedCount = useMemo(
    () => validLeads.filter(lead => !!generatedOutreach[lead.id]).length,
    [generatedOutreach, validLeads],
  )

  const remainingToGenerate = Math.max(0, validLeads.length - generatedCount)

  // Already-contacted leads in this batch
  const alreadyContactedLeads = useMemo(() => {
    return leads.filter(l => {
      const email = emails[l.id]
      return findByLeadId(contacted, l.id) || (email && isContacted(contacted, { email }))
    })
  }, [leads, emails, contacted])

  const previewLead = validLeads[previewIdx] ?? validLeads[0]
  const subjectForLead = useCallback((lead: Lead) =>
    generatedOutreach[lead.id]?.subject ?? renderTemplate(subject, lead, { senderName })
  , [generatedOutreach, senderName, subject])

  const bodyForLead = useCallback((lead: Lead) =>
    generatedOutreach[lead.id]?.body ?? renderTemplate(body, lead, { senderName })
  , [body, generatedOutreach, senderName])

  const renderedSubject = previewLead ? subjectForLead(previewLead) : subject
  const renderedBody    = previewLead ? bodyForLead(previewLead) : body

  const buildUrlForLead = useCallback((lead: Lead, type: "gmail" | "mailto") => {
    const opts = {
      to: emails[lead.id] ?? "",
      subject: subjectForLead(lead),
      body: bodyForLead(lead),
    }
    return type === "gmail" ? buildGmailUrl(opts) : buildMailtoUrl(opts)
  }, [bodyForLead, emails, subjectForLead])

  const markLeadOpened = useCallback((lead: Lead) => {
    const email = emails[lead.id] ?? ""
    const renderedSubject = subjectForLead(lead)
    setSentSet(prev => new Set(prev).add(lead.id))
    // Persist as contacted so future scans don't double-send
    if (email.includes("@")) {
      setContacted(prev => markContacted(prev, {
        email, leadId: lead.id, leadName: lead.name, subject: renderedSubject,
      }))
    }
  }, [emails, subjectForLead])

  const openLead = useCallback((lead: Lead) => {
    setGenerationError("")
    const popup = window.open("about:blank", "_blank")
    if (!popup) {
      setGenerationError("Popup blocked. Allow popups for this site, then try again.")
      return false
    }

    try { popup.opener = null } catch {}
    popup.location.href = buildUrlForLead(lead, "gmail")
    markLeadOpened(lead)
    return true
  }, [buildUrlForLead, markLeadOpened])

  const requestGeneratedOutreach = useCallback(async (lead: Lead): Promise<GeneratedOutreach> => {
    const res = await authedFetch("/api/outreach/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead,
        senderName,
        tone,
        subjectTemplate: subject,
        bodyTemplate: body,
      }),
    })
    const data = await res.json().catch(() => null)
    if (res.status === 402 && data?.billing) {
      onLimitReached?.(data.billing)
    }
    if (!res.ok) throw new Error(data?.error || "Could not generate outreach")
    if (data?.billing) onBillingUpdate?.(data.billing)
    return { subject: data.subject, body: data.body }
  }, [body, onBillingUpdate, onLimitReached, senderName, subject, tone])

  const saveGeneratedForLead = useCallback((lead: Lead, generated: GeneratedOutreach) => {
    setGeneratedOutreach(prev => {
      const next = {
        ...prev,
        [lead.id]: generated,
      }
      saveGeneratedOutreach(next)
      return next
    })
  }, [])

  const generateForLead = async (lead: Lead) => {
    setGeneratingId(lead.id)
    setGenerationError("")

    try {
      saveGeneratedForLead(lead, await requestGeneratedOutreach(lead))
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Could not generate outreach")
    } finally {
      setGeneratingId(null)
    }
  }

  const generateAllSelected = async () => {
    if (bulkGenerating || validLeads.length === 0) return

    setBulkGenerating(true)
    setGenerationError("")
    setBulkProgress({ done: 0, total: validLeads.length })

    try {
      for (let i = 0; i < validLeads.length; i++) {
        const lead = validLeads[i]
        setGeneratingId(lead.id)
        const generated = await requestGeneratedOutreach(lead)
        saveGeneratedForLead(lead, generated)
        setBulkProgress({ done: i + 1, total: validLeads.length })
      }
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Could not generate every selected lead")
    } finally {
      setGeneratingId(null)
      setBulkGenerating(false)
      setTimeout(() => setBulkProgress(null), 1200)
    }
  }

  const handleSequenceNext = useCallback(() => {
    if (sequenceIdx >= validLeads.length - 1) {
      setMode("compose")
      return
    }
    setSequenceIdx(sequenceIdx + 1)
  }, [sequenceIdx, validLeads.length])

  const handleSequenceSkip = useCallback(() => {
    handleSequenceNext()
  }, [handleSequenceNext])

  const handleSequenceOpenAndNext = useCallback(() => {
    const lead = validLeads[sequenceIdx]
    if (lead) openLead(lead)
    setTimeout(() => handleSequenceNext(), 200)
  }, [handleSequenceNext, openLead, sequenceIdx, validLeads])

  // Keyboard shortcuts for sequence mode (Enter = open & next, S = skip)
  useEffect(() => {
    if (!open || mode !== "sequence") return
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in an input
      const target = e.target as HTMLElement
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return
      if (e.key === "Enter") { e.preventDefault(); handleSequenceOpenAndNext() }
      else if (e.key.toLowerCase() === "s") { e.preventDefault(); handleSequenceSkip() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [handleSequenceOpenAndNext, handleSequenceSkip, mode, open])

  // Blitz opens tabs immediately from the user click to avoid popup blockers.
  const handleBlitz = (batchSize: number = 5) => {
    setBlitzing(true)
    setBlitzProgress(0)
    setBlitzBlocked(0)
    setGenerationError("")
    const remaining = validLeads.filter(l => !sentSet.has(l.id)).slice(0, batchSize)
    let opened = 0
    let blocked = 0
    for (let i = 0; i < remaining.length; i++) {
      const lead = remaining[i]
      const popup = window.open("about:blank", "_blank")
      if (!popup) {
        blocked += 1
        continue
      }

      try { popup.opener = null } catch {}
      popup.location.href = buildUrlForLead(lead, "gmail")
      markLeadOpened(lead)
      opened += 1
    }
    setBlitzProgress(opened)
    setBlitzBlocked(blocked)
    if (blocked > 0) {
      setGenerationError(`${blocked} Gmail tab${blocked === 1 ? "" : "s"} were blocked. Allow popups for this site and try Blitz again.`)
    }
    setBlitzing(false)
  }

  const handleCopyEmails = () => {
    const list = validLeads.map(l => emails[l.id]).filter(Boolean).join(", ")
    navigator.clipboard.writeText(list)
  }

  const toggleSkip = (id: string) => {
    setSkipped(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  if (!leads.length) return null

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="bg-slate-900 border-white/10 text-white max-w-3xl flex flex-col p-0 overflow-hidden"
        style={{ maxHeight: "92vh", width: "min(95vw, 768px)" }}>

        <DialogHeader className="px-6 pt-5 pb-4 border-b border-white/[0.07] shrink-0">
          <DialogTitle className="flex items-center gap-2.5 text-white text-sm">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-cyan-400" />
            </div>
            Batch Outreach
            <span className="ml-2 text-[10px] font-normal text-white/40 font-mono">
              {validLeads.length} valid · {skipped.size} skipped
            </span>
            <div className="ml-auto flex items-center gap-1">
              {(["compose", "preview", "sequence", "blitz"] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  disabled={validLeads.length === 0}
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1",
                    mode === m
                      ? m === "blitz"
                        ? "bg-orange-500/15 text-orange-400 border border-orange-500/30"
                        : "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                      : "bg-white/[0.04] text-white/40 border border-white/[0.06] hover:text-white/70"
                  )}
                >
                  {m === "blitz" && <Zap className="w-2.5 h-2.5" />}
                  {m === "compose" ? "Compose" : m === "preview" ? "Preview" : m === "sequence" ? "Sequence" : "Blitz"}
                </button>
              ))}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* ── BODY ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* ── COMPOSE MODE ────────────────────────────── */}
          {mode === "compose" && (
            <div className="px-6 py-5 space-y-5">
              {/* Sender name — required for {senderName} substitution */}
              <div className="space-y-2 p-3 rounded-xl bg-cyan-500/[0.04] border border-cyan-500/15">
                <Label className="text-[10px] text-cyan-400/90 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <User className="w-3 h-3" /> Your name
                  <span className="text-white/30 normal-case tracking-normal ml-1">· signs every email, saved on this device</span>
                </Label>
                <Input
                  value={senderName}
                  onChange={e => setSenderName(e.target.value)}
                  placeholder="e.g. Viggo Pettersson"
                  className="h-9 bg-white/[0.05] border-white/[0.10] text-white text-sm focus:border-cyan-500/40"
                />
              </div>

              {/* Template editor */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white/60 font-mono">Template + AI personalization</h3>
                  <button
                    onClick={() => {
                      const tpl = getTemplate(lang)
                      setSubject(tpl.subject); setBody(tpl.body)
                      setSubjectEdited(false); setBodyEdited(false)
                    }}
                    className="ml-auto text-[10px] text-white/40 hover:text-white/70 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                </div>
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.045] p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-violet-300" />
                    <span className="text-xs font-bold text-white">Gemini per-lead personalization</span>
                    <span className="ml-auto text-[10px] text-white/35 font-mono">
                      cached after generation
                    </span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-white/45">
                    Templates stay as the fallback. Generate one lead, or generate every selected lead before Sequence or Blitz.
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(["direct", "friendly", "premium"] as OutreachTone[]).map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setTone(option)}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-[10px] font-bold capitalize transition-colors",
                          tone === option
                            ? "border-violet-300/40 bg-violet-300/15 text-violet-200"
                            : "border-white/[0.08] bg-white/[0.035] text-white/45 hover:text-white"
                        )}
                      >
                        {option === "premium" ? "Premium agency" : option}
                      </button>
                    ))}
                    <Button
                      type="button"
                      onClick={generateAllSelected}
                      disabled={bulkGenerating || validLeads.length === 0}
                      className="ml-auto h-7 rounded-md bg-violet-300 px-2.5 text-[10px] font-black text-slate-950 hover:bg-violet-200 disabled:opacity-45"
                    >
                      {bulkGenerating ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1.5 h-3 w-3" />
                      )}
                      Generate all ({validLeads.length})
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/38">
                    <span className="font-mono">{generatedCount}/{validLeads.length} AI scripts ready</span>
                    {remainingToGenerate > 0 && (
                      <span>{remainingToGenerate} still using template fallback</span>
                    )}
                    {bulkProgress && (
                      <span className="text-violet-200 font-mono">
                        generating {bulkProgress.done}/{bulkProgress.total}
                      </span>
                    )}
                  </div>
                  {generationError && (
                    <p className="text-[10px] text-red-300">{generationError}</p>
                  )}
                </div>
                {/* Language picker */}
                <div className="space-y-2">
                  <Label className="text-[10px] text-white/45 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    Language
                    {lang === detectedLang && (
                      <span className="text-emerald-400/70 normal-case tracking-normal">· auto-detected from leads</span>
                    )}
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {ALL_LANGUAGES.map(l => (
                      <button
                        key={l}
                        onClick={() => setLang(l)}
                        className={cn(
                          "text-[10px] font-mono px-2 py-1 rounded-md border transition-all cursor-pointer",
                          lang === l
                            ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                            : "bg-white/[0.03] text-white/45 border-white/[0.07] hover:border-white/15 hover:text-white/70"
                        )}
                      >
                        {languageName(l)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] text-white/45 uppercase tracking-wider font-mono">Subject</Label>
                  <Input
                    value={subject}
                    onChange={e => { setSubject(e.target.value); setSubjectEdited(true) }}
                    className="h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm focus:border-cyan-500/40 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] text-white/45 uppercase tracking-wider font-mono">Body</Label>
                  <Textarea
                    value={body}
                    onChange={e => { setBody(e.target.value); setBodyEdited(true) }}
                    rows={10}
                    className="bg-white/[0.04] border-white/[0.08] text-white text-xs focus:border-cyan-500/40 font-mono resize-y leading-relaxed"
                  />
                </div>
                <div className="flex items-center flex-wrap gap-1 text-[10px] text-white/35">
                  <span className="font-mono uppercase tracking-wider mr-2">Variables:</span>
                  {["{name}","{category}","{website}","{domain}","{phone}","{rating}","{revenueLeak}","{healthScore}","{issues}"].map(v => (
                    <button
                      key={v}
                      onClick={() => navigator.clipboard.writeText(v)}
                      title="Copy to clipboard"
                      className="font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.07] hover:border-cyan-500/30 hover:text-cyan-400 cursor-pointer transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Email prefix selector — country-aware */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/60 font-mono">
                  Email Pattern
                  <span className="ml-2 text-white/30 normal-case tracking-normal">· localised for {lang.toUpperCase()}</span>
                </h3>
                <div className="flex items-center gap-1 flex-wrap">
                  {availablePrefixes.map(p => (
                    <button
                      key={p}
                      onClick={() => setPrefix(p)}
                      className={cn(
                        "text-[10px] font-mono px-2 py-1 rounded-md border transition-all cursor-pointer",
                        prefix === p
                          ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                          : "bg-white/[0.04] text-white/45 border-white/[0.07] hover:border-white/15 hover:text-white/70"
                      )}
                    >
                      {p}@…
                    </button>
                  ))}
                </div>
              </div>

              {/* Already-contacted warning banner */}
              {alreadyContactedLeads.length > 0 && (
                <div className="rounded-xl bg-amber-500/[0.07] border border-amber-500/25 px-3.5 py-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-xs font-semibold text-amber-400">
                      {alreadyContactedLeads.length} lead{alreadyContactedLeads.length !== 1 ? "s" : ""} already contacted
                    </span>
                  </div>
                  <p className="text-[10px] text-white/45 leading-relaxed">
                    {allowResend
                      ? "Re-send is enabled. Duplicates will not be skipped."
                      : "Auto-skipped so you don't accidentally double-send. Toggle below to override."}
                  </p>
                  <button
                    onClick={() => setAllowResend(v => !v)}
                    className={cn(
                      "text-[10px] font-mono px-2.5 py-1 rounded-md border transition-all cursor-pointer",
                      allowResend
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-white/[0.04] text-white/55 border-white/[0.10] hover:text-white"
                    )}
                  >
                    {allowResend ? "✓ Allow re-send" : "Allow re-send"}
                  </button>
                </div>
              )}

              {/* Recipient list */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white/60 font-mono">Recipients</h3>
                  <button onClick={handleCopyEmails}
                    className="text-[10px] text-white/40 hover:text-cyan-400 flex items-center gap-1 cursor-pointer transition-colors">
                    <Copy className="w-3 h-3" /> Copy all emails
                  </button>
                </div>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {leads.map(lead => {
                    const isSkipped = skipped.has(lead.id)
                    const email = emails[lead.id] ?? ""
                    const isValid = email.includes("@")
                    const foundOnSite = getDiscoveredEmailsForLead(lead).includes(email.toLowerCase().trim())
                    const contactRec = findByLeadId(contacted, lead.id) ?? (email ? contacted[email.toLowerCase().trim()] : null) ?? null
                    return (
                      <div key={lead.id} className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                        isSkipped
                          ? "bg-white/[0.02] border-white/[0.04] opacity-40"
                          : contactRec
                            ? "bg-amber-500/[0.04] border-amber-500/20"
                            : "bg-white/[0.04] border-white/[0.07]"
                      )}>
                        <Building2 className="w-3.5 h-3.5 text-white/30 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold text-white truncate">{lead.name}</p>
                            {contactRec && (
                              <span title={`Sent ${formatSentAgo(contactRec.sentAt)}`}
                                className="shrink-0 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                                Sent {formatSentAgo(contactRec.sentAt)}
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] text-white/30 truncate font-mono">
                            {lead.website ? lead.website.replace(/^https?:\/\//, "").split("/")[0] : "no website"}
                            {foundOnSite && <span className="ml-1.5 text-emerald-300/80">found on site</span>}
                          </p>
                        </div>
                        <Input
                          value={email}
                          onChange={e => setEmails(prev => ({ ...prev, [lead.id]: e.target.value }))}
                          placeholder={lead.website ? "email@…" : "no website detected"}
                          disabled={isSkipped}
                          className={cn(
                            "h-7 w-52 bg-white/[0.04] border-white/[0.08] text-white text-[11px] focus:border-cyan-500/40 font-mono",
                            !isValid && !isSkipped && "border-red-500/30"
                          )}
                        />
                        <button onClick={() => toggleSkip(lead.id)}
                          className={cn(
                            "shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer",
                            isSkipped
                              ? "bg-white/[0.04] text-white/30 hover:text-white/60"
                              : "bg-red-500/[0.08] text-red-400/80 hover:bg-red-500/15"
                          )}
                          title={isSkipped ? "Include" : "Skip"}
                        >
                          {isSkipped ? <RotateCcw className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── PREVIEW MODE ────────────────────────────── */}
          {mode === "preview" && previewLead && (
            <div className="px-6 py-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/60 font-mono">
                  Preview {previewIdx + 1} / {validLeads.length}
                </h3>
                <div className="ml-auto flex gap-1">
                  <button
                    onClick={() => setPreviewIdx(Math.max(0, previewIdx - 1))}
                    disabled={previewIdx === 0}
                    className="text-[10px] px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.07] text-white/55 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >← Prev</button>
                  <button
                    onClick={() => setPreviewIdx(Math.min(validLeads.length - 1, previewIdx + 1))}
                    disabled={previewIdx >= validLeads.length - 1}
                    className="text-[10px] px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.07] text-white/55 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >Next →</button>
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-xl border border-violet-500/20 bg-violet-500/[0.045] px-3 py-2 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white">
                    {generatedOutreach[previewLead.id] ? "AI personalized email ready" : "Generate a unique email for this lead"}
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/40">
                    Tone: {tone === "premium" ? "Premium agency" : tone}
                  </p>
                </div>
                <Button
                  onClick={() => generateForLead(previewLead)}
                  disabled={generatingId === previewLead.id}
                  className="h-8 shrink-0 bg-violet-400 text-slate-950 text-xs font-bold hover:bg-violet-300 disabled:opacity-50"
                >
                  {generatingId === previewLead.id ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {generatedOutreach[previewLead.id] ? "Regenerate" : "Generate with Gemini"}
                </Button>
              </div>
              {generationError && (
                <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                  {generationError}
                </div>
              )}

              <div className="rounded-xl bg-[#0d1117] border border-white/[0.08] p-4 space-y-3">
                <div className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1.5 text-xs">
                  <span className="text-white/35 font-mono">To:</span>
                  <span className="text-white font-mono">{emails[previewLead.id]}</span>
                  <span className="text-white/35 font-mono">Subject:</span>
                  <span className="text-white font-semibold">{renderedSubject}</span>
                </div>
                <div className="h-px bg-white/[0.07]" />
                <pre className="text-[12px] text-white/80 whitespace-pre-wrap font-sans leading-relaxed">
                  {renderedBody}
                </pre>
              </div>

              <Button onClick={() => openLead(previewLead)}
                className="w-full bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold hover:scale-[1.01] transition-all cursor-pointer">
                <ExternalLink className="w-4 h-4 mr-1.5" />
                Open in Gmail
              </Button>
            </div>
          )}

          {/* ── SEQUENCE MODE ───────────────────────────── */}
          {mode === "sequence" && (
            validLeads.length === 0 ? (
              <div className="px-6 py-12 text-center text-white/40 text-sm">No valid recipients</div>
            ) : sequenceIdx >= validLeads.length ? (
              <div className="px-6 py-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6 text-emerald-400" strokeWidth={2.5} />
                </div>
                <p className="text-sm font-bold text-white">All done</p>
                <p className="text-[11px] text-white/45">{sentSet.size} emails opened in Gmail</p>
                <Button onClick={() => setMode("compose")} variant="ghost"
                  className="border border-white/10 text-white/60 hover:text-white cursor-pointer">
                  Back to compose
                </Button>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-4">
                {/* Progress */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-mono text-white/40">
                    <span>Lead {sequenceIdx + 1} / {validLeads.length}</span>
                    <span>{sentSet.size} sent</span>
                  </div>
                  <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-300"
                      style={{ width: `${(sequenceIdx / validLeads.length) * 100}%` }} />
                  </div>
                </div>

                {/* Current lead card */}
                {(() => {
                  const cur = validLeads[sequenceIdx]
                  if (!cur) return null
                  return (
                    <div className="rounded-2xl bg-[#0d1117] border border-cyan-500/20 p-4 space-y-3 shadow-[0_0_20px_rgba(6,182,212,0.08)]">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-white">{cur.name}</p>
                          <p className="text-[10px] text-white/40 mt-0.5">
                            {cur.category} · {cur.phone ?? "no phone"}
                          </p>
                        </div>
                        {sentSet.has(cur.id) && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" /> Sent
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-[60px_1fr] gap-x-2 gap-y-1 text-[11px]">
                        <span className="text-white/35 font-mono">To:</span>
                        <span className="text-white font-mono">{emails[cur.id]}</span>
                        <span className="text-white/35 font-mono">Subject:</span>
                        <span className="text-white font-semibold truncate">{subjectForLead(cur)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold text-white/70">
                            {generatedOutreach[cur.id] ? "AI personalized" : "Template fallback"}
                          </p>
                          <p className="text-[9px] text-white/35 truncate">
                            {generatedOutreach[cur.id] ? "This lead will use its generated copy." : "Generate with Gemini before opening if you want a unique email."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => generateForLead(cur)}
                          disabled={generatingId === cur.id}
                          className="shrink-0 rounded-md border border-violet-300/25 bg-violet-300/10 px-2.5 py-1 text-[10px] font-bold text-violet-200 transition-colors hover:bg-violet-300/15 disabled:opacity-50"
                        >
                          {generatingId === cur.id ? "Generating..." : generatedOutreach[cur.id] ? "Regenerate" : "Generate AI"}
                        </button>
                      </div>
                      {generationError && generatingId !== cur.id && (
                        <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-2.5 py-2 text-[10px] text-red-200">
                          {generationError}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={handleSequenceSkip} variant="ghost"
                    className="border border-white/10 text-white/55 hover:text-white hover:bg-white/[0.04] cursor-pointer">
                    Skip →
                  </Button>
                  <Button onClick={handleSequenceOpenAndNext}
                    className="bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold hover:scale-[1.01] transition-all cursor-pointer">
                    <ExternalLink className="w-4 h-4 mr-1.5" />
                    Open & Next
                  </Button>
                </div>

                {/* Keyboard hints */}
                <div className="flex items-center justify-center gap-3 text-[9px] text-white/30 font-mono">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-white/55">↵</kbd>
                    open & next
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-white/55">S</kbd>
                    skip
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-white/55">esc</kbd>
                    close
                  </span>
                </div>
              </div>
            )
          )}

          {/* ── BLITZ MODE ──────────────────────────────── */}
          {mode === "blitz" && (
            validLeads.length === 0 ? (
              <div className="px-6 py-12 text-center text-white/40 text-sm">No valid recipients</div>
            ) : (
              <div className="px-6 py-5 space-y-4">
                {/* Warning */}
                <div className="rounded-xl bg-orange-500/[0.06] border border-orange-500/20 px-3.5 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-400 shrink-0" strokeWidth={2.5} />
                    <span className="text-xs font-bold uppercase tracking-wider text-orange-400">Blitz Mode</span>
                    <span className="ml-auto text-[10px] font-mono text-white/40">
                      {generatedCount}/{validLeads.length} AI scripts ready
                    </span>
                  </div>
                  <p className="text-[11px] text-white/55 leading-relaxed">
                    Opens Gmail compose tabs immediately using the generated email for each lead. Your browser may ask you to <span className="text-white font-semibold">allow popups</span> the first time.
                  </p>
                  <Button
                    type="button"
                    onClick={generateAllSelected}
                    disabled={bulkGenerating || validLeads.length === 0}
                    className="h-8 w-full rounded-md bg-violet-300 text-xs font-black text-slate-950 hover:bg-violet-200 disabled:opacity-45"
                  >
                    {bulkGenerating ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {bulkGenerating && bulkProgress
                      ? `Generating ${bulkProgress.done}/${bulkProgress.total}`
                      : `Generate AI scripts for all ${validLeads.length}`}
                  </Button>
                  {remainingToGenerate > 0 && !bulkGenerating && (
                    <p className="text-[10px] text-white/35">
                      {remainingToGenerate} lead{remainingToGenerate === 1 ? "" : "s"} will use the template unless you generate first.
                    </p>
                  )}
                </div>

                {/* Queue preview */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono">
                    Queue · {validLeads.filter(l => !sentSet.has(l.id)).length} pending · {sentSet.size} sent
                  </h3>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-white/[0.06] divide-y divide-white/[0.04]">
                    {validLeads.map((lead, i) => {
                      const isSent = sentSet.has(lead.id)
                      return (
                        <div key={lead.id} className={cn(
                          "flex items-center gap-2 px-3 py-1.5 text-xs",
                          isSent ? "bg-emerald-500/[0.04] text-white/40" : "text-white/75"
                        )}>
                          <span className="text-[9px] font-mono text-white/25 w-6 shrink-0">{(i + 1).toString().padStart(2, "0")}</span>
                          <span className="truncate flex-1">{lead.name}</span>
                          {isSent
                            ? <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1 shrink-0"><Check className="w-2.5 h-2.5" />Sent</span>
                            : <span className="text-[9px] font-mono text-white/30 shrink-0">{emails[lead.id]}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Blitz progress */}
                {(blitzing || blitzProgress > 0 || blitzBlocked > 0) && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-mono text-white/40">
                      <span>{blitzProgress} opened{blitzBlocked > 0 ? ` · ${blitzBlocked} blocked` : ""}</span>
                      <span className={blitzBlocked > 0 ? "text-red-300" : "text-orange-400"}>
                        {blitzing ? "Blitzing" : blitzBlocked > 0 ? "Allow popups" : "Ready"}
                      </span>
                    </div>
                    <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-200" />
                    </div>
                  </div>
                )}

                {/* Batch size buttons */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono">
                    Open in Gmail
                  </h3>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[3, 5, 10, validLeads.filter(l => !sentSet.has(l.id)).length].map((n, i) => {
                      const remaining = validLeads.filter(l => !sentSet.has(l.id)).length
                      const capped = Math.min(n, remaining)
                      const isAll = i === 3
                      if (capped === 0) return null
                      return (
                        <Button
                          key={i}
                          onClick={() => handleBlitz(capped)}
                          disabled={blitzing || remaining === 0}
                          className={cn(
                            "h-9 font-bold text-xs transition-all cursor-pointer disabled:opacity-30",
                            isAll
                              ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-[0_0_16px_rgba(251,146,60,0.25)] hover:scale-[1.02]"
                              : "bg-white/[0.05] border border-white/[0.10] text-white hover:bg-white/[0.10]"
                          )}
                        >
                          <Zap className="w-3 h-3 mr-1" strokeWidth={2.5} />
                          {isAll ? `All ${capped}` : capped}
                        </Button>
                      )
                    })}
                  </div>
                  <p className="text-[10px] text-white/30 leading-relaxed">
                    Each click opens that many Gmail compose tabs at once. Tip: start with 3 to make sure popups are allowed, then crank to All.
                  </p>
                </div>
              </div>
            )
          )}

        </div>

        {/* ── FOOTER ─────────────────────────────────────────── */}
        {mode === "compose" && (
          <div className="px-6 py-4 border-t border-white/[0.07] shrink-0 flex items-center gap-2">
            <Button onClick={onClose} variant="ghost"
              className="border border-white/10 text-white/55 hover:text-white hover:bg-white/[0.04] cursor-pointer">
              Cancel
            </Button>
            <div className="ml-auto flex gap-2">
              <Button onClick={() => { setPreviewIdx(0); setMode("preview") }} variant="ghost"
                disabled={validLeads.length === 0}
                className="border border-white/10 text-white/70 hover:text-white hover:bg-white/[0.04] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                <Eye className="w-4 h-4 mr-1.5" /> Preview
              </Button>
              <Button onClick={() => { setMode("blitz") }} variant="ghost"
                disabled={validLeads.length === 0}
                className="border border-orange-500/25 bg-orange-500/[0.06] text-orange-400 hover:bg-orange-500/15 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                <Zap className="w-4 h-4 mr-1.5" strokeWidth={2.5} /> Blitz
              </Button>
              <Button onClick={() => { setSequenceIdx(0); setMode("sequence") }}
                disabled={validLeads.length === 0}
                className="bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold hover:scale-[1.01] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                <Send className="w-4 h-4 mr-1.5" />
                Sequence ({validLeads.length})
              </Button>
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  )
}
