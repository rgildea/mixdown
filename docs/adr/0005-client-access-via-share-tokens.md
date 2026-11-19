# 0005. Clients access via share tokens, no accounts

- Status: **Proposed**. Decide at the start of Week 2.
- Date: 2026-11-19

## Context
Clients (artists, labels) won't create accounts to hear a mix. Version 1's loop requires
"a shareable client link that needs no account" that lets them listen and comment.

## Options
1. **Share token + `security definer` Postgres functions.** A `share_links` table holds a
   random 128-bit token per song (revocable, optional expiry). Anonymous callers use
   RPCs like `get_shared_song(token)` and `add_comment(token, at_ms, body, author_name)`
   that validate the token internally. No service-role key in the app.
2. **Share token validated in Next.js server code using the service-role key.** Simpler
   to write, but one bug in app code exposes every user's data.
3. **Supabase anonymous sign-in** plus a membership row granted by the link. Clean RLS, but
   creates a user per visitor and complicates "who said this" across devices.

## Leaning
Option 1: keeps all authorization in Postgres, consistent with ADR 0004.
Signed audio URLs for share pages are created server-side after the token validates.

## Open questions
- How do clients identify themselves: name prompt stored in a cookie?
- Realtime for anonymous viewers: Realtime respects RLS, so may need a broadcast channel instead.
