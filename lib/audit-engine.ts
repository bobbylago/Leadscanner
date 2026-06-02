/**
 * Real website audit engine.
 * Fetches the homepage and analyses the HTML for actual digital health signals.
 */

import { safeFetch, BlockedUrlError } from "./net-guard"

export interface RealAuditResult {
  seo: number
  mobileFriendliness: number
  chatbotPresence: number
  pageSpeed: number
  socialPresence: number
  // Signals collected during analysis (for the UI to surface evidence)
  signals: {
    reachable: boolean
    httpStatus: number | null
    isHttps: boolean
    hasViewport: boolean
    hasTitle: boolean
    titleLength: number
    hasMetaDescription: boolean
    metaDescriptionLength: number
    hasOgTags: boolean
    hasFavicon: boolean
    hasSchemaMarkup: boolean
    hasCanonical: boolean
    hasH1: boolean
    h1Count: number
    chatbotProvider: string | null
    bookingProvider: string | null
    analyticsProvider: string | null
    hasContactForm: boolean
    hasPhoneLink: boolean
    hasEmailLink: boolean
    emails: string[]
    hasAddressSignal: boolean
    socialLinks: string[]          // platforms found
    socialLinkCount: number
    responseTimeMs: number
    htmlSizeKb: number
    imgCount: number
    imgWithoutAlt: number
    scriptCount: number
    inlineStyleCount: number
    usesModernFramework: boolean    // detects Next/React/Vue/Svelte
    hasServiceWorker: boolean
    hasManifest: boolean
    finalUrl: string
    error: string | null
  }
}

/** Known chatbot/live-chat providers — detected via script src or class names */
const CHATBOT_PROVIDERS: Array<[string, RegExp]> = [
  ["Intercom",     /intercom\.io|intercomcdn|widget\.intercom/i],
  ["Drift",        /drift\.com|driftt\.com/i],
  ["Tidio",        /tidio\.co|tidiochat/i],
  ["HubSpot",      /hs-scripts|hubspot\.com\/.*chat|hsforms/i],
  ["Crisp",        /crisp\.chat/i],
  ["Tawk.to",      /tawk\.to/i],
  ["LiveChat",     /livechatinc/i],
  ["Zendesk",      /zopim|zdassets|zendesk/i],
  ["Freshchat",    /freshchat|wchat\.freshchat/i],
  ["Olark",        /olark\.com/i],
  ["Smartsupp",    /smartsupp/i],
  ["LiveAgent",    /liveagent/i],
  ["Userlike",     /userlike/i],
  ["Facebook Msg", /connect\.facebook\.net.*MessengerCheckoutLoader|fb-customerchat/i],
  ["ManyChat",     /manychat/i],
  ["Botpress",     /botpress\.cloud|botpress\.io/i],
  ["Dialogflow",   /dialogflow|df-messenger/i],
  ["Voiceflow",    /voiceflow/i],
  ["Ada",          /ada\.support/i],
  ["ChatGPT/Custom AI", /openai\.com|chatgpt|gpt-?bot/i],
]

const BOOKING_PROVIDERS: Array<[string, RegExp]> = [
  ["Calendly",   /calendly\.com/i],
  ["Square",     /squareup\.com|square\.site\/book/i],
  ["Booksy",     /booksy\.com/i],
  ["Setmore",    /setmore\.com/i],
  ["Acuity",     /acuityscheduling/i],
  ["SimplyBook", /simplybook\.me/i],
  ["Vagaro",     /vagaro\.com/i],
  ["MindBody",   /mindbodyonline/i],
  ["OpenTable",  /opentable\.com/i],
  ["YouCanBookMe", /youcanbook\.me/i],
  ["Doodle",     /doodle\.com/i],
  ["Reservio",   /reservio\.com/i],
]

const ANALYTICS_PROVIDERS: Array<[string, RegExp]> = [
  ["Google Analytics 4", /gtag\(.*G-[A-Z0-9]+|googletagmanager\.com\/gtag/i],
  ["Google Tag Manager", /googletagmanager\.com\/gtm/i],
  ["Plausible",          /plausible\.io/i],
  ["Fathom",             /usefathom\.com/i],
  ["Mixpanel",           /mixpanel/i],
  ["Segment",            /segment\.com|segment\.io/i],
  ["Hotjar",             /hotjar/i],
  ["Microsoft Clarity",  /clarity\.ms/i],
]

const SOCIAL_PLATFORMS: Array<[string, RegExp]> = [
  ["facebook",  /(?:facebook\.com|fb\.com)\/[^\/\s"']+/i],
  ["instagram", /instagram\.com\/[^\/\s"']+/i],
  ["twitter",   /(?:twitter\.com|x\.com)\/[^\/\s"']+/i],
  ["linkedin",  /linkedin\.com\/(?:company|in)\/[^\/\s"']+/i],
  ["youtube",   /youtube\.com\/(?:@|channel|c|user)\/[^\/\s"']+|youtu\.be\/[^\/\s"']+/i],
  ["tiktok",    /tiktok\.com\/@[^\/\s"']+/i],
  ["pinterest", /pinterest\.com\/[^\/\s"']+/i],
  ["yelp",      /yelp\.com\/biz\/[^\/\s"']+/i],
  ["google",    /(?:goo\.gl\/maps|maps\.google|g\.page)\/[^\/\s"']+/i],
]

const MODERN_FRAMEWORKS = [
  /_next\/static/i,           // Next.js
  /__nuxt|_nuxt\//i,          // Nuxt
  /data-reactroot|react-dom/i,// React
  /data-v-app|__vue/i,        // Vue
  /svelte-/i,                 // Svelte
  /_astro\//i,                // Astro
  /__remix/i,                 // Remix
]

const RESPONSIVE_HINTS = [
  /@media\s*\(/i,
  /\bcontainer-type\s*:/i,
  /\bmin-width\s*:/i,
  /\bmax-width\s*:/i,
  /\bgrid-template-columns\b/i,
  /\bflex-wrap\s*:/i,
  /\bclamp\s*\(/i,
]

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

/** Detect first regex match in a list of [name, regex] tuples */
function detectProvider(html: string, list: Array<[string, RegExp]>): string | null {
  for (const [name, rx] of list) if (rx.test(html)) return name
  return null
}

function detectSocialPlatforms(html: string): string[] {
  const found = new Set<string>()
  for (const [name, rx] of SOCIAL_PLATFORMS) if (rx.test(html)) found.add(name)
  return Array.from(found)
}

function detectModernFramework(html: string): boolean {
  return MODERN_FRAMEWORKS.some(rx => rx.test(html))
}

async function readCappedText(res: Response, limitBytes: number): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return res.text()

  const chunks: Uint8Array[] = []
  let total = 0
  while (total < limitBytes) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.byteLength
  }
  try { await reader.cancel() } catch {}

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged)
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&commat;/gi, "@")
    .replace(/&period;|&dot;/gi, ".")
    .replace(/&amp;/gi, "&")
}

function cleanEmailCandidate(raw: string): string {
  let value = raw
  try { value = decodeURIComponent(value) } catch {}
  return decodeHtmlEntities(value)
    .replace(/^mailto:/i, "")
    .split(/[?#]/)[0]
    .trim()
    .replace(/^["'<(\[]+|[>"'),;:\]]+$/g, "")
    .toLowerCase()
}

function isLikelyPublicEmail(email: string): boolean {
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) return false
  if (email.length > 96) return false
  if (/\.(?:png|jpe?g|gif|webp|svg|css|js|json|ico|pdf)$/i.test(email)) return false
  if (/(?:example|domain|yourname|sentry|wix|wordpress)@/i.test(email)) return false

  const [local, domain] = email.split("@")
  if (!local || !domain) return false
  if (/^[a-f0-9]{16,}$/i.test(local)) return false
  if (/^(?:no-?reply|do-?not-?reply|donotreply|abuse|postmaster)$/i.test(local)) return false
  if (/^(?:example|invalid|localhost)\./i.test(domain)) return false

  return true
}

const ROLE_EMAILS = [
  "info", "contact", "hello", "office", "admin", "support", "sales",
  "reception", "frontdesk", "booking", "appointments", "care", "intake",
  "admissions", "jobs", "careers", "hr", "kontakt", "mail",
]

const PUBLIC_EMAIL_DOMAINS = [
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
  "msn.com", "yahoo.com", "icloud.com", "me.com", "aol.com", "proton.me",
  "protonmail.com",
]

const BAD_EMAIL_DOMAINS = [
  "example.com", "sentry.io", "wix.com", "wixpress.com", "wordpress.com",
  "schema.org", "google.com", "facebook.com", "cloudflare.com",
]

function domainFromUrl(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return ""
  }
}

function isSameOrSubdomain(domain: string, baseDomain: string): boolean {
  return domain === baseDomain || domain.endsWith(`.${baseDomain}`)
}

function isRelevantEmailDomain(email: string, baseDomain: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? ""
  if (!domain) return false
  if (BAD_EMAIL_DOMAINS.some(bad => domain === bad || domain.endsWith(`.${bad}`))) return false
  if (!baseDomain) return true
  if (isSameOrSubdomain(domain, baseDomain)) return true
  return PUBLIC_EMAIL_DOMAINS.includes(domain)
}

function scoreEmail(email: string, baseScore: number, baseDomain = ""): number {
  const domain = email.split("@")[1]?.toLowerCase() ?? ""
  const local = email.split("@")[0]
  const roleIndex = ROLE_EMAILS.indexOf(local)
  const roleScore = roleIndex >= 0 ? 40 - roleIndex : 0
  const personScore = /^[a-z]+[._-][a-z]+$/.test(local) ? 8 : 0
  const domainScore = baseDomain && isSameOrSubdomain(domain, baseDomain)
    ? 70
    : PUBLIC_EMAIL_DOMAINS.includes(domain)
      ? 10
      : 0
  return baseScore + roleScore + personScore + domainScore
}

function decodeCloudflareEmail(encoded: string): string | null {
  if (!/^[a-f0-9]+$/i.test(encoded) || encoded.length < 4) return null
  const key = parseInt(encoded.slice(0, 2), 16)
  let email = ""
  for (let i = 2; i < encoded.length; i += 2) {
    email += String.fromCharCode(parseInt(encoded.slice(i, i + 2), 16) ^ key)
  }
  return email
}

function textWithoutTags(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
}

function normalizeObfuscatedEmailText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/\\x40|\\u0040/gi, "@")
    .replace(/\\x2e|\\u002e/gi, ".")
    .replace(/["'`]\s*\+\s*["'`]/g, "")
    .replace(/\s*(?:\[at\]|\(at\)|\{at\}|&commat;|\bat\b)\s*/gi, "@")
    .replace(/\s*(?:\[dot\]|\(dot\)|\{dot\}|&period;|&dot;|\bdot\b)\s*/gi, ".")
    .replace(/\s*@\s*/g, "@")
    .replace(/\s+\.\s+/g, ".")
}

function extractEmailsFromHtml(html: string, baseUrl = ""): string[] {
  const ranked = new Map<string, number>()
  const baseDomain = domainFromUrl(baseUrl)
  const add = (raw: string, baseScore: number) => {
    for (const part of raw.split(/[\s,;]+/)) {
      const email = cleanEmailCandidate(part)
      if (!isLikelyPublicEmail(email)) continue
      if (!isRelevantEmailDomain(email, baseDomain)) continue
      ranked.set(email, Math.max(ranked.get(email) ?? 0, scoreEmail(email, baseScore, baseDomain)))
    }
  }

  for (const match of html.matchAll(/href=["']mailto:([^"']+)["']/gi)) {
    add(match[1] ?? "", 90)
  }

  for (const match of html.matchAll(/data-cfemail=["']([a-f0-9]+)["']/gi)) {
    const decoded = decodeCloudflareEmail(match[1] ?? "")
    if (decoded) add(decoded, 85)
  }

  for (const match of html.matchAll(/\/cdn-cgi\/l\/email-protection#([a-f0-9]+)/gi)) {
    const decoded = decodeCloudflareEmail(match[1] ?? "")
    if (decoded) add(decoded, 85)
  }

  const normalized = normalizeObfuscatedEmailText(html)
  const visibleText = normalizeObfuscatedEmailText(textWithoutTags(html))

  for (const match of normalized.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) {
    add(match[0], 20)
  }

  for (const match of visibleText.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) {
    add(match[0], 18)
  }

  return Array.from(ranked.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([email]) => email)
    .slice(0, 8)
}

const EMAIL_DISCOVERY_PATHS = [
  "/contact",
  "/contact-us",
  "/about",
  "/about-us",
  "/locations",
  "/service-area",
  "/request-service",
  "/schedule-service",
  "/book-online",
  "/careers",
  "/jobs",
]

function contactPagePriority(haystack: string): number {
  if (/(contact|kontakt|kontakta|contacto|contatti|get[-_\s]?in[-_\s]?touch)/i.test(haystack)) return 100
  if (/(request|schedule|book|appointment|estimate|quote|service[-_\s]?request)/i.test(haystack)) return 80
  if (/(location|service[-_\s]?area|areas[-_\s]?served|office)/i.test(haystack)) return 65
  if (/(about|company|team|staff|our[-_\s]?story)/i.test(haystack)) return 50
  if (/(careers|jobs|join[-_\s]?our[-_\s]?team|employment)/i.test(haystack)) return 35
  return 0
}

function findEmailDiscoveryUrls(html: string, baseUrl: string, maxUrls = 5): string[] {
  const base = new URL(baseUrl)
  const baseHost = base.hostname.replace(/^www\./i, "")
  const found = new Map<string, number>()

  const addUrl = (rawHref: string, score: number) => {
    if (score <= 0) return
    try {
      const next = new URL(rawHref, baseUrl)
      const nextHost = next.hostname.replace(/^www\./i, "")
      if (!/^https?:$/.test(next.protocol)) return
      if (nextHost !== baseHost) return
      if (/\.(?:pdf|docx?|xlsx?|pptx?|zip|jpe?g|png|gif|webp|svg|css|js|ico)$/i.test(next.pathname)) return
      if (/(privacy|terms|legal|cookie|facebook|instagram|linkedin|twitter|x\.com|mailto:|tel:)/i.test(next.toString())) return
      next.hash = ""
      found.set(next.toString(), Math.max(found.get(next.toString()) ?? 0, score))
    } catch {}
  }

  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,240}?)<\/a>/gi)) {
    const href = decodeHtmlEntities(match[1] ?? "").trim()
    const label = decodeHtmlEntities(match[2] ?? "").replace(/<[^>]+>/g, " ")
    const haystack = `${href} ${label}`.toLowerCase()
    addUrl(href, contactPagePriority(haystack))
  }

  for (const path of EMAIL_DISCOVERY_PATHS) {
    addUrl(path, contactPagePriority(path) - 8)
  }

  return Array.from(found.entries())
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
    .map(([url]) => url)
    .filter(url => url !== baseUrl)
    .slice(0, maxUrls)
}

/** Extract content of <title> tag */
function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m ? m[1].trim() : ""
}

/** Extract meta tag content by name or property */
function extractMeta(html: string, attr: string, value: string): string {
  const rx = new RegExp(`<meta[^>]*\\s${attr}=["']${value}["'][^>]*\\scontent=["']([^"']*)["']`, "i")
  const rx2 = new RegExp(`<meta[^>]*\\scontent=["']([^"']*)["'][^>]*\\s${attr}=["']${value}["']`, "i")
  const m = html.match(rx) || html.match(rx2)
  return m ? m[1].trim() : ""
}

/** Run the full audit on a URL */
export async function auditWebsite(url: string): Promise<RealAuditResult> {
  const start = Date.now()
  const empty = (error: string): RealAuditResult => ({
    seo: 0, mobileFriendliness: 0, chatbotPresence: 0, pageSpeed: 0, socialPresence: 0,
    signals: {
      reachable: false, httpStatus: null, isHttps: false, hasViewport: false,
      hasTitle: false, titleLength: 0, hasMetaDescription: false, metaDescriptionLength: 0,
      hasOgTags: false, hasFavicon: false, hasSchemaMarkup: false, hasCanonical: false,
      hasH1: false, h1Count: 0, chatbotProvider: null, bookingProvider: null,
      analyticsProvider: null, hasContactForm: false, hasPhoneLink: false,
      hasEmailLink: false, emails: [], hasAddressSignal: false, socialLinks: [], socialLinkCount: 0,
      responseTimeMs: 0, htmlSizeKb: 0, imgCount: 0, imgWithoutAlt: 0, scriptCount: 0,
      inlineStyleCount: 0, usesModernFramework: false, hasServiceWorker: false,
      hasManifest: false, finalUrl: url, error,
    },
  })

  let normalisedUrl = url.trim()
  if (!/^https?:\/\//i.test(normalisedUrl)) normalisedUrl = "https://" + normalisedUrl

  const isHttps = normalisedUrl.startsWith("https://")
  let html = ""
  let finalUrl = normalisedUrl
  let httpStatus: number | null = null
  let responseTimeMs = 0

  // Try a browser-like UA first, fall back to a polite bot UA if blocked.
  // safeFetch enforces SSRF protection (public-IP-only, redirects re-validated).
  const fetchWithUA = (ua: string) =>
    safeFetch(normalisedUrl, {
      timeoutMs: 8000,
      headers: {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
      },
    })

  try {
    let res = await fetchWithUA(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    )
    // Retry once with a different UA if blocked
    if (res.status === 403 || res.status === 429) {
      res = await fetchWithUA("Mozilla/5.0 (compatible; LaggardScan/1.0; +https://laggardscan.com/bot)")
    }
    responseTimeMs = Date.now() - start
    httpStatus = res.status
    finalUrl = res.url || normalisedUrl

    if (!res.ok) return empty(`HTTP ${res.status}`)

    // Cap at 800KB — anything larger isn't useful for HTML analysis
    const reader = res.body?.getReader()
    if (!reader) {
      html = await res.text()
    } else {
      const chunks: Uint8Array[] = []
      let total = 0
      while (total < 800_000) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        total += value.byteLength
      }
      try { await reader.cancel() } catch {}
      // Concatenate chunks into a single buffer in one pass (avoid O(n²) array concat).
      const merged = new Uint8Array(total)
      let offset = 0
      for (const chunk of chunks) {
        merged.set(chunk, offset)
        offset += chunk.byteLength
      }
      html = new TextDecoder("utf-8", { fatal: false }).decode(merged)
    }
  } catch (e: unknown) {
    if (e instanceof BlockedUrlError) return empty("Blocked: non-public URL")
    if (e instanceof Error) {
      return empty(e.name === "AbortError" ? "Timeout (>8s)" : e.message)
    }
    return empty("Fetch failed")
  }

  const htmlSizeKb = Math.round(html.length / 1024)
  const discoveryUrls = findEmailDiscoveryUrls(html, finalUrl, 5)
  const discoveryPages = await Promise.all(discoveryUrls.map(async discoveryUrl => {
    try {
      const contactRes = await safeFetch(discoveryUrl, {
        timeoutMs: 4500,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LaggardScan/1.0; +https://laggardscan.com/bot)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
        },
      })
      if (!contactRes.ok) return ""
      return readCappedText(contactRes, 300_000)
    } catch {
      return ""
    }
  }))
  const contactSignalHtml = `${html}\n${discoveryPages.filter(Boolean).join("\n")}`

  // ── Extract signals ────────────────────────────────────────
  const title = extractTitle(html)
  const metaDescription = extractMeta(html, "name", "description")
  const hasViewport = /<meta[^>]+name=["']viewport["'][^>]+content=["'][^"']*width=device-width/i.test(html)
  const hasOgTags = /<meta[^>]+property=["']og:/i.test(html)
  const hasFavicon = /<link[^>]+rel=["'](?:shortcut )?icon["']/i.test(html)
  const hasSchemaMarkup = /application\/ld\+json|itemtype=["']https?:\/\/schema\.org/i.test(html)
  const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html)
  const h1Matches = html.match(/<h1\b[^>]*>/gi) ?? []
  const hasManifest = /<link[^>]+rel=["']manifest["']/i.test(html)
  const hasServiceWorker = /serviceWorker\.register|navigator\.serviceWorker/i.test(html)

  const imgMatches = html.match(/<img\b[^>]*>/gi) ?? []
  const imgWithoutAlt = imgMatches.filter(t => !/\salt=["']/i.test(t) || /\salt=["']\s*["']/i.test(t)).length

  const scriptMatches = html.match(/<script\b/gi) ?? []
  const inlineStyleMatches = html.match(/\sstyle=["']/gi) ?? []

  const chatbotProvider   = detectProvider(html, CHATBOT_PROVIDERS)
  const bookingProvider   = detectProvider(html, BOOKING_PROVIDERS)
  const analyticsProvider = detectProvider(html, ANALYTICS_PROVIDERS)
  const socialLinks       = detectSocialPlatforms(html)
  const usesModernFramework = detectModernFramework(html)
  const hasResponsiveHints = RESPONSIVE_HINTS.some(rx => rx.test(html))
  const emails = extractEmailsFromHtml(contactSignalHtml, finalUrl)
  const hasContactForm = /<form\b[\s\S]{0,4000}<(?:input|textarea|button)\b/i.test(contactSignalHtml)
  const hasPhoneLink = /href=["']tel:/i.test(contactSignalHtml)
  const hasEmailLink = /href=["']mailto:/i.test(contactSignalHtml) || emails.length > 0
  const hasAddressSignal = /LocalBusiness|PostalAddress|streetAddress|addressLocality|<address\b/i.test(contactSignalHtml)

  // ── Score each metric (0–100) ──────────────────────────────

  // SEO: core crawlability and local-search metadata. Schema/H1 matter more than social tags.
  let seo = 0
  if (isHttps) seo += 10
  if (title.length >= 10 && title.length <= 70) seo += 20
  else if (title.length > 0) seo += 10
  if (metaDescription.length >= 50 && metaDescription.length <= 170) seo += 16
  else if (metaDescription.length > 0) seo += 8
  if (hasSchemaMarkup) seo += 18
  if (h1Matches.length === 1) seo += 12
  else if (h1Matches.length > 1) seo += 6
  if (hasCanonical) seo += 8
  if (hasOgTags) seo += 8
  if (hasFavicon) seo += 4
  if (hasAddressSignal) seo += 4
  seo = clampScore(seo)

  // Mobile readiness: viewport is the biggest signal; frameworks alone do not prove responsiveness.
  let mobile = hasViewport ? 50 : 0
  if (hasResponsiveHints) mobile += hasViewport ? 22 : 12
  if (/srcset=/i.test(html)) mobile += 8
  if (usesModernFramework) mobile += 7
  if (hasManifest) mobile += 6
  if (hasServiceWorker) mobile += 4
  mobile = clampScore(mobile)

  // Conversion readiness: a booking flow, contact form, or click-to-call link matters even without AI chat.
  let chatbot = 5
  if (chatbotProvider) chatbot = 86
  if (bookingProvider) chatbot = Math.max(chatbot, 72)
  if (hasContactForm) chatbot = Math.max(chatbot, 48)
  if (hasPhoneLink) chatbot = Math.max(chatbot, 34)
  if (hasEmailLink) chatbot = Math.max(chatbot, 28)
  if (chatbotProvider && bookingProvider) chatbot += 8
  if ((chatbotProvider || bookingProvider) && hasContactForm) chatbot += 5
  chatbot = clampScore(chatbot)

  // Page speed: proxy from response time + HTML size + script count
  let speed = 100
  if (responseTimeMs > 800)  speed -= 8
  if (responseTimeMs > 1600) speed -= 14
  if (responseTimeMs > 3000) speed -= 22
  if (responseTimeMs > 5000) speed -= 28
  if (htmlSizeKb > 150) speed -= 6
  if (htmlSizeKb > 350) speed -= 10
  if (htmlSizeKb > 650) speed -= 14
  if (scriptMatches.length > 25) speed -= 8
  if (scriptMatches.length > 50) speed -= 12
  if (inlineStyleMatches.length > 50) speed -= 8
  speed = clampScore(speed)

  // Trust signals: linked socials plus proof the business tracks, brands, and exposes contacts.
  let social = Math.min(socialLinks.length, 4) * 12
  if (analyticsProvider) social += 12
  if (hasOgTags) social += 10
  if (hasFavicon) social += 8
  if (hasSchemaMarkup) social += 10
  if (hasAddressSignal) social += 8
  if (hasPhoneLink) social += 6
  if (hasEmailLink) social += 4
  if (bookingProvider || chatbotProvider) social += 6
  social = clampScore(social)

  return {
    seo, mobileFriendliness: mobile, chatbotPresence: chatbot,
    pageSpeed: speed, socialPresence: social,
    signals: {
      reachable: true, httpStatus, isHttps,
      hasViewport, hasTitle: title.length > 0, titleLength: title.length,
      hasMetaDescription: metaDescription.length > 0, metaDescriptionLength: metaDescription.length,
      hasOgTags, hasFavicon, hasSchemaMarkup, hasCanonical,
      hasH1: h1Matches.length > 0, h1Count: h1Matches.length,
      chatbotProvider, bookingProvider, analyticsProvider,
      hasContactForm, hasPhoneLink, hasEmailLink, emails, hasAddressSignal,
      socialLinks, socialLinkCount: socialLinks.length,
      responseTimeMs, htmlSizeKb,
      imgCount: imgMatches.length, imgWithoutAlt,
      scriptCount: scriptMatches.length, inlineStyleCount: inlineStyleMatches.length,
      usesModernFramework, hasServiceWorker, hasManifest,
      finalUrl, error: null,
    },
  }
}
