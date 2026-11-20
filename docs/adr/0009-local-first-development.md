# 0009. Local-first development; magic links with token_hash; custom SMTP for hosted

- Status: Accepted
- Date: 2026-11-19
- Decided by: Ryan (reviewed). Brings forward the local stack that ADR 0006 planned for Week 6.

## Context
Testing #4 against the hosted dev project hit Supabase's built-in email limit (~2 emails/hour,
delivered only to team members) after a few sign-ins. Every dev login sent a real email, through
a throttled service, into a database shared with Vercel previews. Default magic links (PKCE)
also only work in the browser that requested them, and dashboard "invite" emails don't work with them.

Development happens both on Ryan's Mac and in Claude Code cloud sessions. We verified the
Supabase CLI stack runs in cloud sessions (Docker available; images must come from Docker Hub
because the default registry rejects the shared proxy IP).

## Decision
**Environments**
| Env | Supabase | Email | Used for |
|---|---|---|---|
| Local (Mac *and* cloud sessions) | CLI stack in Docker (`npm run db:start`) + RustFS for audio | Mailpit, http://127.0.0.1:55324 | Daily dev, migrations, E2E tests |
| Hosted dev | `mixdown-dev` (Free) | Custom SMTP | Vercel previews |
| Prod (before Week 4) | `mixdown-prod` (Pro) | Custom SMTP | Me and real clients |

"Local" means local to wherever the code runs. A cloud session's stack lives in its own
container and never touches the Mac. Databases are disposable; migrations + seed make them equivalent.

**Auth while developing:** real magic links only. No dev-only password login or backdoor route.
`scripts/dev-seed-users.mjs` creates `dev@example.test` / `dev2@example.test` via the admin API
and refuses to run against anything but localhost.

**Email links:** templates in `supabase/templates/` use `token_hash` links
(`{{ .RedirectTo }}?token_hash=…&type=email`), verified by `/auth/callback` with `verifyOtp`.
They work on any device and support invite emails. Because the template appends a query string,
`emailRedirectTo` is exactly `${origin}/auth/callback`, the post-login destination travels in a
short-lived `mixdown_next` cookie, and the **Site URL is set to `/auth/callback`** so Supabase's
fallback redirect also lands somewhere that can finish sign-in.

**Hosted email:** custom SMTP (Resend free tier) on hosted projects, with the same templates
pasted into the dashboard. Raises the send limit, reaches any address, needed for Week 3 alerts anyway.

**Audio storage locally (decided in #6):** RustFS (`rustfs/rustfs:1.0.6`, Apache-2.0, S3-compatible)
in a container on port 55340 with fixed dev credentials, bucket `mixdown-local`. `src/lib/r2.ts` switches
to it when `R2_ENDPOINT` is set. Verified: presigned PUT with signed type and length (mismatches → 403),
HEAD, range GET, bucket CORS. MinIO was the obvious choice but no longer publishes free Docker images
(2025). The real dev R2 bucket was rejected for local use: it needs secrets on every machine, and cloud
sessions/CI couldn't run upload tests. Previews and production always use R2.

**Tests:** one Playwright auth smoke suite now (`npm run test:e2e`, local stack + Mailpit).
The full suite and CI stay in Week 6.

## Alternatives considered
- **Hosted dev for everything:** no Docker needed, but rate limits, real email, and a shared DB.
- **Dev-only password login / test backdoor:** fastest, but a second sign-in path that can leak into prod.
- **Admin `generateLink` script:** no email needed, but skips the real flow we want to test.
- **Keep PKCE links:** no template to maintain, but same-browser only and invites break.

## Consequences
- Mac needs a Docker runtime (OrbStack recommended). First `db:start` pulls a few GB.
- Cloud sessions: first `db:start` in a fresh container takes a few minutes (image pulls);
  `scripts/db-start.sh` starts `dockerd` and switches registries automatically.
- Email templates exist in two places (repo for local, dashboard for hosted). Keep them in sync.
- Local and hosted rate limits differ; E2E helpers space out requests (1 email/user/second locally).

## Changelog
| Date | Change | Why |
|---|---|---|
| 2026-11-19 | Created: local Supabase + Mailpit by default, `token_hash` magic links, custom SMTP on hosted (PR #30). | Hit Supabase's built-in email limit (~2/hour) while testing on hosted dev. |
| 2026-11-19 | Local ports moved from 543xx to 553xx (PR #30). | CleanMyMac listens on 54321 on macOS. |
| 2026-11-19 | Local audio storage decided: **RustFS** (PR #34). | MinIO no longer publishes free Docker images. Real R2 locally would need secrets on every machine and block cloud/CI tests. |
