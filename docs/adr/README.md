# Architecture Decision Records

One short file per decision that would be expensive to reverse or that a reviewer
would ask "why?" about. Format: Context → Decision → Consequences. Status is
`Proposed`, `Accepted`, or `Superseded by NNNN`. Copy `template.md` to add one.

**Every ADR ends with a `## Changelog`.** When a decision is amended, update the ADR body to the
current truth **and** add a changelog row: date, what changed, why (the trigger: a review finding,
a production surprise, new information), and the PR/commit. Never rewrite history in the body
without a row. The point is to look back later and see how solid each decision was: what held,
what changed, and what we learned. A decision that changes completely gets a new ADR that
supersedes the old one, which keeps its changelog.

| # | Decision | Status |
|---|---|---|
| [0001](0001-monorepo-with-docs-and-agent-memory.md) | Monorepo with code, docs and agent memory | Accepted (reviewed) |
| [0002](0002-stack-nextjs-supabase-r2-vercel.md) | Next.js 16 + Supabase + Cloudflare R2 + Vercel | Accepted (reviewed) |
| [0003](0003-audio-in-r2-presigned-urls.md) | Audio in R2 via presigned URLs; ownership checked in Supabase | Accepted (reviewed) |
| [0004](0004-workspace-ownership-and-rls.md) | Workspaces own data; RLS enforces membership; invite-only signups | Accepted (reviewed) |
| [0005](0005-client-access-share-link-redeem-rls.md) | Clients: share link → anonymous session → grant → RLS | Accepted (reviewed) |
| [0006](0006-schema-as-migrations.md) | Schema and infra as code; split dev/prod before Week 4 | Accepted (reviewed) |
| [0007](0007-github-issues-for-planning.md) | GitHub Issues + milestones for planning; Later list as a label | Accepted (reviewed) |
| [0008](0008-cache-components-off.md) | Cache Components off (nearly every page is per-request) | Accepted (reviewed) |
| [0009](0009-local-first-development.md) | Local-first dev (Supabase CLI + Mailpit), token_hash magic links, custom SMTP | Accepted (reviewed) |
