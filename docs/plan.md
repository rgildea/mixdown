# Plan

## Version 1 (the only thing that matters until it works)
One complete loop: **I send a client a link → they listen and leave comments at exact
timestamps → I see those comments.** Everything else waits.

## Ground rules
1. **Use ready-made services.** Supabase for auth/DB, Cloudflare R2 for audio, wavesurfer.js
   for waveforms, Vercel for hosting. Our code only does what's unique to this app.
2. **Keep a Later list.** Every idea becomes a GitHub issue labelled `later`, not code.
3. **Small decisions fast.** If a choice takes >30 min, take the common default, write
   one line on why, move on.
4. **Live in week 1, ship every week.** Every push to `main` deploys.
5. **Real deadline, real user.** One actual client project runs through it by week 4.
6. **Fresh start.** The old `mixdown-*` repos get one hour of review for lessons
   (tracked as an issue), then are left alone.
7. **If a week slips, cut scope, not the timeline.** If a session runs >1 h over, stop and cut.

## Six weeks (~8–10 h/week)
| Week | Milestone due | Goal | Done when |
|---|---|---|---|
| 1 | Sun Nov 29 | Foundation | A live site where I can log in, upload a mix, and play it |
| 2 | Sun Dec 6 | Core loop | Shareable client link (no account), waveform, timestamped comments |
| 3 | Sun Dec 13 | Real workflow | Multiple versions per song, resolve comments, email alerts |
| 4 | Sun Dec 20 | First real client | Prod environment + paid plans first; one real project runs through it. Fix only what hurts |
| 5 | Sun Jan 3 | AI feature | Client voice memos/notes → timestamped task list |
| 6 | Sun Jan 10 | Make it hireable | README w/ architecture, tests + CI, write-up, resume/LinkedIn links |

Week 1 gets a few extra days because it starts mid-week (Thu Nov 19). Thanksgiving falls in
Week 1 and the holidays fall around Weeks 4–5, so week 5 is pushed back a week.
If you know in advance a week will be lost, move the date now, not later.

## How work is tracked
- **Milestones** = weeks. **Issues** = one session-sized task (≈1–3 h) with a
  "Done when" checklist. Issue template: *What / Out of scope / Done when*.
- **Labels:** `type:feature`, `type:bug`, `type:chore`, `type:docs`, `later`, `needs-adr`, `blocked`.
- **Later list:** [`label:later`](../../../issues?q=is%3Aopen+label%3Alater), with no milestone.
  Triage at the Sunday check-in: pull at most one into the next week, close the rest freely.
- Branch per issue (`w1/2-magic-link-auth`), PR body says `Closes #N`, Vercel preview per PR.

## Weekly check-in (Sunday, 15 min, appended to NOTES.md)
1. What did I ship? (link)
2. What's next week's one goal?
3. What am I cutting?
