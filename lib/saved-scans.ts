import type { Lead } from "./types"
import { supabase } from "./supabase-client"

export interface SavedScan {
  id: string
  city: string
  industry: string
  lead_count: number
  leads: Lead[]
  map_center: { lat: number; lon: number } | null
  created_at: string
}

export async function loadSavedScans(): Promise<SavedScan[]> {
  if (!supabase) return []

  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return []

  const { data, error } = await supabase
    .from("saved_scans")
    .select("id, city, industry, lead_count, leads, map_center, created_at")
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    console.warn("Could not load saved scans", error.message)
    return []
  }

  return (data ?? []) as SavedScan[]
}

export async function saveScan(args: {
  city: string
  industry: string
  leads: Lead[]
  center?: { lat: number; lon: number }
}): Promise<boolean> {
  if (!supabase || args.leads.length === 0) return false

  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return false

  const { error } = await supabase.from("saved_scans").insert({
    user_id: userData.user.id,
    city: args.city,
    industry: args.industry,
    lead_count: args.leads.length,
    leads: args.leads,
    map_center: args.center ?? null,
  })

  if (error) {
    console.warn("Could not save scan", error.message)
    return false
  }

  return true
}

export async function clearSavedScans(): Promise<boolean> {
  if (!supabase) return false

  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return false

  const { error } = await supabase
    .from("saved_scans")
    .delete()
    .eq("user_id", userData.user.id)

  if (error) {
    console.warn("Could not clear saved scans", error.message)
    return false
  }

  return true
}
