# Spike: anonymous sign-ins vs invite-only (Week 2 gate, epic #9)

Date: 2026-11-20 · Local Supabase stack (same GoTrue as hosted) · Throwaway; nothing committed.

## Question
ADR 0005 (share link → anonymous session → grant → RLS) needs Supabase anonymous sign-ins.
ADR 0004 makes signups invite-only with the global `enable_signup = false`. Do they coexist?

## Findings
1. **No.** With `enable_signup = false`, anonymous sign-in fails with "Signups not allowed for this
   instance" even when `enable_anonymous_sign_ins = true`. The global switch covers anonymous users too.
2. This CLI/GoTrue version has no email-only signup switch (`[auth.email]` only turns the whole provider on or off).
3. **Signups on + anonymous on + a `before_user_created` auth hook** that rejects non-anonymous users:

   | Probe | Result |
   |---|---|
   | Anonymous sign-in | works |
   | Stranger: email+password signup via API | blocked (403, hook) |
   | Stranger: magic link with `create_user: true` | blocked (403, hook) |
   | Admin-created user (dashboard invite, seed script) | works (hook doesn't fire for admin creates) |
   | Existing user's magic link | works |
   | Anonymous user gets a workspace? | no (trigger skips anonymous) |
   | **Anonymous user sets an email (PUT /user)** | **became a permanent account. The hook only covers creates.** |

4. A `before update` trigger on `auth.users` that refuses `is_anonymous true → false` and email changes
   for anonymous users **closes that hole** (500, no account). Anonymous users can still update
   `user_metadata` (display name) and refresh their session.

## Risk worth noting
With global signups **on**, invite-only depends on the hook being configured. Hooks live in
`config.toml` locally but in the **dashboard** on hosted. Forgetting it on a new project (e.g. prod in
Week 4) **fails open**: anyone could sign up. Untested alternative that fails closed: enforce invite-only
with a `before insert` trigger on `auth.users` plus an invite allowlist table, entirely in migrations.

## Follow-up: invite allowlist enforced in the database (chosen by Ryan)
Signups on + anonymous on; `private.invites` allowlist; a `before insert or update` trigger on
`auth.users`: anonymous inserts are allowed, everything else needs an invited email, and an anonymous user
may only become permanent with an invited email. `public.invite_user(email)` is executable by `service_role` only.

| Probe | Result |
|---|---|
| Anonymous sign-in | works |
| Stranger email+password signup / magic link with `create_user` | refused (GoTrue 500 "Database error saving new user"), no account |
| Anonymous user sets an uninvited email | refused, no account |
| Admin creates an **uninvited** user | refused: invite first, even from the dashboard |
| `invite_user()` with the anon key or an anonymous user's JWT | 42501 permission denied |
| `invite_user()` with the service role, then admin create | works, workspace created |
| Invited person self-signs-up via magic link | works, workspace created |
| Existing user's magic link; anonymous display-name update + refresh | work |

**Fails closed:** it lives entirely in migrations, so a new project (prod) is invite-only as soon as
migrations run, whatever the dashboard says. The only dashboard steps are turning signups and anonymous
sign-ins **on**, and those must come *after* the migration is applied.
