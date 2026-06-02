"use client"

import { useEffect } from "react"
import { Radar, RotateCcw } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface the error for observability (replace with your logger in prod).
    console.error(error)
  }, [error])

  return (
    <main className="min-h-screen bg-[#080b10] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-400 text-slate-950">
          <Radar className="h-6 w-6" />
        </span>
        <p className="font-mono text-sm font-black uppercase tracking-widest text-red-300">Error</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-white/55">
          An unexpected error occurred. You can try again, and if it keeps happening,
          contact support.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-[11px] text-white/30">Ref: {error.digest}</p>
        )}
        <div className="mt-8 flex justify-center">
          <button
            onClick={reset}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cyan-400 px-5 text-sm font-black text-slate-950 transition-colors hover:bg-cyan-300"
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    </main>
  )
}
