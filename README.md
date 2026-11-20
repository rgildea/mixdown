# Mixdown

A mix review and approval portal for audio engineers. Share a mix with a client,
they leave comments pinned to exact moments on the waveform, compare versions,
and approve the final mix.

> Status: **Week 1 of 6: foundation.** See [the plan](docs/plan.md) and
> [open issues](../../issues?q=is%3Aopen+milestone%3A%22Week+1%22).

## Stack
Next.js 16 (App Router, TypeScript) · Tailwind CSS · Supabase (Auth, Postgres + RLS) ·
Cloudflare R2 (audio, presigned URLs) · Vercel. Decisions and trade-offs are recorded in
[`docs/adr/`](docs/adr/).

## Run locally
Prerequisites: Node 22+ and a Docker runtime ([OrbStack](https://orbstack.dev) or Docker Desktop).
Everything runs against a local Supabase stack. Email goes to Mailpit, not real inboxes.

```bash
npm install
npm run db:start          # local Supabase + Mailpit, applies migrations, seeds dev users
cp apps/web/.env.example apps/web/.env.local   # local values are pre-filled
npm run dev               # http://localhost:3000
```

Sign in as `dev@example.test`, then click the link in Mailpit at http://127.0.0.1:55324.

**Studio** (local Supabase dashboard) is at http://127.0.0.1:55323: browse tables, rows, RLS policies
(Authentication → Policies) and run SQL. It connects as an admin, so it **bypasses RLS**: use
`npm run db:test` or the app to check what a user can see. Schema changes still go through migrations
(ADR 0006). If you prototype a change in Studio, capture it with `npx supabase db diff -f <name>`
and then `npm run db:reset` to prove the migration rebuilds it.

| Command | What |
|---|---|
| `npm run db:reset` | Rebuild the local DB from migrations and re-seed dev users |
| `npm run db:users -- a@example.test` | Create extra local users (signups are off) |
| `npm run db:test` | pgTAP database tests (RLS policies) in `supabase/tests/database/` |
| `npm run db:types` | Regenerate `apps/web/src/lib/database.types.ts` after a migration |
| `npm run test:e2e` | Playwright tests (needs `db:start`; first time on a Mac: `npx playwright install chromium`) |
| `npm run db:stop` | Stop the local stack |

Hosted environments (Vercel previews and production) use their own Supabase projects and R2 buckets;
see [ADR 0009](docs/adr/0009-local-first-development.md) and issue #1 for setup.

## Repo layout
| Path | What |
|---|---|
| `apps/web/` | Next.js app (deployed to Vercel with Root Directory = `apps/web`) |
| `supabase/` | Supabase config, SQL migrations (tables, RLS, functions), email templates |
| `scripts/` | Local stack start, dev-user seeding, GitHub bootstrap |
| `infra/` | R2 bucket CORS config |
| `docs/plan.md` | Six-week plan, ground rules, weekly check-in |
| `docs/specs/` | Per-week / per-feature specs handed to the AI coding tool |
| `docs/adr/` | Architecture decision records |
| `PROJECT.md`, `AGENTS.md`, `CLAUDE.md` | Project doc; AI-agent rules (tool-neutral); Claude Code entry point |
| `NOTES.md` | Log of how I worked with AI tools, plus weekly check-ins |
