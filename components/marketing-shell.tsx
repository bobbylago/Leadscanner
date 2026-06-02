import Link from "next/link"
import { Radar } from "lucide-react"

export function MarketingShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-[#080b10] text-white">
      <header className="border-b border-white/8 bg-[#080b10]/88">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan-400 text-slate-950">
              <Radar className="h-4 w-4" />
            </span>
            <span className="text-sm font-black">LaggardScan</span>
          </Link>
          <Link href="/dashboard?mode=sign-up" className="text-sm font-bold text-cyan-300 hover:text-cyan-200">
            Start free
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-14">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-widest text-cyan-300">LaggardScan</p>
          <h1 className="mt-4 text-4xl font-black tracking-normal text-white sm:text-5xl">{title}</h1>
          <p className="mt-4 text-base leading-7 text-white/60">{subtitle}</p>
        </div>
        <div className="mt-10 grid gap-4 text-sm leading-7 text-white/58">
          {children}
        </div>
      </div>
    </main>
  )
}

export function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-base font-bold text-white">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  )
}
