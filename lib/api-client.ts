import { supabase } from "./supabase-client"

export async function authHeaders(): Promise<HeadersInit> {
  if (!supabase) return {}
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = await authHeaders()
  return fetch(input, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers ?? {}),
    },
  })
}
