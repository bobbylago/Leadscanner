import type { Lead } from "./types"
import { calcRevenueLeak, calcHealthScore } from "./utils"
import {
  formatCurrency, languageForCountry, emailPrefixesForCountry,
  inferCountryFromCity, type LangCode,
} from "./country-utils"

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
      "Issues like these typically cost local businesses an estimated {revenueLeak}/month in missed bookings and conversions.",
      "",
      "I've built a working prototype that fixes this — happy to share a quick 2-minute demo specifically for {name}. Worth a look?",
      "",
      "Best,",
      "[Your name]",
    ].join("\n"),
  },
  sv: {
    subject: "Snabb fråga om {name}s digitala närvaro",
    body: [
      "Hej {name},",
      "",
      "Jag tittade på lokala {category}-företag i ert område och gjorde en snabb digital granskning av er webbplats.",
      "",
      "Jag noterade att {issues}.",
      "",
      "Den här typen av problem brukar kosta lokala företag ungefär {revenueLeak}/månad i missade bokningar och konverteringar.",
      "",
      "Jag har byggt en fungerande prototyp som löser det här – kan jag visa en 2-minuters demo specifikt för {name}? Värt en titt?",
      "",
      "Vänliga hälsningar,",
      "[Ditt namn]",
    ].join("\n"),
  },
  da: {
    subject: "Hurtigt spørgsmål om {name}s online tilstedeværelse",
    body: [
      "Hej {name},",
      "",
      "Jeg kiggede på lokale {category}-virksomheder i jeres område og lavede en hurtig digital analyse af jeres hjemmeside.",
      "",
      "Jeg bemærkede at {issues}.",
      "",
      "Den slags problemer koster typisk lokale virksomheder omkring {revenueLeak}/måned i tabte bookinger og konverteringer.",
      "",
      "Jeg har bygget en fungerende prototype, der løser dette – kan jeg vise en hurtig 2-minutters demo for {name}? Værd at se?",
      "",
      "Bedste hilsner,",
      "[Dit navn]",
    ].join("\n"),
  },
  no: {
    subject: "Kort spørsmål om {name}s digitale tilstedeværelse",
    body: [
      "Hei {name},",
      "",
      "Jeg så på lokale {category}-bedrifter i området deres og gjorde en rask digital analyse av nettsiden deres.",
      "",
      "Jeg la merke til at {issues}.",
      "",
      "Slike problemer koster vanligvis lokale bedrifter rundt {revenueLeak}/måned i tapte bookinger og konverteringer.",
      "",
      "Jeg har bygget en prototype som løser dette – kan jeg vise en 2-minutters demo for {name}? Verdt en titt?",
      "",
      "Vennlig hilsen,",
      "[Ditt navn]",
    ].join("\n"),
  },
  de: {
    subject: "Kurze Frage zur Online-Präsenz von {name}",
    body: [
      "Hallo {name}-Team,",
      "",
      "ich habe mir {category}-Unternehmen in Ihrer Region angesehen und einen schnellen Digital-Audit Ihrer Website durchgeführt.",
      "",
      "Mir ist aufgefallen, dass {issues}.",
      "",
      "Solche Probleme kosten lokale Unternehmen typischerweise rund {revenueLeak}/Monat an verlorenen Buchungen und Conversions.",
      "",
      "Ich habe einen funktionierenden Prototyp gebaut, der genau das löst – darf ich eine 2-minütige Demo speziell für {name} zeigen?",
      "",
      "Beste Grüße,",
      "[Ihr Name]",
    ].join("\n"),
  },
  fr: {
    subject: "Petite question concernant la présence en ligne de {name}",
    body: [
      "Bonjour l'équipe {name},",
      "",
      "Je faisais des recherches sur les entreprises {category} de votre région et j'ai effectué un audit digital rapide de votre site.",
      "",
      "J'ai remarqué que {issues}.",
      "",
      "Ce type de problème coûte généralement aux entreprises locales environ {revenueLeak}/mois en réservations et conversions perdues.",
      "",
      "J'ai créé un prototype fonctionnel qui corrige ce problème — puis-je vous montrer une démo de 2 minutes spécifique à {name} ?",
      "",
      "Cordialement,",
      "[Votre nom]",
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
      "[Su nombre]",
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
      "[Jouw naam]",
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
export function renderTemplate(template: string, lead: Lead, opts: { fallbackCity?: string } = {}): string {
  const country = getLeadCountry(lead, opts.fallbackCity)
  const lang = languageForCountry(country)
  const revenueLeak = calcRevenueLeak(lead)
  const healthScore = calcHealthScore(lead)

  const vars: Record<string, string> = {
    name: lead.name,
    category: lead.category ?? "local business",
    website: lead.website ?? "",
    domain: lead.website ? lead.website.replace(/^https?:\/\//, "").replace(/\/.*/, "") : "",
    phone: lead.phone ?? "",
    rating: String(lead.rating),
    // {reviews} is intentionally NOT exposed — the value is synthetic and citing it
    // in client outreach is a credibility risk. If a real value is wired up later
    // (Google Places API), re-add it here.
    revenueLeak: formatCurrency(revenueLeak, country),
    healthScore: String(healthScore),
    issues: buildIssuesPhrase(lead, lang),
  }

  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
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
