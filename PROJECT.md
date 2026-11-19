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
Next.js 16 App Router + TypeScript, Tailwind v4, Supabase (Auth, Postgres, Storage),
tus-js-client for uploads, Vercel hosting. npm workspaces monorepo.

## Layout
- `apps/web/`: the Next.js app (Vercel Root Directory)
- `supabase/`: config + SQL migrations (source of truth for schema and RLS)
- `docs/`: plan, specs, ADRs
- `NOTES.md`: log of working with AI tools, plus weekly check-ins

## Conventions
- Server Components by default; Client Components only for interactivity.
- All data access goes through Supabase with RLS. Never use the service-role key
  in the browser, and never import it into a file that a Client Component imports.
- Audio files upload directly from the browser to Storage (TUS). Never send them
  through a Next.js route (Vercel caps bodies at ~4.5 MB).
- Schema changes only via migrations in `supabase/migrations/`, never by clicking in the dashboard.
- Next.js 16: route protection lives in `src/proxy.ts` (formerly `middleware.ts`).
- Keep it simple: no state libraries, no ORMs, no component libraries in Week 1.
- One feature per branch/PR, closing its GitHub issue.

## Later list
Lives in GitHub Issues with the `later` label, not in code and not here.
Capture an idea in 10 seconds:
`gh issue create -l later -t "Idea: …" -b "why it might matter"`
