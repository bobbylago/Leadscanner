"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { type Lead } from "@/lib/types"
import { calcHealthScore, cn } from "@/lib/utils"
import { Activity, Crosshair, ZoomIn, ZoomOut, RotateCcw, Compass, Flame } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MapViewProps {
  leads: Lead[]
  selectedLead: Lead | null
  onSelectLead: (lead: Lead) => void
  currentCity: string
  mapCenter?: { lat: number; lon: number }
}

const cityCoords: Record<string, { lat: number; lon: number }> = {
  "Austin, TX":    { lat: 30.2672, lon: -97.7431 },
  "Stockholm, SE": { lat: 59.3293, lon:  18.0686 },
  "Gothenburg, SE":{ lat: 57.7089, lon:  11.9746 },
  "Västerås, SE":  { lat: 59.6100, lon:  16.5448 },
}

// Deterministic pseudo-random from seed
function rand(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function markerColor(lead: Lead) {
  if (lead.status === "No Website")  return { fill: "#ef4444", glow: "rgba(239,68,68,0.55)" }
  if (lead.status === "Old Website") return { fill: "#f97316", glow: "rgba(249,115,22,0.55)" }
  if (lead.isCustom)                  return { fill: "#a78bfa", glow: "rgba(167,139,250,0.55)" }
  return { fill: "#06b6d4", glow: "rgba(6,182,212,0.55)" }
}

/** Marker — size based on quality, shape by status, with quality halo */
function Marker({ lead, isSelected }: { lead: Lead; isSelected: boolean }) {
  const { fill, glow } = markerColor(lead)
  const health = calcHealthScore(lead)
  const quality = lead.qualityScore ?? 50
  const isHot = quality >= 70

  const isNoSite  = lead.status === "No Website"
  const isOldSite = lead.status === "Old Website"

  // Size scales with quality
  const baseSize = 10 + Math.round((quality / 100) * 8)
  const size = isSelected ? baseSize + 8 : baseSize

  return (
    <div className={cn(
      "relative flex items-center justify-center transition-all duration-200",
      isSelected ? "scale-[1.25] z-50" : "hover:scale-110"
    )}>
      {/* Halo — only on hot leads or selected */}
      {(isHot || isSelected) && (
        <div className="absolute rounded-full"
          style={{
            width: size * 3, height: size * 3,
            backgroundColor: fill, opacity: 0.06,
            animation: "pulse-glow 3s cubic-bezier(0.4,0,0.6,1) infinite",
          }} />
      )}

      {/* Subtle ping */}
      <div className="absolute rounded-full"
        style={{
          width: size * 2, height: size * 2,
          border: `1px solid ${fill}`, opacity: 0.18,
          animation: "pulse-glow 2.5s ease-in-out infinite",
        }} />

      {/* Shape */}
      {isNoSite ? (
        <div
          className={cn("transition-all", isSelected && "ring-1 ring-white/80 ring-offset-1 ring-offset-slate-950")}
          style={{
            width: size, height: size,
            backgroundColor: fill,
            border: "1.5px solid rgba(255,255,255,0.75)",
            boxShadow: `0 0 12px ${glow}, 0 0 24px ${fill}40, inset 0 0 4px rgba(255,255,255,0.3)`,
            transform: "rotate(45deg)",
            borderRadius: "2px",
          }}
        />
      ) : isOldSite ? (
        <div
          className={cn("transition-all", isSelected && "ring-1 ring-white/80 ring-offset-1 ring-offset-slate-950")}
          style={{
            width: size, height: size,
            backgroundColor: fill,
            border: "1.5px solid rgba(255,255,255,0.75)",
            boxShadow: `0 0 12px ${glow}, 0 0 24px ${fill}40, inset 0 0 4px rgba(255,255,255,0.3)`,
            borderRadius: "3px",
          }}
        />
      ) : (
        <div
          className={cn("rounded-full transition-all", isSelected && "ring-1 ring-white/80 ring-offset-1 ring-offset-slate-950")}
          style={{
            width: size, height: size,
            backgroundColor: fill,
            border: "1.5px solid rgba(255,255,255,0.75)",
            boxShadow: `0 0 12px ${glow}, 0 0 24px ${fill}40, inset 0 0 4px rgba(255,255,255,0.3)`,
          }}
        >
          <div className="absolute inset-[28%] rounded-full bg-white/50" />
        </div>
      )}

      {/* Hot-lead flame badge — top-right of marker */}
      {isHot && !isSelected && (
        <Flame className="absolute -top-1.5 -right-1.5 w-3 h-3 text-orange-300 drop-shadow-[0_0_4px_rgba(251,146,60,0.7)]" strokeWidth={2.5} />
      )}

      {/* Health score on selected */}
      {isSelected && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-950/95 border border-cyan-500/30 rounded-md px-1.5 py-0.5 text-[9px] font-bold text-white font-mono shadow-[0_0_8px_rgba(6,182,212,0.3)]">
          {health}% · Q{quality}
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
        y: (50 - parseFloat(selectedLead.mapPos.top))  * (rect.height / 100) * zoom,
      })
    }
  }, [selectedLead, zoom])

  useEffect(() => { setOffset({ x: 0, y: 0 }); setZoom(1) }, [currentCity])

  // Display coordinates
  const coords = mapCenter ?? cityCoords[currentCity] ?? cityCoords["Austin, TX"]
  const coordsLabel = `${coords.lat.toFixed(4)}° ${coords.lat >= 0 ? "N" : "S"}, ${Math.abs(coords.lon).toFixed(4)}° ${coords.lon >= 0 ? "E" : "W"}`

  // Generate stable "city blocks" decoration based on city name
  const citySeed = useMemo(() => {
    let h = 0
    for (let i = 0; i < currentCity.length; i++) h = (h * 31 + currentCity.charCodeAt(i)) | 0
    return Math.abs(h)
  }, [currentCity])

  // Pseudo-random city block rectangles
  const blocks = useMemo(() => {
    const arr: { x: number; y: number; w: number; h: number; o: number }[] = []
    for (let i = 0; i < 80; i++) {
      const s = citySeed + i * 17
      arr.push({
        x: rand(s) * 100,
        y: rand(s + 1) * 100,
        w: 2 + rand(s + 2) * 5,
        h: 2 + rand(s + 3) * 5,
        o: 0.04 + rand(s + 4) * 0.06,
      })
    }
    return arr
  }, [citySeed])

  // "Roads" — random angled lines
  const roads = useMemo(() => {
    const arr: { x1: number; y1: number; x2: number; y2: number; o: number }[] = []
    for (let i = 0; i < 6; i++) {
      const s = citySeed + i * 43 + 100
      const ang = rand(s) * Math.PI
      const cx = 30 + rand(s + 1) * 40
      const cy = 30 + rand(s + 2) * 40
      const len = 60 + rand(s + 3) * 40
      arr.push({
        x1: cx - Math.cos(ang) * len / 2,
        y1: cy - Math.sin(ang) * len / 2,
        x2: cx + Math.cos(ang) * len / 2,
        y2: cy + Math.sin(ang) * len / 2,
        o: 0.05 + rand(s + 4) * 0.08,
      })
    }
    return arr
  }, [citySeed])

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
  const hotCount = leads.filter(l => (l.qualityScore ?? 0) >= 70).length

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full w-full overflow-hidden select-none",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
      style={{
        background: "radial-gradient(ellipse at center, #0b1424 0%, #050811 60%, #02050b 100%)",
      }}
    >
      {/* ── Layer 1: Topographic contours ────────────────────── */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.10 }}>
        <defs>
          <filter id="topoBlur">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>
        <g filter="url(#topoBlur)">
          {Array.from({ length: 5 }).map((_, i) => {
            const r = 100 + i * 80
            return (
              <ellipse
                key={i}
                cx="50%" cy="50%"
                rx={r} ry={r * 0.7}
                fill="none"
                stroke="rgba(6,182,212,0.6)"
                strokeWidth="0.5"
                strokeDasharray="2 4"
              />
            )
          })}
        </g>
      </svg>

      {/* ── Layer 2: Dot grid ────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.18 }}>
        <div className="w-full h-full" style={{
          backgroundImage: "radial-gradient(rgba(6,182,212,0.45) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }} />
      </div>

      {/* ── Layer 3: City blocks (stylised urban grid) ───────── */}
      <div className="absolute inset-0 transition-transform duration-500 ease-out pointer-events-none"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}>
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          {/* Roads */}
          {roads.map((r, i) => (
            <line key={`road-${i}`} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
              stroke="rgba(6,182,212,0.4)" strokeWidth="0.25" opacity={r.o} />
          ))}
          {/* Blocks */}
          {blocks.map((b, i) => (
            <rect key={`block-${i}`} x={b.x} y={b.y} width={b.w} height={b.h}
              fill="rgba(6,182,212,0.5)" opacity={b.o} />
          ))}
        </svg>
      </div>

      {/* ── Layer 4: Concentric range rings ─────────────────── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {[180, 280, 400, 560].map((r, i) => (
          <div key={i}
            className="absolute rounded-full border"
            style={{
              width: r * 2, height: r * 2,
              borderColor: `rgba(6,182,212,${0.10 - i * 0.015})`,
              borderWidth: 1,
            }}
          />
        ))}
        {/* Center crosshair */}
        <div className="absolute w-3 h-3">
          <div className="absolute top-1/2 left-0 w-full h-px bg-cyan-400/50" />
          <div className="absolute left-1/2 top-0 w-px h-full bg-cyan-400/50" />
        </div>
      </div>

      {/* ── Layer 5: Radar sweep ─────────────────────────────── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="absolute"
          style={{
            width: "200%", aspectRatio: "1",
            background: "conic-gradient(from 0deg, transparent 0deg, rgba(6,182,212,0.06) 50deg, rgba(6,182,212,0.18) 70deg, transparent 80deg)",
            animation: "spin 12s linear infinite",
            transformOrigin: "center",
          }}
        />
      </div>

      {/* ── Layer 6: Scan line ──────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity: 0.7 }}>
        <div className="w-full h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
          style={{ animation: "scan-line 7s ease-in-out infinite", boxShadow: "0 0 8px rgba(6,182,212,0.3)" }} />
      </div>

      {/* ── Layer 7: Vignette ──────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, transparent 30%, rgba(2,5,11,0.85) 100%)" }} />

      {/* ── Layer 8: Corner brackets ───────────────────────── */}
      {(["tl", "tr", "bl", "br"] as const).map(c => (
        <div key={c} className={cn(
          "absolute w-4 h-4 border-cyan-500/30 z-10 pointer-events-none",
          c === "tl" && "top-3 left-3 border-l-2 border-t-2",
          c === "tr" && "top-3 right-3 border-r-2 border-t-2",
          c === "bl" && "bottom-3 left-3 border-l-2 border-b-2",
          c === "br" && "bottom-3 right-3 border-r-2 border-b-2",
        )} />
      ))}

      {/* ── Markers + map content (zoomable layer) ──────────── */}
      <div className="absolute inset-0 transition-transform duration-500 ease-out flex items-center justify-center"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}>
        <div className="absolute inset-0 z-20">
          {leads.map(lead => {
            const isSelected = selectedLead?.id === lead.id
            return (
              <button
                key={lead.id}
                onClick={e => { e.stopPropagation(); onSelectLead(lead) }}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                style={{ top: lead.mapPos.top, left: lead.mapPos.left }}
                title={lead.name}
              >
                <Marker lead={lead} isSelected={isSelected} />

                {/* Tooltip */}
                <div className={cn(
                  "absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-2 rounded-xl",
                  "bg-slate-950/98 border border-cyan-500/20 shadow-2xl",
                  "whitespace-nowrap pointer-events-none z-50 transition-all duration-150",
                  "shadow-[0_4px_20px_rgba(0,0,0,0.6),0_0_12px_rgba(6,182,212,0.08)]",
                  isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}>
                  <p className="text-xs font-bold text-white">{lead.name}</p>
                  <div className="flex items-center gap-2 mt-1 font-mono">
                    <span className={cn("text-[10px] font-semibold",
                      lead.status === "No Website"  ? "text-red-400" :
                      lead.status === "Old Website" ? "text-orange-400" : "text-cyan-400"
                    )}>{lead.status}</span>
                    <span className="text-[10px] text-white/20">·</span>
                    <span className="text-[10px] text-white/55">★ {lead.rating}</span>
                    <span className="text-[10px] text-white/20">·</span>
                    <span className="text-[10px] text-white/55">{calcHealthScore(lead)}%</span>
                    {lead.qualityScore !== undefined && (
                      <>
                        <span className="text-[10px] text-white/20">·</span>
                        <span className={cn(
                          "text-[10px] font-bold",
                          lead.qualityScore >= 70 ? "text-orange-400" : "text-white/55"
                        )}>Q{lead.qualityScore}</span>
                      </>
                    )}
                  </div>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-950 border-r border-b border-cyan-500/20 rotate-45" />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── HUD: Top-left — Live scan + coords ──────────────── */}
      <div className="absolute top-4 left-4 z-30 space-y-1.5">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/90 backdrop-blur-sm border border-cyan-500/15 shadow-[0_0_12px_rgba(6,182,212,0.06)]">
          <div className="relative w-2 h-2">
            <div className="absolute inset-0 rounded-full bg-cyan-400 animate-ping opacity-60" />
            <div className="absolute inset-0 rounded-full bg-cyan-400" />
          </div>
          <span className="text-[10px] font-bold text-white tracking-wider font-mono">LIVE SCAN</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/85 backdrop-blur-sm border border-white/[0.06]">
          <Compass className="w-3 h-3 text-cyan-400/45" />
          <span className="text-[9px] text-white/40 font-mono tracking-wide">{coordsLabel}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/85 backdrop-blur-sm border border-white/[0.06]">
          <Crosshair className="w-3 h-3 text-cyan-400/45" />
          <span className="text-[9px] text-white/40 font-mono">ZOOM {(zoom * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* ── Zoom controls ────────────────────────────────── */}
      <div className="absolute top-4 right-4 z-30 flex flex-col gap-1">
        {[
          { icon: ZoomIn,   fn: () => handleZoom("in"),  title: "Zoom in"  },
          { icon: ZoomOut,  fn: () => handleZoom("out"), title: "Zoom out" },
          { icon: RotateCcw, fn: handleReset,            title: "Reset"    },
        ].map(({ icon: Icon, fn, title }, i) => (
          <Button key={i} variant="ghost" size="icon" onClick={fn} title={title}
            className="w-8 h-8 bg-slate-950/90 backdrop-blur-sm border border-white/[0.08] text-white/45 hover:text-white hover:bg-cyan-500/10 hover:border-cyan-500/25 transition-all cursor-pointer">
            <Icon className="w-3.5 h-3.5" />
          </Button>
        ))}
      </div>

      {/* ── Legend ─────────────────────────────────────── */}
      <div className="absolute bottom-4 left-4 z-30">
        <div className="flex flex-col gap-1.5 px-3.5 py-3 rounded-xl bg-slate-950/95 backdrop-blur-sm border border-white/[0.07] shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
          <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest mb-0.5 font-mono">Targets</span>
          <LegendItem shape="diamond" color="#ef4444" label="No Website"   count={countByStatus("No Website")} />
          <LegendItem shape="square"  color="#f97316" label="Old Website"  count={countByStatus("Old Website")} />
          <LegendItem shape="circle"  color="#06b6d4" label="Needs Chatbot" count={countByStatus("Needs AI Chatbot")} />
          {leads.some(l => l.isCustom) && (
            <LegendItem shape="circle" color="#a78bfa" label="Custom" count={leads.filter(l => l.isCustom).length} />
          )}
          {hotCount > 0 && (
            <>
              <div className="h-px bg-white/[0.06] my-0.5" />
              <div className="flex items-center gap-2.5">
                <Flame className="w-3 h-3 text-orange-400" strokeWidth={2.5} />
                <span className="text-[10px] text-orange-400/90 flex-1 font-semibold">Hot leads</span>
                <span className="text-[10px] font-bold text-orange-400 font-mono">{hotCount}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Bottom stats ───────────────────────────────── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 px-5 py-2.5 rounded-2xl bg-slate-950/95 backdrop-blur-sm border border-white/[0.07] shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-2">
          <Activity className="w-3 h-3 text-cyan-400/50" />
          <span className="text-[10px] text-white/35 uppercase tracking-wider font-mono">Targets</span>
        </div>
        <span className="text-lg font-black text-white font-mono">{leads.length}</span>
        <div className="w-px h-5 bg-white/[0.08]" />
        <span className="text-[10px] text-white/35 uppercase tracking-wider font-mono">Avg Loss</span>
        <span className="text-sm font-black text-red-400 font-mono">
          {leads.length > 0
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
          width: 9, height: 9,
          backgroundColor: color,
          borderRadius: shape === "circle" ? "50%" : "2px",
          transform: shape === "diamond" ? "rotate(45deg)" : undefined,
          boxShadow: `0 0 6px ${color}80`,
          border: "1px solid rgba(255,255,255,0.4)",
        }} />
      </div>
      <span className="text-[10px] text-white/55 flex-1">{label}</span>
      <span className="text-[10px] font-bold text-white/65 font-mono">{count}</span>
    </div>
  )
}
