import { MarketingShell, PolicySection } from "@/components/marketing-shell"

export default function PrivacyPage() {
  return (
    <MarketingShell
      title="Privacy Policy"
      subtitle="How LaggardScan handles account, billing, scan, and outreach data."
    >
      <PolicySection title="Information We Collect">
        <p>We collect the information needed to run the product: account email, authentication records, billing status, saved scans, usage counts, and lead/outreach activity created inside the app.</p>
      </PolicySection>
      <PolicySection title="How We Use It">
        <p>We use this data to authenticate users, enforce plan limits, save scan history, generate outreach, process subscriptions, prevent abuse, and improve reliability.</p>
      </PolicySection>
      <PolicySection title="Third-Party Services">
        <p>LaggardScan uses Supabase for authentication and data storage, Stripe for payments, and AI providers for outreach generation. These services process data only as needed to provide the product.</p>
      </PolicySection>
      <PolicySection title="Your Choices">
        <p>You can request account deletion or data access by contacting support. Some records may be retained if required for billing, security, or legal compliance.</p>
      </PolicySection>
    </MarketingShell>
  )
}
