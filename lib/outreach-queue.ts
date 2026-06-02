import type { Lead } from "./types"
import { calcRevenueLeak } from "./utils"
import { bestEmailForLead, getDiscoveredEmailsForLead } from "./email-utils"
import { getHighValueLeadProfile } from "./lead-scoring"

export interface OutreachQueueItem {
  lead: Lead
  email: string
  emailSource: "found" | "guessed"
  score: number
  reasons: string[]
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function buildOutreachQueue(
  leads: Lead[],
  contactedLeadIds: Set<string> = new Set(),
): OutreachQueueItem[] {
  return leads
    .map(lead => {
      const discovered = getDiscoveredEmailsForLead(lead)
      const email = bestEmailForLead(lead)
      const signals = lead.realAudit?.signals
      const valueProfile = getHighValueLeadProfile(lead)
      const reasons: string[] = []
      const isContacted = contactedLeadIds.has(lead.id)
      const hasNoInstantPath = signals
        ? !signals.chatbotProvider && !signals.bookingProvider
        : lead.status === "Needs AI Chatbot"

      let score = 0

      if (email) score += 20
      if (discovered.length > 0) {
        score += 28
        reasons.push("public email found")
      } else if (email) {
        score += 10
        reasons.push("email guessed from domain")
      }

      if (lead.website) score += 12
      if (lead.phone) score += 8
      if (hasNoInstantPath) {
        score += 18
        reasons.push("no instant response path")
      }
      if (signals?.hasContactForm) score += 5
      if (lead.status === "Old Website") score += 8
      if (lead.websiteVerified === true) score += 5
      if (valueProfile.tier === "Hot") reasons.push("high-value target")
      for (const reason of valueProfile.reasons.slice(0, 3)) reasons.push(reason)
      score += Math.min(24, valueProfile.score * 0.24)

      if (isContacted) {
        score -= 45
        reasons.push("already contacted")
      }
      if (!email) score -= 30

      const emailSource: OutreachQueueItem["emailSource"] = discovered.includes(email) ? "found" : "guessed"

      return {
        lead,
        email,
        emailSource,
        score: clampScore(score),
        reasons,
      }
    })
    .filter(item => item.email.includes("@"))
    .sort((a, b) =>
      b.score - a.score
      || (b.emailSource === "found" ? 1 : 0) - (a.emailSource === "found" ? 1 : 0)
      || (b.lead.qualityScore ?? 0) - (a.lead.qualityScore ?? 0)
      || a.lead.name.localeCompare(b.lead.name)
    )
}

function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? "")
  return `"${text.replace(/"/g, '""')}"`
}

export function buildOutreachQueueCsv(items: OutreachQueueItem[]): string {
  const headers = [
    "Name",
    "Email",
    "Email Source",
    "Industry",
    "Phone",
    "Website",
    "Status",
    "Queue Score",
    "High-Value Score",
    "Target Tier",
    "Quality Score",
    "Estimated Opportunity",
    "Audit Ran",
    "No Instant Response Path",
    "Booking Provider",
    "Chat Provider",
    "Reasons",
  ]

  const rows = items.map(({ lead, email, emailSource, score, reasons }) => {
    const signals = lead.realAudit?.signals
    const valueProfile = getHighValueLeadProfile(lead)
    const noInstantPath = signals
      ? !signals.chatbotProvider && !signals.bookingProvider
      : lead.status === "Needs AI Chatbot"

    return [
      lead.name,
      email,
      emailSource,
      lead.category ?? "",
      lead.phone ?? "",
      lead.website ?? "",
      lead.status,
      score,
      valueProfile.score,
      valueProfile.tier,
      lead.qualityScore ?? "",
      calcRevenueLeak(lead),
      lead.realAudit ? "Yes" : "No",
      noInstantPath ? "Yes" : "No",
      signals?.bookingProvider ?? "",
      signals?.chatbotProvider ?? "",
      Array.from(new Set([...reasons, ...valueProfile.reasons])).join("; "),
    ]
  })

  return [headers, ...rows]
    .map(row => row.map(csvCell).join(","))
    .join("\n")
}
