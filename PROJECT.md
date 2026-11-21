# Mixdown: Mix Review Portal

## What it is
A web app where an audio engineer shares mixes with clients. Clients leave
comments pinned to exact timestamps on the waveform and approve versions.

**Version 1 = one complete loop:** I send a client a link → they listen and leave
timestamped comments → I see those comments. Anything beyond that loop waits.

## Current phase
Week 1: foundation (login, songs, upload, playback). Spec: `docs/specs/week-1-spec.md`.
Plan: `docs/plan.md`. Work items: GitHub Issues, milestone "Week 1".

## Stack (see docs/adr/)
Next.js 16 App Router + TypeScript, Tailwind v4, Supabase (Auth + Postgres with RLS),
Cloudflare R2 for audio (presigned URLs), Vercel hosting. npm workspaces monorepo.

## Layout
- `apps/web/`: the Next.js app (Vercel Root Directory)
- `supabase/`: config + SQL migrations (source of truth for schema and RLS)
- `infra/`: R2 bucket config (CORS)
- `docs/`: plan, specs, ADRs
- `NOTES.md`: log of working with AI tools, plus weekly check-ins

## Conventions
- Server Components by default; Client Components only for interactivity.
- Data is owned by **workspaces**; users are members (ADR 0004). Clients get access via share
  links → anonymous session → `song_access` grant (ADR 0005). Signups are invite-only.
- All data access goes through Supabase with RLS, using the user's session. No service-role key.
- Audio goes browser → R2 directly via presigned PUT, and plays via presigned GET. The server only
  signs URLs after an RLS-checked ownership read (ADR 0003). Never stream audio through Next.js.
- R2 credentials are read only in `src/lib/r2.ts` (`import "server-only"`).
- No Vercel-only services (KV, Blob, Edge Config) so hosting stays portable.
- Schema changes only via migrations in `supabase/migrations/`, never by clicking in the dashboard.
- Next.js 16: route protection lives in `src/proxy.ts` (formerly `middleware.ts`).
- Keep it simple: no state libraries, no ORMs, no component libraries in Week 1.
- UI uses the semantic tokens in `globals.css` and our own components in `src/components/ui/`, never raw
  palette shades or one-off button styles (`docs/design-system.md`).
- One feature per branch/PR, closing its GitHub issue. Branch: `w<week>/<issue>-<slug>` (see `AGENTS.md`).

## Later list
Lives in GitHub Issues with the `later` label, not in code and not here.
Capture an idea in 10 seconds:
`gh issue create -l later -t "Idea: …" -b "why it might matter"`
