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
   The token is 128+ bits of randomness; only a hash is stored. One link covers **one song** in v1.
2. The share page `/s/[token]` signs the visitor in with **Supabase anonymous sign-in**
   (a real `auth.uid()`, no email) if they have no session.
3. One `security definer` function **`redeem_share_link(token)`** validates the token and upserts
   **`song_access (song_id, user_id, role, share_link_id, created_at)`** with `role = 'client'`.
4. Everything else (reading the song and versions, reading and adding comments) goes through
   **normal RLS**. A helper `private.can_access_song(song_id)` returns true for workspace members
   (ADR 0004) **or** users with a `song_access` grant whose link isn't revoked or expired.
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
- Revoking a link revokes access for everyone who redeemed it (`share_link_id` on the grant).
- **Week 2 first task (15 min):** confirm anonymous sign-ins work with `enable_signup = false`
  (separate `enable_anonymous_sign_ins` setting).
- Project/album-level links (one link for an EP) are on the Later list; additive (`projects` table).
