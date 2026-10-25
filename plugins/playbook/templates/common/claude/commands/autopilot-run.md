---
description: Run the autopilot's queue locally and report what matters (playbook)
argument-hint: [max tasks, default 3]
---

Thin wrapper, written by the playbook's boot so `/autopilot-run` works here.
Invoke the `playbook:autopilot-run` skill with the Skill tool, passing the arguments `$ARGUMENTS`, and follow it exactly.
If the skill is not available and `$PLAYBOOK_PLUGIN_DIR` is set, this is
a cloud session, where plugins don't load: read
`$PLAYBOOK_PLUGIN_DIR/skills/autopilot-run/SKILL.md` and follow it exactly.
Otherwise the playbook plugin isn't enabled in this project (in a cloud
session: `PLAYBOOK_SOURCE` is missing from the cloud environment, see the
playbook's repo-setup.md): say so and stop.
