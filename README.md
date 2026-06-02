# LaggardScan

Lead intelligence for agencies, marketers, and web designers. Scan any city for a
service niche, surface businesses with weak web presence, run a real
website audit, and generate personalized cold-outreach with one click.

- **Find** - query Google Places when configured, with OpenStreetMap (Overpass + Nominatim) fallback for businesses in a city/industry.
- **Audit** - fetch each site and score SEO, mobile readiness, conversion paths, speed, and trust signals from real HTML.
- **Outreach** - turn the audit into a tailored email via Google Gemini, localized by country.
- **Billing** - Stripe subscriptions with monthly lead and AI script quotas (Free / Starter / Pro / Agency).

## Tech stack

| Area        | Choice                                   |
| ----------- | ---------------------------------------- |
| Framework   | Next.js 16 (App Router, Turbopack)       |
| UI          | React 19, Tailwind CSS v4, shadcn/ui     |
| Auth + DB   | Supabase (Postgres + Row Level Security) |
| Payments    | Stripe Checkout + Billing Portal         |
| AI outreach | Google Gemini (`generativelanguage` API) |
| Data source | Google Places + OpenStreetMap fallback   |

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev                  # http://localhost:3000
```

### Scripts

| Command         | Description                       |
| --------------- | --------------------------------- |
| `npm run dev`   | Start the dev server (Turbopack)  |
| `npm run build` | Production build (type-checked)   |
| `npm run start` | Serve the production build        |
| `npm run lint`  | Run ESLint                        |

## Environment variables

All variables live in `.env.local` (never commit it). See `.env.example`.

| Variable                        | Required | Notes                                                      |
| ------------------------------- | -------- | ---------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | yes      | Supabase project URL                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes      | Public anon key (browser auth)                             |
| `SUPABASE_SERVICE_ROLE_KEY`     | yes      | Server-only; used by billing/scan/webhook routes           |
| `NEXT_PUBLIC_APP_URL`           | yes      | Canonical origin, e.g. `https://laggardscan.com` (used for SEO, Stripe redirects) |
| `SIGNUP_GUARD_SALT`             | no       | Extra secret used to hash free-account guard claims         |
| `STRIPE_SECRET_KEY`             | yes      | Stripe secret key                                          |
| `STRIPE_WEBHOOK_SECRET`         | yes      | From the Stripe webhook endpoint                           |
| `STRIPE_STARTER_PRICE_ID`       | yes      | Price ID for the Starter plan                              |
| `STRIPE_PRO_PRICE_ID`           | yes      | Price ID for the Pro plan                                  |
| `STRIPE_AGENCY_PRICE_ID`        | yes      | Price ID for the Agency plan                               |
| `GEMINI_API_KEY`                | yes      | Google Generative Language API key                         |
| `GEMINI_MODEL`                  | no       | Defaults to `gemini-2.5-flash`                             |
| `GOOGLE_PLACES_API_KEY`         | no       | Server-only Places API (New) key for higher-volume lead discovery |

> `NEXT_PUBLIC_*` values are exposed to the browser - keep secrets out of them.

## Database setup (Supabase)

Run [`supabase/schema.sql`](supabase/schema.sql) against your project (SQL editor or
`supabase db push`). It creates `saved_scans`, `subscriptions`, `usage_events`,
`free_account_claims`, and `contacted`. User-owned rows are protected with Row
Level Security scoped to `auth.uid()`. Subscription, usage, and free-account claim
rows are written server-side with the service-role key; `saved_scans` and
`contacted` are user-managed via RLS.

## Stripe setup

1. Create three recurring prices and set their IDs in `.env.local`.
2. Add a webhook endpoint pointing at `/api/billing/webhook` for
   `customer.subscription.created|updated|deleted` and copy its signing secret
   into `STRIPE_WEBHOOK_SECRET`.
3. The checkout/portal routes attach the Supabase user id to Stripe metadata so
   the webhook can map subscriptions back to users.

## Architecture

```
app/
  api/            Route handlers (auth, billing, scan-leads, audit, outreach)
  page.tsx        Marketing landing page
  dashboard/      Authenticated app shell
  (contact|privacy|terms|refunds)/  Legal + support pages
  icon.svg, apple-icon, opengraph-image, robots, sitemap, manifest  SEO/metadata
components/        UI (shadcn/ui in components/ui)
lib/
  lead-finder.ts  Scan orchestration, dedup, quality scoring
  google-places.ts  Google Places Text Search lead source
  audit-engine.ts Real website audit from fetched HTML
  gemini-outreach.ts  AI email generation
  billing.ts/stripe.ts  Plans, quotas, Stripe client
  net-guard.ts    SSRF-safe outbound fetch (used by audit + verification)
  rate-limit.ts   In-memory request throttling
```

## Security notes

- **SSRF protection** - all fetches against user-influenced URLs go through
  `lib/net-guard.ts`, which rejects non-public IPs and re-validates every redirect hop.
- **Rate limiting** - `lib/rate-limit.ts` throttles auth, scan, audit, and outreach
  routes. It is in-memory (best-effort per instance); back it with Redis/Upstash for
  hard global limits on multi-instance deploys.
- **Usage quotas** - lead scans and Gemini outreach generations are recorded in
  `usage_events` and enforced monthly per plan.
- **Free-account abuse guard** - signup and protected usage routes record hashed
  email/network/browser claims in `free_account_claims` to stop easy repeat free-tier
  resets.
- **Auth** - every sensitive route validates a Supabase bearer token; the Stripe
  webhook verifies its signature.
- Security headers are set in `next.config.mjs`. A Content-Security-Policy is left
  for per-deploy tuning (inline Next scripts + Stripe/Supabase/Gemini origins).

## Deploy

Designed for Vercel. Set every environment variable above in the project settings,
point your Stripe webhook at the deployed `/api/billing/webhook`, and set
`NEXT_PUBLIC_APP_URL` to the production origin.

## Data & attribution

Business data can come from Google Places when `GOOGLE_PLACES_API_KEY` is set,
with [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors via
the Overpass and Nominatim APIs as fallback. Respect each provider's usage
policies in production (caching, rate limits, attribution).
