# Real Estate CRM

Developer: Ian Katana

Real Estate CRM: portfolios, properties, leads, pipeline, commissions, and Property Finder ingestion (Edge Functions).

## Setup

1. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from **Supabase → Project Settings → API** (same project for both values).

2. Install and run:

```bash
npm install
npm run dev
```

3. Database: apply migrations with Supabase CLI (`npx supabase db push` after `npx supabase link`) or run SQL migrations from `supabase/migrations` in order.

4. Edge functions (e.g. Property Finder sync): deploy with `npx supabase functions deploy` and configure secrets in the Supabase dashboard.

## Scripts

- `npm run dev` — Vite dev server (port 8080)
- `npm run build` — production build
- `npm run test` — Vitest
