---
name: merge-stack
description: (Experimental) Merge the autopilot's PRs one at a time, critical calls first, each on the user's confirmation. Only when the user runs /merge-stack or /playbook:merge-stack.
disable-model-invocation: true
---

Merge session for the autopilot's PRs. Read `.claude/profile.json`.
Every `gh` call goes through `playbook-gh`
(never echo the token, never `-v`, `--debug`, `GH_DEBUG` or `set -x`).

1. `playbook-autopilot status`. If a task is in progress, stop: merging
   under a running task breaks its base. The unmerged PRs are the finished
   tasks with status `ok` or `critical` that aren't merged. Order: those
   based on `main` first, critical before ok; then the ones stacked on
   them. Stacks are one level deep.
2. For each, show:
   - the PR URL and status, and whether it is security-sensitive;
   - its judgment calls: `playbook-autopilot events <id>` (critical first)
     and the PR's `## Judgment calls` section;
   - `playbook-gh run list --branch <branch> --limit 5`. If the newest run
     is not `completed success`, say so and skip it and everything stacked
     on it;
   - for a critical or security-sensitive PR, the full diff
     (`git diff origin/<base>...origin/<branch>`); otherwise `--stat`.

   Then ask me: merge, skip, or stop. Never merge on my behalf without the
   answer.
3. From the primary checkout's root. To merge:
   `git -C .claude/worktrees/autopilot switch --detach` (so the branch isn't
   checked out there), print `git rev-parse origin/<branch>` and keep that
   SHA (shell variables don't survive between commands), then
   `playbook-gh pr merge <url> --squash --delete-branch`. For each PR stacked
   on it, in `.claude/worktrees/autopilot/`:
   `git fetch origin && git switch <child> && git rebase --onto origin/main <SHA>`,
   then `git push --force-with-lease origin <child>`,
   `playbook-gh pr edit <child> --base main` and
   `playbook-autopilot rebased <child-id> main`. If the rebase conflicts:
   `git rebase --abort`, tell me, skip that child. Then
   `git switch --detach` again. A rebased child needs its new CI run before
   it is offered.
4. End: `git fetch --prune`, delete the local branches of merged PRs
   (`git branch -D`, after checking their commit is on `main`), show
   `playbook-autopilot status`, and suggest `/autopilot-plan` if fewer than
   two tasks are queued.
