# 0005. Client access: share link → anonymous session → grant → RLS

- Status: Accepted (direction). Implementation details are settled in the Week 2 spec.
- Date: 2026-11-19
- Decided by: Ryan (reviewed; chosen over token-checking DB functions because client features will grow)

## Context
Clients (artists, labels) won't create accounts to hear a mix. The v1 loop needs a link that
lets them listen and comment with no signup. Later, clients will likely get more capabilities
(approve versions, see history, download) and possibly real accounts and roles. We want one
permission system that grows into that, not two.

## Decision
1. **`share_links`**: `(id, song_id, token, created_by, expires_at null, revoked_at null, created_at)`.
   The token is 192 bits of randomness, **stored as-is** so the engineer can re-copy the link later, and
   readable only by members of the song's studio (RLS); only `revoked_at` is updatable. One **active**
   link per song (partial unique index); one link covers one song in v1.
2. The share page `/s/[token]` has **no side effects on load**. A first-time visitor clicks **Listen**,
   which signs them in with **Supabase anonymous sign-in** (a real `auth.uid()`, no email), redeems the
   link and goes to `/listen/[songId]`. Visitors who already have a session are redeemed and redirected
   straight away. The click step exists so that link-preview bots (iMessage, Slack, email) don't create
   anonymous users or use up the per-IP anonymous sign-in limit.
3. One `security definer` function **`redeem_share_link(token)`** validates the token and upserts
   **`song_access (song_id, user_id, role, share_link_id, created_at)`** with `role = 'client'`.
4. Everything else (reading the song and versions, reading and adding comments) goes through
   **normal RLS**. `private.can_access_song(song_id)` = studio member (ADR 0004) **or**
   `private.has_active_grant(song_id)` (a `song_access` grant whose link isn't revoked or expired), so
   revoking a link cuts off everyone who used it. The `songs` read policy checks the row's own
   `workspace_id` instead of re-querying `songs` (a re-query can't see a row inserted in the same
   statement, which broke `insert … returning`). Writes stay members-only.
5. The client is asked for a display name on first comment (stored on their anonymous user's
   metadata / a cookie). Comments store `author_user_id` + `author_name`.
6. Audio for clients uses the same presigned R2 GET path (ADR 0003), issued after an RLS-checked read.
7. Live comments can use Supabase Realtime with RLS, since anonymous users are `authenticated`.

## Alternatives considered
- **Token + per-capability `security definer` functions:** simplest in Week 2, but every new client
  feature becomes another function that re-checks the token, creating a parallel permission system
  next to RLS that drifts once clients have accounts.
- **Token validated in Next.js with the service-role key:** one bug exposes every workspace.
- **Client accounts from day one:** friction kills the "just click the link" experience.

## Consequences
- **Upgrade path:** an anonymous client can later add an email and become a permanent user with
  the same `auth.uid()`, keeping their grants and comments. Client roles extend `song_access.role`.
- Anonymous users accumulate in Auth and count as MAUs (fine at this scale). Add a captcha or rate
  limiting on anonymous sign-in before any public launch.
- Opening the link on a second device creates a second anonymous user. Acceptable; name is re-entered.
- Revoking a link revokes access for everyone who redeemed it (`share_link_id` on the grant), and is
  **final** (the database refuses clearing `revoked_at`). Signed audio URLs already issued (1 hour)
  and audio already downloaded keep working until they expire; the UI says so.
- Share URLs are built from `NEXT_PUBLIC_SITE_URL`, not request headers.
- Read policies call security-definer helpers per row; fine at this scale, revisit with set-based
  helpers if tables grow (Later issue).
- Anonymous sign-ins require Supabase's global signups **on**; invite-only is enforced in the database
  instead (ADR 0004, amended in #42). Anonymous users cannot upgrade to permanent accounts unless invited.
- Project/album-level links (one link for an EP) are on the Later list; additive (`projects` table).

## Changelog
| Date | Change | Why |
|---|---|---|
| 2026-11-19 | Drafted by AI as *Proposed*: share token + `security definer` functions per client capability. | Left for Ryan to decide. |
| 2026-11-19 | Reviewed and accepted as a **hybrid**: share link → anonymous session → `song_access` grant → plain RLS (`52e185f`). | Per-capability functions would become a second permission system once clients get more features or accounts. |
| 2026-11-20 | Spike result recorded: anonymous sign-ins don't work with global signups off; resolved by moving invite-only into the DB (ADR 0004). Design otherwise unchanged (#42). | The 15-minute check this ADR asked for found the conflict before any share-link code was written. |
| 2026-11-20 | Implemented (#43): **token stored in plain text** rather than hashed, readable only by studio members; one active link per song; only `revoked_at` updatable; grants count only while their link is active; studio members opening their own link get no client grant. | Ryan's call: engineers need to re-copy links, and these are streaming links, not bank details, so the hash-only/show-once UX wasn't worth it. A database leak would expose working links, which is accepted. |
| 2026-11-20 | Hardened after the PR #52 review: revoking is final (un-revoke refused); token format enforced (`^[A-Za-z0-9_-]{32,64}$`); grant check also matches link↔song; share URLs from `NEXT_PUBLIC_SITE_URL`; revoke text admits already-open audio lasts up to an hour; tests for grant privacy, cross-studio revoke, and versions cut off on revoke/expiry (#43). | Independent review found un-revoke possible (confirmed live) and several untested claims; no exploitable high/medium issue. |
| 2026-11-21 | Client page built (#44): a **click to listen** instead of signing in on page load; client view at `/listen/[songId]` (RLS-only, revoked → 404); anonymous users are not engineers (proxy and `getCurrentUser` send them to `/login`; no studio → 404, not 500). | Signing in on load would let link-preview bots create anonymous users and use up the rate limit. Engineer pages must never treat a share-link session as an engineer. |
