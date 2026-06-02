import Link from "next/link"
import { Radar, ArrowLeft } from "lucide-react"

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#080b10] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-400 text-slate-950">
          <Radar className="h-6 w-6" />
        </span>
        <p className="font-mono text-sm font-black uppercase tracking-widest text-cyan-300">404</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-white/55">
          The page you are looking for does not exist or has moved.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cyan-400 px-5 text-sm font-black text-slate-950 transition-colors hover:bg-cyan-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-md border border-white/14 bg-white/[0.045] px-5 text-sm font-bold text-white transition-colors hover:bg-white/[0.075]"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
