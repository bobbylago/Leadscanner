"use client"

import { useState, useMemo, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Lead } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  Mail, ExternalLink, X, Check, ArrowRight, Eye, Send, Copy,
  Building2, Globe, AlertCircle, Sparkles, ChevronRight, RotateCcw,
} from "lucide-react"
import {
  guessEmail, EMAIL_PREFIXES, renderTemplate, buildGmailUrl, buildMailtoUrl,
  DEFAULT_SUBJECT, DEFAULT_BODY,
} from "@/lib/email-utils"

interface BatchOutreachDialogProps {
  open: boolean
  onClose: () => void
  leads: Lead[]
}

type Mode = "compose" | "preview" | "sequence"

export function BatchOutreachDialog({ open, onClose, leads }: BatchOutreachDialogProps) {
  const [subject, setSubject]     = useState(DEFAULT_SUBJECT)
  const [body, setBody]           = useState(DEFAULT_BODY)
  const [prefix, setPrefix]       = useState<string>("info")
  const [emails, setEmails]       = useState<Record<string, string>>({})
  const [skipped, setSkipped]     = useState<Set<string>>(new Set())
  const [mode, setMode]           = useState<Mode>("compose")
  const [previewIdx, setPreviewIdx] = useState(0)
  const [sentSet, setSentSet]     = useState<Set<string>>(new Set())
  const [sequenceIdx, setSequenceIdx] = useState(0)

  // Init emails per lead when dialog opens / leads change
  useEffect(() => {
    if (!open) return
    const initial: Record<string, string> = {}
    const initialSkipped = new Set<string>()
    for (const lead of leads) {
      const guess = guessEmail(lead.website, prefix)
      initial[lead.id] = guess
      if (!guess) initialSkipped.add(lead.id)
    }
    setEmails(initial)
    setSkipped(initialSkipped)
    setSentSet(new Set())
    setSequenceIdx(0)
    setMode("compose")
  }, [open, leads])

  // Rebuild emails when prefix changes
  useEffect(() => {
    if (!open) return
    setEmails(prev => {
      const next: Record<string, string> = { ...prev }
      for (const lead of leads) {
        // Only rebuild if the user hasn't manually edited (i.e. still matches a guessed prefix)
        const cur = next[lead.id]
        const guessedAny = EMAIL_PREFIXES.some(p => guessEmail(lead.website, p) === cur)
        if (guessedAny || !cur) next[lead.id] = guessEmail(lead.website, prefix)
      }
      return next
    })
  }, [prefix, leads, open])

  const validLeads = useMemo(() =>
    leads.filter(l => !skipped.has(l.id) && emails[l.id]?.includes("@")),
    [leads, skipped, emails]
  )

  const previewLead = validLeads[previewIdx] ?? validLeads[0]
  const renderedSubject = previewLead ? renderTemplate(subject, previewLead) : subject
  const renderedBody    = previewLead ? renderTemplate(body, previewLead)    : body

  const buildUrlForLead = (lead: Lead, type: "gmail" | "mailto") => {
    const opts = {
      to: emails[lead.id] ?? "",
      subject: renderTemplate(subject, lead),
      body: renderTemplate(body, lead),
    }
    return type === "gmail" ? buildGmailUrl(opts) : buildMailtoUrl(opts)
  }

  const openLead = (lead: Lead) => {
    window.open(buildUrlForLead(lead, "gmail"), "_blank", "noopener,noreferrer")
    setSentSet(prev => new Set(prev).add(lead.id))
  }

  const handleSequenceNext = () => {
    if (sequenceIdx >= validLeads.length - 1) {
      setMode("compose")
      return
    }
    setSequenceIdx(sequenceIdx + 1)
  }

  const handleSequenceSkip = () => {
    handleSequenceNext()
  }

  const handleSequenceOpenAndNext = () => {
    const lead = validLeads[sequenceIdx]
    if (lead) openLead(lead)
    setTimeout(() => handleSequenceNext(), 200)
  }

  const handleCopyEmails = () => {
    const list = validLeads.map(l => emails[l.id]).filter(Boolean).join(", ")
    navigator.clipboard.writeText(list)
  }

  const toggleSkip = (id: string) => {
    setSkipped(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
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
              {(["compose", "preview", "sequence"] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  disabled={validLeads.length === 0}
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed",
                    mode === m
                      ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                      : "bg-white/[0.04] text-white/40 border border-white/[0.06] hover:text-white/70"
                  )}
                >
                  {m === "compose" ? "Compose" : m === "preview" ? "Preview" : "Sequence"}
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
              {/* Template editor */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white/60 font-mono">Template</h3>
                  <button
                    onClick={() => { setSubject(DEFAULT_SUBJECT); setBody(DEFAULT_BODY) }}
                    className="ml-auto text-[10px] text-white/40 hover:text-white/70 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] text-white/45 uppercase tracking-wider font-mono">Subject</Label>
                  <Input
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm focus:border-cyan-500/40 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] text-white/45 uppercase tracking-wider font-mono">Body</Label>
                  <Textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    rows={10}
                    className="bg-white/[0.04] border-white/[0.08] text-white text-xs focus:border-cyan-500/40 font-mono resize-y leading-relaxed"
                  />
                </div>
                <div className="flex items-center flex-wrap gap-1 text-[10px] text-white/35">
                  <span className="font-mono uppercase tracking-wider mr-2">Variables:</span>
                  {["{name}","{category}","{website}","{domain}","{phone}","{rating}","{reviews}","{revenueLeak}","{healthScore}","{issues}"].map(v => (
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

              {/* Email prefix selector */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/60 font-mono">Email Pattern</h3>
                <div className="flex items-center gap-1 flex-wrap">
                  {EMAIL_PREFIXES.map(p => (
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
                    return (
                      <div key={lead.id} className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                        isSkipped
                          ? "bg-white/[0.02] border-white/[0.04] opacity-40"
                          : "bg-white/[0.04] border-white/[0.07]"
                      )}>
                        <Building2 className="w-3.5 h-3.5 text-white/30 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white truncate">{lead.name}</p>
                          <p className="text-[9px] text-white/30 truncate font-mono">
                            {lead.website ? lead.website.replace(/^https?:\/\//, "").split("/")[0] : "no website"}
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
                        <span className="text-white font-semibold truncate">{renderTemplate(subject, cur)}</span>
                      </div>
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
              <Button onClick={() => { setSequenceIdx(0); setMode("sequence") }}
                disabled={validLeads.length === 0}
                className="bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold hover:scale-[1.01] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                <Send className="w-4 h-4 mr-1.5" />
                Start Outreach ({validLeads.length})
              </Button>
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  )
}
