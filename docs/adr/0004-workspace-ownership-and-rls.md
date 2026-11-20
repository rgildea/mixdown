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
- **Invite-only, enforced in the database** (amended in #42): `private.invites` is an email allowlist.
  A `before insert or update` trigger on `auth.users` (`private.guard_auth_users`) allows anonymous
  users (share-link clients, ADR 0005), allows anyone else only if their email is invited, and lets an
  anonymous user become a permanent account only with an invited email. Supabase's global signup
  switch is therefore **on** (it also blocks anonymous sign-ins when off), and anonymous sign-ins are on.
  This **fails closed**: any project running the migrations is invite-only whatever the dashboard says.
- **Inviting someone = allowlisting AND creating their account in one step** (`npm run invite --
  [--remote] a@b.com`, `scripts/invite.mjs`). There is never an "invited but unregistered" email: the
  public `/auth/v1/signup` endpoint could otherwise let anyone who knows that address claim it first with
  their own password (found by the PR #50 review and confirmed live). `/signup` can't touch an existing
  account ("User already registered"). The login form never creates accounts (`shouldCreateUser: false`).
- **Anonymous users never become permanent accounts or get an email.** A future "client accounts" feature
  needs its own ADR. Permanent users can't change their email to an uninvited address.
- **The UI is not a security boundary.** Anyone can call the Supabase Auth API with the public anon key,
  including password signup, even though Mixdown only uses magic links. Every rule lives in the database.
- No service-role key in Week 1.

## Alternatives considered
- **Per-user ownership (`songs.owner_id`)**: about an hour less work now, but a painful migration
  if a second engineer ever joins. Rejected: workspaces are the one data-model choice that's
  expensive to retrofit.
- **Open signups:** each user would be isolated by RLS anyway, but costs and abuse are unbounded.
- **Global signup switch off** (original decision): simple, but blocks anonymous sign-ins (spike, #9).
- **`before_user_created` auth hook:** works, but it's configured in the dashboard, so a new project
  without it **fails open**. It also doesn't cover anonymous users adding an email (an update).
- **Inline membership subqueries in every policy:** works, but repetitive and prone to RLS recursion.

## Consequences
- Isolation test (spec §9) uses a second *invited* account, which gets its own workspace.
- Hosted rollout order matters: apply the migration **before** switching signups/anonymous on.
- Refused signups surface from GoTrue as a generic 500 ("Database error saving new user"). The login
  form shows the same "check your email" message regardless, but the raw API (and email timing) still
  reveals which emails have accounts, as it did before. Accepted: the user list is small and not secret.
- Abuse of anonymous sign-ins (bots creating throwaway users) is rate-limited per IP; captcha is Later #23.
- `created_by` records who uploaded or created what, for future team features and audit.
- Every new table must have RLS and policies in the same migration that creates it.
- `security definer` functions live in a non-exposed `private` schema with `search_path` set.

## Changelog
| Date | Change | Why |
|---|---|---|
| 2026-11-19 | Drafted by AI: per-user ownership (`songs.owner_id`), open magic-link signups. | Initial plan. |
| 2026-11-19 | Reviewed: **workspaces own data**, users are members; **invite-only** signups (`52e185f`). | The ownership unit is costly to retrofit. Open signups would let strangers fill the R2 bucket. |
| 2026-11-19 | Implemented in #5 with narrower privileges than drafted: select/insert-only policies, `anon` revoked, and the workspace trigger skips anonymous users (PR #32). | Least privilege until edit/delete exists; anonymous share-link users must not get workspaces. |
| 2026-11-20 | **Invite-only moved from Supabase's global signup switch into the database:** `private.invites` allowlist + `guard_auth_users` trigger + service-role `invite_user()`; signups and anonymous sign-ins switched on; inviting = allowlisting, and invited people sign in normally (#42). | Week 2 spike: the global switch also blocks anonymous sign-ins (needed by ADR 0005). Ryan chose the DB allowlist over an auth hook because it fails closed. |
| 2026-11-20 | **Tightened before rollout:** inviting now creates the account in the same step (no invited-but-unregistered window); the login form never creates accounts; anonymous users can never become permanent; permanent users can't move to an uninvited email; API-level attack tests added (PR #50). | An independent review found, and a live probe confirmed, that allowlist-only invites let anyone pre-claim an invited address via the public `/signup` endpoint with a password. Supersedes the same-day "allowlist-only" choice. |
