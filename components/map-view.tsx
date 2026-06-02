"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { type Lead } from "@/lib/types"
import { calcHealthScore, cn } from "@/lib/utils"
import { getHighValueLeadProfile } from "@/lib/lead-scoring"
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
  if (lead.status === "No Website")  return { fill: "#f87171", glow: "rgba(248,113,113,0.24)" }
  if (lead.status === "Old Website") return { fill: "#fb923c", glow: "rgba(251,146,60,0.24)" }
  if (lead.isCustom)                  return { fill: "#a78bfa", glow: "rgba(167,139,250,0.24)" }
  return { fill: "#22d3ee", glow: "rgba(34,211,238,0.24)" }
}

/** Marker — size based on quality, shape by status, with quality halo */
function Marker({ lead, isSelected }: { lead: Lead; isSelected: boolean }) {
  const { fill, glow } = markerColor(lead)
  const health = calcHealthScore(lead)
  const valueProfile = getHighValueLeadProfile(lead)
  const quality = valueProfile.score
  const isHot = valueProfile.tier === "Hot"

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
            backgroundColor: fill, opacity: 0.05,
          }} />
      )}

      {/* Subtle ping */}
      <div className="absolute rounded-full"
        style={{
          width: size * 2, height: size * 2,
          border: `1px solid ${fill}`, opacity: 0.14,
        }} />

      {/* Shape */}
      {isNoSite ? (
        <div
          className={cn("transition-all", isSelected && "ring-1 ring-white/80 ring-offset-1 ring-offset-slate-950")}
          style={{
            width: size, height: size,
            backgroundColor: fill,
            border: "1.5px solid rgba(255,255,255,0.75)",
            boxShadow: `0 0 10px ${glow}`,
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
            boxShadow: `0 0 10px ${glow}`,
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
            boxShadow: `0 0 10px ${glow}`,
          }}
        >
          <div className="absolute inset-[28%] rounded-full bg-white/50" />
        </div>
      )}

      {/* Hot-lead flame badge — top-right of marker */}
      {isHot && !isSelected && (
        <Flame className="absolute -top-1.5 -right-1.5 w-3 h-3 text-orange-300" strokeWidth={2.5} />
      )}

      {/* Health score on selected */}
      {isSelected && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#0b0f16]/95 border border-white/[0.12] rounded-md px-1.5 py-0.5 text-[9px] font-bold text-white font-mono">
          {health}% · HV{quality}
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

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
    setStartPos({ x: e.clientX - offset.x, y: e.clientY - offset.y })
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    setOffset({ x: e.clientX - startPos.x, y: e.clientY - startPos.y })
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }
  const handleZoom = (d: "in" | "out") => setZoom(p => d === "in" ? Math.min(p + 0.25, 3) : Math.max(p - 0.25, 0.5))
  const handleReset = () => { setOffset({ x: 0, y: 0 }); setZoom(1) }

  const countByStatus = (s: string) => leads.filter(l => l.status === s).length
  const hotCount = leads.filter(l => getHighValueLeadProfile(l).tier === "Hot").length

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full w-full overflow-hidden select-none touch-none",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setIsDragging(false)}
      style={{
        background: "radial-gradient(ellipse at center, #0b111b 0%, #070b12 62%, #05070c 100%)",
      }}
    >
      {/* ── Layer 1: Topographic contours ────────────────────── */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.055 }}>
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
                stroke="rgba(148,163,184,0.55)"
                strokeWidth="0.5"
                strokeDasharray="2 4"
              />
            )
          })}
        </g>
      </svg>

      {/* ── Layer 2: Dot grid ────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.08 }}>
        <div className="w-full h-full" style={{
          backgroundImage: "radial-gradient(rgba(148,163,184,0.35) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }} />
      </div>

      {/* ── Layer 3: City blocks (stylised urban grid) ───────── */}
      <div className="absolute inset-0 transition-transform duration-500 ease-out pointer-events-none"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}>
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          {/* Roads */}
          {roads.map((r, i) => (
            <line key={`road-${i}`} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
              stroke="rgba(148,163,184,0.36)" strokeWidth="0.25" opacity={r.o} />
          ))}
          {/* Blocks */}
          {blocks.map((b, i) => (
            <rect key={`block-${i}`} x={b.x} y={b.y} width={b.w} height={b.h}
              fill="rgba(148,163,184,0.35)" opacity={b.o} />
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
              borderColor: `rgba(148,163,184,${0.09 - i * 0.014})`,
              borderWidth: 1,
            }}
          />
        ))}
        {/* Center crosshair */}
        <div className="absolute w-3 h-3">
          <div className="absolute top-1/2 left-0 w-full h-px bg-white/25" />
          <div className="absolute left-1/2 top-0 w-px h-full bg-white/25" />
        </div>
      </div>

      {/* ── Layer 5: Radar sweep ─────────────────────────────── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="absolute"
          style={{
            width: "200%", aspectRatio: "1",
            background: "conic-gradient(from 0deg, transparent 0deg, rgba(34,211,238,0.035) 52deg, rgba(34,211,238,0.09) 70deg, transparent 82deg)",
            animation: "spin 18s linear infinite",
            transformOrigin: "center",
          }}
        />
      </div>

      {/* ── Layer 6: Scan line ──────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity: 0.25 }}>
        <div className="w-full h-px bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent"
          style={{ animation: "scan-line 10s ease-in-out infinite" }} />
      </div>

      {/* ── Layer 7: Vignette ──────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, transparent 38%, rgba(5,7,12,0.78) 100%)" }} />

      {/* ── Layer 8: Corner brackets ───────────────────────── */}
      {(["tl", "tr", "bl", "br"] as const).map(c => (
        <div key={c} className={cn(
           "absolute w-4 h-4 border-white/18 z-10 pointer-events-none",
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
                  "absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-2 rounded-lg",
                  "bg-[#0b0f16]/98 border border-white/[0.12]",
                  "whitespace-nowrap pointer-events-none z-50 transition-all duration-150",
                  isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}>
                  <p className="text-xs font-bold text-white">{lead.name}</p>
                  <div className="flex items-center gap-2 mt-1 font-mono">
                    <span className={cn("text-[10px] font-semibold",
                      lead.status === "No Website"  ? "text-red-400" :
                      lead.status === "Old Website" ? "text-orange-400" : "text-cyan-400"
                    )}>{lead.status}</span>
                    {lead.rating > 0 && (
                      <>
                        <span className="text-[10px] text-white/20">·</span>
                        <span className="text-[10px] text-white/55">★ {lead.rating}</span>
                      </>
                    )}
                    {calcHealthScore(lead) >= 0 && (
                      <>
                        <span className="text-[10px] text-white/20">·</span>
                        <span className="text-[10px] text-white/55">{calcHealthScore(lead)}%</span>
                      </>
                    )}
                    {(() => {
                      const profile = getHighValueLeadProfile(lead)
                      return (
                        <>
                          <span className="text-[10px] text-white/20">·</span>
                          <span className={cn(
                            "text-[10px] font-bold",
                            profile.tier === "Hot" ? "text-orange-400" : "text-white/55"
                          )}>HV{profile.score}</span>
                        </>
                      )
                    })()}
                  </div>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-950 border-r border-b border-cyan-500/20 rotate-45" />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── HUD: Top-left — Live scan + coords ──────────────── */}
      <div className="absolute top-3 left-3 z-30 space-y-1.5 sm:top-4 sm:left-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#0b0f16]/88 backdrop-blur-sm border border-white/[0.08]">
          <div className="relative w-2 h-2">
            <div className="absolute inset-0 rounded-full bg-cyan-400" />
          </div>
          <span className="text-[10px] font-bold text-white/75 tracking-wider font-mono">MAP VIEW</span>
        </div>
        <div className="hidden items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0b0f16]/82 backdrop-blur-sm border border-white/[0.07] sm:flex">
          <Compass className="w-3 h-3 text-cyan-400/45" />
          <span className="text-[9px] text-white/40 font-mono tracking-wide">{coordsLabel}</span>
        </div>
        <div className="hidden items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0b0f16]/82 backdrop-blur-sm border border-white/[0.07] sm:flex">
          <Crosshair className="w-3 h-3 text-cyan-400/45" />
          <span className="text-[9px] text-white/40 font-mono">ZOOM {(zoom * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* ── Zoom controls ────────────────────────────────── */}
      <div className="absolute top-3 right-3 z-30 flex flex-col gap-1 sm:top-4 sm:right-4">
        {[
          { icon: ZoomIn,   fn: () => handleZoom("in"),  title: "Zoom in"  },
          { icon: ZoomOut,  fn: () => handleZoom("out"), title: "Zoom out" },
          { icon: RotateCcw, fn: handleReset,            title: "Reset"    },
        ].map(({ icon: Icon, fn, title }, i) => (
          <Button key={i} variant="ghost" size="icon" onClick={fn} title={title}
            className="w-8 h-8 rounded-md bg-[#0b0f16]/88 backdrop-blur-sm border border-white/[0.09] text-white/45 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer">
            <Icon className="w-3.5 h-3.5" />
          </Button>
        ))}
      </div>

      {/* ── Legend ─────────────────────────────────────── */}
      <div className="absolute bottom-4 left-4 z-30 hidden sm:block">
        <div className="flex flex-col gap-1.5 px-3.5 py-3 rounded-lg bg-[#0b0f16]/92 backdrop-blur-sm border border-white/[0.08]">
          <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest mb-0.5 font-mono">Targets</span>
          <LegendItem shape="diamond" color="#ef4444" label="No Site Found" count={countByStatus("No Website")} />
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
      <div className="absolute bottom-4 left-1/2 z-30 hidden -translate-x-1/2 items-center gap-4 rounded-lg border border-white/[0.08] bg-[#0b0f16]/92 px-5 py-2.5 backdrop-blur-sm sm:flex">
        <div className="flex items-center gap-2">
          <Activity className="w-3 h-3 text-cyan-400/50" />
          <span className="text-[10px] text-white/35 uppercase tracking-wider font-mono">Targets</span>
        </div>
        <span className="text-lg font-black text-white font-mono">{leads.length}</span>
        <div className="w-px h-5 bg-white/[0.08]" />
        <span className="text-[10px] text-white/35 uppercase tracking-wider font-mono">Avg Gap</span>
        <span className="text-sm font-black text-orange-300 font-mono">
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
