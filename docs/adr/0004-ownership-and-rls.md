# 0004. Ownership enforced by Postgres RLS

- Status: Accepted
- Date: 2026-11-19

## Context
The browser talks to Supabase directly with the public anon key, so authorization must
live in the database, not in app code that a client could bypass.

## Decision
- Every table has RLS enabled. `songs.owner_id = auth.uid()` is the root of ownership;
  child tables (`mix_versions`, later `comments`) check ownership through their song.
- The service-role key is never shipped to the browser and not used at all in Week 1.
- Schema per `docs/specs/week-1-spec.md` §5.

## Consequences
- Multi-user safety comes for free: a second account sees nothing (manual test in spec §9).
- Add an index on `songs(owner_id, created_at desc)` for the list query, and on
  `mix_versions(song_id)` for the RLS subquery.
- Every new table needs policies in the same migration that creates it. Reviewers check this.
