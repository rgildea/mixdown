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
