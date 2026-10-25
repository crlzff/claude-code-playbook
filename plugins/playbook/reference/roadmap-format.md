# ROADMAP format contract

ROADMAP.md is written by the spec-driven-dev skill (Phase 3) and read by
the playbook: `/task <id>`, `/milestone-review <M>`, `doctor` and the
autopilot parser. The spec skill carries a copy of this file in its own
references; `doctor` checks a ROADMAP against the parser, so if the two
copies ever drift, the parser wins.

## Shape

```markdown
# Roadmap

<one paragraph: how tasks are run; the definition of done; the Env legend>

# Phase 1 — <outcome>

## M0 Foundation

- [ ] **T0.1 Project scaffolding and tooling setup** `[S]` *(scaffold)*
  - Env: **Local** (toolchain choices)
  - Acceptance: `pnpm dev` starts, `pnpm test` runs one passing test.
  - Depends on: nothing
  - Verify: run both commands.

- [ ] **T0.2 Registration validates email format** `[M]`
  - Env: **Cloud** (test-defined)
  - Acceptance: 400 with a message when the email lacks @; 201 otherwise.
  - Test first: POST an invalid email, assert 400 (red), then implement.
  - Depends on: T0.1
  - Not included: password reset.
  - Verify: `pnpm test -- registration`.

## M1 <milestone name>
…
```

## Rules the parser relies on

- **Milestones** are `## M<n> <name>` headings (`M` followed by a word also
  works, e.g. `## MS Spikes`). Every task belongs to
  the milestone heading above it. A milestone is done when all its tasks are
  checked. A finished milestone may collapse its tasks to one line each
  (`- [x] **T0.1** Project scaffolding (#1). D-2.`): still parsed.
- **Task line**: `- [ ] **<id> <title>** \`[S|M|L]\` <markers>`.
  `[x]` when done. A cancelled task: `- [x] ~~<id> <title>~~ *(cancelled, D-n)*`.
- **Ids**: `T<milestone>.<n>` (`T0.1`, `T3.12`) and spikes `SP.<n>`. Design
  and decision tasks are ordinary tasks with an Env of **Design** or a
  *(decision)* marker. A template task repeated per item uses a
  placeholder (`T9.<x>.a`): the autopilot never takes one.
  Default regex: ``(?:T|SP)[0-9]*\.[0-9A-Za-z<>]+(?:\.[0-9A-Za-z<>]+)?``
  (profile `autopilot.patterns.taskId` overrides it).
- **Bullets** are indented two spaces, in this order: `Env:`,
  `Acceptance:`, `Test first:`, `Design:` (optional), `Depends on:`,
  `Not included:` (optional), `Verify:`. A bullet continues on lines
  indented four spaces.
- **Depends on**: task ids, milestones (`M2`) or a range (`M1–M3`), or
  `nothing`. A `Design:` line's ids count as dependencies too.

## Env line

`Env: **Local** | **Cloud** | **Design** (<why, in a few words>)`

- **Local**: an interactive session; you watch and steer.
- **Cloud**: a command settles it, so it may run unattended (the autopilot)
  or beside other work. A Claude Code cloud session doesn't load the
  playbook plugin: there it runs on CLAUDE.md alone, without the routine,
  except `/autopilot-run`, which fetches the playbook (repo-setup.md,
  step 7).
- **Design**: done in Claude Design; a later Local task lands the handoff.

The words in parentheses are read by the autopilot, so use these phrases
when they apply:

| Phrase | Effect |
|---|---|
| `security-sensitive: <what>`, `deletes data`, `touches deletion`, `touches identity` | Security task: Local, never beside another task, line-by-line review, `/security-review`; the autopilot takes it only under its security gates, the same locally and in the cloud |
| `visual`, `real device`, `hands-on`, `your decision`, `your judgement`, `secrets`, `go-live` | Yours: settled by eye, by hand or by you. Never delegated |

## Markers (after the size)

| Marker | Meaning |
|---|---|
| `*(scaffold)*`, `*(spike)*`, `*(fixture)*` | Exempt from the red test; scaffold and spike branch as `chore/`. A spike is also yours: you choose the approach, so it is never delegated |
| `*(docs)*` | Docs-only: branches as `docs/` |
| `*(you)*`, `*(decision)*` | Yours, whatever the Env line says |
| `*(parallel-safe)*` | A command settles it (its `Verify:` is a command, not a judgement), so it may be the task *added* beside one in flight |
| `*(cancelled, D-n)*` | With `[x]` and strikethrough |

## Spikes

A spike task names its timebox and its fallback in Acceptance
("one day; if it fails, fall back to X"). Spikes live in `spikes/`,
excluded from build and lint, and are thrown away.
