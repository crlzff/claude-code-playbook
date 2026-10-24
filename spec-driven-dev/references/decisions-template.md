# docs/decisions.md Template

One row per choice that shapes the project: stack, hosting, data store,
auth, a pattern adopted or rejected, a constraint accepted. The log says
what happened and when; this file says what holds now and why. CLAUDE.md
lines point here by id ("(D-12)") so the reason is one lookup away.

## Rules

- **Ids** are `D-1`, `D-2`… in order, never reused.
- **Amend, don't rewrite.** A reversed or refined decision gets a new row
  that starts "Amends D-n:"; the old row stays and gets "(amended by D-m)"
  at the end of its decision text. At a milestone review, amended rows may
  be folded into the current one, keeping the id.
- **Revisit when** names the concrete signal that would reopen it ("builds
  take over ten minutes", "a second customer"), or "—" if nothing
  foreseeable would.
- **Short.** Decision and why in a sentence or two each. Detail belongs in
  docs/spec/ or the PR.

## Template

```markdown
# Decisions

Architecture and process decisions, newest at the bottom. Amended by a new
row, never rewritten. Lines in CLAUDE.md point here by id.

| Id | Decision | Why | Revisit when |
|---|---|---|---|
| D-1 | Server-rendered pages, no client framework | Few interactive screens; less to ship and test | A screen needs offline editing |
| D-2 | SQLite in a single file | One user per install; no server to run | Two people need to edit the same data |
| D-3 | Amends D-2: SQLite with write-ahead logging | Background sync writes while the app reads | — |
```
