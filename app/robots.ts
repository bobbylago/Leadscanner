import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl()
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Authenticated app surface + API are not useful to index.
        disallow: ["/dashboard", "/api/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
