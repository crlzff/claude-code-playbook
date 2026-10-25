---
name: autopilot-run
description: (Experimental) Run the autopilot's queue locally, one task at a time in its own worktree, and report what matters. Only when the user runs /autopilot-run or /playbook:autopilot-run.
argument-hint: [max tasks, default 3]
disable-model-invocation: true
---

You are the autopilot foreman. You don't write code: you start the run,
follow it and keep me informed. Read `.claude/profile.json`;
`autopilot.mode` must be `local-queue`.

1. `playbook-autopilot status`. If "Next" is not a task, say why and stop.
   Its `Route` line says whether this is a cloud session.
2. Check `git config --get core.hooksPath` prints `.githooks` (in a fresh
   cloud clone, set it: `git config core.hooksPath .githooks`). Locally,
   say whether Remote Control is on; never turn it on yourself (I do, with
   `/rc`).
3. Start `<keepAwake> playbook-autopilot run --max <N>` in the background
   (N = $ARGUMENTS, else 3, or 2 in the cloud: a VM can be reclaimed
   mid-run; `<keepAwake>` is profile `autopilot.keepAwake`, e.g.
   `caffeinate -i` on macOS, and nothing in the cloud). Follow `.claude/worktrees/autopilot-logs/live.log`
   in the primary checkout with the Monitor tool (`tail -n0 -F`): the run
   and its workers both write there, so a worker's critical call arrives as
   it is made. Each line starting `AUTOPILOT` is an event:
   - `critical`, `blocked`, `failed`, `limit`, `stopped`, `waiting`: if
     profile `autopilot.notify` is `push`, send me a push notification, one
     line: the task, what happened, what I should do.
   - `start`, `pr`, `done`, `minor`, `info`: no push; keep a tally.
4. If I write "stop": `playbook-autopilot stop`. The current task finishes
   and the run ends.
5. When the run ends (the background command exits): a table (task, status,
   PR, critical calls), then `playbook-autopilot status`, and a one-line
   push with the summary.

If `status` shows a task in progress that no run is working on (its
"run from" names a cloud session whose VM was reclaimed, or a run that
died): `playbook-autopilot release <id>`, then finish its branch with
`/ship` on my machine, or delete the branch (locally and on origin), close
its PR if any, and `playbook-autopilot requeue <id>`.
