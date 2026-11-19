# 0006. Schema changes only through Supabase CLI migrations

- Status: Accepted
- Date: 2026-11-19

## Context
Clicking in the Supabase dashboard leaves no history, can't be reviewed in a PR, and
can't recreate the database for tests in Week 6.

## Decision
- `npx supabase migration new <name>` → SQL in `supabase/migrations/`, reviewed in the PR.
- Apply to the hosted project with `npx supabase db push` (linked via `supabase link`).
- Tables, RLS policies, the storage bucket, and storage policies all go in migrations.
- Local Docker stack (`supabase start`) is optional in Week 1; required for tests in Week 6.

## Consequences
- The hosted DB must never be edited by hand. If it is, capture it with `supabase db diff`.
- Generate TypeScript types with `npx supabase gen types typescript --linked` after each migration.
