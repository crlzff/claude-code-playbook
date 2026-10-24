---
description: Run the autopilot's queue locally and report what matters (playbook)
argument-hint: [max tasks, default 3]
---

Thin wrapper, written by the playbook's boot so `/autopilot-run` works here.
Invoke the `playbook:autopilot-run` skill with the Skill tool, passing the arguments `$ARGUMENTS`, and follow it exactly.
If the skill is not available, the playbook plugin isn't enabled in this
project: say so and stop.
