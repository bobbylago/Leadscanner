"use client"

import { useEffect, useState } from "react"
import { Clock, Loader2, MapPin, RotateCcw } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { loadSavedScans, type SavedScan } from "@/lib/saved-scans"

interface SavedScansDialogProps {
  open: boolean
  onClose: () => void
  onOpenScan: (scan: SavedScan) => void
}

export function SavedScansDialog({ open, onClose, onOpenScan }: SavedScansDialogProps) {
  const [scans, setScans] = useState<SavedScan[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setIsLoading(true)
    loadSavedScans()
      .then(setScans)
      .finally(() => setIsLoading(false))
  }, [open])

  return (
    <Dialog open={open} onOpenChange={value => { if (!value) onClose() }}>
      <DialogContent className="bg-slate-900 border-white/10 text-white max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Clock className="w-5 h-5 text-cyan-400" />
            Saved Scans
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 flex items-center justify-center text-white/45">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Loading scans...
          </div>
        ) : scans.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-semibold text-white/75">No saved scans yet</p>
            <p className="text-xs text-white/40 mt-1">Run a lead scan and it will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {scans.map(scan => (
              <button
                key={scan.id}
                onClick={() => {
                  onOpenScan(scan)
                  onClose()
                }}
                className="w-full text-left rounded-xl border border-white/[0.08] bg-white/[0.035] hover:bg-cyan-500/[0.06] hover:border-cyan-500/25 transition-colors p-3 flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-cyan-500/12 border border-cyan-500/20 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{scan.city}</p>
                  <p className="text-xs text-white/40">
                    {scan.industry} · {scan.lead_count} leads · {new Date(scan.created_at).toLocaleDateString()}
                  </p>
                </div>
                <RotateCcw className="w-4 h-4 text-white/30 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
