import { NextRequest } from "next/server"
import { createSupabaseServerClient } from "./supabase-server"

export async function getAuthenticatedUser(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")

  if (!supabase || !token) {
    return { user: null, supabase }
  }

  const { data, error } = await supabase.auth.getUser(token)
  if (error) {
    return { user: null, supabase }
  }

  return { user: data.user, supabase }
}
