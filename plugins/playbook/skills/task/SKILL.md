---
name: task
description: Start a ROADMAP task by id - branch, plan, red test, then hand over the /goal line. Only when the user runs /task or /playbook:task.
argument-hint: <task id, e.g. T0.3>
disable-model-invocation: true
---

Start ROADMAP task $ARGUMENTS.

Read `.claude/profile.json` first; every "profile" below means that file.
Paths (`docs.roadmap`, `docs.spec`, `docs.log`…) come from it.

1. Read task $ARGUMENTS in the ROADMAP, the SPEC sections and every doc the
   task references. Don't load the whole spec when the task names sections.
   If it has a `Design:` line and profile `design.tool` is `claude-design`,
   read `${CLAUDE_PLUGIN_ROOT}/reference/design-handoff.md` and the handoff
   bundle in `design.handoffs` before planning: the plan implements it, it
   doesn't redesign it. No bundle yet: stop and say the design task must
   hand off first.
2. Check its Env line and markers (format: `${CLAUDE_PLUGIN_ROOT}/reference/roadmap-format.md`):
   - **Design**, *(you)*, *(decision)*, or an Env phrase that makes it yours
     (visual, real device, hands-on, your decision, secrets,
     go-live): stop and tell me the task is mine, and what I should do (for
     a Design task: the Claude Design round trip, steps 1–3 of
     `reference/design-handoff.md`, then the landing task).
   - **Cloud**: a command settles it. If *(parallel-safe)*, say it could
     run beside local work (in a worktree, or under the autopilot);
     otherwise that it runs on its own. Then continue.
   - Every dependency is checked off. If not, stop and list the missing ones.
   - If profile `autopilot.mode` is not `off`:
     `playbook-autopilot owns $ARGUMENTS`. If it says the autopilot owns the
     task, stop and show me its message.
   - A security task (Env says security-sensitive, deletes data, touches
     deletion or identity, or its files are in `security.sensitive`): say
     so. It runs interactively, with nothing beside it.
3. Git: `git checkout main && git pull`, then create the branch
   `<type>/<id>-<short-slug>` (id lowercased, dots as dashes; type `chore`
   for scaffold/spike, `docs` for docs-only, `feat` otherwise). Inside a
   worktree `git checkout main` fails (it is checked out in the primary
   tree): use `git fetch origin && git switch -c <branch> origin/main`, and
   delete the `worktree-<name>` branch once the task branch exists.
4. If profile `tasks.approvePlan` is true, edit nothing yet. Present:
   - the plan (files to create or change, in order);
   - the failing test you will write (from "Test first"), unless `tdd.mode`
     is `off` or the task carries an `tdd.exempt` marker;
   - for a security task: what could go wrong, each with the test that
     catches it;
   - anything unclear or in conflict with the docs.
   Then wait for my approval. If `approvePlan` is false, show the plan and go on.
5. Red step, by profile `tdd.mode`:
   - `strict-stub` (and not exempt): write only the failing test plus a stub
     of the code under test with the right signature and an empty body, so
     the test fails on its assertions, never on a missing module. Run it,
     show the red output, commit test and stub alone: `test: <what>`.
   - `required`: tests come with the implementation; no separate commit.
   - `off`, or an exempt task: say so and go to step 6.
6. Finish by printing this line for me to paste, filled in, and nothing
   after it. `<gate>` is the profile `gate` names as their `verify`
   commands; drop the turn clause when `tasks.goalTurns` is 0:

   /goal ROADMAP $ARGUMENTS acceptance criteria hold; <gate commands> pass and their output is shown; only files needed for $ARGUMENTS changed; $ARGUMENTS checked in ROADMAP.md and a log entry added; stop after <goalTurns> turns.

Parallel work: read-only subagents may read docs or code in parallel
while planning; writing stays in this session. A second task beside this
one only when a command settles it, its files don't overlap this one's
(the ROADMAP and the log excepted), and the two don't share a singleton (a
migration, the lockfile, local services); never with a security task on
either side.
