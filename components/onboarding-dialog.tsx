"use client"

import { CheckCircle2, MapPin, Mail, Radar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface OnboardingDialogProps {
  open: boolean
  onClose: () => void
  onStartScan: () => void
}

export function OnboardingDialog({ open, onClose, onStartScan }: OnboardingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={value => { if (!value) onClose() }}>
      <DialogContent className="bg-slate-900 border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Radar className="w-5 h-5 text-cyan-400" />
            Run your first market scan
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {[
            { icon: MapPin, title: "Pick a city and niche", desc: "Start with one market where your service is easy to explain." },
            { icon: Radar, title: "Find weak web presence", desc: "Surface businesses with old sites, no site, or missing conversion paths." },
            { icon: Mail, title: "Turn gaps into outreach", desc: "Use the audit evidence to write a specific first email." },
          ].map(item => (
            <div key={item.title} className="flex gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] p-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/12 border border-cyan-500/20 flex items-center justify-center shrink-0">
                <item.icon className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{item.title}</p>
                <p className="text-xs text-white/45 mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button
            onClick={onClose}
            variant="ghost"
            className="border border-white/10 text-white/55 hover:text-white"
          >
            Skip
          </Button>
          <Button
            onClick={() => {
              onClose()
              onStartScan()
            }}
            className="ml-auto bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Run First Scan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
