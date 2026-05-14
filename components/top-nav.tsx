"use client"

import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Download, Radar, Search, Shield, Wifi } from "lucide-react"
import { CityPicker } from "./city-picker"

interface TopNavProps {
  industry: string
  location: string
  onIndustryChange: (value: string) => void
  onLocationChange: (value: string) => void
  onExport: () => void
  onFindLeads: () => void
  extraCities?: string[]
}

const industries = ["All Industries","Plumbing","Electrician","HVAC","Home Services","Dental","Roofing"]

const PRESET_CITIES = [
  { label: "Austin, TX",    value: "Austin, TX"    },
  { label: "Stockholm, SE", value: "Stockholm, SE" },
  { label: "Gothenburg, SE",value: "Gothenburg, SE"},
  { label: "Västerås, SE",  value: "Västerås, SE"  },
]

export function TopNav({
  industry, location, onIndustryChange, onLocationChange,
  onExport, onFindLeads, extraCities = [],
}: TopNavProps) {
  // Forward the user's scanned cities to the CityPicker for the "Recently scanned" group
  const scanned = extraCities

  return (
    <header className="h-14 border-b border-white/[0.06] bg-[#050810]/95 backdrop-blur-2xl sticky top-0 z-50 shrink-0 shadow-[0_1px_0_rgba(255,255,255,0.04)]">
      <div className="h-full px-4 flex items-center justify-between gap-3">

        {/* Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <div className="absolute inset-0 bg-cyan-400 blur-[10px] opacity-35 rounded-xl" />
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center shadow-[0_0_16px_rgba(6,182,212,0.35)]">
              <Radar className="w-[18px] h-[18px] text-slate-950" strokeWidth={2.5} />
            </div>
          </div>
          <div>
            <p className="font-black text-[15px] text-white tracking-tight leading-none">LaggardScan</p>
            <p className="text-[9px] text-cyan-400/70 font-mono font-medium tracking-[0.18em] uppercase mt-0.5">
              Intelligence Platform
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-1 justify-center max-w-lg">
          <Select value={industry} onValueChange={onIndustryChange}>
            <SelectTrigger className="w-40 h-9 bg-white/[0.04] border-white/[0.08] hover:border-white/15 focus:ring-0 focus:border-cyan-500/35 text-white/80 text-sm transition-colors cursor-pointer">
              <Search className="w-3.5 h-3.5 mr-1.5 text-cyan-400/40 shrink-0" />
              <SelectValue placeholder="Industry" />
            </SelectTrigger>
            <SelectContent className="bg-[#0d1117] border-white/10 shadow-2xl">
              {industries.map(ind => (
                <SelectItem key={ind} value={ind} className="text-white/80 text-sm focus:bg-cyan-500/15 focus:text-white cursor-pointer">
                  {ind}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <CityPicker value={location} onChange={onLocationChange} recentCities={scanned} />
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[10px] text-white/35 font-mono">
            <span className="flex items-center gap-1.5">
              <Wifi className="w-3 h-3 text-emerald-400/80" /> Online
            </span>
            <span className="w-px h-3 bg-white/10" />
            <span className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-cyan-400/50" /> Secure
            </span>
          </div>

          <Button
            onClick={onFindLeads}
            variant="ghost"
            className="h-9 px-4 border border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/45 hover:text-cyan-300 font-bold text-sm transition-all duration-200 cursor-pointer hover:shadow-[0_0_16px_rgba(6,182,212,0.12)]"
          >
            <Radar className="w-3.5 h-3.5 mr-1.5" />
            Find Leads
          </Button>

          <Button
            onClick={onExport}
            className="h-9 px-4 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-bold text-sm shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:shadow-[0_0_28px_rgba(6,182,212,0.40)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export
          </Button>
        </div>
      </div>
    </header>
  )
}
