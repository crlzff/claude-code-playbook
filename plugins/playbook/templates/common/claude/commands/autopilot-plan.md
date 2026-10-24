---
description: Draft plans for the next autopilot tasks; approved ones join its queue (playbook)
argument-hint: <how many, e.g. 4>
---

Thin wrapper, written by the playbook's boot so `/autopilot-plan` works here.
Invoke the `playbook:autopilot-plan` skill with the Skill tool, passing the arguments `$ARGUMENTS`, and follow it exactly.
If the skill is not available, the playbook plugin isn't enabled in this
project: say so and stop.
