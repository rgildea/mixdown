#!/usr/bin/env bash
# Creates labels, weekly milestones and the initial backlog in GitHub Issues.
# Safe to re-run: labels are upserted, existing milestones/issues (by title) are skipped.
# Usage: REPO=owner/name scripts/bootstrap-github.sh
set -euo pipefail
REPO="${REPO:?set REPO=owner/name}"

# REST only (gh api), so it also works where GitHub GraphQL is unavailable.
label() { # name color description (upsert)
  gh api "repos/$REPO/labels" -f name="$1" -f color="$2" -f description="$3" >/dev/null 2>&1 ||
    gh api -X PATCH "repos/$REPO/labels/$(jq -rn --arg n "$1" '$n|@uri')" -f color="$2" -f description="$3" >/dev/null
}
label "type:feature" 1f6feb "New capability"
label "type:bug"     d73a4a "Something broken"
label "type:chore"   8b949e "Setup, infra, upgrades"
label "type:docs"    0e8a16 "Docs, ADRs, notes"
label "later"        fbca04 "Parked idea. Not this week."
label "needs-adr"    5319e7 "Architecture decision required first"
label "blocked"      b60205 "Waiting on something external"
label "epic"         0052cc "Week-level goal; split into issues at week start"

existing_ms=$(gh api "repos/$REPO/milestones?state=all&per_page=100" --jq '.[].title')
milestone() { # title due description
  grep -qxF "$1" <<<"$existing_ms" && return
  gh api "repos/$REPO/milestones" -f title="$1" -f due_on="$2T23:59:59Z" -f description="$3" >/dev/null
}
milestone "Week 1" 2026-11-29 "Foundation: a live site where I can log in, upload a mix, and play it"
milestone "Week 2" 2026-12-06 "Core loop: share link (no account), waveform, timestamped comments"
milestone "Week 3" 2026-12-13 "Real workflow: versions, resolve comments, email alerts"
milestone "Week 4" 2026-12-20 "First real client project runs through it"
milestone "Week 5" 2027-01-03 "AI feature: voice memos / notes to a timestamped task list"
milestone "Week 6" 2027-01-10 "Make it hireable: README, tests + CI, write-up"

existing_issues=$(gh api --paginate "repos/$REPO/issues?state=all&per_page=100" --jq '.[].title')
milestones_json=$(gh api "repos/$REPO/milestones?state=all&per_page=100")
issue() { # title labels(comma-separated) milestone-title body
  grep -qxF "$1" <<<"$existing_issues" && { echo "skip: $1"; return; }
  jq -n --arg t "$1" --arg l "$2" --arg m "$3" --arg b "$4" --argjson ms "$milestones_json" '
    {title: $t, body: $b, labels: ($l | split(","))}
    + (if $m == "" then {} else {milestone: ($ms[] | select(.title == $m) | .number)} end)' |
    gh api "repos/$REPO/issues" --input - --jq '"#\(.number) \(.title)"'
}

# ---------- Week 1 ----------
issue "W1 S1: Supabase, R2, Vercel deploy, env vars (Hello page live)" "type:chore" "Week 1" "$(cat <<'EOF'
## What
Repo + Next.js 16/Tailwind scaffold are done (`apps/web`). Remaining: create the Supabase
project and R2 bucket, connect Vercel, set env vars, and get the Hello page live.
Spec: `docs/specs/week-1-spec.md` §8. ADRs 0002, 0003, 0006.

## Steps
- [ ] Supabase: create project `mixdown-dev` (Free plan). `npx supabase login && npx supabase link --project-ref <ref>`
- [ ] Supabase → Auth → Sign In / Providers: **turn off "Allow new users to sign up"** (ADR 0004)
- [ ] Cloudflare: enable R2, create private bucket `mixdown-dev`, create an API token scoped to
      that bucket (Object Read & Write)
- [ ] `npx wrangler r2 bucket cors set mixdown-dev --file infra/r2-cors.json`. If wildcard
      origins aren't accepted, list the exact production/preview origins instead
- [ ] Vercel → Add New Project → import this repo → **Root Directory = `apps/web`**
- [ ] Vercel env vars (Production + Preview): all names in `apps/web/.env.example`
- [ ] Local: `cp apps/web/.env.example apps/web/.env.local` and fill in

## Out of scope
Login, tables, uploads.

## Done when
- [ ] "Hello" page is live at the Vercel URL
- [ ] A push to `main` triggers a production deploy; a PR gets a preview URL
EOF
)"

issue "Line up the Week 4 client project now" "type:chore" "Week 1" "$(cat <<'EOF'
## What
The real deadline is what keeps this moving. Pick one actual client project that will
need mix revisions around **Dec 14–20**, and tell the client you'll send mixes through a
new review link. Writing it down makes it real.

## Done when
- [ ] Client + project named in a comment on this issue (initials are fine for a public repo)
- [ ] Client has agreed to try it
EOF
)"

issue "Review old mixdown repos for lessons (1 h timebox)" "type:docs" "Week 1" "$(cat <<'EOF'
## What
Spend **one hour, max** skimming `mixdown-prototype`, `mixdown-gcp-prototype`,
`mixdown-database`, `mixdown-file-upload-post-processor`, `epic-mixdown-prototype` and
`mixdown-cloudflare`. Don't copy code.

## Done when
- [ ] `docs/lessons-from-earlier-attempts.md` with ≤10 bullets: what stalled me, what
      decisions were good (e.g. schema ideas), what to avoid
- [ ] Anything worth doing later → `later` issues
EOF
)"

issue "W1 S2: Magic-link login, logout, auth callback, protected routes" "type:feature" "Week 1" "$(cat <<'EOF'
## What
Spec §6 routes `/login` and `/auth/callback`; sign out; `src/proxy.ts` (Next 16's
middleware) refreshes the Supabase session and redirects signed-out visitors on `/songs/**` to
`/login`. Invite-only (ADR 0004).

## Notes for the AI tool
- Use `@supabase/ssr` helpers in `apps/web/src/lib/supabase/`. Read
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` first.
- `signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${NEXT_PUBLIC_SITE_URL}/auth/callback` } })`.
  Show the same "check your email" message whether or not the address is invited.
- Supabase → Auth → URL Configuration: add the Vercel URL + `/auth/callback` to redirect URLs.
- Invite yourself and one test account from Supabase → Auth → Users.
- In server code use `supabase.auth.getUser()` (verified), not `getSession()`.

## Out of scope
Signup UI, passwords, OAuth, client accounts, profile pages.

## Done when
- [ ] Sign in via emailed magic link and sign out work **on the live site**
- [ ] An uninvited email gets no account
- [ ] Signed-out visit to `/songs` redirects to `/login`
EOF
)"

issue "W1 S3: Migrations (workspaces, songs, RLS) + song list + create-song form" "type:feature" "Week 1" "$(cat <<'EOF'
## What
First migration with the schema from spec §5 (ADR 0004): `workspaces`, `workspace_members`,
`songs`, `mix_versions`, the `private.is_member()` helper, RLS policies, indexes, and the
`auth.users` trigger that creates a personal workspace. `/songs` lists my workspace's songs
newest first (title, client, date) with a "New song" button; `/songs/new` creates a song with
title + optional client name (Server Action). No file yet.

## Notes for the AI tool
- `npx supabase migration new init_schema`, then `npx supabase db push`.
- Existing invited users predate the trigger: backfill their workspaces in the migration.
- `security definer` functions: `set search_path = ''`, fully qualify names, `private` schema.
- Policies use `(select auth.uid())` for performance.
- Generate types: `npx supabase gen types typescript --linked > apps/web/src/lib/database.types.ts`.

## Out of scope
Edit/delete songs, pagination, search, inviting members, workspace switcher.

## Done when
- [ ] Songs I create show up in my list on the live site
- [ ] The second invited account has its own workspace and can't see them
EOF
)"

issue "W1 S4: R2 presigned upload with progress + mix_versions row" "type:feature" "Week 1" "$(cat <<'EOF'
## What
`src/lib/r2.ts` (`import "server-only"`, S3 client for R2). `/songs/new` gets a file picker:
client-side type/size check (≤ 500 MB), Server Action `createUploadUrl` returns a presigned PUT,
browser uploads via XHR with a progress bar, Server Action `finishUpload` HEADs the object and
inserts `mix_versions` v1, then redirect to `/songs/[id]`. Follow ADR 0003 and spec §7.

## Notes for the AI tool
- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, endpoint
  `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, region `auto`.
- Sign `ContentType` and `ContentLength` into the PUT. Key: `{workspace_id}/{song_id}/v1-{uuid}.{ext}`.
- Access check = select the song through the user's Supabase client (RLS); no row → 404.
- `MAX_UPLOAD_BYTES` and allowed MIME types in one shared module used by client and server.
- Upload failure: show error + "Try again".

## Out of scope
Multipart/resumable uploads, multiple versions, waveform, drag-and-drop, AIFF/FLAC.

## Done when
- [ ] A 100–300 MB WAV uploads on the live site with a smoothly moving progress bar
- [ ] 600 MB file and .txt/.aiff get a clear error before upload
- [ ] R2 secrets don't appear in the client bundle (`grep` the `.next/static` output)
EOF
)"

issue "W1 S5: Song page playback (presigned URL), error states, README, DoD run-through" "type:feature" "Week 1" "$(cat <<'EOF'
## What
`/songs/[id]`: title, client, filename + size, `<audio controls>` using a 1-hour presigned R2
GET URL created on each request after an RLS-checked read. "No mix uploaded" when there's no version. Not-found for other
users' songs. Update README. Run the full checklist in spec §2 and §9 on the live URL.

## Done when
- [ ] Every box in spec §2 is checked on the live URL
- [ ] Spec §9 manual tests pass (paste results as a comment)
EOF
)"

issue "Week 1 check-in" "type:docs" "Week 1" "$(cat <<'EOF'
Answer in `NOTES.md` (spec §13):
- [ ] What shipped? (live URL)
- [ ] What did I cut / move to Later?
- [ ] What slowed me down?
- [ ] Week 2's single goal. Split the Week 2 epic into session issues.
EOF
)"

# ---------- Weeks 2–6 (epics; split at the start of each week, not before) ----------
issue "Week 2 epic: Client share link + waveform + timestamped comments" "epic" "Week 2" "$(cat <<'EOF'
The core loop: I send a client a link, they listen and comment at exact moments, I see the comments.
- [ ] 15-min spike: anonymous sign-ins work with signups disabled (ADR 0005)
- [ ] Share link per song: `share_links`, `song_access`, `redeem_share_link()`, `can_access_song()` (ADR 0005)
- [ ] wavesurfer.js waveform with precomputed peaks
- [ ] Click the waveform to leave a comment at that timestamp; markers on the waveform
- [ ] I see comments on my song page (Realtime if cheap, refresh otherwise)
EOF
)"
issue "Week 3 epic: Versions, resolve comments, email alerts" "epic" "Week 3" "$(cat <<'EOF'
- [ ] Upload v2, v3… per song; client link shows the latest, can switch versions
- [ ] Side-by-side / A-B version compare (simple switcher with synced position is enough)
- [ ] Mark comments resolved
- [ ] Email me when a client comments; client approves a version
EOF
)"
issue "Production environment + paid plans before first client" "type:chore" "Week 4" "$(cat <<'EOF'
Before real client data (ADR 0002, 0006):
- [ ] Vercel Pro (Hobby is non-commercial)
- [ ] Supabase: create `mixdown-prod` (Pro, so it doesn't pause), `db push` all migrations, disable signups, invite myself
- [ ] R2: create `mixdown-prod` bucket + token + CORS
- [ ] Vercel *Production* env vars → prod; Preview/Development stay on dev
- [ ] Smoke test the full loop on production
EOF
)"
issue "Week 4 epic: Run one real client project through it" "epic" "Week 4" "$(cat <<'EOF'
- [ ] Real client reviews real mixes through the link
- [ ] Fix only what hurts; everything else → `later`
- [ ] Write down client feedback in NOTES.md
EOF
)"
issue "Week 5 epic: AI revision notes" "epic,needs-adr" "Week 5" "$(cat <<'EOF'
Client voice memos or messy notes ("make the vocal pop more in the chorus") become a clean,
timestamped task list per song using an LLM. ADR first: model/provider, transcription, cost, privacy.
EOF
)"
issue "Week 6 epic: Make it hireable" "epic" "Week 6" "$(cat <<'EOF'
- [ ] README with architecture diagram + ADR summary
- [ ] Automated tests (RLS tests against local Supabase, a Playwright happy path) + GitHub Actions CI
- [ ] Short write-up (from NOTES.md): how I worked with AI tools
- [ ] Links on resume / LinkedIn
EOF
)"

# ---------- Later list ----------
for t in \
  "Payments and invoicing" \
  "Custom domain and branding" \
  "Dark mode" \
  "Mobile app" \
  "Invite workspace members, roles UI, workspace switcher" \
  "Project/album share links (one link for an EP)" \
  "Resumable multipart uploads to R2" \
  "Compressed streaming copy (AAC/MP3) for faster client playback" \
  "Captcha / rate limit on anonymous sign-in before public launch" \
  "AIFF / FLAC support" \
  "Edit and delete songs" \
  "Clean up orphaned R2 objects from unfinished uploads" \
  "Mastering presets / reference track compare" \
  "Visual design polish"; do
  issue "Later: $t" "later" "" "Parked from the plan. Triage at a weekly check-in."
done
echo "Done: https://github.com/$REPO/issues"
