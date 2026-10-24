---
description: Start a ROADMAP task: branch, plan, red test, then the /goal line (playbook)
argument-hint: <task id, e.g. T0.3>
---

Thin wrapper, written by the playbook's boot so `/task` works here.
Invoke the `playbook:task` skill with the Skill tool, passing the arguments `$ARGUMENTS`, and follow it exactly.
If the skill is not available, the playbook plugin isn't enabled in this
project: say so and stop.
