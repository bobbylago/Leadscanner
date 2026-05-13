/**
 * Country detection, currency formatting, and template localisation.
 */

// ── Locale groups ────────────────────────────────────────────────

const EUR_COUNTRIES = new Set(["DE","FR","ES","IT","NL","BE","AT","IE","PT","GR","FI","LU","SK","SI","EE","LV","LT","MT","CY","HR"])
const GBP_COUNTRIES = new Set(["GB","UK"])
const SEK_COUNTRIES = new Set(["SE"])
const NOK_COUNTRIES = new Set(["NO"])
const DKK_COUNTRIES = new Set(["DK"])
const CHF_COUNTRIES = new Set(["CH","LI"])
const CAD_COUNTRIES = new Set(["CA"])
const AUD_COUNTRIES = new Set(["AU"])
const NZD_COUNTRIES = new Set(["NZ"])

// Languages spoken — used to pick template language
const SV_COUNTRIES = new Set(["SE"])
const DA_COUNTRIES = new Set(["DK"])
const NO_COUNTRIES = new Set(["NO"])
const DE_COUNTRIES = new Set(["DE","AT","CH","LI"])
const FR_COUNTRIES = new Set(["FR","BE","LU","MC"])
const ES_COUNTRIES = new Set(["ES","MX","AR","CO","CL","PE"])
const NL_COUNTRIES = new Set(["NL"])

export type LangCode = "en" | "sv" | "da" | "no" | "de" | "fr" | "es" | "nl"

/** Normalise a country code (handles "us", "USA", "GB-ENG", etc.) */
export function normaliseCountry(country?: string | null): string {
  if (!country) return "US"
  let c = country.trim().toUpperCase()
  if (c.length > 2) c = c.slice(0, 2)
  if (c === "UK") c = "GB"
  return c
}

/** Pick template language for a country */
export function languageForCountry(country?: string | null): LangCode {
  const c = normaliseCountry(country)
  if (SV_COUNTRIES.has(c)) return "sv"
  if (DA_COUNTRIES.has(c)) return "da"
  if (NO_COUNTRIES.has(c)) return "no"
  if (DE_COUNTRIES.has(c)) return "de"
  if (FR_COUNTRIES.has(c)) return "fr"
  if (ES_COUNTRIES.has(c)) return "es"
  if (NL_COUNTRIES.has(c)) return "nl"
  return "en"
}

/** Format an amount with the country's currency */
export function formatCurrency(amount: number, country?: string | null): string {
  const c = normaliseCountry(country)
  const formatted = amount.toLocaleString()

  if (SEK_COUNTRIES.has(c)) return `${formatted} kr`
  if (NOK_COUNTRIES.has(c)) return `${formatted} kr`
  if (DKK_COUNTRIES.has(c)) return `${formatted} kr`
  if (CHF_COUNTRIES.has(c)) return `CHF ${formatted}`
  if (GBP_COUNTRIES.has(c)) return `£${formatted}`
  if (EUR_COUNTRIES.has(c)) return `€${formatted}`
  if (CAD_COUNTRIES.has(c)) return `CA$${formatted}`
  if (AUD_COUNTRIES.has(c)) return `A$${formatted}`
  if (NZD_COUNTRIES.has(c)) return `NZ$${formatted}`
  return `$${formatted}`
}

/** Currency symbol only, for inline use */
export function currencySymbol(country?: string | null): string {
  const c = normaliseCountry(country)
  if (SEK_COUNTRIES.has(c) || NOK_COUNTRIES.has(c) || DKK_COUNTRIES.has(c)) return "kr"
  if (CHF_COUNTRIES.has(c)) return "CHF"
  if (GBP_COUNTRIES.has(c)) return "£"
  if (EUR_COUNTRIES.has(c)) return "€"
  return "$"
}

/** Country-appropriate email prefixes (most common patterns) */
export function emailPrefixesForCountry(country?: string | null): readonly string[] {
  const lang = languageForCountry(country)
  switch (lang) {
    case "sv":
    case "da":
    case "no": return ["info", "kontakt", "hej", "kundservice", "post"] as const
    case "de": return ["info", "kontakt", "hallo", "service", "buero"] as const
    case "fr": return ["contact", "info", "bonjour", "accueil", "commercial"] as const
    case "es": return ["info", "contacto", "hola", "ventas", "atencion"] as const
    case "nl": return ["info", "contact", "hallo", "klantenservice"] as const
    default:   return ["info", "contact", "hello", "office", "team", "admin"] as const
  }
}

/** Infer country code from a city string like "Austin, TX" or "Stockholm, SE" */
export function inferCountryFromCity(city: string): string {
  const parts = city.split(",").map(p => p.trim())
  const last = parts[parts.length - 1]?.toUpperCase() ?? ""

  // 2-letter codes
  if (last.length === 2) {
    // US state codes → US
    const US_STATES = new Set(["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"])
    if (US_STATES.has(last)) return "US"
    return last === "UK" ? "GB" : last
  }
  // Full country names
  const NAME_TO_CODE: Record<string, string> = {
    "USA":"US","UNITED STATES":"US","UNITED KINGDOM":"GB","ENGLAND":"GB",
    "SWEDEN":"SE","SVERIGE":"SE","NORWAY":"NO","NORGE":"NO",
    "DENMARK":"DK","FINLAND":"FI","GERMANY":"DE","DEUTSCHLAND":"DE",
    "FRANCE":"FR","SPAIN":"ES","ITALY":"IT","NETHERLANDS":"NL",
    "AUSTRALIA":"AU","CANADA":"CA","IRELAND":"IE","NEW ZEALAND":"NZ",
  }
  if (NAME_TO_CODE[last]) return NAME_TO_CODE[last]
  return "US"
}
