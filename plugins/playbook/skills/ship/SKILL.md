---
name: ship
description: Review, verify and push the current task branch, then open its PR. Only when the user runs /ship or /playbook:ship.
disable-model-invocation: true
---

Ship the current branch. Read `.claude/profile.json` first ("profile").

1. **Review.** Run the `playbook:reviewer` subagent on the branch against
   its ROADMAP task:
   - profile `review.lenses` 1: one reviewer, lens `all`.
   - `review.lenses` 3: three reviewers in parallel, lenses `scope-tests`,
     `landmines-security`, `docs`. Merge their findings, dropping
     duplicates. A finding two lenses both raise counts as agreed.
   - If the diff touches a security task or a `security.sensitive` path:
     also run `/security-review` and treat its findings as blocking.

   Fix every blocking finding, and every non-blocking one that two lenses
   agree on or that costs a few lines.
   Skip a finding, whatever the rule, if fixing it would leave the task's
   scope, contradict CLAUDE.md or the task, or need a decision that is mine
   (design, a dependency, CI); list those with the reason. Commit fixes with
   one-line messages, then review again until nothing blocking is left.
   Stop and ask after three rounds, or as soon as one of your
   fixes causes a regression for the third time: the mechanism is wrong,
   say so instead of patching again. Show what you fixed and skipped.
2. **Verify.** Run every command in profile `gate` (from `verify`), show the
   output. Stop if anything fails.
3. **Bookkeeping.** The task is checked off in the ROADMAP, has a log entry
   (about `docs.logEntryLines` lines: what, deviations, learnings), and
   every doc the change made wrong is updated (SPEC, `docs.specDir`,
   CLAUDE.md, decisions). Fix and commit if not.
4. `git push -u origin <branch>`.
5. Compose:
   - **Title**: one line, conventional commit, with the task id, at most
     72 characters: `feat: list sharing (T4.6)`.
   - **Description**: task id; 2–5 bullets on what changed; the red test
     output from the `test:` commit (re-run that commit's test on its parent
     if needed), or "scaffold/spike/fixture: no red test", or "tdd: <mode>".
     For an autopilot task, `## Judgment calls` first (see its policy). No
     attribution footer.
6. **Open the PR yourself**, no browser:
   `playbook-gh pr create --base <base> --title "<title>" --body "<description>"`
   (`<base>` is `main` unless the autopilot says otherwise).
   `playbook-gh` borrows the repo-scoped token for that one command.
   **Never** read, echo or store the token, and never add `-v`, `--debug`,
   `GH_DEBUG` or `set -x` to a command that carries it: they print the
   `Authorization` header into the transcript, which persists.
   Show me the PR URL, title and description. On a 403, the PAT lacks
   **Pull requests: Read and write**: say so and print
   `https://github.com/<owner>/<repo>/compare/<branch>?expand=1` instead.
   If the credential read fails (on macOS `-128`, "could not read
   Username"), the credential store is locked: ask me to unlock it in my
   own terminal (macOS: `security unlock-keychain`), then retry. Don't
   retry in a loop.
