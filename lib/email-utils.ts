import type { Lead } from "./types"
import { calcRevenueLeak, calcHealthScore } from "./utils"
import {
  formatCurrency, languageForCountry, emailPrefixesForCountry,
  inferCountryFromCity, type LangCode,
} from "./country-utils"

// ── Legal-entity suffixes per language ────────────────────────────
// "Acme Corp Inc." → "Acme Corp" — these are the things to strip from greetings.
const LEGAL_SUFFIXES: Record<LangCode, string[]> = {
  en: ["Inc.", "Inc", "LLC", "L.L.C.", "Ltd.", "Ltd", "Limited", "Corp.", "Corp", "Corporation", "Co.", "Company", "LLP", "PLC", "P.C.", "P.A."],
  sv: ["AB", "Aktiebolag", "HB", "KB", "Ekonomisk Förening", "Ek. För.", "Stiftelse"],
  da: ["A/S", "ApS", "I/S", "K/S", "P/S", "IVS"],
  no: ["AS", "ASA", "ANS", "DA", "BA", "SA"],
  de: ["GmbH", "AG", "KG", "OHG", "e.K.", "e.V.", "mbH", "UG", "GbR", "Co. KG"],
  fr: ["SAS", "SARL", "SA", "EURL", "SNC", "SCI", "SCS", "SCA", "SASU", "EI"],
  es: ["S.A.", "S.L.", "S.A.U.", "S.L.U.", "S.R.L.", "S.C.", "S. Coop."],
  nl: ["B.V.", "BV", "N.V.", "NV", "V.O.F.", "VOF", "C.V.", "CV"],
}

/** Strip legal-entity suffixes from a business name. "Acme Corp Inc" → "Acme Corp" */
export function cleanBusinessName(name: string, lang: LangCode = "en"): string {
  // Try the lead's language first, then English as a fallback
  const suffixes = [...(LEGAL_SUFFIXES[lang] ?? []), ...LEGAL_SUFFIXES.en]
  let cleaned = name.trim()
  for (const suffix of suffixes) {
    // Match suffix as a whole word at the end, preceded by space or comma
    const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const rx = new RegExp(`[\\s,]+${escaped}\\s*$`, "i")
    cleaned = cleaned.replace(rx, "").trim()
  }
  return cleaned || name // never return empty
}

export function normalizeSenderName(name: string | undefined): string {
  const trimmed = name?.trim()
  if (!trimmed) return ""
  if (/^\[[^\]]+\]$/.test(trimmed)) return trimmed

  return trimmed
    .split(/\s+/)
    .map(part => part
      .split(/([-'])/)
      .map(piece => /^[a-zA-Z]/.test(piece)
        ? piece.charAt(0).toUpperCase() + piece.slice(1).toLowerCase()
        : piece
      )
      .join("")
    )
    .join(" ")
}

// ── Category translations per language ────────────────────────────
const CATEGORY_TRANSLATIONS: Record<LangCode, Record<string, string>> = {
  en: {}, // already English
  sv: {
    "Plumbing": "VVS", "Electrician": "elektriker", "HVAC": "värme och ventilation",
    "Home Services": "hemtjänster", "Dental": "tandvård", "Roofing": "taktäckning",
    "local business": "lokala företag",
  },
  da: {
    "Plumbing": "VVS", "Electrician": "elektriker", "HVAC": "varme og ventilation",
    "Home Services": "hjemmeservice", "Dental": "tandlæge", "Roofing": "tagdækning",
    "local business": "lokale virksomheder",
  },
  no: {
    "Plumbing": "rørlegger", "Electrician": "elektriker", "HVAC": "varme og ventilasjon",
    "Home Services": "hjemmetjenester", "Dental": "tannlege", "Roofing": "taktekking",
    "local business": "lokale bedrifter",
  },
  de: {
    "Plumbing": "Klempnerei", "Electrician": "Elektriker", "HVAC": "HLK",
    "Home Services": "Haushaltsdienste", "Dental": "Zahnärzte", "Roofing": "Dachdeckerei",
    "local business": "lokale Unternehmen",
  },
  fr: {
    "Plumbing": "plomberie", "Electrician": "électricité", "HVAC": "CVC",
    "Home Services": "services à domicile", "Dental": "dentaires", "Roofing": "couverture",
    "local business": "entreprises locales",
  },
  es: {
    "Plumbing": "fontanería", "Electrician": "electricidad", "HVAC": "climatización",
    "Home Services": "servicios domésticos", "Dental": "dentales", "Roofing": "techado",
    "local business": "negocios locales",
  },
  nl: {
    "Plumbing": "loodgieterswerk", "Electrician": "elektrotechniek", "HVAC": "HVAC",
    "Home Services": "huishoudelijke diensten", "Dental": "tandheelkunde", "Roofing": "dakdekkerij",
    "local business": "lokale bedrijven",
  },
}

export function translateCategory(category: string | undefined, lang: LangCode): string {
  if (!category) return CATEGORY_TRANSLATIONS[lang]?.["local business"] ?? "local business"
  return CATEGORY_TRANSLATIONS[lang]?.[category] ?? category.toLowerCase()
}

/** Guess a contact email from a website URL */
export function guessEmail(website: string | null, prefix: string = "info"): string {
  if (!website) return ""
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`)
    let host = url.hostname.toLowerCase()
    if (host.startsWith("www.")) host = host.slice(4)
    return `${prefix}@${host}`
  } catch {
    return ""
  }
}

function domainFromWebsite(website: string | null): string {
  if (!website) return ""
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`)
    return url.hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return ""
  }
}

function normalizeEmail(value: string): string {
  let decoded = value
  try { decoded = decodeURIComponent(decoded) } catch {}
  return decoded
    .replace(/^mailto:/i, "")
    .split(/[?#]/)[0]
    .trim()
    .replace(/^["'<(\[]+|[>"'),;:\]]+$/g, "")
    .toLowerCase()
}

function isUsableContactEmail(email: string): boolean {
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) return false
  if (email.length > 96) return false
  if (/\.(?:png|jpe?g|gif|webp|svg|css|js|json|ico|pdf)$/i.test(email)) return false
  const [local, domain] = email.split("@")
  if (!local || !domain) return false
  if (/^[a-f0-9]{16,}$/i.test(local)) return false
  if (/^(?:no-?reply|do-?not-?reply|donotreply|abuse|postmaster)$/i.test(local)) return false
  return true
}

const PREFERRED_CONTACT_MAILBOXES = [
  "info", "contact", "hello", "office", "admin", "support", "sales",
  "reception", "frontdesk", "booking", "appointments", "care", "intake",
  "admissions", "jobs", "careers", "hr", "kontakt", "mail",
]

function emailPreferenceScore(email: string, websiteDomain: string): number {
  const [local, domain] = email.split("@")
  let score = 0
  if (websiteDomain && (domain === websiteDomain || domain.endsWith(`.${websiteDomain}`))) score += 60
  const mailboxIndex = PREFERRED_CONTACT_MAILBOXES.indexOf(local)
  if (mailboxIndex >= 0) score += 40 - mailboxIndex
  if (/^[a-z]+[._-][a-z]+$/.test(local)) score += 8
  return score
}

export function getDiscoveredEmailsForLead(lead: Lead): string[] {
  const websiteDomain = domainFromWebsite(lead.website)
  const seen = new Set<string>()
  const emails: string[] = []

  for (const raw of lead.realAudit?.signals.emails ?? []) {
    const email = normalizeEmail(raw)
    if (!isUsableContactEmail(email) || seen.has(email)) continue
    seen.add(email)
    emails.push(email)
  }

  return emails.sort((a, b) =>
    emailPreferenceScore(b, websiteDomain) - emailPreferenceScore(a, websiteDomain)
    || a.localeCompare(b)
  )
}

export function bestEmailForLead(lead: Lead, prefix: string = "info"): string {
  return getDiscoveredEmailsForLead(lead)[0] ?? guessEmail(lead.website, prefix)
}

/** Get email prefixes appropriate for the lead's country */
export function getEmailPrefixesForLead(lead: Lead, fallbackCity?: string): readonly string[] {
  const country = lead.country ?? (fallbackCity ? inferCountryFromCity(fallbackCity) : undefined)
  return emailPrefixesForCountry(country)
}

/** Get the resolved country for a lead, falling back to inference from city if needed */
export function getLeadCountry(lead: Lead, fallbackCity?: string): string {
  return lead.country ?? (fallbackCity ? inferCountryFromCity(fallbackCity) : "US")
}

// ── Localised template content ────────────────────────────────────

type TemplatePack = { subject: string; body: string }

const TEMPLATES: Record<LangCode, TemplatePack> = {
  en: {
    subject: "Quick fix for {name}",
    body: [
      "Hi {name},",
      "",
      "I noticed there isn't a clear instant quote path for after-hours inquiries.",
      "",
      "That can mean a customer waits, then calls someone else.",
      "",
      "I set up AI follow-up that texts back, collects the job details, and helps book the next step.",
      "",
      "Want me to send a 2-minute demo?",
      "",
      "Best,",
      "{senderName}",
    ].join("\n"),
  },
  sv: {
    subject: "Snabb ide for {name}",
    body: [
      "Hej {name},",
      "",
      "Jag tittade pa {category} i ert omrade och sag nagra saker pa er webbplats som kan gora det svarare for besokare att bli bokningar eller forfragningar.",
      "",
      "Det viktigaste jag sag: {issues}.",
      "",
      "Jag hjalper lokala foretag att gora sadana svaga punkter tydligare: battre kontaktvagar, snabbare sidor och enklare uppfoljning.",
      "",
      "Ar det vart att jag skickar en snabb 2-minuters audit for {name} med de konkreta forbattrigar jag skulle foresla?",
      "",
      "Vanliga halsningar,",
      "{senderName}",
    ].join("\n"),
  },
  da: {
    subject: "Hurtig ide til {name}",
    body: [
      "Hej {name},",
      "",
      "Jeg kiggede pa lokale {category} i jeres omrade og sa et par ting pa jeres hjemmeside, som kan gore det svaerere for besogende at blive til bookinger eller henvendelser.",
      "",
      "Det vigtigste jeg sa: {issues}.",
      "",
      "Jeg hjaelper lokale virksomheder med at gore den slags svage punkter til tydeligere kontaktveje, hurtigere sider og bedre opfolgning.",
      "",
      "Vil det vaere relevant, hvis jeg sender en hurtig 2-minutters audit for {name} med de konkrete forbedringer, jeg ville foresla?",
      "",
      "Bedste hilsner,",
      "{senderName}",
    ].join("\n"),
  },
  no: {
    subject: "Rask ide for {name}",
    body: [
      "Hei {name},",
      "",
      "Jeg sa pa lokale {category} i omradet deres og la merke til noen ting pa nettsiden som kan gjore det vanskeligere for besokende a bli til bookinger eller henvendelser.",
      "",
      "Det viktigste jeg sa: {issues}.",
      "",
      "Jeg hjelper lokale bedrifter med a gjore slike svake punkter til tydeligere kontaktveier, raskere sider og bedre oppfolging.",
      "",
      "Vil det vaere nyttig om jeg sender en rask 2-minutters audit for {name} med de konkrete forbedringene jeg ville foreslatt?",
      "",
      "Vennlig hilsen,",
      "{senderName}",
    ].join("\n"),
  },
  de: {
    subject: "Kurze Idee fur {name}",
    body: [
      "Hallo {name},",
      "",
      "ich habe mir {category} in Ihrer Region angesehen und ein paar Punkte auf Ihrer Website bemerkt, die es Besuchern schwerer machen konnten, eine Anfrage oder Buchung auszulosen.",
      "",
      "Der wichtigste Punkt: {issues}.",
      "",
      "Ich helfe lokalen Unternehmen dabei, solche Schwachstellen in klarere Kontaktwege, schnellere Seiten und bessere Nachverfolgung umzuwandeln.",
      "",
      "Soll ich Ihnen einen kurzen 2-Minuten-Audit fur {name} mit den konkreten Verbesserungen schicken, die ich vorschlagen wurde?",
      "",
      "Beste Grusse,",
      "{senderName}",
    ].join("\n"),
  },
  fr: {
    subject: "Petite idee pour {name}",
    body: [
      "Bonjour {name},",
      "",
      "Je regardais des entreprises de {category} dans votre region et j'ai remarque quelques points sur votre site qui peuvent rendre plus difficile la conversion des visiteurs en demandes ou reservations.",
      "",
      "Le principal point que j'ai vu : {issues}.",
      "",
      "J'aide les entreprises locales a transformer ce type de faiblesse en parcours de contact plus clairs, pages plus rapides et meilleur suivi.",
      "",
      "Serait-il utile que je vous envoie un audit rapide de 2 minutes pour {name}, avec les ameliorations concretes que je proposerais ?",
      "",
      "Cordialement,",
      "{senderName}",
    ].join("\n"),
  },
  es: {
    subject: "Idea rapida para {name}",
    body: [
      "Hola {name},",
      "",
      "Estuve revisando empresas de {category} en su zona y note algunos puntos en su sitio web que podrian hacer mas dificil convertir visitantes en reservas o consultas.",
      "",
      "El punto principal que vi: {issues}.",
      "",
      "Ayudo a negocios locales a convertir este tipo de puntos debiles en rutas de contacto mas claras, paginas mas rapidas y mejor seguimiento.",
      "",
      "Valdria la pena que les envie una auditoria rapida de 2 minutos para {name} con las mejoras concretas que sugeriria?",
      "",
      "Saludos,",
      "{senderName}",
    ].join("\n"),
  },
  nl: {
    subject: "Kort idee voor {name}",
    body: [
      "Hallo {name},",
      "",
      "Ik keek naar lokale {category}-bedrijven in jullie regio en zag een paar punten op jullie website die het lastiger kunnen maken om bezoekers om te zetten in aanvragen of boekingen.",
      "",
      "Het belangrijkste punt dat ik zag: {issues}.",
      "",
      "Ik help lokale bedrijven om zulke zwakke plekken om te zetten in duidelijkere contactroutes, snellere pagina's en betere opvolging.",
      "",
      "Zal ik een korte audit van 2 minuten voor {name} sturen met de concrete verbeteringen die ik zou voorstellen?",
      "",
      "Met vriendelijke groet,",
      "{senderName}",
    ].join("\n"),
  },
}

// ── Issue phrasing per language ───────────────────────────────────

const ISSUE_PHRASES: Record<LangCode, Record<string, string>> = {
  en: {
    noHttps:   "the contact path could be clearer for visitors",
    noViewport:"the contact path could be easier on phones",
    noBot:     "there's no clear instant quote or booking path for after-hours inquiries",
    noSchema:  "the site could make the service area and contact path clearer",
    slow:      "the site may respond slowly when someone is trying to request service",
    noTitle:   "the quote path could be clearer from the website",
    fallback:  "there isn't a clear instant quote path",
    noSite:    "your business has no website yet",
    oldSite:   "your current website appears outdated",
    needsBot:  "the site has no automated lead capture",
  },
  sv: {
    noHttps:   "er webbplats inte använder HTTPS (Chrome flaggar den som 'Inte säker')",
    noViewport:"sajten inte är mobilanpassad – den visas felaktigt på telefoner",
    noBot:     "ni inte har någon chatbot eller bokningssystem – kunder som hör av sig efter stängning får inget svar",
    noSchema:  "sajten saknar strukturerad data (schema.org), så Google kan inte visa er i utökade lokala sökresultat",
    slow:      "förstasidan tar {sec}s att svara, och 53% av mobilanvändare lämnar sajten efter 3 sekunder",
    noTitle:   "sajten saknar grundläggande SEO-taggar (sidtitel eller meta-beskrivning)",
    fallback:  "sajten saknar viktiga element för att fånga upp besökare och omvandla dem till kunder",
    noSite:    "ert företag saknar webbplats helt",
    oldSite:   "er nuvarande webbplats verkar föråldrad",
    needsBot:  "sajten saknar chatbot eller automatiskt bokningssystem för att fånga upp kunder dygnet runt",
  },
  da: {
    noHttps: "jeres site ikke bruger HTTPS",
    noViewport: "der ikke er en mobile viewport-tag",
    noBot: "der hverken er chatbot eller bookingsystem – kunder efter lukketid får intet svar",
    noSchema: "der mangler schema.org-markup",
    slow: "forsiden tager {sec}s at indlæse",
    noTitle: "siden mangler grundlæggende SEO-tags",
    fallback: "siden mangler vigtig konverteringsinfrastruktur",
    noSite: "jeres virksomhed endnu ikke har en hjemmeside",
    oldSite: "jeres nuværende hjemmeside virker forældet",
    needsBot: "siden mangler automatiseret kundebehandling",
  },
  no: {
    noHttps: "nettsiden ikke bruker HTTPS",
    noViewport: "det mangler mobile viewport-tag",
    noBot: "det verken er chatbot eller bookingsystem – kunder etter stengetid får ingen respons",
    noSchema: "schema.org-markup mangler",
    slow: "forsiden bruker {sec}s på å svare",
    noTitle: "siden mangler grunnleggende SEO-tagger",
    fallback: "siden mangler viktig konverteringsinfrastruktur",
    noSite: "bedriften deres ikke har nettside ennå",
    oldSite: "nåværende nettside virker utdatert",
    needsBot: "siden mangler automatisert kundehåndtering",
  },
  de: {
    noHttps: "Ihre Website nicht HTTPS verwendet (Chrome warnt davor)",
    noViewport: "kein Mobile-Viewport-Tag vorhanden ist, sodass die Seite auf Smartphones falsch dargestellt wird",
    noBot: "kein Chatbot oder Buchungssystem installiert ist – Anfragen außerhalb der Geschäftszeiten bleiben unbeantwortet",
    noSchema: "kein schema.org-Markup vorhanden ist",
    slow: "die Startseite {sec}s zum Laden braucht",
    noTitle: "wichtige SEO-Tags fehlen",
    fallback: "wichtige Conversion-Infrastruktur fehlt",
    noSite: "Ihr Unternehmen noch keine Website hat",
    oldSite: "Ihre aktuelle Website veraltet wirkt",
    needsBot: "die Seite keine automatische Lead-Erfassung hat",
  },
  fr: {
    noHttps: "votre site n'utilise pas HTTPS",
    noViewport: "il n'y a pas de balise viewport mobile",
    noBot: "il n'y a ni chatbot ni système de réservation – les demandes après les heures de bureau restent sans réponse",
    noSchema: "il manque le balisage schema.org",
    slow: "la page d'accueil prend {sec}s à charger",
    noTitle: "des balises SEO essentielles manquent",
    fallback: "des éléments clés de conversion sont manquants",
    noSite: "votre entreprise n'a pas encore de site web",
    oldSite: "votre site actuel semble obsolète",
    needsBot: "le site n'a pas de capture de leads automatisée",
  },
  es: {
    noHttps: "su sitio no usa HTTPS",
    noViewport: "no hay etiqueta viewport móvil",
    noBot: "no hay chatbot ni sistema de reservas – los leads fuera de horario quedan sin respuesta",
    noSchema: "falta el marcado schema.org",
    slow: "la página tarda {sec}s en cargar",
    noTitle: "faltan etiquetas SEO básicas",
    fallback: "falta infraestructura de conversión clave",
    noSite: "su negocio aún no tiene sitio web",
    oldSite: "su sitio actual parece desactualizado",
    needsBot: "el sitio no tiene captura automática de leads",
  },
  nl: {
    noHttps: "jullie site geen HTTPS gebruikt",
    noViewport: "er geen mobile viewport-tag is",
    noBot: "er geen chatbot of boekingssysteem is – leads buiten kantooruren blijven onbeantwoord",
    noSchema: "schema.org-markup ontbreekt",
    slow: "de homepage {sec}s nodig heeft om te laden",
    noTitle: "essentiële SEO-tags ontbreken",
    fallback: "belangrijke conversie-infrastructuur ontbreekt",
    noSite: "jullie bedrijf nog geen website heeft",
    oldSite: "jullie huidige site verouderd lijkt",
    needsBot: "de site geen automatische leadcapture heeft",
  },
}

/** Build the "issues" phrase from real audit signals, localised */
function buildIssuesPhrase(lead: Lead, lang: LangCode): string {
  const phrases = ISSUE_PHRASES[lang]
  const signals = lead.realAudit?.signals

  if (lead.status === "No Website") return phrases.noSite

  if (signals) {
    const found: string[] = []
    if (!signals.isHttps)              found.push(phrases.noHttps)
    if (!signals.hasViewport)          found.push(phrases.noViewport)
    if (!signals.chatbotProvider && !signals.bookingProvider) found.push(phrases.noBot)
    if (!signals.hasSchemaMarkup)      found.push(phrases.noSchema)
    if (signals.responseTimeMs > 3000) found.push(phrases.slow.replace("{sec}", (signals.responseTimeMs/1000).toFixed(1)))
    if (!signals.hasTitle || !signals.hasMetaDescription) found.push(phrases.noTitle)
    return found.length > 0 ? found.slice(0, 2).join(lang === "en" ? " and " : " och ") : phrases.fallback
  }

  if (lead.status === "Old Website") return phrases.oldSite
  return phrases.needsBot
}

/** Render a template string with {variable} placeholders, country-aware */
export function renderTemplate(
  template: string,
  lead: Lead,
  opts: { fallbackCity?: string; senderName?: string } = {},
): string {
  const country = getLeadCountry(lead, opts.fallbackCity)
  const lang = languageForCountry(country)
  const revenueLeak = calcRevenueLeak(lead)
  const healthScore = calcHealthScore(lead)

  const vars: Record<string, string> = {
    name: cleanBusinessName(lead.name, lang),
    category: translateCategory(lead.category, lang),
    website: lead.website ?? "",
    domain: lead.website ? lead.website.replace(/^https?:\/\//, "").replace(/\/.*/, "") : "",
    phone: lead.phone ?? "",
    rating: lead.rating > 0 ? String(lead.rating) : "",
    // {reviews} is intentionally NOT exposed — synthetic value, credibility risk.
    revenueLeak: formatCurrency(revenueLeak, country),
    // -1 means "not audited yet" — expose blank rather than a misleading number.
    healthScore: healthScore >= 0 ? String(healthScore) : "",
    issues: buildIssuesPhrase(lead, lang),
    senderName: normalizeSenderName(opts.senderName) || senderNamePlaceholder(lang),
  }

  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}

/** Placeholder text shown when no sender name has been configured yet */
function senderNamePlaceholder(lang: LangCode): string {
  switch (lang) {
    case "sv": return "[Ditt namn]"
    case "da": return "[Dit navn]"
    case "no": return "[Ditt navn]"
    case "de": return "[Ihr Name]"
    case "fr": return "[Votre nom]"
    case "es": return "[Su nombre]"
    case "nl": return "[Jouw naam]"
    default:   return "[Your name]"
  }
}

/** Build a Gmail compose URL */
export function buildGmailUrl(opts: { to: string; subject: string; body: string }): string {
  const params = new URLSearchParams({
    view: "cm", fs: "1", tf: "1",
    to: opts.to, su: opts.subject, body: opts.body,
  })
  return `https://mail.google.com/mail/?${params.toString()}`
}

/** Build a mailto: URL */
export function buildMailtoUrl(opts: { to: string; subject: string; body: string }): string {
  const params = new URLSearchParams({ subject: opts.subject, body: opts.body })
  return `mailto:${opts.to}?${params.toString()}`
}

/** Get the template for a specific language */
export function getTemplate(lang: LangCode): TemplatePack {
  return TEMPLATES[lang] ?? TEMPLATES.en
}

/** Backward-compat: default English template (will be replaced based on detected country) */
export const DEFAULT_SUBJECT = TEMPLATES.en.subject
export const DEFAULT_BODY    = TEMPLATES.en.body

/** Legacy export — replaced by getEmailPrefixesForLead but kept for API compat */
export const EMAIL_PREFIXES = ["info", "contact", "hello", "office", "team", "admin"] as const

/** Get a human-readable language name */
export function languageName(lang: LangCode): string {
  const names: Record<LangCode, string> = {
    en: "English", sv: "Svenska", da: "Dansk", no: "Norsk",
    de: "Deutsch", fr: "Français", es: "Español", nl: "Nederlands",
  }
  return names[lang]
}

export const ALL_LANGUAGES: LangCode[] = ["en", "sv", "da", "no", "de", "fr", "es", "nl"]
