# 0001. Monorepo with code, docs and agent memory

- Status: Accepted
- Date: 2026-11-19

## Context
Most code is written by AI coding tools from specs I write. The specs, decisions, and
conventions have to stay next to the code so every session (human or AI) starts from the
same context, and so reviewers can see *how* the project was built.

## Decision
One GitHub repo, npm workspaces:
- `apps/web`: the Next.js app. Future deployables (e.g. an AI notes worker) go in `apps/*`,
  shared code in `packages/*` only once something is actually shared.
- `supabase/`: at the root, because the schema belongs to the product, not to one app.
- `docs/`: plan, specs, ADRs. `PROJECT.md` is the human project doc; `CLAUDE.md` is
  agent memory and imports `PROJECT.md` so there's one source of truth.
- `NOTES.md`: log of working with AI.

## Alternatives considered
- Single-package repo with the app at root: slightly simpler now, but an AI worker
  in Week 5 would muddle the root. Workspaces cost nothing to set up today.
- Turborepo/Nx: overkill for one app.
- Docs in Notion/Google Docs: invisible to the AI tool and to reviewers.

## Consequences
- Vercel project must set **Root Directory = `apps/web`**.
- Run npm scripts from the root (they forward to the workspace).
