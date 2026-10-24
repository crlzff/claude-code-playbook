---
description: End-of-milestone review: security pass, docs drift, cleanup (playbook)
argument-hint: <milestone, e.g. M0>
---

Thin wrapper, written by the playbook's boot so `/milestone-review` works here.
Invoke the `playbook:milestone-review` skill with the Skill tool, passing the arguments `$ARGUMENTS`, and follow it exactly.
If the skill is not available, the playbook plugin isn't enabled in this
project: say so and stop.
