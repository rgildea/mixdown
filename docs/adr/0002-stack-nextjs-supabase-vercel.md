# 0002. Next.js 16 + Supabase + Vercel

- Status: Accepted
- Date: 2026-11-19

## Context
Earlier attempts (`mixdown-prototype`, `mixdown-gcp-prototype`, `mixdown-cloudflare`, …)
spread across Remix/React Router, GCP and Cloudflare Workers, and stalled on
infrastructure details. The goal now is to ship a working loop in weeks with
ready-made services, using tools hiring managers recognise.

## Decision
- **Next.js 16 App Router + TypeScript**: one codebase for UI and server code; Server
  Components and Server Actions remove the need for a separate API in v1.
- **Tailwind CSS v4**: styling without design work.
- **Supabase**: Auth (magic links), Postgres, Storage, and (Week 2) Realtime for live
  comments, all from one managed service with RLS.
- **Vercel**: git-push deploys, preview deploy per PR.

## Alternatives considered
- Clerk for auth: nicer UI, but a second vendor whose user IDs would need syncing into
  Postgres for RLS. Supabase Auth gives `auth.uid()` in policies for free.
- Cloudflare Workers (the previous attempt): cheaper egress, but more custom plumbing;
  that's where the last attempt bogged down.
- Prisma/Drizzle ORM: adds a layer that bypasses RLS unless configured carefully. Use supabase-js.

## Consequences
- Next.js 16 changed conventions (e.g. `middleware.ts` → `proxy.ts`); AI tools trained
  on older versions must check `node_modules/next/dist/docs/` (noted in CLAUDE.md).
- Supabase Free: 50 MB/file, 1 GB storage, 5 GB egress, pauses when idle. **Upgrade to
  Pro before Week 4** (tracked issue).
- Lock-in is moderate: Postgres and S3-compatible storage are portable; Auth is the sticky part.
