import { MarketingShell, PolicySection } from "@/components/marketing-shell"

export default function TermsPage() {
  return (
    <MarketingShell
      title="Terms of Service"
      subtitle="The rules for using LaggardScan responsibly as a prospecting and outreach tool."
    >
      <PolicySection title="Acceptable Use">
        <p>You agree to use LaggardScan responsibly, comply with applicable outreach, privacy, and anti-spam laws, and avoid misleading or abusive sales activity.</p>
      </PolicySection>
      <PolicySection title="Product Output">
        <p>Lead data, audit findings, opportunity estimates, and outreach suggestions are decision-support tools. You are responsible for reviewing results before contacting a business.</p>
      </PolicySection>
      <PolicySection title="Subscriptions">
        <p>Paid plans renew monthly through Stripe unless cancelled before renewal. Usage limits reset according to the plan shown in your billing page.</p>
      </PolicySection>
      <PolicySection title="No Guaranteed Results">
        <p>LaggardScan can help identify prospects and write better outreach, but it does not guarantee replies, clients, revenue, rankings, or any specific business outcome.</p>
      </PolicySection>
    </MarketingShell>
  )
}
