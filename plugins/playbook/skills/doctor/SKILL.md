---
name: doctor
description: Check a playbook project against its profile and the current playbook, report drift, and fix what the user approves. Use when the user runs /playbook:doctor, after boot, or when the playbook itself has changed.
---

Read `.claude/profile.json` (no profile: suggest `/playbook:boot`, or
`/playbook:boot adopt` for a project with its own setup, and stop).
Compare with `${CLAUDE_PLUGIN_ROOT}` (templates, rules, reference) and
report one line per check: **ok**, **drift** (with the fix) or **n/a**.
Change nothing until I approve; then apply the approved fixes on a
`chore/doctor` branch and `/ship` it (or commit on main locally if the
remote has no main yet).

1. **Profile**: valid JSON, every key of `reference/profile.md` present
   (add missing keys with the value in `defaults/profile.json`); `gate` names all have a
   `verify` command; `stack.pack` not `undecided` once SPEC has a Tech
   Stack.
2. **Profile matches SPEC**: each `verify` command matches SPEC → Commands,
   and CI runs the same gate commands; `security.sensitive` matches SPEC →
   Security → Sensitive areas (an area added or dropped there, a path
   moved).
3. **Wrappers**: `.claude/commands/<name>.md` exists for each routine skill
   the profile enables and matches `templates/common/claude/commands/`.
   A project command with the same name that isn't a wrapper: report it,
   never replace it.
4. **Settings**: `.claude/settings.json` has empty `attribution`,
   `remoteControlAtStartup: false` and `playbook@playbook` enabled, and no
   absolute path, user name or machine detail anywhere in `.claude/`.
5. **Git**: `core.hooksPath` is `.githooks`; both hooks exist, are
   executable and match the templates; `origin` is GitHub;
   `credential.useHttpPath` is true in this repository.
6. **CLAUDE.md blocks**: the `core` block matches `rules/core.md` (with
   its TDD line adapted to `tdd.mode` as boot does), the
   `pack` block matches the pack's rules, and with `design.tool:
   claude-design` the `design` block matches `rules/design.md` and
   `design.handoffs` exists. Lines outside the blocks are the
   project's: never touched, only reported when they repeat a block line.
7. **Docs**: `playbook-autopilot lint-roadmap` passes (without Node 22.18+,
   check by hand against `reference/roadmap-format.md`); the doc paths in
   `docs` exist.
8. **Dependabot and CI**: present when the stack is chosen; cooldown and
   automerge group follow `deps`; the automerge workflow exists only when
   `deps.automerge` isn't `none`.
9. **Autopilot** (mode not `off`): `playbook-autopilot status` runs; the
   autopilot wrappers exist; `.claude/worktrees/` is gitignored.
10. **Secrets and research**: no tracked `.env*` other than `.env.example`
    (`git ls-files '.env*'`); `research/` is gitignored and nothing under it
    is tracked except `notes.md` (`git ls-files research/`).

End with the list of drifts and a one-line recommendation.
