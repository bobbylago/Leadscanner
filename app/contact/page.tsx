import { Mail, MessageCircle, ShieldCheck } from "lucide-react"
import { MarketingShell, PolicySection } from "@/components/marketing-shell"

export default function ContactPage() {
  return (
    <MarketingShell
      title="Contact Support"
      subtitle="Get help with billing, setup, scan results, or account access."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <PolicySection title="Support Email">
          <Mail className="mb-3 h-4 w-4 text-cyan-300" />
          <a href="mailto:support@laggardscan.com" className="font-black text-cyan-300 hover:text-cyan-200">
            support@laggardscan.com
          </a>
        </PolicySection>
        <PolicySection title="Best For">
          <MessageCircle className="mb-3 h-4 w-4 text-emerald-300" />
          <p>Billing questions, Stripe issues, scan bugs, and product feedback.</p>
        </PolicySection>
        <PolicySection title="Include">
          <ShieldCheck className="mb-3 h-4 w-4 text-violet-300" />
          <p>Your account email, plan, and a short description of what happened.</p>
        </PolicySection>
      </div>
    </MarketingShell>
  )
}
