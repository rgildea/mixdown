# Architecture Decision Records

One short file per decision that would be expensive to reverse or that a reviewer
would ask "why?" about. Format: Context → Decision → Consequences. Status is
`Proposed`, `Accepted`, or `Superseded by NNNN`. Copy `template.md` to add one.

| # | Decision | Status |
|---|---|---|
| [0001](0001-monorepo-with-docs-and-agent-memory.md) | Monorepo with code, docs and agent memory | Accepted |
| [0002](0002-stack-nextjs-supabase-vercel.md) | Next.js 16 + Supabase + Vercel | Accepted |
| [0003](0003-direct-to-storage-resumable-uploads.md) | Browser → Supabase Storage via TUS; private bucket + signed URLs | Accepted |
| [0004](0004-ownership-and-rls.md) | Ownership enforced by Postgres RLS | Accepted |
| [0005](0005-client-access-via-share-tokens.md) | Clients access via share tokens, no accounts | Proposed (Week 2) |
| [0006](0006-schema-as-migrations.md) | Schema changes only through Supabase CLI migrations | Accepted |
| [0007](0007-github-issues-for-planning.md) | GitHub Issues + milestones for planning; Later list as a label | Accepted |
