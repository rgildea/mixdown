# 0002. Stack: Next.js 16, Supabase, Cloudflare R2, Vercel

- Status: Accepted
- Date: 2026-11-19
- Decided by: Ryan, after reviewing each option (an earlier AI-drafted plan had assumed this stack without discussion)

## Context
Earlier attempts (`mixdown-prototype`, `mixdown-gcp-prototype`, `mixdown-cloudflare`, …) stalled
on infrastructure. The last one was built on the Epic Stack: React Router/Remix, Prisma + Neon,
**hand-rolled auth** (bcrypt, TOTP, remix-auth), Uppy, Sentry, Radix, styled-components, and
Cloudflare Workers, with about 60 dependencies. Much of the effort went into owning layers that
aren't the product.

The product's main cost is streaming large audio files to clients (an 85 MB WAV played 10 times
is about 0.85 GB of egress), so storage egress pricing matters more than usual.

## Decision
| Layer | Choice | Reversibility |
|---|---|---|
| Framework | **Next.js 16** App Router + TypeScript, Tailwind v4 | Medium. Logic lives in Postgres/RLS; the app is mostly React |
| Auth + database | **Supabase** Auth (magic links) + Postgres with RLS (+ Realtime in Week 2) | Hard. Auth users and `auth.uid()` policies are Supabase-specific |
| Audio storage | **Cloudflare R2** (S3 API, zero egress fees) | Easy. S3-compatible; paths stored in Postgres |
| Hosting | **Vercel**: free Hobby plan through Week 3, **Pro before Week 4** (Hobby is non-commercial only) | Easy, as long as we use no Vercel-only services |

## Alternatives considered
- **Everything in Supabase, including Storage:** one vendor, but egress-metered, and a 50 MB per-file cap
  on Free. Rejected because audio streaming would make egress the main bill.
- **Clerk + Neon + R2:** best-of-breed parts, but a third vendor whose user IDs need syncing
  into Postgres for RLS. That's more glue, which is how the last attempt bogged down.
- **React Router v7:** familiar from the last attempt, but less hiring signal and fewer AI tools trained on it.
- **Netlify:** free plan allows commercial use, but the credit-metered free plan fits poorly with
  deploying on every push, and Next.js runs through an adapter. Saves about $20/mo at most.
- **Cloudflare Workers for hosting:** would consolidate with R2, but Next.js needs the OpenNext
  adapter, which is the kind of runtime plumbing that slowed the last attempt.
- **Prisma/Drizzle ORM:** bypasses RLS unless configured carefully. Use supabase-js.

## Consequences
- Two data vendors. Supabase is the source of truth for who owns what; R2 holds bytes only.
  The server issues presigned R2 URLs only after an RLS-checked ownership query (see ADR 0003).
- R2 credentials are the first **server-only secrets**. They must never reach the browser bundle.
- No Vercel-specific products (KV, Blob, Edge Config, Vercel Postgres); keeps hosting portable.
- Next.js 16 conventions differ from older AI training data (e.g. `middleware.ts` became `proxy.ts`).
- Budget from Week 4: Vercel Pro (~$20/mo) + Supabase Pro (~$25/mo; avoids idle pausing) + R2
  (likely within free tier). Check current pricing at the time.

## Changelog
| Date | Change | Why |
|---|---|---|
| 2026-11-19 | Drafted by AI: Next.js + Supabase (Auth, Postgres **and Storage**) + Vercel, decided without discussion in an earlier chat. | Initial plan. |
| 2026-11-19 | Reviewed: **audio moved to Cloudflare R2**; Vercel Hobby until Week 4, then Pro; no Vercel-only services (`52e185f`). | Audio streaming is egress-heavy and R2 has zero egress fees; Hobby is non-commercial. Netlify was considered and rejected. |
