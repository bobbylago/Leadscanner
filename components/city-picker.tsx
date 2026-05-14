"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { MapPin, Search, Globe, Clock, ChevronDown } from "lucide-react"
import { CITY_PRESETS, filterCities, groupCitiesByCountry, COUNTRY_NAMES } from "@/lib/city-presets"
import { cn } from "@/lib/utils"

interface CityPickerProps {
  value: string
  onChange: (city: string) => void
  recentCities?: string[]
}

export function CityPicker({ value, onChange, recentCities = [] }: CityPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const filtered = useMemo(() => filterCities(query), [query])
  const grouped = useMemo(() => groupCitiesByCountry(filtered), [filtered])

  // Recents that aren't already in presets
  const recentExtra = useMemo(() =>
    recentCities.filter(c => !CITY_PRESETS.some(p => p.label === c) && c.toLowerCase().includes(query.toLowerCase())),
    [recentCities, query]
  )

  const select = (label: string) => {
    onChange(label)
    setOpen(false)
    setQuery("")
  }

  const submit = () => {
    const trimmed = query.trim()
    if (trimmed) select(trimmed)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex items-center gap-1.5 h-9 px-3 rounded-md border w-52 text-sm transition-colors cursor-pointer",
          "bg-white/[0.04] border-white/[0.08] hover:border-white/15 text-white/80",
          open && "border-cyan-500/35"
        )}
      >
        <MapPin className="w-3.5 h-3.5 text-cyan-400/40 shrink-0" />
        <span className="truncate flex-1 text-left">{value || "Pick city"}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-white/30 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-[60] w-[360px] bg-[#0d1117] border border-white/[0.12] rounded-xl shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-white/[0.07]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
              <Input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    // Pick first result, or use raw query
                    const first = filtered[0] ?? recentExtra[0]
                    if (first) select(typeof first === "string" ? first : first.label)
                    else submit()
                  }
                  if (e.key === "Escape") { setOpen(false); setQuery("") }
                }}
                placeholder="Type a city, country, or region…"
                className="pl-8 h-8 bg-white/[0.04] border-white/[0.08] text-white text-xs focus:border-cyan-500/40 font-mono"
              />
            </div>
            {query.trim() && !filtered.length && !recentExtra.length && (
              <button
                onClick={submit}
                className="w-full mt-1.5 flex items-center justify-center gap-2 py-2 rounded-md bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 text-[11px] font-bold hover:bg-cyan-500/15 transition-colors cursor-pointer"
              >
                Use "{query.trim()}"
              </button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {recentExtra.length > 0 && (
              <div className="py-1">
                <div className="px-3 py-1 flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-white/30 font-mono">
                  <Clock className="w-2.5 h-2.5" /> Recently Scanned
                </div>
                {recentExtra.map(c => (
                  <button key={c} onClick={() => select(c)}
                    className="w-full text-left px-3 py-1.5 text-xs text-white/80 hover:bg-cyan-500/10 hover:text-white transition-colors flex items-center gap-2 cursor-pointer">
                    <MapPin className="w-3 h-3 text-cyan-400/40 shrink-0" />
                    <span className="truncate">{c}</span>
                    <span className="ml-auto text-[9px] text-emerald-400/70 font-mono">SAVED</span>
                  </button>
                ))}
              </div>
            )}

            {grouped.map(g => (
              <div key={g.country} className="py-1">
                <div className="px-3 py-1 flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-white/30 font-mono">
                  <Globe className="w-2.5 h-2.5" />
                  {COUNTRY_NAMES[g.country] ?? g.country}
                  <span className="text-white/15 font-normal">· {g.cities.length}</span>
                </div>
                {g.cities.map(c => (
                  <button key={c.label} onClick={() => select(c.label)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-xs hover:bg-cyan-500/10 hover:text-white transition-colors flex items-center gap-2 cursor-pointer",
                      c.label === value ? "text-cyan-400 bg-cyan-500/5" : "text-white/70"
                    )}>
                    <MapPin className="w-3 h-3 text-cyan-400/40 shrink-0" />
                    <span className="truncate">{c.label}</span>
                    {c.region && <span className="ml-auto text-[9px] text-white/25 font-mono">{c.region}</span>}
                  </button>
                ))}
              </div>
            ))}

            {!query && grouped.length === 0 && recentExtra.length === 0 && (
              <div className="p-6 text-center text-white/30 text-xs">No cities found</div>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-3 py-1.5 border-t border-white/[0.06] flex items-center gap-2 text-[9px] text-white/30 font-mono">
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">↵</kbd>
            <span>select first</span>
            <span className="ml-auto">Type any city to scan worldwide</span>
          </div>
        </div>
      )}
    </div>
  )
}
