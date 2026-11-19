# Mixdown

A mix review and approval portal for audio engineers. Share a mix with a client,
they leave comments pinned to exact moments on the waveform, compare versions,
and approve the final mix.

> Status: **Week 1 of 6: foundation.** See [the plan](docs/plan.md) and
> [open issues](../../issues?q=is%3Aopen+milestone%3A%22Week+1%22).

## Stack
Next.js 16 (App Router, TypeScript) · Tailwind CSS · Supabase (Auth, Postgres, Storage) ·
tus-js-client resumable uploads · Vercel. Decisions and trade-offs are recorded in
[`docs/adr/`](docs/adr/).

## Run locally
Prerequisites: Node 22+, a Supabase project (the free tier works).

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # fill in Supabase URL + anon key
npm run dev                                    # http://localhost:3000
```

Database schema lives in `supabase/migrations/`. To apply it to your project:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

## Repo layout
| Path | What |
|---|---|
| `apps/web/` | Next.js app (deployed to Vercel with Root Directory = `apps/web`) |
| `supabase/` | Supabase config and SQL migrations (tables, RLS, storage policies) |
| `docs/plan.md` | Six-week plan, ground rules, weekly check-in |
| `docs/specs/` | Per-week / per-feature specs handed to the AI coding tool |
| `docs/adr/` | Architecture decision records |
| `PROJECT.md`, `CLAUDE.md` | Project doc and AI-agent memory |
| `NOTES.md` | Log of how I worked with AI tools, plus weekly check-ins |
