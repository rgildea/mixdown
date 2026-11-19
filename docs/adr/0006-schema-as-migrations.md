# 0006. Schema and infra changes as code; split dev/prod before Week 4

- Status: Accepted
- Date: 2026-11-19
- Decided by: Ryan (reviewed)

## Context
Clicking in the Supabase or Cloudflare dashboards leaves no history, can't be reviewed in a PR,
and can't recreate an environment. From Week 4 real client data exists, so experiments must
not run against it.

## Decision
- **Postgres:** every table, policy, function and trigger goes through
  `npx supabase migration new <name>` → SQL in `supabase/migrations/` → reviewed in the PR.
  Apply with `npx supabase db push` to the linked project.
- **Ordering rule:** push a migration *before* merging code that depends on it, and keep
  migrations backward-compatible with the currently deployed code (add, then use, then remove).
- **R2:** bucket CORS rules live in `infra/r2-cors.json`, applied with `wrangler r2 bucket cors set`.
  Bucket creation and API tokens are documented steps in the README (one-time).
- **Types:** `npx supabase gen types typescript --linked > apps/web/src/lib/database.types.ts`
  after each migration, committed.
- **Environments:**
  - Weeks 1–3: one hosted Supabase project (`mixdown-dev`) for local dev, previews and production.
  - **Before Week 4:** create `mixdown-prod` (Supabase) and a prod R2 bucket, `db push` all migrations,
    point Vercel *Production* env vars at them. Previews and local stay on dev.
  - Week 6: add the local Docker stack (`supabase start`) for automated tests, and apply migrations
    from GitHub Actions instead of by hand.

## Alternatives considered
- Dev + prod from Session 1: same end state, double the setup in the momentum-critical first week.
- Local Docker-only dev: best isolation, but requires Docker; deferred to Week 6 when tests need it.

## Consequences
- The hosted DB must never be edited by hand. If it happens, capture it with `supabase db diff`.
- Because migrations fully describe the schema, creating prod is ~10 minutes. This is tested
  for real in Week 4.
