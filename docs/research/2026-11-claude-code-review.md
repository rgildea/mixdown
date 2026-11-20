# Research: making the automated Claude PR review trustworthy (2026-11-20)

**Question.** The `code-review` plugin run by `.github/workflows/claude-code-review.yml` said "No issues
found" on PRs #37 and #52, where independent reviews found real medium issues, and it seemed to
review each PR only once. Why, and what should replace it?

**Short answer.** The plugin does what it was designed to do. It reviews each PR once, keeps only
high-certainty bugs in the changed lines, and explicitly drops "general security issues" and missing
tests. That is the opposite of what this project needs. Our runs also didn't follow the plugin's
multi-agent recipe (no Opus was ever used). Replaced by a project-specific prompt
(`.github/review-prompt.md`) run on every push, with strict read-only tools, returning structured
output that a separate job posts as one comment edited in place.

Status labels: **Confirmed** = read in source/docs/logs. **Inferred** = consistent with evidence, not
directly observed. **Refuted** = the evidence contradicts it.

## Sources

| Source | Version read |
|---|---|
| `anthropics/claude-plugins-official` `plugins/code-review/commands/code-review.md`, `README.md` | `d586c3f` (plugin 1.0.1, command updated 2026-10-26 in `c905cd8`) |
| `anthropics/claude-code` `.claude-plugin/marketplace.json` (the marketplace our workflow adds) | `e791a1c` |
| `anthropics/claude-code-action` `action.yml`, `docs/`, `src/` | `acfe799` (what `@v1` resolved to today) |
| Claude Code docs: memory, sub-agents, CLI reference (code.claude.com/docs/en/…) | fetched 2026-11-20 |
| Review run logs 44671515283 (#36 canary), 44821443268 and 44827118520 (#52); PR comments on #36, #37, #52 | |

## 1. What the `code-review` plugin actually does

The marketplace we add (`https://github.com/anthropics/claude-code.git`) only points elsewhere:
`code-review` is a `git-subdir` of `anthropics/claude-plugins-official`, `ref: main`, so it isn't
pinned and can change under us between runs (marketplace.json, `code-review` entry). **Confirmed.**

The command (`commands/code-review.md`):

- **Skip rules (L15–21).** A Haiku agent stops the review if the PR is closed, a draft, "does not need
  code review (e.g. automated PR, trivial change that is obviously correct)", or **"Claude has already
  commented on this PR (check `gh pr view <PR> --comments`)"**. So a PR is reviewed once; new pushes
  are skipped while any Claude comment exists. *Hypothesis 3 (skips already-reviewed PRs):
  **confirmed** in source.* The "trivial" rule is a model judgement, so it can also skip a real PR.
- **CLAUDE.md (L25–27, L33–34).** A Haiku agent lists paths of the root `CLAUDE.md` and those in
  directories of changed files; two Sonnet agents check compliance, and only for CLAUDE.md files on
  the changed file's path.
- **Reviewers (L31–40).** 4 parallel agents: 2 Sonnet (CLAUDE.md), 2 Opus (bugs). Bug agent 3:
  "Focus only on the diff itself without reading extra context … Do not flag issues that you cannot
  validate without looking at context outside of the git diff." Agent 4: "Only look for issues that
  fall within the changed code."
- **Filter (L42–52, L80–87).** Flag only code that won't compile, logic that is wrong "regardless of
  inputs", or CLAUDE.md violations you can quote. Do NOT flag "Potential issues that depend on
  specific inputs or state"; "If you are not certain an issue is real, do not flag it"; and in the
  false-positive list: **"General code quality concerns (e.g., lack of test coverage, general
  security issues) unless explicitly required in CLAUDE.md"** and "Pre-existing issues".
- **Validation (L56–58).** Each bug is re-checked by an Opus subagent, each CLAUDE.md issue by a
  Sonnet one; unvalidated issues are dropped.
- **Scoring.** The README (L23–24, L52, L214–218) still describes 0–100 scores with a threshold of
  80. The current command has **no numeric score**: it uses binary validate-or-drop. The 80
  threshold was in the previous version (`git show c905cd8^`, L20–26). *Hypothesis 5 (tuned for
  precision): **confirmed**, though via "validated or dropped", not a score.* There is no flag or
  setting to change the threshold or the skip rule; the only "configuration" is editing the command
  file (README L214–218), i.e. forking it.
- **"No issues found" (L60–66, L94–100)** means "nothing survived the high-signal filter and
  validation". It is printed and posted whether the review was thorough or not, and it doesn't say
  what was checked.

Why #37 and #52 were missed: the #37 finding (an engineer page relying on RLS alone would show another
studio's song once share-link grants exist) depends on state and on context outside the diff, and is
a "general security issue". Three separate rules exclude it. The #52 un-revoke was only reachable via
the raw API (context outside the diff), and the missing tests are excluded as "lack of test coverage".
**Inferred** (consistent with the rules; transcripts are hidden).

### What our runs actually did

The runs' `modelUsage` lists each model the session used. Subagent usage counts toward the session's
totals (CLI reference, `--max-budget-usd`: "Spend from subagents counts toward the cap"), so an Opus
subagent would appear as an Opus entry.

| Run | PR | Turns | Cost | Models used | Posted |
|---|---|---|---|---|---|
| 44671515283 | #36 canary | 6 | $0.082 | Sonnet only | 2 correct inline comments |
| 44821443268 | #52 (opened) | 3 | $0.060 | Sonnet + Haiku | nothing |
| 44827118520 | #52 (push) | 5 | $0.087 | Sonnet only | "No issues found" |

- **No run used Opus**, so the two Opus bug agents and the Opus validators in L36–40 and L56 never ran.
  Five or six turns is also too few for 1 + 1 + 1 + 4 agents plus validation. The main Sonnet session
  most likely did a short single-pass review itself. **Inferred** from `modelUsage`; the cause (the model
  skipping the subagent steps, or the subagent tool not being usable in this setup) is unknown
  without the transcript.
- The first #52 run used Haiku (consistent with the eligibility agent) and posted nothing, on a PR
  with no earlier Claude comment. Why it stopped is **not verifiable** (perhaps the "trivial"
  judgement, or a failure). The next push did post. Nondeterministic skips are a second trust problem.
- Turn count and cost don't tell you whether a review happened (the canary run, which found both
  bugs, had about the same stats as the #52 "No issues" run). **Confirmed** by the table.
- Default model: `claude-sonnet-5-5` (`"model"` in the init message of all three logs). **Confirmed.**

## 2. `claude-code-action@v1` options that matter

From `action.yml` (inputs) and `docs/`:

- `prompt`: the instructions. With a prompt on a `pull_request` event the action runs in **agent
  mode** (log: "Auto-detected mode: agent"); it posts nothing by itself.
- `claude_args`: CLI flags. In v1, `model`, `max_turns`, `allowed_tools` and `disallowed_tools` are no
  longer inputs; they are `--model`, `--max-turns`, `--allowedTools`, `--disallowedTools`
  (docs/migration-guide.md L23–26, configuration.md L370–373). Also useful: `--effort`,
  `--max-budget-usd`, `--json-schema`, `--permission-mode` (CLI reference).
- **Permission mode (important).** The action starts Claude in **auto mode** by default
  (`src/modes/agent/index.ts` L147; docs/usage.md L117–135): "a safety review decides any other tool
  call that your allow rules don't cover … Opt out if your workflow relies on `--allowedTools` as a
  strict list". So **our old "read-only" `--allowedTools` list wasn't strict.** A command outside it
  could run if the classifier allowed it. Fix: `--permission-mode default`, which "den[ies] what no
  rule covers" in a workflow. **Confirmed** in source and docs; verified locally with Claude Code
  2.1.330 using the exact new flags (an allowed `git log` ran; a `touch` was denied and no file was
  created; the structured output came back).
- `track_progress` (L144–147) forces **tag mode** with a progress comment. `use_sticky_comment`
  (L120–123) reuses one Claude comment across runs, but **only in tag mode**
  (`src/github/operations/comments/create-initial.ts` L31–57, called only from `src/modes/tag/index.ts`).
  Tag mode also gives Claude the action's `git add/commit/push` wrappers and workspace edits
  (`src/modes/tag/index.ts` L178, `tagModeTools`), and the sticky lookup takes the first comment by any bot whose
  login contains "claude". Usable, but it conflicts with "read-only".
- `show_full_output` (L164–167, default false): prints the whole transcript, "publicly visible in
  GitHub Actions". `display_report` (L160–163, default false) puts Claude-authored text in the step
  summary. Keep both off on this public repo.
- **Private transcript?** There is no documented private option. The transcript is written to
  `$RUNNER_TEMP/claude-execution-output.json` (output `execution_file`;
  `base-action/src/execution-file.ts`). Artifacts of a public repo can be downloaded by any
  signed-in GitHub user, so uploading it is not private. The only private routes are encrypting it
  before upload (e.g. `age` with a public key in the repo) or running the job in a private mirror.
  Not done here; the new comment's "What was checked / Not verified" section takes over the main job
  the transcript would have done.
- Note: the action logs the prompt text ("Context prompt: …"). Our prompt has only public content
  (the instructions file and the previous public review comment).
- `--json-schema` → `structured_output` output (docs/usage.md L239–290). The review comes back as data,
  and a later step can post it with no write tools given to the model.
- **Workflow-file check.** The OIDC exchange for the Claude App token fails with "workflow validation
  failed" when the workflow differs from the default branch's, and the action exits quietly
  (`src/github/token.ts` L24–55, `src/entrypoints/run.ts` L224–227). So a PR that edits this workflow
  can't be reviewed by its own new version. **Confirmed** in source.
- Config from the base branch: on PRs the action restores `CLAUDE.md`, `AGENTS.md`, `.claude/` etc. from
  the base branch before Claude starts (docs/security.md L60; log: "Restoring … CLAUDE.md … AGENTS.md
  … from origin/main"). A PR can't weaken the rules it's reviewed against, but it also isn't reviewed
  against rules it adds. `--append-system-prompt-file` is restored from the base only for authors
  without write access, so the new workflow reads `review-prompt.md` from the base itself (`git show
  origin/<base>:…`).

## 3. Is `CLAUDE.md` (with `@` imports) read?

- The session loads project memory (log: `settingSources: ["user","project","local"]`), and `@path`
  imports are expanded: "Imported files are expanded and loaded into context alongside the CLAUDE.md
  that references them … maximum depth of four hops" (memory docs, "Import additional files"). So
  `AGENTS.md`, `PROJECT.md` and `apps/web/AGENTS.md` are in the main session's context. **Confirmed (docs).**
- Subagents other than Explore/Plan load the same CLAUDE.md hierarchy (sub-agents docs, "What loads at
  startup"). **Confirmed (docs).**
- But the plugin's own CLAUDE.md step hands file paths to agents that may `Read` them; a raw `Read` of
  our `CLAUDE.md` shows only three `@` lines. Whether its compliance agents used the loaded context or
  the raw file, and whether rules like "Server Actions are public endpoints" count as "CLAUDE.md
  rules" for its filter, can't be told from the logs. **Unverified.** Moot after this change: the new
  prompt names the files directly.

## 4. Options considered

| Option | Quality | Noise | Cost | Maintenance |
|---|---|---|---|---|
| (a) Keep the plugin, configure it | No knobs for the threshold or skip rule; forking means owning a 110-line prompt that changes upstream | Low | Low (~$0.08/PR) | Fork drifts |
| (b) Custom prompt via the action (**chosen**) | Encodes this project's risks (public Server Actions, RLS/security definer, raw API, presigned scoping, vacuous tests, Next 16, AGENTS.md rules); reports medium findings; can read context outside the diff | One comment, edited in place | Higher (see below) | One short Markdown file; rules stay in AGENTS.md |
| (c) Model/effort | Opus 5.5 at `high` effort; the old runs were all Sonnet | n/a | ~$0.30 floor per run (measured), likely $1–3 on a real PR | none |
| (d) Every push, one comment | Sees fixes and regressions; marks old findings fixed/still open | One comment | ×pushes; `cancel-in-progress` drops superseded runs; drafts skipped | small |
| (e1) Tag mode + `use_sticky_comment` | same as (b) | One comment | same | Gives the model git write wrappers; would need extra deny rules |
| (e2) Inline comments per finding | Nice in the diff view | Duplicates on every push unless de-duplicated | same | Needs de-duplication logic; skipped |
| (e3) Add Claude's `/security-review`-style pass or a second job | Possibly more recall | More comments | ×2 | Later, if canaries show misses |

**Recommendation: (b) + (c) + (d)**, implemented as:

1. `review` job (read-only GitHub permissions): builds the prompt from the base branch's
   `.github/review-prompt.md`, PR context and our previous review comment; runs Opus 5.5
   (`--effort high`) with `--permission-mode default`, read-only `--allowedTools`, write/network/subagent
   tools removed, `--max-turns 60`, `--max-budget-usd 4`, and `--json-schema` for the result
   (severity, confidence, file/line, detail, fix, new vs still open, resolved, checked, not checked).
2. `post` job (only `pull-requests: write`, no checkout, no model): renders the result and creates or
   edits one comment marked `<!-- mixdown-claude-review -->`. If the review failed or hit a limit it
   says **"Review did not complete"**, never "no findings". It redacts token-shaped strings as a backstop.
3. Concurrency group per PR with `cancel-in-progress`; drafts and fork PRs skipped.

Trade-offs: more findings means some false positives; the `confidence` field and the severity
scheme are there so they can be triaged. Cost goes up from about $0.08 per PR to about $1–3 per push
(estimate). Lower it by switching `--model` to Sonnet or `--effort` to `medium`, or by adding a
`paths-ignore` for docs-only PRs. Validate with a canary PR after merge (plan in the PR description).

Not verified: the real per-push cost and recall on a real PR (needs the canary); whether Opus at `high`
stays within 60 turns / $4 on a large PR like #52.
