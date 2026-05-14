/**
 * Curated city presets per country.
 * Shown as suggestions when typing a city or browsing the location picker.
 */

export interface CityPreset {
  label: string
  /** ISO 3166 country code */
  country: string
  /** Group for grouping in UI */
  region?: string
}

export const CITY_PRESETS: CityPreset[] = [
  // ── United States ────────────────────────────────────
  { label: "Austin, TX",        country: "US", region: "Texas"    },
  { label: "Dallas, TX",        country: "US", region: "Texas"    },
  { label: "Houston, TX",       country: "US", region: "Texas"    },
  { label: "San Antonio, TX",   country: "US", region: "Texas"    },
  { label: "Phoenix, AZ",       country: "US", region: "Southwest"},
  { label: "Los Angeles, CA",   country: "US", region: "California"},
  { label: "San Diego, CA",     country: "US", region: "California"},
  { label: "San Francisco, CA", country: "US", region: "California"},
  { label: "San Jose, CA",      country: "US", region: "California"},
  { label: "Seattle, WA",       country: "US", region: "Pacific NW"},
  { label: "Portland, OR",      country: "US", region: "Pacific NW"},
  { label: "Denver, CO",        country: "US", region: "Mountain"  },
  { label: "Chicago, IL",       country: "US", region: "Midwest"   },
  { label: "Minneapolis, MN",   country: "US", region: "Midwest"   },
  { label: "Nashville, TN",     country: "US", region: "Southeast" },
  { label: "Atlanta, GA",       country: "US", region: "Southeast" },
  { label: "Miami, FL",         country: "US", region: "Florida"   },
  { label: "Orlando, FL",       country: "US", region: "Florida"   },
  { label: "Tampa, FL",         country: "US", region: "Florida"   },
  { label: "New York, NY",      country: "US", region: "Northeast" },
  { label: "Boston, MA",        country: "US", region: "Northeast" },
  { label: "Philadelphia, PA",  country: "US", region: "Northeast" },
  { label: "Washington, DC",    country: "US", region: "Northeast" },

  // ── Sweden ──────────────────────────────────────────
  { label: "Stockholm, SE",   country: "SE" },
  { label: "Gothenburg, SE",  country: "SE" },
  { label: "Malmö, SE",       country: "SE" },
  { label: "Uppsala, SE",     country: "SE" },
  { label: "Västerås, SE",    country: "SE" },
  { label: "Örebro, SE",      country: "SE" },
  { label: "Linköping, SE",   country: "SE" },
  { label: "Helsingborg, SE", country: "SE" },
  { label: "Jönköping, SE",   country: "SE" },
  { label: "Norrköping, SE",  country: "SE" },
  { label: "Lund, SE",        country: "SE" },
  { label: "Umeå, SE",        country: "SE" },
  { label: "Gävle, SE",       country: "SE" },
  { label: "Borås, SE",       country: "SE" },
  { label: "Eskilstuna, SE",  country: "SE" },
  { label: "Södertälje, SE",  country: "SE" },
  { label: "Karlstad, SE",    country: "SE" },
  { label: "Halmstad, SE",    country: "SE" },
  { label: "Växjö, SE",       country: "SE" },
  { label: "Sundsvall, SE",   country: "SE" },

  // ── Norway ──────────────────────────────────────────
  { label: "Oslo, NO",       country: "NO" },
  { label: "Bergen, NO",     country: "NO" },
  { label: "Trondheim, NO",  country: "NO" },
  { label: "Stavanger, NO",  country: "NO" },
  { label: "Kristiansand, NO", country: "NO" },
  { label: "Drammen, NO",    country: "NO" },
  { label: "Tromsø, NO",     country: "NO" },
  { label: "Fredrikstad, NO",country: "NO" },

  // ── Denmark ─────────────────────────────────────────
  { label: "Copenhagen, DK", country: "DK" },
  { label: "Aarhus, DK",     country: "DK" },
  { label: "Odense, DK",     country: "DK" },
  { label: "Aalborg, DK",    country: "DK" },
  { label: "Esbjerg, DK",    country: "DK" },
  { label: "Randers, DK",    country: "DK" },

  // ── Finland ─────────────────────────────────────────
  { label: "Helsinki, FI",   country: "FI" },
  { label: "Tampere, FI",    country: "FI" },
  { label: "Turku, FI",      country: "FI" },
  { label: "Oulu, FI",       country: "FI" },

  // ── United Kingdom ──────────────────────────────────
  { label: "London, UK",     country: "GB" },
  { label: "Manchester, UK", country: "GB" },
  { label: "Birmingham, UK", country: "GB" },
  { label: "Leeds, UK",      country: "GB" },
  { label: "Glasgow, UK",    country: "GB" },
  { label: "Liverpool, UK",  country: "GB" },
  { label: "Bristol, UK",    country: "GB" },
  { label: "Edinburgh, UK",  country: "GB" },
  { label: "Sheffield, UK",  country: "GB" },
  { label: "Cardiff, UK",    country: "GB" },
  { label: "Belfast, UK",    country: "GB" },
  { label: "Newcastle, UK",  country: "GB" },

  // ── Germany ─────────────────────────────────────────
  { label: "Berlin, DE",     country: "DE" },
  { label: "Hamburg, DE",    country: "DE" },
  { label: "Munich, DE",     country: "DE" },
  { label: "Frankfurt, DE",  country: "DE" },
  { label: "Cologne, DE",    country: "DE" },
  { label: "Stuttgart, DE",  country: "DE" },
  { label: "Düsseldorf, DE", country: "DE" },
  { label: "Leipzig, DE",    country: "DE" },
  { label: "Dresden, DE",    country: "DE" },
  { label: "Hannover, DE",   country: "DE" },

  // ── Netherlands ─────────────────────────────────────
  { label: "Amsterdam, NL",  country: "NL" },
  { label: "Rotterdam, NL",  country: "NL" },
  { label: "The Hague, NL",  country: "NL" },
  { label: "Utrecht, NL",    country: "NL" },
  { label: "Eindhoven, NL",  country: "NL" },
  { label: "Groningen, NL",  country: "NL" },

  // ── France ──────────────────────────────────────────
  { label: "Paris, FR",      country: "FR" },
  { label: "Lyon, FR",       country: "FR" },
  { label: "Marseille, FR",  country: "FR" },
  { label: "Toulouse, FR",   country: "FR" },
  { label: "Nice, FR",       country: "FR" },
  { label: "Nantes, FR",     country: "FR" },
  { label: "Bordeaux, FR",   country: "FR" },
  { label: "Lille, FR",      country: "FR" },

  // ── Spain ───────────────────────────────────────────
  { label: "Madrid, ES",     country: "ES" },
  { label: "Barcelona, ES",  country: "ES" },
  { label: "Valencia, ES",   country: "ES" },
  { label: "Sevilla, ES",    country: "ES" },
  { label: "Zaragoza, ES",   country: "ES" },
  { label: "Málaga, ES",     country: "ES" },
  { label: "Bilbao, ES",     country: "ES" },

  // ── Canada ──────────────────────────────────────────
  { label: "Toronto, ON",    country: "CA" },
  { label: "Vancouver, BC",  country: "CA" },
  { label: "Montreal, QC",   country: "CA" },
  { label: "Calgary, AB",    country: "CA" },
  { label: "Ottawa, ON",     country: "CA" },
  { label: "Edmonton, AB",   country: "CA" },

  // ── Australia ───────────────────────────────────────
  { label: "Sydney, AU",     country: "AU" },
  { label: "Melbourne, AU",  country: "AU" },
  { label: "Brisbane, AU",   country: "AU" },
  { label: "Perth, AU",      country: "AU" },
  { label: "Adelaide, AU",   country: "AU" },
]

/** Group cities by country for UI sectioning */
export function groupCitiesByCountry(cities: CityPreset[]): Array<{ country: string; cities: CityPreset[] }> {
  const map = new Map<string, CityPreset[]>()
  for (const c of cities) {
    if (!map.has(c.country)) map.set(c.country, [])
    map.get(c.country)!.push(c)
  }
  return Array.from(map.entries()).map(([country, cities]) => ({ country, cities }))
}

/** Filter cities by a free-text search query (matches label, country, region) */
export function filterCities(query: string, cities: CityPreset[] = CITY_PRESETS): CityPreset[] {
  const q = query.trim().toLowerCase()
  if (!q) return cities
  return cities.filter(c =>
    c.label.toLowerCase().includes(q)
    || c.country.toLowerCase().includes(q)
    || c.region?.toLowerCase().includes(q)
  )
}

export const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  GB: "United Kingdom",
  DE: "Germany",
  NL: "Netherlands",
  FR: "France",
  ES: "Spain",
  CA: "Canada",
  AU: "Australia",
}
