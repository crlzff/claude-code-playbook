# docs/log.md Template

The devlog is a reverse-chronological record of what happened during the
project. One short entry per completed task, requirement change, or
significant decision. It serves two audiences:

- **Humans** revisiting the project after a break — they can skim the log
  to reconstruct what happened without re-reading all the code and git history.
- **Agents** starting a new session — they can read recent entries to
  understand what was done, what changed, and what to watch out for.

## Writing guidelines

Lead with what happened, not what you felt about it. Short sentences, short
entries. One idea per entry. If an entry is longer than 5 lines, it probably
contains two entries. (A project may set a longer target, up to about 10
lines, e.g. the playbook profile's `docs.logEntryLines`, when its entries
carry a verify checklist; the story of how you got there still belongs in
the PR.)

Each entry has four parts. Only the first two are required:

1. **Date and task reference** — when, and which ROADMAP.md task this relates to
2. **What was done** — one or two sentences
3. **Deviations** (if any) — how this differed from the plan and why
4. **Learnings** (if any) — gotchas discovered, decisions made, things to
   remember. These often become CLAUDE.md entries or SPEC.md updates.

## Template

```markdown
# Project Log

Reverse chronological. Newest entries at the top.

---

## 2030-01-14

**Task: User registration validates email format**
Added POST /api/register endpoint with email validation. Returns 400 for
invalid emails, 201 with user object for valid ones.

Deviated from plan: Used the schema validation library instead of custom
regex. It was already a dependency (used in the settings module) and
handles edge cases better.

Learned: The test database needs to be reset between registration tests
or unique constraints cause false failures. Added `--forceExit` flag to
test command. Updated CLAUDE.md.

---

## 2030-01-13

**Task: Database schema and seed data**
Created the initial database schema with users and tasks tables. Seed script
populates 10 test users and 50 sample tasks.

---

## 2030-01-13

**Requirements change: Switched from SQLite to PostgreSQL**
User decided they need full-text search. Updated SPEC.md tech stack and
data model sections. Adjusted ROADMAP.md — database setup task is now
slightly larger (M instead of S) because it needs a Docker Compose setup
for local Postgres.

---

## 2030-01-12

**Task: Project scaffolding and tooling setup**
Initialized Vite + React + TypeScript project. Configured Vitest,
ESLint, Prettier. All commands from SPEC.md work.
```

## When to write entries

- After completing each ROADMAP.md task (check the task off, then log it)
- When requirements change mid-project
- When a significant architectural decision is made (why you chose X over Y)
- When you discover a gotcha that future sessions need to know about

## When NOT to write entries

- Don't log failed attempts or debugging sessions unless the resolution
  contains a learning worth preserving
- Don't duplicate git commit messages — the log captures what git can't:
  the reasoning, deviations, and context
- Don't write essays — if an entry needs more than 5 lines, it's either
  two entries or it belongs in a separate doc
