/** @type {import('next').NextConfig} */

// Hardening headers applied to every response. CSP is intentionally omitted
// here: the app loads inline bootstrap scripts (Next), Stripe, Supabase, and
// Google Fonts, so a strict policy needs per-deploy tuning + nonces. The
// headers below are zero-risk and cover the common hardening checks.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
]

const nextConfig = {
  // tsc --noEmit is clean, so let the build enforce types rather than ignore them.
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
