# 0001. Monorepo with code, docs and agent memory

- Status: Accepted
- Date: 2026-11-19
- Decided by: Ryan (reviewed)

## Context
Most code is written by AI coding tools from specs I write. The specs, decisions, and
conventions have to stay next to the code so every session (human or AI) starts from the
same context, and so reviewers can see *how* the project was built.

## Decision
One GitHub repo, npm workspaces:
- `apps/web`: the Next.js app. Future deployables (e.g. an AI notes worker) go in `apps/*`,
  shared code in `packages/*` only once something is actually shared.
- `supabase/`: at the root, because the schema belongs to the product, not to one app.
- `docs/`: plan, specs, ADRs. `PROJECT.md` is the project doc (stack, conventions, layout).
- **Agent memory is tool-neutral:** `AGENTS.md` at the root holds the working rules (read by
  Cursor, Codex and others); `CLAUDE.md` just imports `AGENTS.md` + `PROJECT.md` for Claude Code.
- `NOTES.md`: log of working with AI.

## Alternatives considered
- Single-package repo with the app at root: slightly simpler now, but an AI worker
  in Week 5 would muddle the root. Workspaces cost nothing to set up today.
- Turborepo/Nx: overkill for one app.
- Docs in Notion/Google Docs: invisible to the AI tool and to reviewers.
- `CLAUDE.md` as the only rules file: Cursor and other tools wouldn't see the rules.
- Possible YAGNI: a second deployable may never appear (Week 5 AI work may be just server
  actions). Kept anyway; flattening later or now is ~10 minutes either way.

## Consequences
- Vercel project must set **Root Directory = `apps/web`**.
- Run npm scripts from the root (they forward to the workspace).

## Changelog
| Date | Change | Why |
|---|---|---|
| 2026-11-19 | Drafted by AI from the pre-project plan (`fb84f29`). | Initial setup. |
| 2026-11-19 | Reviewed and accepted. Agent rules moved to a tool-neutral `AGENTS.md`; `CLAUDE.md` now only imports it (`52e185f`). | Ryan may use Cursor or Zed agents as well as Claude Code; `CLAUDE.md` is Claude-only. |
