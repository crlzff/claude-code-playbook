---
name: done
description: Merge the task's PR once CI is green, then back to main and clean up branches. Only when the user runs /done or /playbook:done.
disable-model-invocation: true
---

Merge the current branch's PR and clean up. Read `.claude/profile.json`
first ("profile").

If profile `git.merge` is `human`, skip step 2's merge: tell me the PR is
ready for me on GitHub once CI is green, wait until I say it is merged,
then go on from step 3.

1. Note the current branch name.
2. If its PR is still open: show me
   `playbook-gh run list --branch <branch> --limit 5` and stop if the newest
   run is not `completed success`. Use that, not `gh pr checks`: with
   `git.protection: pre-push` nothing on GitHub blocks a red merge, so this
   is the only gate. Then ask me to confirm, and
   `playbook-gh pr merge --squash --delete-branch`. If it is already
   merged, go on.
3. `git checkout main && git pull --prune`. Inside a worktree that fails:
   finish here, then run this step from the primary checkout.
4. Delete the local branch with `git branch -D <branch>` (squash merges
   aren't detected by `-d`), but first confirm with
   `git log main --oneline -5` that this task's commit is on `main`. If
   it isn't, stop and tell me.
5. Show `git status` and the next unchecked ROADMAP task with its Env line.

Token rules as in `/ship`: never echo it, never `-v`, `--debug`,
`GH_DEBUG` or `set -x` with `playbook-gh`.
