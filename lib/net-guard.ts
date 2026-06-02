/**
 * SSRF protection for outbound fetches against user-supplied URLs.
 *
 * Validates that a URL is http(s) and that every IP its hostname resolves to is
 * publicly routable, then follows redirects manually so each hop is re-checked
 * (defends against redirect-to-internal and single-record DNS rebinding).
 */

import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BlockedUrlError"
  }
}

/** Parse an IPv4 string to its 32-bit integer, or null. */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".")
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    const n = Number(part)
    if (!Number.isInteger(n) || n < 0 || n > 255) return null
    value = value * 256 + n
  }
  return value >>> 0
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip)
  if (n === null) return true // unparseable → treat as unsafe
  const inRange = (base: string, bits: number) => {
    const baseInt = ipv4ToInt(base)!
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    return (n & mask) === (baseInt & mask)
  }
  return (
    inRange("0.0.0.0", 8) ||        // "this" network
    inRange("10.0.0.0", 8) ||       // private
    inRange("100.64.0.0", 10) ||    // CGNAT
    inRange("127.0.0.0", 8) ||      // loopback
    inRange("169.254.0.0", 16) ||   // link-local (cloud metadata)
    inRange("172.16.0.0", 12) ||    // private
    inRange("192.0.0.0", 24) ||     // IETF protocol assignments
    inRange("192.168.0.0", 16) ||   // private
    inRange("198.18.0.0", 15) ||    // benchmarking
    inRange("224.0.0.0", 4) ||      // multicast
    inRange("240.0.0.0", 4)         // reserved
  )
}

function isPrivateIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().split("%")[0] // strip zone id
  if (addr === "::1" || addr === "::") return true
  // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded v4
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIPv4(mapped[1])
  return (
    addr.startsWith("fc") || addr.startsWith("fd") || // unique local
    addr.startsWith("fe8") || addr.startsWith("fe9") || // link-local
    addr.startsWith("fea") || addr.startsWith("feb")
  )
}

function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip)
  if (kind === 4) return isPrivateIPv4(ip)
  if (kind === 6) return isPrivateIPv6(ip)
  return true // not a valid IP → unsafe
}

/**
 * Throws BlockedUrlError unless `rawUrl` is an http(s) URL whose host resolves
 * exclusively to public IPs. Returns the parsed URL on success.
 */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new BlockedUrlError("Invalid URL")
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedUrlError("Only http(s) URLs are allowed")
  }

  const host = url.hostname
  if (!host || host.endsWith(".local") || host.endsWith(".internal") || host === "localhost") {
    throw new BlockedUrlError("Host is not allowed")
  }

  // If the host is a literal IP, check it directly; otherwise resolve all records.
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new BlockedUrlError("URL resolves to a non-public address")
    return url
  }

  let records: Array<{ address: string }>
  try {
    records = await lookup(host, { all: true })
  } catch {
    throw new BlockedUrlError("Could not resolve host")
  }
  if (records.length === 0) throw new BlockedUrlError("Could not resolve host")
  for (const { address } of records) {
    if (isPrivateIp(address)) throw new BlockedUrlError("URL resolves to a non-public address")
  }
  return url
}

export interface SafeFetchOptions {
  method?: string
  headers?: Record<string, string>
  timeoutMs?: number
  maxRedirects?: number
}

/**
 * Fetch a user-supplied URL with SSRF protection. Redirects are followed
 * manually so every hop is re-validated. Throws BlockedUrlError if any hop
 * points at a non-public address.
 */
export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<Response> {
  const { method = "GET", headers = {}, timeoutMs = 8000, maxRedirects = 5 } = options
  let current = rawUrl

  for (let i = 0; i <= maxRedirects; i++) {
    const url = await assertPublicUrl(current)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    let res: Response
    try {
      res = await fetch(url, {
        method,
        signal: controller.signal,
        redirect: "manual",
        headers,
      })
    } finally {
      clearTimeout(timeout)
    }

    // Manual redirect handling
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location")
      if (!location) return res
      current = new URL(location, url).toString()
      continue
    }
    return res
  }
  throw new BlockedUrlError("Too many redirects")
}
