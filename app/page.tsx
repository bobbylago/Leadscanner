import Link from "next/link"
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Lock,
  Mail,
  MapPin,
  Radar,
  Search,
  ShieldCheck,
  Target,
  UserPlus,
  Zap,
} from "lucide-react"

const stats = [
  { value: "50", label: "free Google Places lead credits" },
  { value: "18+", label: "audit signals per website" },
  { value: "4", label: "steps from scan to outreach" },
]

const pains = [
  "No website or a broken website",
  "No booking, quote form, or chat capture",
  "Slow pages and poor mobile signals",
  "Missing SEO basics and trust markers",
]

const features = [
  {
    icon: Search,
    title: "Find prospects in any city",
    body: "Choose a city and niche, then surface businesses with weak web presence and clear reasons to pitch them.",
  },
  {
    icon: ClipboardCheck,
    title: "Audit the exact sales angle",
    body: "See conversion gaps, SEO misses, mobile readiness, speed signals, and live-site evidence in one workspace.",
  },
  {
    icon: Mail,
    title: "Generate outreach with context",
    body: "Turn the audit into a personalized email angle instead of sending another generic agency pitch.",
  },
]

const workflow = [
  ["Pick a market", "Choose a city and one service category."],
  ["Scan businesses", "Find websites with visible commercial gaps."],
  ["Review proof", "Open a lead and see what is missing."],
  ["Send outreach", "Use the audit to write a sharper first email."],
]

const proof = [
  ["For web designers", "Find companies that need a rebuild, mobile fix, booking flow, or clearer service pages."],
  ["For marketers", "Spot SEO, conversion, and trust gaps before pitching a campaign."],
  ["For agencies", "Build a repeatable local prospecting workflow your team can run every week."],
]

const plans = [
  { name: "Free", price: "$0", scans: "50 lead credits/mo", cta: "Start free", color: "text-zinc-300", recommended: false },
  { name: "Starter", price: "$39", scans: "300 lead credits/mo", cta: "Choose Starter", color: "text-emerald-300", recommended: false },
  { name: "Pro", price: "$79", scans: "1,500 lead credits/mo", cta: "Choose Pro", color: "text-cyan-300", recommended: true },
  { name: "Agency", price: "$149", scans: "5,000 lead credits/mo", cta: "Choose Agency", color: "text-violet-300", recommended: false },
]

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan-400 text-slate-950">
        <Radar className="h-4 w-4" />
      </span>
      <span className="text-sm font-black tracking-tight">LaggardScan</span>
    </Link>
  )
}

function ProductPreview() {
  const leads = [
    ["Elite Dentistry ATX", "Old website", "$31k/mo estimate", "64%", "text-orange-300"],
    ["Radiant Plumbing", "No chatbot", "$28k/mo estimate", "65%", "text-cyan-300"],
    ["South Lamar Roofing", "No website", "$14k/mo estimate", "91", "text-red-300"],
  ]

  return (
    <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#0d131c] shadow-2xl shadow-black/45">
      <div className="flex h-12 items-center justify-between border-b border-white/8 px-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-400 text-slate-950">
            <Radar className="h-4 w-4" />
          </span>
          <span className="text-sm font-black text-white">Prospecting workspace</span>
        </div>
        <span className="rounded-md border border-white/10 bg-white/[0.035] px-2 py-1 text-[10px] font-mono text-white/45">
          Austin / Plumbing
        </span>
      </div>

      <div className="grid min-h-[460px] lg:grid-cols-[1fr_0.78fr]">
        <div className="border-r border-white/8 p-4">
          <div className="grid grid-cols-4 gap-2">
            {["Market", "Leads", "Review", "Outreach"].map((step, i) => (
              <div key={step} className="rounded-md border border-white/8 bg-white/[0.025] p-2">
                <div className="text-[10px] font-black text-cyan-200">0{i + 1}</div>
                <div className="mt-1 truncate text-[11px] text-white/55">{step}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {leads.map(([name, issue, opp, score, color], i) => (
              <div
                key={name}
                className={[
                  "rounded-lg border p-3",
                  i === 1 ? "border-cyan-300/30 bg-cyan-300/[0.055]" : "border-white/9 bg-white/[0.028]",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-white">{name}</div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-white/45">
                      <MapPin className="h-3 w-3" />
                      <span>{issue}</span>
                      <span>/</span>
                      <span>{opp}</span>
                    </div>
                  </div>
                  <span className={`font-mono text-xs font-black ${color}`}>{score}</span>
                </div>
                <div className="mt-3 grid grid-cols-5 gap-1">
                  {Array.from({ length: 5 }).map((_, n) => (
                    <div key={n} className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={["h-full rounded-full", n < 2 ? "w-2/5 bg-red-400" : n === 2 ? "w-3/5 bg-orange-400" : "w-4/5 bg-cyan-400"].join(" ")}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4">
          <div className="rounded-lg border border-red-400/20 bg-red-400/[0.07] p-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-red-200">
              <Target className="h-3.5 w-3.5" />
              Pitch angle
            </div>
            <p className="mt-3 text-sm leading-6 text-white/70">
              Your site is missing a booking path and has weak mobile conversion signals. I found three changes that could make quote requests easier.
            </p>
          </div>

          <div className="mt-3 rounded-lg border border-emerald-400/18 bg-emerald-400/[0.055] p-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              Evidence found
            </div>
            <div className="mt-3 grid gap-2 text-xs text-white/62">
              {["No booking system", "Mobile viewport present", "No chat capture", "Slow response detected"].map(item => (
                <div key={item} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <Link
            href="/dashboard?mode=sign-up"
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-cyan-400 text-sm font-black text-slate-950 transition-colors hover:bg-cyan-300"
          >
            Try the workflow
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-black uppercase tracking-widest text-cyan-300">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black tracking-normal text-white sm:text-4xl">{title}</h2>
      {body && <p className="mt-4 text-sm leading-7 text-white/58">{body}</p>}
    </div>
  )
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#080b10] text-white">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#080b10]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-white/58 md:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#workflow" className="hover:text-white">Workflow</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <Link href="/dashboard" className="hover:text-white">Sign in</Link>
          </nav>
          <Link
            href="/dashboard?mode=sign-up"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-cyan-400 px-3 text-sm font-black text-slate-950 transition-colors hover:bg-cyan-300"
          >
            Start free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/8 bg-[#090d13]">
        <div className="mx-auto grid min-h-[calc(100vh-65px)] max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-cyan-200">
              <Target className="h-3.5 w-3.5" />
              Lead intelligence for agencies
            </div>
            <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[0.98] tracking-normal text-white sm:text-6xl">
              Find businesses your agency can actually help.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/66 sm:text-lg">
              Scan a city, uncover companies with weak websites or missing conversion paths, and turn each audit into a sharper outreach angle.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard?mode=sign-up"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-cyan-400 px-5 text-sm font-black text-slate-950 transition-colors hover:bg-cyan-300"
              >
                Start with 50 free lead credits
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#workflow"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-white/14 bg-white/[0.045] px-5 text-sm font-bold text-white transition-colors hover:bg-white/[0.075]"
              >
                See workflow
              </a>
            </div>

            <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
              {stats.map(stat => (
                <div key={stat.label} className="rounded-lg border border-white/10 bg-black/24 p-3">
                  <div className="font-mono text-2xl font-black text-white">{stat.value}</div>
                  <div className="mt-1 text-[11px] leading-4 text-white/45">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {pains.map(pain => (
                <span key={pain} className="rounded-md border border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs text-white/52">
                  {pain}
                </span>
              ))}
            </div>
          </div>

          <ProductPreview />
        </div>
      </section>

      <section id="features" className="border-b border-white/8 bg-[#0d1117] px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="What it does"
            title="Prospecting with a reason to reach out."
            body="The best cold outreach starts with a specific observation. LaggardScan gives you that observation before you write the email."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {features.map(feature => (
              <div key={feature.title} className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
                <feature.icon className="h-5 w-5 text-cyan-300" />
                <h3 className="mt-5 text-lg font-bold text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/55">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="border-b border-white/8 bg-[#080b10] px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Workflow"
            title="From city search to outreach in one workspace."
            body="Keep the process simple enough to repeat every week: find, qualify, pitch, follow up."
          />
          <div className="mt-10 grid gap-3 md:grid-cols-4">
            {workflow.map(([title, body], index) => (
              <div key={title} className="rounded-lg border border-white/10 bg-white/[0.028] p-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-400/[0.12] font-mono text-xs font-black text-cyan-200">
                  {index + 1}
                </div>
                <h3 className="mt-5 text-base font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/50">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/8 bg-[#101014] px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <SectionHeader
            eyebrow="Who it is for"
            title="Built for people selling better websites, SEO, and automation."
            body="You still bring the service and sales skill. LaggardScan helps you find better-fit conversations faster."
          />
          <div className="grid gap-3 sm:grid-cols-3">
            {proof.map(([title, body]) => (
              <div key={title} className="rounded-lg border border-white/10 bg-black/22 p-4">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                <h3 className="mt-4 text-sm font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/50">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-b border-white/8 bg-[#080b10] px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <SectionHeader
              eyebrow="Pricing"
              title="Start free. Upgrade when it becomes part of your sales motion."
            />
            <Link
              href="/dashboard?mode=sign-up"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-black text-slate-950 transition-colors hover:bg-cyan-100"
            >
              Create account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {plans.map(plan => (
              <div
                key={plan.name}
                className={[
                  "relative rounded-lg border p-5",
                  plan.recommended ? "border-cyan-300/35 bg-cyan-300/[0.045]" : "border-white/10 bg-white/[0.025]",
                ].join(" ")}
              >
                {plan.recommended && (
                  <div className="absolute right-3 top-3 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-200">
                    Best value
                  </div>
                )}
                <div className={`pr-24 text-sm font-black ${plan.color}`}>{plan.name}</div>
                <div className="mt-4 flex items-end gap-1">
                  <span className="text-3xl font-black text-white">{plan.price}</span>
                  <span className="pb-1 text-sm text-white/40">/mo</span>
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm text-white/58">
                  <Zap className="h-4 w-4 text-cyan-300" />
                  {plan.scans}
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm text-white/50">
                  <Lock className="h-4 w-4 text-white/30" />
                  Stripe billing
                </div>
                <Link
                  href="/dashboard?mode=sign-up"
                  className={[
                    "mt-5 inline-flex h-9 w-full items-center justify-center rounded-md text-sm font-bold transition-colors",
                    plan.recommended ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300" : "border border-white/12 bg-white/5 text-white hover:bg-white/10",
                  ].join(" ")}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0d1117] px-5 py-16 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 rounded-lg border border-cyan-300/18 bg-cyan-300/[0.045] p-6 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-black text-white">Run your first market scan today.</p>
            <p className="mt-1 text-sm text-white/55">No credit card required for the free lead-credit allowance.</p>
          </div>
          <Link
            href="/dashboard?mode=sign-up"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-cyan-400 px-4 text-sm font-black text-slate-950 transition-colors hover:bg-cyan-300"
          >
            Start scanning
            <UserPlus className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/8 bg-[#080b10] px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 text-sm text-white/40 md:flex-row md:items-center">
          <div className="space-y-2">
            <Logo />
            <p className="text-sm text-white/38">Lead intelligence for modern agencies.</p>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
            <Link href="/contact" className="hover:text-white">Contact</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/refunds" className="hover:text-white">Refunds</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
