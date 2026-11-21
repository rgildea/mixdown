# Notes: working log

How I worked with AI tools on this project: what I asked, what it got wrong, what I
decided. Raw material for the Week 6 write-up and interviews. Keep entries short.

## 2026-11-19: Kickoff (Claude Code, cloud session)
- **Asked:** Turn the six-week plan + Week 1 spec into a repo: monorepo layout, ADRs,
  agent memory, GitHub issues, and Session 1 scaffold.
- **AI did:** Scaffolded Next.js 16 + Tailwind v4 in `apps/web` (npm workspaces),
  Supabase clients via `@supabase/ssr`, `supabase init`, PROJECT.md/CLAUDE.md, ADRs 0001–0007,
  issue templates, and a script that creates labels, milestones and the backlog.
- **Caught:** Next.js 16 renamed `middleware.ts` → `proxy.ts`; the spec's
  "middleware" wording would have produced outdated code. Recorded in CLAUDE.md.
- **Decided:** Later list lives in GitHub Issues (`later` label) instead of a markdown list,
  so ideas are one command to capture and easy to triage. Client access (Week 2) left as a
  *proposed* ADR so I make that security call myself.
- **Blocked:** The AI session couldn't create the GitHub repo; I created it by hand.

## 2026-11-19: ADR review (Claude Code)
- **Why:** The Week 1 plan and stack came out of an earlier AI chat that made the decisions for
  me. Before writing code, I went through every ADR and chose deliberately.
- **Changed:**
  - Audio storage: Supabase Storage + TUS → **Cloudflare R2 + presigned URLs**. Audio streaming
    is egress-heavy and R2 has zero egress fees; also removes the 50 MB Free-plan file cap.
    Upload limit set to 500 MB, single PUT for now (multipart only if real uploads fail).
  - Ownership: per-user → **workspaces** with members. The one data-model choice that's painful to retrofit.
  - Signups: open → **invite-only**. Open magic-link signup would let strangers fill my R2 bucket.
  - Client access: token-checking DB functions → **share link redeemed into an anonymous session +
    grant, then plain RLS**, so client features (and future client accounts) don't need a
    parallel permission system.
  - Agent rules moved to tool-neutral `AGENTS.md`; `CLAUDE.md` imports it.
- **Kept:** Next.js (hiring signal, AI-tool support), Supabase for auth + Postgres, Vercel
  (Hobby until Week 4, then Pro; Netlify's metered free deploys and adapter weren't worth ~$20/mo),
  npm workspaces, migrations as the only way to change schema, dev/prod split before Week 4.
- **AI got wrong / missed at first:** assumed open signups were fine; the original plan's
  Supabase Storage choice ignored egress costs for an audio-streaming product.
- **Lesson from the old repo:** `mixdown-cloudflare` (Epic Stack) hand-rolled auth, ORM and upload
  plumbing across ~60 dependencies before any product feature. This time: managed services, own only the product.

## Weekly check-ins
<!-- Sunday: What shipped (link)? What did I cut? What slowed me down? Next week's one goal? -->

### Week 1 check-in (Foundation), 2026-11-20
**1. What shipped?** https://mixdown-three.vercel.app/
- Invite-only magic-link sign-in. Links work across devices. Custom email from `mail.mixdown.audio`.
- Workspaces own the data; Postgres RLS isolates studios (19 pgTAP tests).
- Create a song and upload a WAV/MP3 up to 500 MB **straight to Cloudflare R2** with a progress bar. The
  server only signs and verifies.
- Song page with playback via a fresh 1-hour signed URL; private bucket.
- 30 Playwright tests, including 9 that tamper with Server Action requests to prove the server enforces
  the rules. Local-first dev (Supabase + Mailpit + RustFS in Docker) that also runs in AI cloud sessions.
- Every box in spec §2 and §9 checked on production, including the signed URL failing after an hour
  and working again on refresh (results on #7).
- 7 feature PRs merged (#30, #32, #34, #35, #37, #40, plus the CI workflow #31).

**2. What did I cut or move to Later?**
- Moved to Later (17 open `later` issues): multipart/resumable uploads, compressed streaming copies,
  orphaned-object cleanup, edit/delete songs, a mix-file error message (#38), a layout error page (#39),
  and more.
- Changed rather than cut: my review overturned 4 of the 7 AI-drafted decisions (R2 instead of Supabase
  Storage, workspaces, invite-only, the share-link model), and Cache Components was turned off (ADR 0008).
- **Pulled forward, not cut:** the local Docker stack and E2E tests were planned for Week 6 and landed
  in Week 1 (ADR 0009), because testing against hosted email limits wasn't workable. That was extra
  scope, but it paid for itself immediately.

**3. What slowed me down?**
- Infrastructure surprises, each about an hour: Supabase's built-in email cap (~2/hour), CleanMyMac
  holding port 54321, Supabase CLI v3 defaulting to the local stack (`--remote`), MinIO no longer
  publishing Docker images, and the 1Password SSH agent not running after a `brew upgrade`.
- AI-tool issues: the GitHub review bot was **blind** (it couldn't read the PR) and later skipped PRs
  it had already commented on. Its "No issues found" was meaningless until fixed and canary-tested. An
  independent review agent found real bugs on both #34 and #37 that the bot missed.
- AI mistakes I had to catch: making the mix optional (I created songs without uploads), claiming "lint
  clean" with a warning present, a flaky clock-based test helper, and `Closes #7` written in the commit
  message ahead of the live checks.
- **Time:** about 10 hours, at the top of the 8–10 h budget, but done in **2 days instead of a week**. The
  infrastructure surprises above ate a good share of it; the feature work itself went fast with AI tools.

**4. The single goal for Week 2:** a client opens a share link (no account), sees a waveform, and leaves
comments pinned to timestamps, which I see on my song page. That's the full v1 loop (#9). The first task
is the 15-minute check that anonymous sign-ins work with signups disabled.

**Also for Week 2:** the 1-hour old-repo lessons review (#3), still open. The Week 4 client project is
lined up (#2 closed).

## 2026-11-19: Issue #4, magic-link auth (Claude Code)
- **Asked:** Build #4: invite-only magic-link login, callback, sign-out, protected `/songs`.
- **Built:** `src/proxy.ts` + `lib/supabase/proxy.ts` (session refresh via `getClaims()`, optimistic
  redirects), `/login` with a Server Action (`shouldCreateUser: false`, same response for unknown
  emails), `/auth/callback` (PKCE `code` or `token_hash`), `signOut` action, `lib/auth.ts`
  `getCurrentUser()` as the authoritative check in the `/songs` layout, `safeNext()` against open redirects.
- **Next 16 surprises:** create-next-app enabled `cacheComponents`, so any cookie/searchParams read
  outside `<Suspense>` fails the build. The AI first kept it and added boundaries; after walking
  through the trade-off I **turned it off** (ADR 0008): nearly every page, share links included, is
  per-request, so the static shell buys little and the forced boundaries cost on every page.
  `LayoutProps`/`PageProps` types come from `next typegen`, so `typecheck` now runs it first.
- **Also fixed earlier today:** `apps/web/.gitignore` (from create-next-app) ignored `.env.example`,
  overriding the root `.gitignore` exception.
- **Known limitation:** the default email template uses PKCE, so the link must be opened in the same
  browser that requested it. Switching the template to `token_hash` would lift that; the callback already supports it.

## 2026-11-19: Dev workflow decision (Claude Code)
- **Trigger:** testing #4 on the hosted dev project hit Supabase's built-in email limit after a few
  sign-ins ("Too many attempts").
- **Decided (ADR 0009):** local Supabase (Docker) is the default for dev *and* AI cloud sessions;
  hosted dev is only for Vercel previews; real magic links everywhere (no dev password backdoor);
  `token_hash` email templates so links work across devices; custom SMTP on hosted projects.
- **AI checked before recommending:** confirmed Docker runs in cloud sessions (needed Docker Hub,
  since the default registry refused the shared IP), then ran the full login loop end to end via Mailpit.
- **AI got wrong:** the first E2E helpers were flaky: Supabase's 1-email-per-user-per-second limit and
  stale emails in the inbox. Then `getByRole("alert")` also matched Next's route announcer. Fixed;
  the suite passed 3 runs in a row. Also caught: appending `?token_hash` to a redirect URL that already
  had `?next=` breaks on Supabase's fallback redirect, so `next` moved into a cookie.
- **Mac setup snag:** `db:start` looped on "Transport error … 127.0.0.1:54321". Cause: CleanMyMac listens on
  54321 (Supabase's default API port). Moved the project to 553xx, added a fail-fast port check, and
  made retries cloud-only (locally `supabase start` tears its containers down on failure, so retrying looped).

## 2026-11-19: Hosted email + #4 shipped
- Resend on `mail.mixdown.audio` (DNS added through Resend's Cloudflare integration), custom SMTP on
  the dev project, `token_hash` templates pasted into the dashboard, Site URL → `/auth/callback`.
- Verified: sign-in via the new email on a preview, then cross-device (laptop requests, phone opens)
  on production after merging PR #30.
- Gotcha: opening a preview link on the phone hit **Vercel's SSO page**. Preview deployments are
  protected by Vercel Deployment Protection by default (production isn't). Kept it on; cross-device
  checks happen on production or while logged into Vercel.

## 2026-11-20: Issue #5, schema + songs (Claude Code)
- **Asked:** #5 with pgTAP tests; migration reviewed by me before it touches hosted.
- **Built:** one migration (workspaces, members, songs, mix_versions, `private.is_member()`, select/insert-only
  RLS, anon revoked, personal-workspace trigger that skips anonymous users, backfill), 19 pgTAP tests,
  generated DB types, `getCurrentWorkspace()`, song list (newest first), new-song form + Server Action,
  3 Playwright tests incl. the second-account isolation check from spec §9.
- **AI got wrong:** first draft of the "Bob can't add a version to Alice's song" test selected the id
  through RLS, got zero rows, and inserted nothing, so it could never fail. Rewritten to use Alice's real id.
  Then **mutation-checked** the suite: loosened the songs read policy, and exactly the two isolation tests failed.
- **Decided:** no UPDATE/DELETE policies until editing/deleting is built (least privilege; Later list).
- **AI got wrong (E2E on the Mac):** the Mailpit helper picked "the new email" by comparing Mailpit's
  `Created` timestamp (Docker VM clock) with the test's clock (Mac). Passed in the cloud (one clock),
  failed on the Mac. Suspected Docker VM clock drift after sleep; unconfirmed (clocks matched when
  checked afterwards, and a stale dev server would also explain it). Now matches by unseen message ID,
  which removes the clock dependency either way.

## 2026-11-20: Issue #6, uploads (Claude Code)
- **Decided:** local audio storage = RustFS. The AI probed before recommending: MinIO's Docker Hub
  images no longer exist; RustFS passed presigned PUT/HEAD/range GET/CORS checks.
- **Caught by the probe:** the AWS SDK signs only `content-length` into presigned PUTs by default, so a
  wrong content type would have been accepted by R2 too. Fixed with `signableHeaders`; mismatches now 403.
- **Built:** shared upload rules (by extension, canonical MIME), `lib/r2.ts` (server-only; R2 or RustFS),
  `createSong` → `createUploadUrl` → XHR PUT with progress → `finishUpload` (key-prefix check, HEAD
  size/type check, then the `mix_versions` row), "Try again" without creating a second song, "No mix yet"
  in the list. 5 new E2E tests (WAV, MP3, no file, 600 MB sparse file, .txt/.aiff).
- **Verified:** progress bar on a throttled 200 MB upload (screenshot at 43%); canary build shows no R2
  secret or S3 code in client chunks. The first grep "found" hits, but they were React's `-canary` version string.
- **AI got wrong:** used refs for render-visible state; the React lint rules flagged it, so it switched to state.
- **UX fix from Ryan's local test:** the bare file input was easy to miss (two songs created without a mix).
  Now a bordered picker with a real button and a "Ready to upload: name (size)" confirmation, the mix is
  required (matches the spec flow; "Skip for now" remains after a failed upload), and the button says
  "Create song and upload". Making the mix optional in the first place was the AI's call, and a bad one.
- **Independent review (separate AI agent) of PR #34 found real issues** that the GitHub review action
  missed ("No issues found"): thrown Server Action errors froze the form on "Finishing…"; `ext in TYPES`
  accepted `x.constructor` (prototype chain); upload access inferred from read access (breaks once share
  links grant reads); retry looped on "already has a mix". All fixed.
- **Server checks now have tests that bypass the browser:** Playwright intercepts and tampers with the
  Server Action JSON (foreign song, prototype extension, 600 MB, string size, foreign key, size mismatch,
  wrong content type at storage, retry without a duplicate song, lost finish response). Mutation-checked:
  removing each of six server checks makes its test fail. Not independently testable yet: the
  own-workspace check (RLS already hides foreign songs; meaningful once share links exist).
- **The GitHub review action was blind:** its `allowedTools` contained only the inline-comment tool (no
  `gh pr diff`/`Read`), with a depth-1 checkout. 4 turns, 12 s, $0.15 per "review". Fix in a separate PR.
- **Fixed review bot, verified:** canary PR #36 with two planted bugs (open redirect, `using (true)` RLS
  policy disguised as an index migration). The fixed reviewer flagged both, correctly. Lesson: the run's
  cost and turn count weren't a reliable "is it reviewing?" signal (the working run was cheaper than the
  blind ones); planting known bugs was.
- **Second gotcha:** the reviewer skips PRs it has already commented on. #34's stale blind "No issues
  found" made re-runs exit in 2–3 turns. Deleting it, then close and reopen, gave a real 6-turn review
  (no issues on the fixed code). Inferred from run behavior; I couldn't read the plugin's rule. In AGENTS.md.

## 2026-11-20: Issue #7, song page (Claude Code)
- **Built:** `/songs/[id]` (RLS read; another studio's song, a missing id and a malformed id all give the
  same 404, so nothing leaks about which songs exist), fresh 1-hour presigned GET per request,
  `<audio>` playback, "No mix uploaded", a `not-found` page, an error boundary for `/songs/**`, list
  titles link to their pages, uploads land on the song page. README describes what works and why.
- **Next 16 drift caught from the bundled docs:** error boundaries get `retry()` (re-fetch), not
  `reset()`, and `error: unknown`.
- **Tests (30 total):** playback verified in the browser (duration decoded, currentTime advances), signed
  URL expiry 3600 s and range support (206), unsigned URL 403, fresh URL on reload, 404 cases, signed-out
  redirect returns to the song.
- **Independent review of PR #37 vs the review bot:** the bot (a real 6-turn run this time) said "No issues
  found". The agent found one medium issue the bot missed: the song page relied on RLS alone, which
  would expose another studio's song on the engineer page once share-link grants exist (ADR 0005). It
  also found a lint warning, a test name promising more than it checked, and always-v1 playback. All
  fixed. Conclusion: the bot catches blatant bugs; it doesn't replace a design-aware review.
- **AI got wrong:** reported "lint clean" while lint had a warning (it was grepping for errors only).
  Lint now runs with `--max-warnings=0`, so a warning fails it.

## 2026-11-20: ADR changelogs (Ryan's suggestion)
- Every ADR now ends with a `## Changelog` (date, change, why, PR/commit), backfilled from git history.
  The convention is in `docs/adr/README.md` and AGENTS.md. Goal: look back later at how solid each decision was.
- From the backfill: 4 of 7 original ADRs were substantially changed by Ryan's review (stack storage,
  upload design, ownership, client access). Two more were amended after reviews or surprises during
  implementation (0003 after the #34 review; 0006 twice).

## 2026-11-20: Week 2 S1 (#42), invite allowlist in the database (Claude Code)
- **Why:** the Week 2 spike found that Supabase's global "signups off" also blocks anonymous sign-ins,
  which share links need. Two more probes: an auth hook works but fails open if it's not configured on a new
  project, and it misses anonymous users adding an email. Ryan chose the DB allowlist (fails closed).
- **Built:** `private.invites`, `guard_auth_users` (before insert/update on `auth.users`),
  service-role-only `invite_user()`; signups and anonymous sign-ins on; the login form allows first
  sign-in for invited emails; the seed script invites before creating. ADR 0004 amended + changelog
  rows on 0004 and 0005.
- **Tests:** 16 new pgTAP + 3 E2E. Mutation-checked: dropping the guard, opening `invite_user` to
  clients, and removing the UPDATE guard each fail tests. Dropping the guard makes the uninvited E2E
  test receive a real sign-in email, which is the regression alarm for the most important security property.
- **Gotcha recorded:** `db:reset` doesn't reload auth config; config changes need a stop + start.
- **AI got wrong:** told Ryan to stop + start the stack after pulling. A restarted stack keeps its DB and
  doesn't apply new migrations, so the seed script's `invite_user()` call failed. `db:start` now runs
  `supabase migration up` before seeding; reproduced the failing case and verified the fix.
- **Independent review of PR #50 found a HIGH issue, confirmed live:** with signups on, an allowlisted
  email with no account yet could be claimed by anyone via the public `/auth/v1/signup` with their own
  password. Ryan asked how, since the app only does magic links. Answer: the auth API is public (anon key),
  and password signup exists whether or not our UI uses it. **The UI is not a security boundary.**
  Fix (Ryan's call): invite creates the account in the same step (`npm run invite`), the login form never
  creates accounts, anonymous users never become permanent, and email changes are restricted. Four API
  attack tests added. A mutation check showed the anonymous-takeover test really depends on the guard
  (my first manual probe of that attack had "failed" for an incidental reason; it is exploitable).
- **AI got wrong:** proposed and built "allowlist-only invites" without modelling the raw API as an
  attacker would. The review agent did; the bot review on #50 hadn't run yet.

## 2026-11-20: Week 2 S2 (#43), share links, engineer side (Claude Code)
- **Decided (Ryan):** store the share token in plain text so engineers can re-copy links ("these are just
  streaming audio links, not bank account numbers"), overriding ADR 0005's hash-only line. Recorded in
  the changelog.
- **Built:** `share_links` (one active per song), `song_access` grants created only by
  `redeem_share_link()`, `has_active_grant`/`can_access_song` helpers, read policies switched to
  members OR active grantees, and a song-page panel (Create / Copy / Revoke, re-copy after reload).
- **Tests:** 28 new pgTAP tests covering the full client lifecycle (redeem → read → revoke → cut off → new link →
  expire), mutation-checked 5 ways; 2 E2E.
- **AI got wrong (twice):** (1) another vacuous test: a client's "attack" insert selected the link id through
  RLS, got zero rows and inserted nothing. Same trap as in #5; fixed with an admin-captured id. (2) The new
  songs read policy re-queried `songs`, which can't see a row inserted in the same statement, so creating a
  song failed. pgTAP missed it (no `insert … returning` test); the E2E suite caught it. Fixed, a regression
  test was added, and the rule is in AGENTS.md.
- **Independent review of PR #52:** nothing exploitable at high or medium severity. It found that a member could
  **un-revoke** a link via the raw API (confirmed live; now refused), plus untested claims: revoking
  cutting off *versions*, grant privacy, and cross-studio revoke. All now tested and mutation-checked (4 more
  mutations caught). Also: token format enforced, link↔song check in grants, share URLs from
  `NEXT_PUBLIC_SITE_URL` instead of request headers, honest "audio already open lasts up to an hour"
  text. Per-row RLS function cost moved to Later #53.
- **AI got wrong:** miscounted pgTAP plans twice (the harmless kind of failure).

## 2026-11-20: Making the bot review trustworthy (Claude Code)
- **Asked:** research why the `code-review` plugin said "No issues found" on #37 and #52 when independent
  reviews found medium issues, then fix it. Write-up: `docs/research/2026-11-claude-code-review.md`.
- **Found (in the plugin's source):** it skips any PR Claude has already commented on, keeps only bugs that are
  certain from the diff alone, and lists "lack of test coverage, general security issues" as false positives.
  Our runs never used Opus, so its multi-agent steps didn't run either. And the action's default auto
  permission mode meant our "read-only" tool list wasn't strict.
- **Changed:** a project-specific prompt (`.github/review-prompt.md`, pointing at AGENTS.md), Opus at high
  effort, strict read-only tools, every push re-reviewed, one comment edited in place, posted by a separate job.
  Cost per push goes up (estimate $1–3); validation is a canary PR after merge.

## 2026-11-21: Review canary + share-URL fix (Claude Code)
- **Canary PR #55 for the new review (#54):** three subtle planted bugs (songs policy re-query that breaks
  `insert … returning`, a song page relying on RLS alone, a vacuous pgTAP attack). The review caught all three with
  correct severities (1 high, 2 medium), then edited the same comment after a fix push (fixed one dropped,
  two "still open"). About $0.47 and 66 s per run. Our own pgTAP regression also caught the policy bug; the other
  two pass every test, which is why the review matters. It pointed out that no CI runs `db:test`.
- **Bug (found by Ryan on production):** share links said `http://localhost:3000/s/…`. `NEXT_PUBLIC_SITE_URL`
  wasn't set for Production, and the code silently fell back to localhost. **AI got wrong:** a silent fallback to a
  plausible-but-wrong value. Now `siteUrl()` falls back to Vercel's runtime `VERCEL_PROJECT_PRODUCTION_URL` and
  ignores localhost values on Vercel; a production build with no URL at all throws instead of guessing.

## 2026-11-21: Week 2 S3 (#44), client share page (Claude Code)
- **Built:** `/s/[token]` (no side effects on load; **Listen** click → anonymous sign-in → redeem →
  `/listen/[songId]`; returning visitors go straight through), the client listen page (RLS-only access,
  fresh signed audio URL, revoked → 404 "This mix isn't available"), and anonymous sessions are never treated as engineers
  (proxy + `getCurrentUser`); "no studio" is now a 404, not a 500 (#9 item).
- **Decided (AI, recorded in ADR 0005):** click to listen rather than signing in on load, so link previews
  (iMessage/Slack/email) can't create anonymous users. A test asserts that viewing the link creates no user.
- **Tests:** 5 new E2E across two browsers (client plays the mix with no account; revoke cuts off; bad
  links; anonymous blocked from engineer pages; engineer opening their own link).
- **AI got wrong:** two pgTAP assertions from #52 counted revoked links across the WHOLE database as admin,
  so they failed once E2E runs had revoked real links locally. Now scoped to the fixture's song; verified on
  a dirty and a clean database.
- **Bot review of #57 (first real one under #54) found a medium issue, fixed:** I'd put `signInAnonymously()` in
  a Server Action, so Supabase saw Vercel's IP and every client shared one 30/hour anonymous limit. Since it signed in
  before checking the token, anyone could exhaust it with junk tokens and block all clients. Now the browser
  signs in (per-visitor IP) and the server only redeems, never creating users. Also: everyone clicks Listen
  (loading the page used to redeem for existing sessions, a write on GET), plus 3 new tests: no grant from loading the
  link while signed in; a replayed redeem without a session creates no user; a replayed engineer action with an
  anonymous session creates nothing, **with a positive control** (the same replay as the engineer does create a link).
- **Also:** `db:start` now removes a stale Docker pid file left by a container restart.
- **Bot re-review:** all four fixed; one new low: the browser trusted `getSession()` (cookie only), so a
  deleted anonymous user's browser would be stuck on "Try again". Now `getUser()` validates and a stale session
  is cleared locally and replaced. The new test deletes the user mid-session (mutation-checked: the old code
  gets stuck).
- **Bot re-review of that fix (medium):** it treated *any* `getUser()` error as a dead session, so a network
  blip, 5xx or 429 signed the browser out and replaced the client's anonymous identity (losing earlier grants) or
  logged an engineer out. Now only "no session" or a 401/403 replaces the session; anything else says "Couldn't
  reach the server" and keeps it. New test fails `/auth/v1/user` once (network, then 500) and checks no new
  anonymous user is made (mutation-checked: fails on the previous code). Lesson: a fix that adds a network call
  adds a new failure mode; test the failure, not just the happy recovery.
- **Share page copy by visitor (Ryan's ask):** reviewed the flow for each visitor; a signed-in engineer was
  told "No account needed". Now the page reads (never writes) the session: your own link → "This is your share
  link" + preview + back to song; another account → "Signed in as …, the mix will be added to this account";
  anonymous → unchanged. Decided: an engineer's grant stays on their real account (no guest option).

## 2026-11-21: Design tokens and UI components, ahead of a Claude Design import (Claude Code)
- **Asked:** tidy colors, type, spacing and components so a `/design-sync` or Claude Design repo import comes
  out clean. Plan shown first and approved.
- **Built:** semantic color tokens (`primary`, `muted`, `subtle`, `line`, `danger`…) and `rounded-control` /
  `rounded-card` in `globals.css` (Tailwind v4 `@theme`), with the same values as before; `src/components/ui/`
  (`Button`/`ButtonLink`, `Input`, `Field`, `ErrorText`, `Alert`, `Card`, `EmptyState`, `PageHeader`,
  `Wordmark`); every page switched over, no raw zinc/red/emerald left; `docs/design-system.md`.
- **Visible changes (small, on purpose):** primary buttons now have a hover shade and pointer cursor; the
  login-link error box has the same padding as the success box, and the login label sits closer to its input
  (same `Field` spacing as the new-song form). Songs list and song page are pixel-identical before and after.
- **AI got wrong:** first draft mapped `--radius-control: var(--radius-control)` inside `@theme inline`, a
  self-reference; radii now live in a plain `@theme` block.
- **Not done:** dark mode (later issue); PR #57's new `/s` and `/listen` pages move onto the components after it merges.
