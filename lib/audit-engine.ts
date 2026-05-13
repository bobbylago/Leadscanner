/**
 * Real website audit engine.
 * Fetches the homepage and analyses the HTML for actual digital health signals.
 */

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
      analyticsProvider: null, socialLinks: [], socialLinkCount: 0,
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

  // Try a browser-like UA first, fall back to a polite bot UA if blocked
  const fetchWithUA = async (ua: string) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch(normalisedUrl, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": ua,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
        },
      })
      return res
    } finally { clearTimeout(timeout) }
  }

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
      html = new TextDecoder("utf-8", { fatal: false }).decode(
        new Uint8Array(chunks.reduce<number[]>((acc, c) => acc.concat(Array.from(c)), []))
      )
    }
  } catch (e: any) {
    return empty(e.name === "AbortError" ? "Timeout (>8s)" : e.message || "Fetch failed")
  }

  const htmlSizeKb = Math.round(html.length / 1024)

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

  // ── Score each metric (0–100) ──────────────────────────────

  // SEO: title, meta description, OG, canonical, schema, H1
  let seo = 0
  if (title.length >= 10 && title.length <= 70) seo += 22
  else if (title.length > 0) seo += 12
  if (metaDescription.length >= 50 && metaDescription.length <= 160) seo += 20
  else if (metaDescription.length > 0) seo += 10
  if (hasOgTags) seo += 12
  if (hasCanonical) seo += 10
  if (hasSchemaMarkup) seo += 18
  if (h1Matches.length === 1) seo += 10
  else if (h1Matches.length > 1) seo += 5
  if (isHttps) seo += 8
  seo = Math.min(100, seo)

  // Mobile friendliness: viewport, modern framework, manifest, responsive hints
  let mobile = 0
  if (hasViewport) mobile += 50
  if (usesModernFramework) mobile += 20
  if (hasManifest) mobile += 8
  if (hasServiceWorker) mobile += 8
  if (/srcset=/i.test(html)) mobile += 8
  if (/@media\s*\(/i.test(html) || /min-width|max-width/i.test(html)) mobile += 6
  mobile = Math.min(100, mobile)

  // Chatbot presence: binary signal mostly
  let chatbot = 0
  if (chatbotProvider) chatbot = 90
  else if (bookingProvider) chatbot = 45            // booking flow exists
  else if (/<form\b[^>]*>[\s\S]{0,2000}<input/i.test(html)) chatbot = 18  // any contact form
  else chatbot = 5

  // Page speed: proxy from response time + HTML size + script count
  let speed = 100
  if (responseTimeMs > 500)  speed -= 10
  if (responseTimeMs > 1500) speed -= 15
  if (responseTimeMs > 3000) speed -= 20
  if (responseTimeMs > 5000) speed -= 20
  if (htmlSizeKb > 100) speed -= 8
  if (htmlSizeKb > 300) speed -= 12
  if (htmlSizeKb > 500) speed -= 15
  if (scriptMatches.length > 30) speed -= 10
  if (scriptMatches.length > 60) speed -= 15
  if (inlineStyleMatches.length > 50) speed -= 8
  if (!usesModernFramework && scriptMatches.length > 20) speed -= 5
  speed = Math.max(0, Math.min(100, speed))

  // Social: count distinct platforms (cap at 6)
  let social = Math.min(socialLinks.length, 6) * 14
  if (analyticsProvider) social += 8
  if (hasOgTags) social += 8
  social = Math.min(100, social)

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
      socialLinks, socialLinkCount: socialLinks.length,
      responseTimeMs, htmlSizeKb,
      imgCount: imgMatches.length, imgWithoutAlt,
      scriptCount: scriptMatches.length, inlineStyleCount: inlineStyleMatches.length,
      usesModernFramework, hasServiceWorker, hasManifest,
      finalUrl, error: null,
    },
  }
}
