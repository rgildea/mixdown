# Lessons from earlier attempts (2024–2026)

Reviewed together (Ryan + Claude) on 2026-11-20, issue #3. Six repos, four hosting platforms (Fly,
Cloudflare, GCP, Vercel), about 2.5 years. **None reached the core loop** (share link → client
comments at timestamps → engineer sees them). Every restart rebuilt auth, uploads and deploys first.

## What stalled me
1. **Polish, infrastructure and minor bugs before the core loop** (Ryan's own diagnosis). In
   `mixdown-cloudflare`, the furthest attempt: full account management (2FA, password reset, avatars,
   connections), Sentry, marketing pages, many visual-tweak commits. No sharing or comment code ever existed.
2. **Platform hopping.** Each new platform restarted the same plumbing. The GCP attempt spent **31 of 42
   commits on Cloud Build and deploy fixes**; the 2026 Cloudflare commits were all framework and tooling upgrades.
3. **A learning goal competing with the shipping goal.** I wanted to learn Cloudflare's Workers and Queues and
   build a reactive, decentralized, less monolithic app. So the schema became a versioned npm package
   shared across repos (81 commits, mostly release and packaging fixes), and an upload "post-processor"
   queue worker was built that only logged events. Both solved problems a monorepo doesn't have, and the
   architecture goal crowded out the product. **Lesson:** keep learning experiments separate from the
   product, or make them the product deliberately. Don't let them in by default.
4. **Starting from big templates** (Remix Indie Stack, Epic Stack) meant owning lots of code that wasn't the
   product, and much of the early history is template maintenance.

## What to avoid (now encoded in ADRs and AGENTS.md)
5. **Security by unguessable URLs.** The old `/storage/*` route had no auth for GET *or* DELETE: anyone who
   saw a file key could download it forever (`Cache-Control: public, 1 year`) or delete the track.
   Now: private bucket, short-lived signed URLs, RLS checks before signing (ADR 0003/0004).
6. **Streaming audio through the app server**, which also broke seeking (Range ignored, always 200).
   Now: browser ↔ R2 directly; range requests tested.

## Worth keeping (ideas, not code)
7. **An "active version" pointer per track**, for Week 3 approval and current version. But number versions
   per song (1, 2, 3…), not with a global auto-increment as the old schema did.
8. **Store each mix's `duration`**, for validating comment timestamps and for the waveform (Week 2, #45).
   Don't store URLs in the database; derive them.
9. The wavesurfer setup (drag to seek, hover cursor), and "projects" grouping tracks (Later #20).

## The rule that matters
**Finish the loop before polishing it.** Week 1 of this attempt took about 10 hours to reach what took
the Cloudflare attempt months, because the plan cut everything that wasn't the loop.
