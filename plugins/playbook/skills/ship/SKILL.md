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
     also run `/security-review` and treat its findings as blocking. Its
     report is input, not the end of `ship`.

   Fix every blocking finding, and every non-blocking one that two lenses
   agree on or that costs a few lines.
   Skip a finding, whatever the rule, if fixing it would leave the task's
   scope, contradict CLAUDE.md or the task, or need a decision that is mine
   (design, a dependency, CI); list those with the reason. Commit fixes with
   one-line messages, then review again (a new reviewer run, not a message
   to the last one; wait for its verdict) until nothing blocking is left.
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
6. **Open the PR yourself**, no browser, through GitHub's REST API (a
   cloud session's GitHub proxy refuses the GraphQL `gh pr create` uses):
   `playbook-gh api repos/{owner}/{repo}/pulls -f head=<branch> -f base=<base> -f title="<title>" -f body="<description>" --jq .html_url`
   prints the PR URL (`<base>` is `main` unless the autopilot says
   otherwise). If GitHub answers 422 because the PR already exists:
   `playbook-gh api "repos/{owner}/{repo}/pulls?head={owner}:<branch>" --jq '.[0].html_url'`.
   `playbook-gh` borrows the repo-scoped token for that one command; in a
   cloud session the proxy attaches its own credential instead.
   **Never** read, echo or store the token, and never add `-v`, `--debug`,
   `GH_DEBUG` or `set -x` to a command that carries it: they print the
   `Authorization` header into the transcript, which persists.
   Show me the PR URL, title and description. On a 403, the PAT lacks
   **Pull requests: Read and write** (in a cloud session: the GitHub
   connection can't reach the repository): say so and print
   `https://github.com/<owner>/<repo>/compare/<branch>?expand=1` instead.
   If the credential read fails locally (on macOS `-128`, "could not read
   Username"), the credential store is locked: ask me to unlock it in my
   own terminal (macOS: `security unlock-keychain`), then retry. Don't
   retry in a loop.
