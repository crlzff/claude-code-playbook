---
description: Merge the autopilot's PRs one at a time, critical first (playbook)
---

Thin wrapper, written by the playbook's boot so `/merge-stack` works here.
Invoke the `playbook:merge-stack` skill with the Skill tool and follow it exactly.
If the skill is not available, the playbook plugin isn't enabled in this
project: say so and stop.
