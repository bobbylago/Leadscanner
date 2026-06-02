import { MarketingShell, PolicySection } from "@/components/marketing-shell"

export default function RefundsPage() {
  return (
    <MarketingShell
      title="Refund Policy"
      subtitle="How cancellations, billing mistakes, and refund requests are handled."
    >
      <PolicySection title="Cancellations">
        <p>You can cancel future renewals from the Stripe billing portal. Cancelling stops future billing but does not automatically refund prior usage.</p>
      </PolicySection>
      <PolicySection title="Billing Issues">
        <p>If you were charged twice, upgraded accidentally, or your plan did not update correctly, contact support as soon as possible with your account email.</p>
      </PolicySection>
      <PolicySection title="Refund Reviews">
        <p>Refunds are reviewed case by case for recent purchases, especially when there is a technical problem or billing error. Heavy usage may reduce refund eligibility.</p>
      </PolicySection>
    </MarketingShell>
  )
}
