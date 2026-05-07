"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { type Lead, INDUSTRIES, STATUSES } from "@/lib/types"
import { generateAuditScores } from "@/lib/utils"
import { Plus, Globe, Phone, Star, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface AddLeadDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (lead: Lead) => void
  currentCity: string
}

const EMPTY_FORM = {
  name: "",
  website: "",
  phone: "",
  rating: "4.5",
  reviews: "50",
  category: "Plumbing",
  status: "Needs AI Chatbot",
}

export function AddLeadDialog({ open, onClose, onAdd, currentCity }: AddLeadDialogProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = "Business name is required"
    const r = parseFloat(form.rating)
    if (isNaN(r) || r < 1 || r > 5) e.rating = "Rating must be 1.0 – 5.0"
    const rev = parseInt(form.reviews)
    if (isNaN(rev) || rev < 0) e.reviews = "Must be a positive number"
    if (form.website && !/^https?:\/\/.+/.test(form.website.trim())) {
      e.website = "Must start with http:// or https://"
    }
    return e
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    const websiteVal = form.website.trim() || null
    const phoneVal = form.phone.trim() || null
    const partial = {
      name: form.name.trim(),
      website: websiteVal,
      phone: phoneVal,
      rating: parseFloat(form.rating),
      reviews: parseInt(form.reviews),
      status: form.status,
    }

    // Generate map position from name seed
    const seed = partial.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const top = 12 + Math.abs(Math.sin(seed * 12.9898) * 76)
    const left = 8 + Math.abs(Math.cos(seed * 78.233) * 84)

    const newLead: Lead = {
      ...partial,
      id: `custom-${Date.now()}-${seed}`,
      category: form.category,
      isCustom: true,
      mapPos: {
        top: `${Math.max(6, Math.min(93, top))}%`,
        left: `${Math.max(6, Math.min(93, left))}%`,
      },
      audit: generateAuditScores(partial),
    }

    onAdd(newLead)
    setForm(EMPTY_FORM)
    setErrors({})
    onClose()
  }

  const field = (key: keyof typeof EMPTY_FORM, value: string) => {
    setForm(f => ({ ...f, [key]: value }))
    if (errors[key]) setErrors(e => { const ne = { ...e }; delete ne[key]; return ne })
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <Plus className="w-4 h-4 text-cyan-400" />
            </div>
            Add New Lead
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">

          {/* Business Name */}
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60 flex items-center gap-1.5">
              <Building2 className="w-3 h-3" /> Business Name *
            </Label>
            <Input
              value={form.name}
              onChange={e => field("name", e.target.value)}
              placeholder="e.g. City Plumbing Co."
              className={cn(
                "bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/40",
                errors.name && "border-red-500/50"
              )}
            />
            {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
          </div>

          {/* Category + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-white/60">Category</Label>
              <Select value={form.category} onValueChange={v => field("category", v)}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white focus:ring-0 focus:border-cyan-500/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10">
                  {INDUSTRIES.map(i => (
                    <SelectItem key={i} value={i} className="text-white focus:bg-cyan-500/15">{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-white/60">Status</Label>
              <Select value={form.status} onValueChange={v => field("status", v)}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white focus:ring-0 focus:border-cyan-500/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10">
                  {STATUSES.map(s => (
                    <SelectItem key={s} value={s} className="text-white focus:bg-cyan-500/15">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rating + Reviews */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-white/60 flex items-center gap-1.5">
                <Star className="w-3 h-3" /> Rating (1–5)
              </Label>
              <Input
                type="number" step="0.1" min="1" max="5"
                value={form.rating}
                onChange={e => field("rating", e.target.value)}
                className={cn(
                  "bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/40",
                  errors.rating && "border-red-500/50"
                )}
              />
              {errors.rating && <p className="text-xs text-red-400">{errors.rating}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-white/60">Reviews</Label>
              <Input
                type="number" min="0"
                value={form.reviews}
                onChange={e => field("reviews", e.target.value)}
                className={cn(
                  "bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/40",
                  errors.reviews && "border-red-500/50"
                )}
              />
              {errors.reviews && <p className="text-xs text-red-400">{errors.reviews}</p>}
            </div>
          </div>

          {/* Website */}
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60 flex items-center gap-1.5">
              <Globe className="w-3 h-3" /> Website <span className="text-white/30">(optional)</span>
            </Label>
            <Input
              value={form.website}
              onChange={e => field("website", e.target.value)}
              placeholder="https://example.com"
              className={cn(
                "bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/40",
                errors.website && "border-red-500/50"
              )}
            />
            {errors.website && <p className="text-xs text-red-400">{errors.website}</p>}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60 flex items-center gap-1.5">
              <Phone className="w-3 h-3" /> Phone <span className="text-white/30">(optional)</span>
            </Label>
            <Input
              value={form.phone}
              onChange={e => field("phone", e.target.value)}
              placeholder="(512) 000-0000"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/40"
            />
          </div>

          <div className="flex gap-2.5 pt-2">
            <Button
              type="button" variant="ghost"
              onClick={onClose}
              className="flex-1 border border-white/10 text-white/60 hover:text-white hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold hover:scale-[1.02] transition-all"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Lead
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
