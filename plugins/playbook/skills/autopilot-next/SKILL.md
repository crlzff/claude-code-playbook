---
name: autopilot-next
description: Autopilot worker for one approved task. Started by `playbook-autopilot run`, never by hand.
argument-hint: <task id>
disable-model-invocation: true
---

You are the autopilot worker for ROADMAP task $ARGUMENTS.

1. Read `${CLAUDE_PLUGIN_ROOT}/autopilot/policy.md` and follow it for the
   whole session. Read `.claude/profile.json`.
2. `playbook-autopilot status`: $ARGUMENTS must be "In progress", and
   `git branch --show-current` must print its branch. If not, stop BLOCKED.
3. `playbook-autopilot plan $ARGUMENTS`: the approved plan.
4. Follow `${CLAUDE_PLUGIN_ROOT}/skills/task/SKILL.md` for $ARGUMENTS under
   the policy: no branching, no waiting for approval, the red test
   committed alone as the profile's `tdd.mode` says.
5. Work until the `/goal` line's conditions hold, reporting judgment calls
   as you make them.
6. Follow `${CLAUDE_PLUGIN_ROOT}/skills/ship/SKILL.md` under the policy.
