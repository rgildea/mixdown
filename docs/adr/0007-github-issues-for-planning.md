# 0007. GitHub Issues + milestones for planning; Later list as a label

- Status: Accepted
- Date: 2026-11-19

## Context
The previous attempt stalled in details. Planning has to be cheap, visible, and next to the code.

## Decision
- One **milestone per week** with a due date (see `docs/plan.md`).
- One **issue per session-sized task** with *What / Out of scope / Done when*. The issue
  body *is* the spec handed to the AI tool.
- **Later list = issues labelled `later`, no milestone.** Capture with one command; triage weekly.
- PRs close issues (`Closes #N`). `scripts/bootstrap-github.sh` creates labels, milestones and
  the initial backlog.

## Consequences
- No separate task tool. The issue tracker doubles as evidence of process for reviewers.
- Must keep issues small. Anything over ~3 h gets split.
