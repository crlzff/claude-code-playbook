---
name: spec-driven-dev
description: >
  Guide users through creating structured project specifications, PRDs, and
  documentation before writing any code — optimized for AI-assisted and agentic
  engineering workflows (Claude Code, Cursor, Codex, etc.). Use this skill
  whenever the user wants to start a new project, write a PRD, create a spec,
  plan a feature, set up a new repo for AI coding, write a CLAUDE.md or
  AGENTS.md, or says anything like "let's plan this out", "help me spec this",
  "I want to build X", "new project", "create a plan", "write requirements",
  or "set up my repo for agents". Also trigger when a user has jumped straight
  into coding without a plan and is hitting confusion or inconsistency —
  suggest they step back and spec first. Even if they don't say "spec" or "PRD"
  explicitly, trigger whenever someone describes a project idea and hasn't
  established a plan yet. This skill owns what gets built (spec, roadmap,
  decisions); how work runs (hooks, CI, the task routine) belongs to the
  playbook's boot skill when it is installed, and this skill hands over to it.
---

# Spec-Driven Development

This skill produces five artifacts that form the foundation of any AI-assisted
project. The goal is to front-load clarity so that coding agents (and humans)
have unambiguous direction — a rapid structured planning phase that makes
subsequent coding dramatically smoother.

## Working with the playbook

The playbook (a Claude Code plugin, `playbook`) sets up how work runs: a
project profile, git hooks, the `/task` → `/ship` → `/done` routine, CI and
the autopilot. The two split the work cleanly: **this skill authors the
artifacts below; the playbook's task routine only maintains them as work
happens** (checks tasks off, adds log entries, fixes docs a change made
wrong, consolidates at milestone ends), **and this skill never writes the
playbook's files** (`.claude/profile.json`, hooks, CI, the
`<!-- playbook:begin … -->` blocks in CLAUDE.md).

- **Phase 0, in Claude Code only.** If the project has no
  `.claude/profile.json`: when the `playbook:boot` skill is available,
  suggest running `/playbook:boot` first (a few minutes), so the hooks
  guard the very first commit; when it isn't but the user works with the
  playbook, it isn't switched on for this folder yet: suggest
  `claude plugin install playbook@playbook --scope project`, then
  `/reload-plugins` and `/playbook:boot`. If the user prefers, go on and
  boot afterwards.
- **On claude.ai**, or without the playbook: work as usual and hand the
  artifacts over as files; boot reads them later.
- **The handoff** (Phase 4) changes when the playbook is there: see below.

Whether or not the playbook is used, ROADMAP.md always follows
`references/roadmap-format.md`: task ids, milestones and Env lines cost
nothing without the playbook and are what its commands parse.

## The five artifacts

1. **SPEC.md** — The product and project specification. What we're building,
   why, for whom, what success looks like, and the technical plan. This is the
   source of truth that both humans and agents refer back to.

2. **CLAUDE.md** — A lean context file containing ONLY information an agent
   cannot discover by reading the codebase. Tooling gotchas, non-obvious
   conventions, landmines. Never a codebase overview.

3. **ROADMAP.md** — The implementation broken into ordered, atomic tasks with
   clear acceptance criteria. The user's work queue.

4. **docs/log.md** — A reverse-chronological devlog. One short entry per
   completed task recording what was done, deviations from plan, and learnings.
   Serves as project memory for both humans and agents across sessions.

5. **docs/decisions.md** — One row per significant decision: id (`D-1`),
   the decision, why, and when to revisit it. Amended, never rewritten: a
   reversed decision gets a new row that names the one it amends. The log
   says what happened; decisions say what holds.

Detailed reference sections that outgrow the spec (data model, API,
architecture, security) live in `docs/spec/<topic>.md`.

Read the templates in `references/` before drafting any artifact:
- `references/spec-template.md` — SPEC.md structure and required sections
- `references/claude-md-template.md` — CLAUDE.md filter and format
- `references/roadmap-format.md` — ROADMAP.md format contract
- `references/decisions-template.md` — docs/decisions.md format
- `references/log-template.md` — docs/log.md entry format

---

## Core principles

These come from empirical research and practitioner experience:

- **Plan first, execute second.** No code until the spec is reviewed and
  approved.
- **The spec is the leverage.** Vague specs multiply errors across every
  agent. Precise specs multiply into precise implementations.
- **Draft first, then react.** Don't wait for perfect information from the
  user. Draft the spec from what you have — even if incomplete — and present
  it for the user to react to. Reacting to a draft is easier than generating
  requirements from scratch.
- **Focus on what/why first, how second.** Start with user stories and
  acceptance criteria, not implementation details.
- **Only non-discoverable info in CLAUDE.md.** Research shows auto-generated
  context files reduce task success by 2-3% while increasing cost 20%+.
  Only include what the agent genuinely cannot find by reading the code.
- **Tests are mandatory.** Define the testing strategy in the spec. Prefer
  red/green TDD — write tests before implementation.
- **Break work into atomic tasks.** Each task should fit in one AI session
  and have unambiguous pass/fail criteria.
- **Gate each phase.** Don't advance until the current phase is validated
  by the user.
- **Name your unknowns.** Open questions belong in the spec explicitly.
  Unnamed ambiguity gets filled by agent assumptions — and those assumptions
  compound.
- **Document as you go.** Log each completed task in docs/log.md. This
  costs seconds per task and saves hours when revisiting the project.

---

## The workflow

### Phase 1: Specify (the what and why)

Interview the user to understand the project. Keep it conversational — ask
2-3 questions per turn, not all at once. After each round, summarize what
you've understood and ask what's missing. When the user confirms the summary
is accurate, move to drafting.

Cover these areas:

1. **Vision**: What are we building? One-sentence elevator pitch.
2. **Users**: Who is this for? What problem does it solve for them?
3. **Success criteria**: What does "done" look like? Concrete, testable
   conditions. "User can add, edit, and delete tasks" not "task management."
4. **Non-goals**: What are we explicitly NOT building? This prevents scope
   creep and stops agents from over-building.
5. **Constraints**: Performance, security, accessibility, platform targets,
   budget, timeline.
6. **Open questions**: What hasn't been decided yet? Prompt the user: "What
   are you still unsure about? It's better to name those now than let the
   agent guess." These go into the spec explicitly.
7. **Security surface**: Does this project touch auth, payments, user data,
   or untrusted input? If yes, security becomes a required section later,
   and its "Sensitive areas" list is what the playbook treats as
   security-sensitive (interactive work, line-by-line review).

Keep this phase focused on product thinking. The user should be able to
explain the spec to a non-technical person.

**Studying similar products** is fine and often useful, as a good actor:
learn the pattern, never copy, never harm. Stay at what a normal visitor's
browser receives; never get past a login, paywall or access control, and
never use unreleased content. Ask before going further (sourcemaps, API
calls, guessed paths). Write what you learned in your own words, and refer
to each product by a neutral label (Source A, B…) in anything that gets
committed: the spec never names them.

**Draft first.** Once you have enough to work with (you don't need everything),
draft the SPEC.md using `references/spec-template.md`. Present the draft to
the user for reaction. It's much easier for someone to say "no, that's wrong,
it should be X" than to generate requirements from a blank page. Iterate until
they confirm it captures their intent.

**Spec size target**: Aim for under 2,000 words for the full spec. If it grows
longer, split into a summary spec (the core sections agents need every session)
and detailed reference sections (data model, API design) in `docs/spec/`
that get fed into context only when relevant. Use clear section headers so the user can reference
specific parts by name when prompting agents (e.g., "refer to the Data Model
section of SPEC.md").

Do not proceed to Phase 2 until the spec is approved.

### Phase 2: Plan (the how)

Now get technical. With the approved spec, work with the user to define:

1. **Tech stack**: Specific names and versions — "React 18 with TypeScript,
   Vite, Tailwind" not "React project."
2. **Architecture**: How components connect. Data flow. API boundaries.
   Module structure.
3. **Data model**: Entities, relationships, storage.
4. **Testing strategy**: Framework, file locations, coverage expectations,
   test types (unit, integration, e2e).
5. **Commands**: Full executable commands with flags. Agents reference these
   constantly. This section is the truth for commands: the playbook copies
   test, lint, typecheck and build from it into its gate.
6. **Project structure**: Where source code, tests, and docs live. Be explicit.
7. **Code style**: One real code snippet showing conventions is better than
   paragraphs of description.
8. **Git workflow**: Branch naming, commit message format, PR requirements.
   With the playbook, this section is one line pointing to
   `.claude/profile.json` and the playbook's routine, which own it.
9. **Security** (if flagged in Phase 1): Auth approach, data handling,
   sensitive areas (name each area and the folders or files it lives in,
   even planned ones), threat model for critical paths. This is not optional
   when the project touches auth, payments, user data, or untrusted input —
   45% of AI-generated code contains security flaws and XSS vulnerabilities
   appear at 2.74× human rates.

**For existing codebases**: Before proposing anything, explore the code in
read-only mode. In Claude Code, use Plan Mode (Shift+Tab) to analyze the
codebase without writing any code. Understand existing conventions, patterns,
and architecture first. Don't propose a tech stack or structure that conflicts
with what's already there unless the user explicitly wants to change it.

Update SPEC.md with these technical details.

Then create CLAUDE.md using `references/claude-md-template.md`.

**The CLAUDE.md filter** — before adding any line, ask: "Can the agent
discover this by reading the code?" If yes, delete it. Good candidates:

- Package manager choice when non-obvious (e.g., `uv` not `pip`)
- Commands needing special flags or you get false positives
- Modules with non-obvious patterns that must not be refactored
- Deprecated directories still imported by production code
- Environment setup gotchas

Bad candidates (delete these):

- Directory structure (agent can `ls`)
- Tech stack overview (agent can read package.json / requirements.txt)
- General coding style (agent can read existing code)
- Anything in the README

Record each choice that shapes the project (stack, hosting, data store,
auth approach, anything rejected for a reason) as a row in
`docs/decisions.md`, using `references/decisions-template.md`.

Present the documents for review. Iterate until approved.

### Phase 3: Roadmap (the work breakdown)

Convert the spec and plan into ROADMAP.md — an ordered checklist of atomic
tasks, grouped into milestones, in the format of
`references/roadmap-format.md` (read it first). Each task needs:

0. **An id** — `T<milestone>.<n>` (`T0.1`), or `SP.<n>` for spikes. Commands
   and prompts refer to tasks by id (`/task T0.3`).

1. **A clear title** describing the outcome, not the activity.
   Good: "User registration endpoint validates email format"
   Bad: "Work on authentication"

2. **Size estimate** — S, M, or L.
   S = straightforward, one focused prompt, <30 min. Boilerplate, config,
   simple CRUD.
   M = some complexity, may need iteration, 30-90 min. Feature with edge
   cases, integrations.
   L = significant complexity, multiple sub-steps, 90+ min. Consider
   breaking L tasks into smaller pieces. If you can't, note why.

3. **Acceptance criteria** — concrete, testable conditions.
   Good: "Returns 400 with error message when email lacks @ symbol"
   Bad: "Handle invalid emails"

4. **Test first** — what failing test to write BEFORE implementing. This is
   the red/green TDD step and it's critical for agentic workflows. Agents
   optimizing for passing tests will find ways to pass them. If tests are
   written after implementation, they test what the code *happens to do*,
   not what it *should do*. Writing the test first and confirming it fails
   (red) before implementing (green) is the single highest-leverage
   instruction you can give an agent. Scaffold tasks (project setup,
   config, tooling) may not need this — use judgment.

5. **Dependencies** — which tasks must complete first.

6. **Scope boundary** — what this task does NOT include.

7. **Verification method** — how we prove this task is done. Include both
   the test command AND any manual verification or evidence to capture
   (screenshot, log output, curl response). Think of this as the "proof it
   works" that you'd attach to a PR.

8. **Env line** — where the task runs and why, in a few words: **Local**
   (an interactive session the user watches), **Cloud** (a command settles
   it, so it may run unattended), **Design** (Claude Design). Use the
   contract's phrases when they apply: `security-sensitive: <what>`,
   `deletes data`, or `visual`, `real device`, `your decision` for
   what only the user can settle.

9. **Markers** when they apply: `*(scaffold)*`, `*(spike)*`, `*(fixture)*`
   (no red test), `*(docs)*`, `*(you)*`, `*(decision)*`, `*(parallel-safe)*` (its
   Verify is a command, so it may run beside another task).

Order tasks so foundational work comes first (project setup, data models,
core abstractions), then features build on top. Keep each task small enough
for a single focused AI session. A milestone leaves the main branch
deployable. Unproven foundations get a spike first: timeboxed, with its
fallback decided in advance.

Format as a markdown checklist with nested details:

```markdown
# Phase 1 — Usable by one person

## M0 Foundation

- [ ] **T0.1 Project scaffolding and tooling setup** `[S]` *(scaffold)*
  - Env: **Local** (toolchain choices)
  - Acceptance: `npm run dev` starts without errors, `npm test` runs
  - Depends on: nothing
  - Verify: Run both commands

- [ ] **T0.2 Database schema and seed data** `[M]` *(parallel-safe)*
  - Env: **Cloud** (migration test)
  - Acceptance: Migrations run cleanly, seed script populates test data
  - Depends on: T0.1
  - Verify: `npm run db:migrate && npm run db:seed` succeeds

## M1 Core features

- [ ] **T1.1 User registration validates email format** `[M]`
  - Env: **Local** (security-sensitive: account creation)
  - Acceptance: Returns 400 with message when email lacks @; returns 201
    with user object for valid email
  - Test first: Write test that POSTs invalid email and asserts 400.
    Confirm it fails (red). Implement endpoint. Confirm test passes (green).
  - Depends on: T0.2
  - Not included: Password reset, email verification
  - Verify: `npm test -- --grep "registration"`
```

Screens designed in Claude Design get two tasks: the design itself
(`Env: **Design**`, yours) and a Local landing task whose `Design:` line
names it (`- Design: sign-up screen from T2.1.`). The landing implements
the handoff; it doesn't redesign it.

Above the first phase, one short paragraph: the definition of done for
every task (acceptance met, tests green, checked off, a log entry, every
doc the change made wrong updated in the same PR) and the Env legend.

Also create `docs/log.md` with a header. Read `references/log-template.md`
for the format. This file will be appended to as tasks are completed during
implementation.

Present the roadmap and log file to the user. This is the last gate before
implementation.

### Phase 4: Hand off to implementation

**With the playbook** (Claude Code, `playbook:boot` available): if the
folder is a git repository, commit the artifacts on the main branch
locally as `docs: spec, roadmap and decisions` (no push yet), then tell the
user to run `/playbook:boot` again. It reads SPEC (stack, commands, sensitive
areas), checks ROADMAP against the contract, sets up CI and the rest,
makes the first push, and names the first task: `/task <id>`. The task
routine then carries the principles below, so don't repeat them as a
list; mention only that one task per conversation still holds.

**Without the playbook**, with all five artifacts ready, remind the user of
these principles:

- **One task per session.** Reset agent context between tasks.
- **Feed relevant SPEC.md sections** into context for each task. Don't
  load the entire spec if it's long — reference specific sections by name.
- **CLAUDE.md is auto-loaded** by Claude Code — no need to paste it.
- **Red/green TDD for every feature task.** The workflow per task is:
  (1) write the test based on acceptance criteria, (2) run it and confirm
  it fails (red), (3) implement until the test passes (green),
  (4) refactor if needed. Telling the agent "use red/green TDD" is
  shorthand every good model understands. Skip TDD only for pure scaffold
  tasks (project init, config files, tooling setup).
- **Commit after each task.** Frequent commits are save points.
- **Review every diff.** If you can't explain what a module does, it doesn't
  go in.
- **Log each completed task** in docs/log.md — date, what was done, any
  deviations or learnings. Takes seconds, saves hours later.
- **Update CLAUDE.md when you hit gotchas.** But treat each addition as a
  signal the codebase might need fixing. Fix the root cause when possible,
  then delete the line.
- **Check off tasks in ROADMAP.md** as they're completed.
- **Never commit code you can't explain.**

---

## When the user has an existing project

If the user already has a codebase and wants to add a feature or refactor:

1. Skip the full Phase 1 interview. Ask what they want to change and why.
2. **Explore first.** Use read-only / Plan Mode to understand the existing
   codebase before proposing anything. Read existing conventions, patterns,
   and architecture. The agent should understand the codebase at least as
   well as a new team member would before suggesting changes.
3. In Phase 2, focus on how the change fits existing architecture. Don't
   propose patterns that conflict with what's already there unless the user
   explicitly wants a different approach.
4. Phase 3 is especially important — break the change into small, reviewable
   tasks with their own tests.
5. Review or create CLAUDE.md if one doesn't exist. Keep it lean.
6. Set up docs/log.md and docs/decisions.md if they don't exist.
7. New tasks go into ROADMAP.md in the contract format. If the project
   doesn't use the playbook yet, `/playbook:boot adopt` can bring it in
   without overwriting what it has.

---

## Updating artifacts when requirements change

These are living documents, not frozen specs. When requirements change
mid-project:

1. **Update SPEC.md first.** Change the relevant sections. If a decision
   is being reversed, note why briefly (this is documentation, not a
   debate record — if the decision is architecturally significant, add a
   row to docs/decisions.md that names the decision it amends).
2. **Cascade to ROADMAP.md.** Add, remove, or modify tasks to reflect the
   new requirements. Mark obsolete tasks as cancelled with a note rather
   than deleting them — the history is useful.
3. **Update CLAUDE.md if needed.** New gotchas or changed conventions.
4. **Log the change** in docs/log.md with a clear note that this was a
   requirements change, not a task completion.

The key principle: SPEC.md is always the current truth. It's not a historical
document of what was originally planned — it's what we're building NOW.
History lives in docs/log.md and git.

---

## Anti-patterns to catch

- **Skipping planning to start coding.** Push back gently. Even 10 minutes
  of spec work saves hours of rework. Offer to make it fast.
- **Spec growing into a novel.** Aim for under 2,000 words. If longer, split
  into summary + reference sections. Feed only relevant sections per task.
- **CLAUDE.md becoming a codebase overview.** Strip it. If the agent can
  find it by reading code, delete the line.
- **Tasks too large.** "Build the dashboard" is not a task. Any task sized
  L should be scrutinized — can it be broken down further?
- **No testing strategy.** Don't let this slide. Tests are what turn
  unreliable agent output into reliable systems.
- **User treating AI output as trusted.** Reinforce: verification is the
  bottleneck, not generation. Every change needs proof it works.
- **Security hand-waved away.** If the project touches auth, payments,
  user data, or untrusted input, security is a required section in the
  spec. Don't let "[only if relevant]" become an excuse to skip it.
- **Unnamed ambiguity.** If the user says "I'll figure that out later,"
  that's an Open Question that belongs in the spec explicitly. Agents will
  fill unnamed gaps with assumptions.
- **Skipping the log.** It takes seconds per task. Without it, revisiting
  the project after a break means re-reading all the code and git history
  to reconstruct what happened.
- **Tasks without ids or Env lines.** Nobody can say "`/task T1.3`", and
  nothing can tell a task the user must judge from one a command settles.
- **Writing the playbook's files.** Hooks, CI, `.claude/profile.json` and
  the `playbook:begin` blocks in CLAUDE.md belong to boot; leave them.

---

## Success criteria for this skill

- [ ] SPEC.md clearly articulates what, why, for whom, and success criteria
- [ ] SPEC.md includes technical plan with stack, architecture, commands,
      testing strategy, and project structure
- [ ] SPEC.md includes Open Questions section (even if empty — confirms
      nothing was left unnamed)
- [ ] SPEC.md includes Security section if project touches auth, payments,
      user data, or untrusted input
- [ ] SPEC.md is under 2,000 words (or split into summary + references)
- [ ] CLAUDE.md exists containing ONLY non-discoverable information
- [ ] ROADMAP.md follows `references/roadmap-format.md`: milestones, task
      ids, size, Env line, acceptance criteria, Depends on and Verify
- [ ] docs/decisions.md exists with a row per choice that shapes the project
- [ ] docs/log.md exists with header and format ready for entries
- [ ] User has reviewed and approved all five artifacts
- [ ] Task ordering respects dependencies

## Verification

Before presenting the final artifacts, verify all success criteria are met.
If any fail, iterate up to 3 times to fix them.
