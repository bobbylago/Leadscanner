"use client"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, Radar, Search, MapPin, Shield, Wifi } from "lucide-react"

interface TopNavProps {
  industry: string
  location: string
  onIndustryChange: (value: string) => void
  onLocationChange: (value: string) => void
  onExport: () => void
  onFindLeads: () => void
  extraCities?: string[]
}

const industries = [
  "All Industries",
  "Plumbing",
  "Electrician",
  "HVAC",
  "Home Services",
  "Dental",
  "Roofing",
]

const PRESET_CITIES = [
  { label: "Austin, TX", value: "Austin, TX" },
  { label: "Stockholm, SE", value: "Stockholm, SE" },
  { label: "Gothenburg, SE", value: "Gothenburg, SE" },
  { label: "Västerås, SE", value: "Västerås, SE" },
]

export function TopNav({
  industry, location, onIndustryChange, onLocationChange,
  onExport, onFindLeads, extraCities = [],
}: TopNavProps) {
  const allCities = [
    ...PRESET_CITIES,
    ...extraCities
      .filter(c => !PRESET_CITIES.some(p => p.value === c))
      .map(c => ({ label: c, value: c })),
  ]

  return (
    <header className="h-14 border-b border-white/5 bg-slate-950/98 backdrop-blur-xl sticky top-0 z-50 shrink-0">
      <div className="h-full px-4 flex items-center justify-between gap-3">

        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative">
            <div className="absolute inset-0 bg-cyan-500 blur-md opacity-40 rounded-xl" />
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <Radar className="w-5 h-5 text-slate-950" strokeWidth={2.5} />
            </div>
          </div>
          <div>
            <span className="font-black text-base text-white tracking-tight">LaggardScan</span>
            <span className="block text-[9px] text-cyan-400/80 font-medium tracking-widest uppercase -mt-0.5">Intelligence Platform</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-1 justify-center max-w-lg">
          <Select value={industry} onValueChange={onIndustryChange}>
            <SelectTrigger className="w-40 h-9 bg-white/5 border-white/10 focus:ring-0 focus:border-cyan-500/40 text-white text-sm">
              <Search className="w-3.5 h-3.5 mr-1.5 text-cyan-400/50 shrink-0" />
              <SelectValue placeholder="Industry" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10">
              {industries.map(ind => (
                <SelectItem key={ind} value={ind} className="text-white text-sm focus:bg-cyan-500/15 focus:text-white">
                  {ind}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={allCities.some(c => c.value === location) ? location : ""} onValueChange={onLocationChange}>
            <SelectTrigger className="w-52 h-9 bg-white/5 border-white/10 focus:ring-0 focus:border-cyan-500/40 text-white text-sm">
              <MapPin className="w-3.5 h-3.5 mr-1.5 text-cyan-400/50 shrink-0" />
              <SelectValue placeholder={location || "Select city"} />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10">
              {allCities.length > PRESET_CITIES.length && (
                <div className="px-2 py-1.5">
                  <p className="text-[9px] text-white/30 uppercase tracking-wider font-semibold">Preset</p>
                </div>
              )}
              {PRESET_CITIES.map(city => (
                <SelectItem key={city.value} value={city.value} className="text-white text-sm focus:bg-cyan-500/15 focus:text-white">
                  {city.label}
                </SelectItem>
              ))}
              {extraCities.filter(c => !PRESET_CITIES.some(p => p.value === c)).length > 0 && (
                <>
                  <div className="px-2 py-1.5 mt-1 border-t border-white/8">
                    <p className="text-[9px] text-white/30 uppercase tracking-wider font-semibold">Scanned</p>
                  </div>
                  {extraCities.filter(c => !PRESET_CITIES.some(p => p.value === c)).map(city => (
                    <SelectItem key={city} value={city} className="text-white text-sm focus:bg-cyan-500/15 focus:text-white">
                      {city}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/4 border border-white/6 text-[10px] text-white/50">
            <span className="flex items-center gap-1.5">
              <Wifi className="w-3 h-3 text-emerald-400" />
              Online
            </span>
            <span className="w-px h-3 bg-white/10" />
            <span className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-cyan-400/60" />
              Secure
            </span>
          </div>

          <Button
            onClick={onFindLeads}
            className="h-9 px-4 bg-white/6 border border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/15 hover:border-cyan-500/40 font-bold text-sm transition-all"
            variant="ghost"
          >
            <Radar className="w-3.5 h-3.5 mr-1.5" />
            Find Leads
          </Button>

          <Button
            onClick={onExport}
            className="h-9 px-4 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all border-0"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export
          </Button>
        </div>
      </div>
    </header>
  )
}
