import { supabase } from "./supabase-client"

const DEVICE_ID_KEY = "ls_device_id_v1"

export function clientDeviceId() {
  if (typeof window === "undefined") return ""
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY)
    if (existing) return existing

    const next = window.crypto?.randomUUID?.()
      ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(DEVICE_ID_KEY, next)
    return next
  } catch {
    return ""
  }
}

export async function authHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {}
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const deviceId = clientDeviceId()
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(deviceId ? { "X-LS-Device-Id": deviceId } : {}),
  }
}

export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  const auth = await authHeaders()
  for (const [key, value] of Object.entries(auth)) {
    headers.set(key, value)
  }

  return fetch(input, {
    ...init,
    headers,
  })
}
