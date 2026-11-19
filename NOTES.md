# Notes: working log

How I worked with AI tools on this project: what I asked, what it got wrong, what I
decided. Raw material for the Week 6 write-up and interviews. Keep entries short.

## 2026-11-19: Kickoff (Claude Code, cloud session)
- **Asked:** Turn the six-week plan + Week 1 spec into a repo: monorepo layout, ADRs,
  agent memory, GitHub issues, and Session 1 scaffold.
- **AI did:** Scaffolded Next.js 16 + Tailwind v4 in `apps/web` (npm workspaces),
  Supabase clients via `@supabase/ssr`, `supabase init`, PROJECT.md/CLAUDE.md, ADRs 0001–0007,
  issue templates, and a script that creates labels, milestones and the backlog.
- **Caught:** Next.js 16 renamed `middleware.ts` → `proxy.ts`; the spec's
  "middleware" wording would have produced outdated code. Recorded in CLAUDE.md.
- **Decided:** Later list lives in GitHub Issues (`later` label) instead of a markdown list,
  so ideas are one command to capture and easy to triage. Client access (Week 2) left as a
  *proposed* ADR so I make that security call myself.
- **Blocked:** The AI session couldn't create the GitHub repo; I created it by hand.

## Weekly check-ins
<!-- Sunday: What shipped (link)? What did I cut? What slowed me down? Next week's one goal? -->
