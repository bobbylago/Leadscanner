/** Canonical site URL + brand constants, shared by metadata/SEO files. */

export const SITE_NAME = "LaggardScan"

export const SITE_DESCRIPTION =
  "Scan any city, audit weak websites, and generate personalized outreach for agencies, marketers, and web designers."

export function siteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL
  if (fromEnv) return fromEnv.replace(/\/$/, "")
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}
