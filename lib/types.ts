export type Priority = "Low" | "Medium" | "High"

export interface AuditSignals {
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
  socialLinks: string[]
  socialLinkCount: number
  responseTimeMs: number
  htmlSizeKb: number
  imgCount: number
  imgWithoutAlt: number
  scriptCount: number
  inlineStyleCount: number
  usesModernFramework: boolean
  hasServiceWorker: boolean
  hasManifest: boolean
  finalUrl: string
  error: string | null
}

export interface Lead {
  id: string
  name: string
  rating: number
  reviews: number
  status: string
  website: string | null
  phone: string | null
  category?: string
  priority?: Priority
  mapPos: { top: string; left: string }
  isCustom?: boolean
  audit: {
    seo: number
    mobileFriendliness: number
    chatbotPresence: number
    pageSpeed: number
    socialPresence: number
  }
  /** Set after a real-website audit runs; presence signals "verified" */
  realAudit?: {
    seo: number
    mobileFriendliness: number
    chatbotPresence: number
    pageSpeed: number
    socialPresence: number
    signals: AuditSignals
    auditedAt: number
  }
}

export const statusConfig: Record<string, { label: string; bgColor: string; color: string; dot: string }> = {
  "Needs AI Chatbot": {
    label: "Needs Chatbot",
    bgColor: "bg-cyan-500/15",
    color: "text-cyan-400",
    dot: "bg-cyan-400",
  },
  "No Website": {
    label: "No Website",
    bgColor: "bg-red-500/15",
    color: "text-red-400",
    dot: "bg-red-400",
  },
  "Old Website": {
    label: "Old Website",
    bgColor: "bg-orange-500/15",
    color: "text-orange-400",
    dot: "bg-orange-400",
  },
  "Has Chatbot": {
    label: "Has Chatbot",
    bgColor: "bg-emerald-500/15",
    color: "text-emerald-400",
    dot: "bg-emerald-400",
  },
}

export const fallbackStatusConfig = {
  label: "Unknown",
  bgColor: "bg-white/10",
  color: "text-white/50",
  dot: "bg-white/40",
}

export function getStatusConfig(status: string) {
  return statusConfig[status] ?? fallbackStatusConfig
}

export const INDUSTRIES = [
  "Plumbing",
  "Electrician",
  "HVAC",
  "Home Services",
  "Dental",
  "Roofing",
] as const

export const STATUSES = [
  "Needs AI Chatbot",
  "No Website",
  "Old Website",
] as const
