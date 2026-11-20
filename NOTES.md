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
