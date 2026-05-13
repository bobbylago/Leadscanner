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
    subject: "Quick question about {name}'s online presence",
    body: [
      "Hi {name} team,",
      "",
      "I was researching {category} businesses in your area and ran a digital health audit on your site.",
      "",
      "I noticed {issues}.",
      "",
      "Issues like these typically cost local businesses around {revenueLeak}/month in missed bookings and conversions.",
      "",
      "I've built a working prototype that fixes this — happy to share a quick 2-minute demo specifically for {name}. Worth a look?",
      "",
      "Best,",
      "{senderName}",
    ].join("\n"),
  },
  sv: {
    subject: "Snabb fråga om {name}s digitala närvaro",
    body: [
      "Hej {name},",
      "",
      "Jag tittade på {category} i ert område och gjorde en snabb digital granskning av er webbplats.",
      "",
      "Jag noterade att {issues}.",
      "",
      "Den här typen av problem brukar kosta lokala företag ungefär {revenueLeak}/månad i missade bokningar och konverteringar.",
      "",
      "Jag har byggt en fungerande prototyp som löser det här – kan jag visa en 2-minuters demo specifikt för {name}? Värt en titt?",
      "",
      "Vänliga hälsningar,",
      "{senderName}",
    ].join("\n"),
  },
  da: {
    subject: "Hurtigt spørgsmål om {name}s online tilstedeværelse",
    body: [
      "Hej {name},",
      "",
      "Jeg kiggede på lokale {category} i jeres område og lavede en hurtig digital analyse af jeres hjemmeside.",
      "",
      "Jeg bemærkede at {issues}.",
      "",
      "Den slags problemer koster typisk lokale virksomheder omkring {revenueLeak}/måned i tabte bookinger og konverteringer.",
      "",
      "Jeg har bygget en fungerende prototype, der løser dette – kan jeg vise en hurtig 2-minutters demo for {name}? Værd at se?",
      "",
      "Bedste hilsner,",
      "{senderName}",
    ].join("\n"),
  },
  no: {
    subject: "Kort spørsmål om {name}s digitale tilstedeværelse",
    body: [
      "Hei {name},",
      "",
      "Jeg så på lokale {category} i området deres og gjorde en rask digital analyse av nettsiden deres.",
      "",
      "Jeg la merke til at {issues}.",
      "",
      "Slike problemer koster vanligvis lokale bedrifter rundt {revenueLeak}/måned i tapte bookinger og konverteringer.",
      "",
      "Jeg har bygget en prototype som løser dette – kan jeg vise en 2-minutters demo for {name}? Verdt en titt?",
      "",
      "Vennlig hilsen,",
      "{senderName}",
    ].join("\n"),
  },
  de: {
    subject: "Kurze Frage zur Online-Präsenz von {name}",
    body: [
      "Hallo {name}-Team,",
      "",
      "ich habe mir {category} in Ihrer Region angesehen und einen schnellen Digital-Audit Ihrer Website durchgeführt.",
      "",
      "Mir ist aufgefallen, dass {issues}.",
      "",
      "Solche Probleme kosten lokale Unternehmen typischerweise rund {revenueLeak}/Monat an verlorenen Buchungen und Conversions.",
      "",
      "Ich habe einen funktionierenden Prototyp gebaut, der genau das löst – darf ich eine 2-minütige Demo speziell für {name} zeigen?",
      "",
      "Beste Grüße,",
      "{senderName}",
    ].join("\n"),
  },
  fr: {
    subject: "Petite question concernant la présence en ligne de {name}",
    body: [
      "Bonjour l'équipe {name},",
      "",
      "Je faisais des recherches sur les entreprises de {category} de votre région et j'ai effectué un audit digital rapide de votre site.",
      "",
      "J'ai remarqué que {issues}.",
      "",
      "Ce type de problème coûte généralement aux entreprises locales environ {revenueLeak}/mois en réservations et conversions perdues.",
      "",
      "J'ai créé un prototype fonctionnel qui corrige ce problème — puis-je vous montrer une démo de 2 minutes spécifique à {name} ?",
      "",
      "Cordialement,",
      "{senderName}",
    ].join("\n"),
  },
  es: {
    subject: "Consulta rápida sobre la presencia online de {name}",
    body: [
      "Hola equipo de {name},",
      "",
      "Estuve investigando empresas de {category} en su zona y realicé una auditoría digital rápida de su sitio web.",
      "",
      "Noté que {issues}.",
      "",
      "Este tipo de problemas suele costarle a los negocios locales unos {revenueLeak}/mes en reservas y conversiones perdidas.",
      "",
      "He creado un prototipo funcional que soluciona esto — ¿les muestro una demo de 2 minutos específica para {name}?",
      "",
      "Saludos,",
      "{senderName}",
    ].join("\n"),
  },
  nl: {
    subject: "Korte vraag over de online aanwezigheid van {name}",
    body: [
      "Hallo {name} team,",
      "",
      "Ik keek naar lokale {category}-bedrijven in jullie regio en deed een snelle digitale audit van jullie website.",
      "",
      "Ik merkte op dat {issues}.",
      "",
      "Dit soort problemen kost lokale bedrijven gemiddeld zo'n {revenueLeak}/maand aan gemiste boekingen en conversies.",
      "",
      "Ik heb een werkend prototype gebouwd dat dit oplost — zal ik een 2-minuten demo specifiek voor {name} laten zien?",
      "",
      "Met vriendelijke groet,",
      "{senderName}",
    ].join("\n"),
  },
}

// ── Issue phrasing per language ───────────────────────────────────

const ISSUE_PHRASES: Record<LangCode, Record<string, string>> = {
  en: {
    noHttps:   "your site isn't using HTTPS (Chrome flags it as 'Not Secure')",
    noViewport:"there's no mobile viewport meta tag, so it renders incorrectly on phones",
    noBot:     "there's no chatbot or booking system, so after-hours leads go unanswered",
    noSchema:  "there's no schema.org markup, so Google can't show rich local results",
    slow:      "the homepage takes {sec}s to respond, and 53% of mobile users bounce after 3s",
    noTitle:   "the site is missing core SEO tags (title or meta description)",
    fallback:  "the site is missing key conversion infrastructure",
    noSite:    "your business has no website yet",
    oldSite:   "your current website appears outdated",
    needsBot:  "the site has no automated lead capture",
  },
  sv: {
    noHttps:   "er webbplats inte använder HTTPS (Chrome flaggar den som 'Inte säker')",
    noViewport:"det inte finns någon mobile viewport-tagg, så sajten visas felaktigt på telefoner",
    noBot:     "det inte finns någon chatbot eller bokningssystem – kunder som kommer efter stängning får inget svar",
    noSchema:  "det inte finns någon schema.org-markup, så Google kan inte visa rika lokala resultat",
    slow:      "förstasidan tar {sec}s att svara, och 53% av mobilanvändare lämnar sajten efter 3s",
    noTitle:   "sajten saknar grundläggande SEO-taggar (title eller meta description)",
    fallback:  "sajten saknar viktig konverteringsinfrastruktur",
    noSite:    "ert företag inte har någon webbplats ännu",
    oldSite:   "er nuvarande webbplats verkar föråldrad",
    needsBot:  "sajten inte har någon automatiserad kundbehandling",
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
    rating: String(lead.rating),
    // {reviews} is intentionally NOT exposed — synthetic value, credibility risk.
    revenueLeak: formatCurrency(revenueLeak, country),
    healthScore: String(healthScore),
    issues: buildIssuesPhrase(lead, lang),
    senderName: opts.senderName?.trim() || senderNamePlaceholder(lang),
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
