---
description: Merge the task's PR once CI is green, then back to main and clean up (playbook)
---

Thin wrapper, written by the playbook's boot so `/done` works here.
Invoke the `playbook:done` skill with the Skill tool and follow it exactly.
If the skill is not available, the playbook plugin isn't enabled in this
project: say so and stop.
