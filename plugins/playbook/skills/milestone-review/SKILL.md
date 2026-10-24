---
name: milestone-review
description: End-of-milestone review - security pass, docs drift, consolidation and branch cleanup. Only when the user runs /milestone-review or /playbook:milestone-review.
argument-hint: <milestone, e.g. M0>
disable-model-invocation: true
---

Milestone $ARGUMENTS is finished. Read `.claude/profile.json` first
("profile"). Work on a `docs/` branch.

1. **Drift.** Compare the SPEC, the ROADMAP and `docs.specDir` with what the
   code does now. List every drift and fix the docs: the code is the truth
   for what exists.
2. **Completeness.** Every task of $ARGUMENTS is checked or explicitly
   cancelled.
3. **Security pass** over everything merged since the last milestone
   review, for what per-PR reviews can't see: how the pieces fit together.
   The range runs from the commit that merged the previous milestone review
   (its log entry names the PR; the root commit if there is none) to
   `origin/main`, so each commit is reviewed once. `/security-review`
   only reviews the current branch, so do this by hand with its checklist:
   `git diff --stat <start>..origin/main` for the files, then the
   non-test code area by area. Look hardest at what crosses a boundary:
   every `security.sensitive` area, what reaches the client, headers and
   CSP against new routes, cookies, rate limits, input validation, and (if
   the autopilot ran) its critical calls in that range
   (`playbook-autopilot events | grep ' critical '`). Record the findings;
   don't fix them on this branch. The log entry lists each one, and each
   becomes its own task after this PR ships (security ones interactive).
4. **Branches.** List local branches other than `main`, and remote
   branches without an open PR; propose which to delete, delete them after
   I confirm. Never the autopilot's state branch.
5. **Consolidate**, so the next milestone doesn't carry this one's weight:
   move the milestone's log entries to `docs.archive` + `log-<m>.md` and
   leave a summary (versions, decisions, carried-forward items, lessons);
   collapse its finished ROADMAP tasks to one line each (id, PR, decisions);
   fold amended decisions into their current rows; move anything the log
   holds that is still a rule into the doc that owns it. Nothing the summary
   drops may be referenced from outside the archive. Skip this step when
   `docs.depth` is `minimal`.
6. **Lessons.** Rules this milestone taught (a reviewer finding that came
   back, a gotcha that cost time): propose each as a CLAUDE.md landmine, a
   lint rule or a test, preferring the lint rule or test. Also propose any
   that belong in the playbook itself, for every project: list those for
   me, don't edit the plugin.
7. Add a "Milestone review $ARGUMENTS" log entry.
8. Then follow `/ship`.
