# Agent instructions for Mixdown

Canonical rules for any AI coding tool (Claude Code, Cursor, Codex…). Read `PROJECT.md`
(stack, conventions, layout) and `apps/web/AGENTS.md` (Next.js 16 notes) before working.

## How we work (rules for the AI)
- The human is the tech lead and makes architecture calls (data model, security
  policies, upload approach). If a change touches those, stop and propose an ADR
  in `docs/adr/` instead of just doing it.
- Each session starts from a GitHub issue or spec. Work only on that. If you notice
  something out of scope, suggest a `later` issue; don't build it.
- Small steps: one feature → show the diff → run it → commit. Before writing code
  for a new feature, list the files you'll create or change.
- When a technical choice would take more than ~30 minutes, pick the common
  default, write one line on why in the PR/ADR, and move on.
- Never commit secrets. Env vars are documented in `apps/web/.env.example`.
- The repo is public: no client names, emails, or details of unreleased music in code,
  issues, commits, or `NOTES.md`. Use initials.
- Verify before saying it's done: `npm run lint`, `npm run typecheck`, `npm run build`
  (from repo root). Say plainly what you did not verify.
- After a session, append what you asked, what you got wrong, and what was decided to `NOTES.md`.

## Commands (run from repo root)
- `npm install`: install all workspaces
- `npm run db:start`: local Supabase + Mailpit (starts dockerd in cloud sessions), seeds dev users
- `npm run dev`: app on http://localhost:3000 against local Supabase (`apps/web/.env.local`)
- `npm run test:e2e`: Playwright tests (local stack must be running)
- `npm run db:test`: pgTAP RLS tests. Every new table/policy gets tests here, and confirm they FAIL
  when the policy is loosened (a test that never failed proves nothing)
- `npm run db:types`: regenerate DB types after each migration (commit the result)
- `npm run db:reset`: rebuild local DB from migrations + re-seed
- `npm run build` / `npm run lint` / `npm run typecheck`
- `npx supabase migration new <name>`: new SQL migration
- `npx supabase db push`: apply migrations to the linked hosted project

## Gotchas
- Next.js 16 differs from older training data: read `node_modules/next/dist/docs/`
  before using an API you're unsure of. Middleware is now `src/proxy.ts`.
- `NEXT_PUBLIC_*` env vars are inlined at build time; reference them literally.
- Develop and test against the LOCAL stack (ADR 0009), never the hosted projects. Dev users:
  `dev@example.test`, `dev2@example.test`; read their emails from Mailpit (http://127.0.0.1:55324,
  API at `/api/v1`). Supabase allows 1 email per user per second locally.
- Magic links use `token_hash` templates (`supabase/templates/`); `emailRedirectTo` must stay
  exactly `${origin}/auth/callback`. Template changes must also be pasted into the hosted dashboards.
- In Playwright, `getByRole("alert")` also matches Next's route announcer; use text locators.
- Vercel preview deployments are behind Vercel Deployment Protection (login required); production
  isn't. Test anything "opened on another device" on production or while logged into Vercel.
- Supabase Free plan pauses the project after 7 days idle.
- Pages must authorize themselves (`getCurrentUser()` / `getCurrentWorkspace()`); the `/songs`
  layout's check does not protect child pages. Server Actions too: they're public endpoints.
- R2 credentials are server-only: only `src/lib/r2.ts` (which imports `server-only`) may read them.
