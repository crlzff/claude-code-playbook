---
name: boot
description: Set up or finish setting up a project the playbook way - profile from the defaults, settings, hooks, wrappers, then after the spec the stack pack, CI, Dependabot and the composed CLAUDE.md. Use when the user runs /playbook:boot, or when the spec-driven-dev skill hands over to it. Not for writing the spec itself (that is spec-driven-dev).
argument-hint: [adopt]
---

Boot sets up **how work happens** in this project. **What gets built**
(SPEC, ROADMAP, CLAUDE.md content, decisions, log) belongs to the
spec-driven-dev skill; boot never writes those, except its own marked
blocks in CLAUDE.md. Boot is re-entrant: work out which stage the project
is in and do only that stage. Ask before overwriting anything that exists.

Plugin files: `${CLAUDE_PLUGIN_ROOT}` (defaults, templates, rules,
reference). Never write an absolute path, a user name or anything about
this machine into the project: projects may be public.

## Which stage

- No `.claude/profile.json` → **Stage A**. Then, if SPEC and ROADMAP
  already exist (a spec written first, e.g. on claude.ai), go straight on
  to **Stage B**; otherwise tell me: next is the spec (spec-driven-dev
  Phases 1–3), then `/playbook:boot` again.
- Profile with `stack.pack: undecided` and a SPEC whose Tech Stack is
  filled → **Stage B**.
- Profile with `stack.pack: undecided` and no SPEC yet → say the spec comes
  next and stop.
- Profile complete → run the `doctor` skill instead.
- `$ARGUMENTS` is `adopt` (an existing project with its own setup) →
  **Adopt**.

## Stage A: before the spec (how we work)

1. **Profile.** Start from `${CLAUDE_PLUGIN_ROOT}/defaults/profile.json`.
   Ask only what is this project's to decide, in one turn: the autopilot
   (`off`, `plan-only` or `local-queue`; default off); whether it has
   screens designed in Claude Design (`design.tool`, default
   `claude-design`; `none` for a project without UI); whether it is small
   enough for lighter rules (`docs.depth: minimal`, `tdd.mode: required`,
   `review.lenses: 1`); and, if the repository will be public,
   `git.protection: ruleset`. Everything else stays at the defaults and can
   be changed later in the profile. Meanings:
   `${CLAUDE_PLUGIN_ROOT}/reference/profile.md`.
2. **Git.** If this isn't a repository: `git init -b main`. If there is no
   `origin`, ask for `owner/repo` (always GitHub) and
   `git remote add origin https://github.com/<owner>/<repo>.git`, then
   `git config credential.useHttpPath true` (this repository only, never
   `--global`: it keys the stored PAT by repository).
3. **Write**, from `${CLAUDE_PLUGIN_ROOT}/templates/common/`:
   - `.claude/profile.json`: the defaults with my answers; `stack.pack`
     stays `undecided`, `verify` empty.
   - `.claude/settings.json` from `claude/settings.json`. Merge into an
     existing file; never drop keys that are there.
   - `.claude/commands/*.md` from `claude/commands/` (the wrappers), except
     the autopilot ones when `autopilot.mode` is `off` (keep
     `autopilot-plan` for `plan-only`).
   - `.githooks/commit-msg` and `.githooks/pre-push`, executable, then
     `git config core.hooksPath .githooks`.
   - `.gitignore` (merge `gitignore`), `.worktreeinclude`, `.env.example`.
4. **Commit** on the main branch, locally: `chore: playbook setup`. Don't
   push: the first push comes at the end of Stage B, so the remote starts
   with the whole skeleton.
5. Print `${CLAUDE_PLUGIN_ROOT}/templates/common/repo-setup.md` as a
   checklist for me, then: "Next: the spec. Say what you want to build
   (spec-driven-dev), then run /playbook:boot again."

## Stage B: after the spec (stack, commands, safety)

1. **Read** SPEC (Tech Stack, Commands, Security, Testing Strategy, Git
   Workflow), ROADMAP and CLAUDE.md.
2. **ROADMAP.** `playbook-autopilot lint-roadmap`. Every problem it prints
   is a spec issue: list them and ask me to fix them with spec-driven-dev
   (or fix them myself), then rerun. Don't continue past a failing lint.
   If it can't run (no Node 22.18+ on this machine), check the ROADMAP by
   hand against `${CLAUDE_PLUGIN_ROOT}/reference/roadmap-format.md`: ids,
   milestone headings, an Env line on every open task, and dependencies
   that exist.
3. **Pack.** If `${CLAUDE_PLUGIN_ROOT}/templates/stacks/<pack>/pack.json`
   fits the Tech Stack, use it; otherwise `custom`: ask me for the setup
   command and the gate commands, and write CI from them by hand, keeping
   the pack's CI conventions (read-only permissions, concurrency, separate
   audit job, first-party actions only). Never write a pack for a stack
   no project uses yet.
4. **Profile, completed:**
   - `stack` and `verify` from the pack, overridden by SPEC → Commands where
     they differ (SPEC is the truth for commands); `gate` keeps only names
     that have a command.
   - `security.sensitive` from SPEC → Security → Sensitive areas: propose
     area → paths (planned paths are fine), I confirm.
   - `security.landmines`: one short name per security rule in SPEC.
   - `autopilot` extras from the pack (test patterns, tripwires). Every
     `security.sensitive` path is already a file tripwire; add one more
     file tripwire for each other file that *is* a guard (headers and CSP
     config, request middleware or routing, the lint config): keyword
     rules miss value-only edits. Propose the list from SPEC; I confirm.
5. **Files** from the pack: CI, Dependabot (`__COOLDOWN__` from
   `deps.cooldownDays`), the automerge workflow only
   when `deps.automerge` isn't `none` (its group follows the setting), the
   gitignore additions, and the package manifest bits if the manifest
   exists. If it doesn't yet, list what the scaffold task must add and ask
   me to put it in that task's Acceptance (the ROADMAP is the spec's file,
   not boot's).
6. **CLAUDE.md**: put the lines of `${CLAUDE_PLUGIN_ROOT}/rules/core.md`
   under the same sections of CLAUDE.md (create a section that is missing)
   inside marked blocks:
   `<!-- playbook:begin core -->` … `<!-- playbook:end core -->`. When
   `design.tool` is `claude-design`, the same for `rules/design.md` (a
   `design` block), and create `design.handoffs` with a `.gitkeep`. Add the
   pack's `rules` and `stack.notes` under Commands, in a `pack` block.
   A block is always complete, so `doctor` can compare it. Lines outside
   the blocks are spec-driven-dev's: never edit them, but list those that
   say the same as a block line (a spec written without the playbook
   carries generic Boundaries and Workflow) and propose deleting them; I
   approve. CLAUDE.md stays landmines only. Match the core block's TDD line
   to `tdd.mode`: as written for `strict-stub`, "Tests come with every
   feature." for `required`, dropped for `off`.
7. **Commit** `chore: stack setup and workflow`, then the first push:
   `git push -u origin main` (the pre-push hook allows creating main once).
   Until the scaffold task lands, CI on main has nothing to build and runs
   red: say so; the first PR turns it green.
   If origin already has a main branch, this goes through a PR instead:
   branch `chore/boot-stack`, then `/ship`.
8. Run `doctor`. Then: "Next: `/task <first id>`", naming the first
   unchecked task and its Env line.

## Adopt (a project that already has its own setup)

Don't overwrite anything. Read its CLAUDE.md, hooks, CI, commands and
docs; draft the profile that describes what it already does; list each
difference from the playbook (missing, different, extra) with a proposal,
and apply only what I approve, on a `chore/adopt-playbook` branch through
`/ship`. Its own commands with the same names as the wrappers stay until I
say otherwise.
