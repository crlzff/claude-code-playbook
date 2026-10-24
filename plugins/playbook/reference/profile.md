# The project profile: `.claude/profile.json`

One file per project, committed. It holds only what differs between
projects; everything else is the playbook's fixed way of working, written
into the skills. `boot` writes it from `defaults/profile.json`; `doctor`
checks the project still matches it. JSON, because the autopilot CLI reads
it with no dependencies.

The profile says *how we work*; SPEC.md says *what we build*. They meet in
two places: `verify` is filled from SPEC → Commands, `security.sensitive`
from SPEC → Security.

| Key | Meaning |
|---|---|
| `stack.pack` | `undecided` until spec Phase 2 picks a stack; then a pack from `templates/stacks/` (`node-pnpm`) or `custom` |
| `stack.setup` | Installs dependencies in a fresh worktree (the autopilot runs it before each task) |
| `stack.notes` | One line of toolchain gotchas, also written into CLAUDE.md → Commands |
| `verify` | Name → full command (`test`, `lint`, `typecheck`, `build`, `e2e`…) |
| `gate` | The `verify` names that must pass before a PR: `/ship` runs them, the `/goal` line demands them, the autopilot re-runs them |
| `docs.depth` | `full` (SPEC, docs/spec/, decisions, log, archive) · `minimal` (CLAUDE.md, ROADMAP, log) for a small project |
| `docs.spec`, `specDir`, `roadmap`, `log`, `archive` | Paths of the spec-driven artifacts |
| `docs.logEntryLines` | Target length of a log entry (`5`) |
| `design.tool` | `claude-design` (screens designed in Claude Design and handed off: `reference/design-handoff.md`) · `none` |
| `design.handoffs` | Where handoff bundles go (`design/handoffs/`), one `<yyyy-mm-dd>-<task-id>/` folder per landing |
| `tasks.approvePlan` | `true`: `/task` presents the plan and waits · `false`: shows it and goes on |
| `tasks.goalTurns` | Turn cap in the `/goal` line (`30`), or `0` for none |
| `tdd.mode` | `strict-stub` (failing test plus a stub committed alone, red output in the PR) · `required` (tests with every feature, order free) · `off` |
| `tdd.exempt` | Task markers that skip the red step (`scaffold`, `spike`, `fixture`) |
| `review.lenses` | `3`: three reviewers in parallel (scope and tests · landmines and security · docs) · `1`: one reviewer for everything |
| `security.sensitive` | `[{ "area": "auth", "paths": ["src/auth/"] }]`, from SPEC → Security. Interactive only, line-by-line review, `/security-review` |
| `security.landmines` | Short names of the project's security rules; the reviewer checks each |
| `git.merge` | `agent-confirm` (the agent merges after showing CI and asking) · `human` (you merge on GitHub) |
| `git.protection` | `pre-push` (local hook, for a free private repository) · `ruleset` (server-side, for a public one) |
| `deps.automerge` | `dev-patch` · `dev-minor` · `none`: the Dependabot group merged unattended once CI is green |
| `deps.cooldownDays` | Days a release waits before Dependabot proposes it (`3`) |
| `autopilot.mode` | *Experimental.* `off` (default) · `plan-only` (`/autopilot-plan` drafts plans you run with `/task`) · `local-queue` (the full loop) |
| `autopilot.caps` | `perDay` 4, `unmerged` 3, `security` 1; env `AUTOPILOT_MAX_PER_DAY`, `_UNMERGED`, `_SECURITY` override |
| `autopilot.permissionMode`, `workerTimeoutHours` | Worker sessions' mode (`auto`, env `AUTOPILOT_PERMISSION_MODE`) and time limit (`4`) |
| `autopilot.keepAwake` | Prefix that keeps the machine awake during a run (macOS: `caffeinate -i`), or empty |
| `autopilot.copyIntoWorktree` | Gitignored files the worker tree needs (`.env.local`) |
| `autopilot.notify` | `push` (critical, blocked and failed events as push notifications) · `none` |
| `autopilot.patterns` | ROADMAP parser overrides: `taskId`, `yours`, `yoursMarks`, `security`, `choreMarks`, `docsMarks` (regex sources; defaults in `reference/roadmap-format.md`) |
| `autopilot.tripwires` | Extra diff rules: `[{ "rule": "scope", "line": "scopedQuery\\(" }]`, with `line` (added or removed code), `added`, `file` (path regex) |
| `autopilot.testFile`, `testCall`, `alwaysInPlan` | Test-file and test-call patterns (from the stack pack) and files any plan may touch |

## Fixed, not settings

The main branch is `main`. Branches are `<type>/<id>-<slug>` (`chore` for
scaffold or spike, `docs` for docs-only, `feat` otherwise). Commit
messages are one line, at most 72 characters. The GitHub PAT is per
repository, in the OS credential store, borrowed by `playbook-gh`.
Non-blocking review findings are fixed when two lenses agree or the fix is
a few lines; `/ship` stops after three review rounds; `/security-review`
runs when a diff touches a sensitive area. Read-only subagents may run in
parallel; a second task beside one in flight only when a command settles
it, the files don't overlap, and the pair shares no singleton (a
migration, the lockfile, local services).
