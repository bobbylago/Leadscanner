"use client"

import { useState, useRef, useEffect } from "react"
import { type Lead } from "@/lib/types"
import { calcHealthScore, cn } from "@/lib/utils"
import { Activity, Crosshair, ZoomIn, ZoomOut, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MapViewProps {
  leads: Lead[]
  selectedLead: Lead | null
  onSelectLead: (lead: Lead) => void
  currentCity: string
  mapCenter?: { lat: number; lon: number }
}

const cityCoords: Record<string, string> = {
  "Austin, TX": "30.2672,-97.7431",
  "Stockholm, SE": "59.3293,18.0686",
  "Gothenburg, SE": "57.7089,11.9746",
  "Västerås, SE": "59.6100,16.5448",
}

function markerColor(lead: Lead) {
  if (lead.status === "No Website") return { fill: "#ef4444", shadow: "rgba(239,68,68,0.5)" }
  if (lead.status === "Old Website") return { fill: "#f97316", shadow: "rgba(249,115,22,0.5)" }
  if (lead.isCustom) return { fill: "#a78bfa", shadow: "rgba(167,139,250,0.5)" }
  return { fill: "#06b6d4", shadow: "rgba(6,182,212,0.5)" }
}

function Marker({ lead, isSelected }: { lead: Lead; isSelected: boolean }) {
  const { fill, shadow } = markerColor(lead)
  const health = calcHealthScore(lead)

  // Shape depends on status
  const isNoSite = lead.status === "No Website"
  const isOldSite = lead.status === "Old Website"
  const size = isSelected ? 20 : 14

  return (
    <div className={cn("relative flex items-center justify-center transition-transform duration-200",
      isSelected ? "scale-150 z-50" : "hover:scale-125"
    )}>
      {/* Pulse rings */}
      <div className="absolute rounded-full animate-ping"
        style={{ width: size * 2.5, height: size * 2.5, backgroundColor: fill, opacity: 0.15, animationDuration: "2.8s" }} />
      <div className="absolute rounded-full"
        style={{ width: size * 1.8, height: size * 1.8, backgroundColor: fill, opacity: 0.12,
          animation: "pulse-glow 3s cubic-bezier(0.4,0,0.6,1) infinite" }} />

      {/* Shape */}
      {isNoSite ? (
        // Diamond for "No Website"
        <div
          className={cn("border-[1.5px] border-white/60 shadow-lg",
            isSelected && "ring-2 ring-white ring-offset-1 ring-offset-slate-950")}
          style={{
            width: size, height: size,
            backgroundColor: fill,
            boxShadow: `0 0 10px ${shadow}, 0 0 20px ${fill}30`,
            transform: "rotate(45deg)",
            borderRadius: "3px",
          }}
        />
      ) : isOldSite ? (
        // Rounded square for "Old Website"
        <div
          className={cn("border-[1.5px] border-white/60 shadow-lg",
            isSelected && "ring-2 ring-white ring-offset-1 ring-offset-slate-950")}
          style={{
            width: size, height: size,
            backgroundColor: fill,
            boxShadow: `0 0 10px ${shadow}, 0 0 20px ${fill}30`,
            borderRadius: "4px",
          }}
        />
      ) : (
        // Circle for chatbot / custom
        <div
          className={cn("rounded-full border-[1.5px] border-white/60 shadow-lg",
            isSelected && "ring-2 ring-white ring-offset-1 ring-offset-slate-950")}
          style={{
            width: size, height: size,
            backgroundColor: fill,
            boxShadow: `0 0 10px ${shadow}, 0 0 20px ${fill}30`,
          }}
        >
          <div className="absolute inset-[25%] rounded-full bg-white/35" />
        </div>
      )}

      {/* Health score mini badge on selected */}
      {isSelected && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/95 border border-white/15 rounded px-1.5 py-0.5 text-[9px] font-bold text-white">
          {health}%
        </div>
      )}
    </div>
  )
}

export function MapView({ leads, selectedLead, onSelectLead, currentCity, mapCenter }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (selectedLead && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setOffset({
        x: (50 - parseFloat(selectedLead.mapPos.left)) * (rect.width / 100) * zoom,
        y: (50 - parseFloat(selectedLead.mapPos.top)) * (rect.height / 100) * zoom,
      })
    }
  }, [selectedLead, zoom])

  useEffect(() => { setOffset({ x: 0, y: 0 }); setZoom(1) }, [currentCity])

  const coords = mapCenter
    ? `${mapCenter.lat},${mapCenter.lon}`
    : (cityCoords[currentCity] ?? cityCoords["Austin, TX"])

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return
    setIsDragging(true)
    setStartPos({ x: e.clientX - offset.x, y: e.clientY - offset.y })
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setOffset({ x: e.clientX - startPos.x, y: e.clientY - startPos.y })
  }
  const handleZoom = (d: "in" | "out") => setZoom(p => d === "in" ? Math.min(p + 0.25, 3) : Math.max(p - 0.25, 0.5))
  const handleReset = () => { setOffset({ x: 0, y: 0 }); setZoom(1) }

  const countByStatus = (s: string) => leads.filter(l => l.status === s).length

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full w-full bg-slate-950 overflow-hidden select-none",
        isDragging ? "cursor-grabbing" : "cursor-grab")}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
    >
      {/* Scan line */}
      <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent"
          style={{ animation: "scan-line 5s ease-in-out infinite" }} />
      </div>

      {/* Grid */}
      <div className="absolute inset-0 z-[2] pointer-events-none" style={{ opacity: 0.12 }}>
        <div className="w-full h-full" style={{
          backgroundImage: `linear-gradient(rgba(6,182,212,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.15) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }} />
      </div>

      {/* Corner brackets */}
      {(["tl", "tr", "bl", "br"] as const).map(c => (
        <div key={c} className={cn("absolute w-5 h-5 border-cyan-500/35 z-10 pointer-events-none",
          c === "tl" && "top-3 left-3 border-l-2 border-t-2",
          c === "tr" && "top-3 right-3 border-r-2 border-t-2",
          c === "bl" && "bottom-3 left-3 border-l-2 border-b-2",
          c === "br" && "bottom-3 right-3 border-r-2 border-b-2",
        )} />
      ))}

      {/* Vignette */}
      <div className="absolute inset-0 z-[3] pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(2,6,23,0.85)_100%)]" />

      {/* Map + Markers */}
      <div className="absolute inset-0 transition-transform duration-500 ease-out flex items-center justify-center"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}>
        {/* Satellite iframe */}
        <div className="absolute inset-[-200%] z-0 pointer-events-none" style={{ opacity: 0.4 }}>
          <iframe key={coords} width="100%" height="100%" frameBorder="0"
            src={`https://maps.google.com/maps?q=${coords}&t=k&z=13&ie=UTF8&iwloc=&output=embed`}
            style={{ filter: "saturate(0.12) brightness(0.4) contrast(1.6) hue-rotate(190deg)", pointerEvents: "none" }}
          />
        </div>

        {/* Markers */}
        <div className="absolute inset-0 z-20">
          {leads.map(lead => {
            const isSelected = selectedLead?.id === lead.id
            return (
              <button
                key={lead.id}
                onClick={e => { e.stopPropagation(); onSelectLead(lead) }}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
                style={{ top: lead.mapPos.top, left: lead.mapPos.left }}
              >
                <Marker lead={lead} isSelected={isSelected} />

                {/* Tooltip */}
                <div className={cn(
                  "absolute bottom-full left-1/2 -translate-x-1/2 mb-4 px-3 py-2 rounded-xl",
                  "bg-slate-900/98 backdrop-blur-xl border border-white/10 shadow-xl",
                  "whitespace-nowrap pointer-events-none z-50 transition-all duration-150",
                  isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}>
                  <p className="text-xs font-bold text-white">{lead.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("text-[10px] font-semibold",
                      lead.status === "No Website" ? "text-red-400" :
                      lead.status === "Old Website" ? "text-orange-400" : "text-cyan-400"
                    )}>{lead.status}</span>
                    <span className="text-[10px] text-white/30">·</span>
                    <span className="text-[10px] text-white/50">★ {lead.rating}</span>
                    <span className="text-[10px] text-white/30">·</span>
                    <span className="text-[10px] text-white/50">{calcHealthScore(lead)}% health</span>
                  </div>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-r border-b border-white/10 rotate-45" />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* HUD: Live scan */}
      <div className="absolute top-4 left-4 z-30 space-y-1.5">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/92 backdrop-blur-xl border border-white/8">
          <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span className="text-[10px] font-bold text-white tracking-wide">LIVE SCAN</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/85 backdrop-blur-xl border border-white/8">
          <Crosshair className="w-3 h-3 text-cyan-400/50" />
          <span className="text-[9px] text-white/45 font-mono">{(zoom * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute top-4 right-4 z-30 flex flex-col gap-1">
        {[
          { icon: ZoomIn, fn: () => handleZoom("in") },
          { icon: ZoomOut, fn: () => handleZoom("out") },
          { icon: RotateCcw, fn: handleReset },
        ].map(({ icon: Icon, fn }, i) => (
          <Button key={i} variant="ghost" size="icon" onClick={fn}
            className="w-8 h-8 bg-slate-900/90 backdrop-blur-xl border border-white/8 text-white/50 hover:text-white hover:bg-slate-800/90">
            <Icon className="w-3.5 h-3.5" />
          </Button>
        ))}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-30">
        <div className="flex flex-col gap-1.5 px-3.5 py-3 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-white/8">
          <span className="text-[8px] font-bold text-white/35 uppercase tracking-widest mb-0.5">Legend</span>
          <LegendItem shape="diamond" color="#ef4444" label="No Website" count={countByStatus("No Website")} />
          <LegendItem shape="square" color="#f97316" label="Old Website" count={countByStatus("Old Website")} />
          <LegendItem shape="circle" color="#06b6d4" label="Needs Chatbot" count={countByStatus("Needs AI Chatbot")} />
          {leads.some(l => l.isCustom) && (
            <LegendItem shape="circle" color="#a78bfa" label="Custom" count={leads.filter(l => l.isCustom).length} />
          )}
        </div>
      </div>

      {/* Bottom stats */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 px-5 py-2.5 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/8">
        <span className="text-[10px] text-white/40">Targets</span>
        <span className="text-lg font-black text-white">{leads.length}</span>
        <div className="w-px h-5 bg-white/10" />
        <span className="text-[10px] text-white/40">Avg Leak</span>
        <span className="text-sm font-black text-red-400">
          ${leads.length > 0
            ? Math.round(leads.reduce((s, l) => s + (calcHealthScore(l) === 0 ? 1 : 100 - calcHealthScore(l)), 0) / leads.length)
            : 0}%
        </span>
      </div>
    </div>
  )
}

function LegendItem({ shape, color, label, count }: { shape: "circle" | "square" | "diamond"; color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-4 h-4 flex items-center justify-center shrink-0">
        <div style={{
          width: 10, height: 10,
          backgroundColor: color,
          borderRadius: shape === "circle" ? "50%" : shape === "diamond" ? "2px" : "2px",
          transform: shape === "diamond" ? "rotate(45deg)" : undefined,
          boxShadow: `0 0 6px ${color}60`,
        }} />
      </div>
      <span className="text-[10px] text-white/55 flex-1">{label}</span>
      <span className="text-[10px] font-bold text-white/70">{count}</span>
    </div>
  )
}
