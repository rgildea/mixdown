# Agent memory for Mixdown

@PROJECT.md
@apps/web/AGENTS.md

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
- Verify before saying it's done: `npm run lint`, `npm run typecheck`, `npm run build`
  (from repo root). Say plainly what you did not verify.
- After a session, append what you asked, what you got wrong, and what was decided to `NOTES.md`.

## Commands (run from repo root)
- `npm install`: install all workspaces
- `npm run dev`: app on http://localhost:3000
- `npm run build` / `npm run lint` / `npm run typecheck`
- `npx supabase migration new <name>`: new SQL migration
- `npx supabase db push`: apply migrations to the linked hosted project
- `npx supabase start`: optional local stack (needs Docker)

## Gotchas
- Next.js 16 differs from older training data: read `node_modules/next/dist/docs/`
  before using an API you're unsure of. Middleware is now `src/proxy.ts`.
- `NEXT_PUBLIC_*` env vars are inlined at build time; reference them literally.
- Supabase Free plan: 50 MB per-file cap, project pauses after 7 days idle.
