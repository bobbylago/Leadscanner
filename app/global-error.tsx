"use client"

// Catches errors thrown in the root layout itself. Must render its own
// <html>/<body> since it replaces the root layout when triggered.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#080b10",
          color: "white",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 12px" }}>Something went wrong</h1>
          <p style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.6, margin: "0 0 16px" }}>
            A critical error occurred while loading the app. Please try again.
          </p>
          {error.digest && (
            <p style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.3)", margin: "0 0 24px" }}>
              Ref: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              height: 44,
              padding: "0 20px",
              borderRadius: 6,
              border: "none",
              background: "#22d3ee",
              color: "#06121a",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
