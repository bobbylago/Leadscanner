"use client"

import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Clock, CreditCard, Download, LogOut, MoreVertical, Radar, Search, User } from "lucide-react"
import { CityPicker } from "./city-picker"
import { supabase } from "@/lib/supabase-client"
import { PLAN_TEXT_COLORS, type BillingStatus } from "@/lib/billing-types"
import { cn } from "@/lib/utils"

interface TopNavProps {
  industry: string
  location: string
  onIndustryChange: (value: string) => void
  onLocationChange: (value: string) => void
  onExport: () => void
  onFindLeads: () => void
  onBilling: () => void
  onHistory: () => void
  billingStatus: BillingStatus
  extraCities?: string[]
}

const industries = [
  "All Industries",
  "Plumbing",
  "Electrician",
  "HVAC",
  "Home Services",
  "Home Care Agencies",
  "Dental",
  "Roofing",
]

export function TopNav({
  industry, location, onIndustryChange, onLocationChange,
  onExport, onFindLeads, onBilling, onHistory, billingStatus, extraCities = [],
}: TopNavProps) {
  return (
    <header className="border-b border-white/[0.08] bg-[#0b0f16]/96 backdrop-blur-xl sticky top-0 z-50 shrink-0">
      <div className="min-h-16 md:h-16 px-4 sm:px-5 py-2 md:py-0 flex flex-wrap md:flex-nowrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative w-9 h-9 rounded-lg bg-cyan-400 flex items-center justify-center">
            <Radar className="w-[18px] h-[18px] text-slate-950" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-black text-[15px] text-white tracking-tight leading-none">LaggardScan</p>
            <p className="text-[9px] text-white/35 font-mono font-medium tracking-[0.16em] uppercase mt-0.5">
              Lead prospecting
            </p>
          </div>
        </div>

        <div className="order-last md:order-none w-full md:w-auto flex items-center gap-2 flex-1 md:justify-center md:max-w-xl">
          <Select value={industry} onValueChange={onIndustryChange}>
            <SelectTrigger className="flex-1 md:flex-none md:w-44 min-w-0 h-10 rounded-md bg-white/[0.035] border-white/[0.10] hover:border-white/18 focus:ring-0 focus:border-cyan-500/35 text-white/78 text-sm transition-colors cursor-pointer">
              <Search className="w-3.5 h-3.5 mr-1.5 text-white/35 shrink-0" />
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

          <CityPicker
            value={location}
            onChange={onLocationChange}
            recentCities={extraCities}
            className="flex-1 md:flex-none"
            triggerClassName="w-full md:w-52"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={onFindLeads}
            className="h-10 px-3 sm:px-4 rounded-md bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-bold text-sm transition-colors cursor-pointer"
          >
            <Radar className="w-3.5 h-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Find leads</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 px-3 rounded-md border border-white/[0.09] bg-white/[0.025] text-white/55 hover:bg-white/[0.06] hover:text-white cursor-pointer"
                title="Account menu"
              >
                <User className="w-3.5 h-3.5 mr-1.5" />
                <span className="hidden xl:inline text-sm font-bold">Account</span>
                <MoreVertical className="w-3.5 h-3.5 ml-1 text-white/35" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-[#0d1117] border-white/10 text-white shadow-2xl">
              <DropdownMenuLabel className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-white/45">Current plan</span>
                  <span className={cn("text-xs font-black uppercase", PLAN_TEXT_COLORS[billingStatus.plan])}>
                    {billingStatus.plan}
                  </span>
                </div>
                <div className="text-[11px] text-white/35 font-mono">
                  {billingStatus.scansUsed}/{billingStatus.scanLimit} lead credits used
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={onExport} className="cursor-pointer focus:bg-white/[0.06] focus:text-white">
                <Download className="w-3.5 h-3.5 mr-2 text-cyan-300" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onHistory} className="cursor-pointer focus:bg-white/[0.06] focus:text-white">
                <Clock className="w-3.5 h-3.5 mr-2 text-white/45" />
                Saved scans
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onBilling} className="cursor-pointer focus:bg-white/[0.06] focus:text-white">
                <CreditCard className="w-3.5 h-3.5 mr-2 text-white/45" />
                Billing
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onClick={() => supabase?.auth.signOut()}
                className="cursor-pointer text-red-300 focus:bg-red-500/10 focus:text-red-200"
              >
                <LogOut className="w-3.5 h-3.5 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
