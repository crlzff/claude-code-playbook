---
name: autopilot-plan
description: (Experimental) Draft plans for the next tasks the autopilot may run; the ones the user approves join its queue. Only when the user runs /autopilot-plan or /playbook:autopilot-plan.
argument-hint: <how many, e.g. 4>
disable-model-invocation: true
---

Plan the next $ARGUMENTS autopilot tasks. Nothing here edits code or
creates branches. Read `.claude/profile.json` first; `autopilot.mode` must
be `plan-only` or `local-queue`, otherwise stop and say so.

Only after the first tasks on a new surface were done by hand and
reviewed: five unattended tasks make the same mistake five times before
anyone can correct it. If none was, say so and propose which one to do
by hand first.

1. `playbook-autopilot status` and `playbook-autopilot candidates`. Choose
   up to $ARGUMENTS candidates, favouring those that unblock the most other
   tasks. Show the list with each one's kind (`agent` or `security`).
2. For each, do the `task` skill's steps 1 and 2 (a dependency may be
   queued instead of done), then draft the plan its step 4 would present,
   plus:
   - **Threats → tests**: every "what could go wrong" line names the test
     that catches it. Required for a security task; elsewhere when relevant.
   - **Open items**: each open point of the task, with the answer you
     propose. Approving the plan settles them.
   - **Unclear or conflicting**: as in `task`. These must be resolved before
     I approve: an autopilot task can't ask.
   - **My check**: if the task's `Verify:` needs a device, screenshots or my
     eye, say so: the autopilot does the rest, I verify before merging.
     A design landing (a `Design:` line) is settled by eye: don't offer it.
3. Write each plan to `.claude/worktrees/autopilot-plans/<id>.md`:

   ```
   ---
   id: T1.4
   security: false
   migration: true
   files:
     - src/db/schema/
     - migrations/
   ---
   <the plan: files in order, the failing test, threats → tests, open
   items settled, out of scope>
   ```

   `security` is true exactly when `candidates` says `security`.
   `migration` is true when the task adds a migration. `files` lists the
   files and folders (trailing `/`) the task may touch; the tripwires flag
   anything else.
4. Present every plan, then wait. With `local-queue`, for each one I approve
   (with my edits applied): `playbook-autopilot enqueue <file>`, and end
   with `playbook-autopilot status`. With `plan-only`, leave the files for
   me to run with `/task`.
