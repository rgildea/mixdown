# 0004. Workspaces own the data; RLS enforces membership; signups are invite-only

- Status: Accepted
- Date: 2026-11-19
- Decided by: Ryan (reviewed; original draft was per-user ownership with open signups)

## Context
The browser and Server Actions talk to Supabase with the anon key plus the user's session, so
authorization must live in Postgres. Today there is one engineer, but assistants, partner studios,
or selling to other engineers are plausible. Changing the ownership unit later means migrating
data and rewriting every policy, so we pick it now.

Supabase magic links create an account for any email by default, which would let strangers
upload to our R2 bucket at our expense.

## Decision
**Data is owned by a workspace (a studio). Users are members of workspaces.**

```sql
workspaces        (id, name, created_at)
workspace_members (workspace_id, user_id, role check (role in ('owner','member')), created_at,
                   primary key (workspace_id, user_id))
songs             (id, workspace_id → workspaces, created_by → auth.users, title, client_name, created_at)
mix_versions      (id, song_id → songs, version_number, object_key, original_filename,
                   mime_type, size_bytes, created_by, created_at, unique (song_id, version_number))
```

- RLS on every table. One helper, `private.is_member(workspace_id)`, a `security definer`
  `stable` function checking `workspace_members` for `(select auth.uid())`. Policies call it, which
  avoids recursive RLS on `workspace_members` and keeps policies one line each.
- `songs`: members can do everything. `mix_versions`: members of the song's workspace.
  `workspaces`/`workspace_members`: members can read; writes only via migrations or the
  dashboard in v1.
- **Every user gets a personal workspace automatically**: an `after insert on auth.users`
  trigger creates "<email>'s studio" with that user as `owner`.
- v1 UI assumes one workspace per user (their first). Adding members, a workspace switcher, and
  role-based permissions go on the Later list. `role` exists now so no migration is needed later.
- R2 keys are prefixed by workspace: `{workspace_id}/{song_id}/v{n}-{uuid}.{ext}`.
- Indexes: `songs(workspace_id, created_at desc)`, `mix_versions(song_id)`, `workspace_members(user_id)`.
- **Invite-only:** public signups disabled in Supabase Auth (and `enable_signup = false` in
  `supabase/config.toml`); `signInWithOtp({ options: { shouldCreateUser: false } })`; users are
  invited from the dashboard. Clients never get accounts (see ADR 0005).
- No service-role key in Week 1.

## Alternatives considered
- **Per-user ownership (`songs.owner_id`)**: about an hour less work now, but a painful migration
  if a second engineer ever joins. Rejected: workspaces are the one data-model choice that's
  expensive to retrofit.
- **Open signups:** each user would be isolated by RLS anyway, but costs and abuse are unbounded.
- **Inline membership subqueries in every policy:** works, but repetitive and prone to RLS recursion.

## Consequences
- Isolation test (spec §9) uses a second *invited* account, which gets its own workspace.
- `created_by` records who uploaded or created what, for future team features and audit.
- Every new table must have RLS and policies in the same migration that creates it.
- `security definer` functions live in a non-exposed `private` schema with `search_path` set.
