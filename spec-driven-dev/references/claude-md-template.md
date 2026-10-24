# CLAUDE.md Template

This template is deliberately short. A good CLAUDE.md is lean — often under
20 lines. Every line competes with the actual task in the agent's attention.
If you find yourself writing paragraphs, you're probably including information
the agent can discover by reading the code.

## The filter

Before adding ANY line, ask: "Can the agent figure this out by reading the
codebase?" If yes, don't write it.

Good: information the agent cannot discover on its own.
Bad: information that duplicates what's already in the code, README, or
package.json.

## What belongs

- Non-obvious tooling choices and their required flags
- Commands that behave unexpectedly without specific options
- Modules with patterns that look wrong but are intentional
- Deprecated code that must not be deleted or refactored
- Environment or setup gotchas that would cause silent failures
- "Landmines" — things that look safe to change but will break something

## What does NOT belong

- Directory structure descriptions (agent can `ls`)
- Tech stack overview (agent reads package.json, requirements.txt, etc.)
- General coding style guide (agent reads existing code)
- Anything already in the README
- Architecture overviews (agent can explore the codebase)
- Dependency lists (agent reads lock files)

## Template

```markdown
# CLAUDE.md

## Commands
[Only if they need special flags or have gotchas]
- Tests: `npm test -- --no-cache` (caching causes false positives from fixture setup)
- Lint: `npm run lint -- --fix` (always auto-fix; CI blocks unfixed warnings)

## Gotchas
- [The auth module uses a custom middleware pattern — do NOT refactor to standard Express middleware. It handles token refresh in a way that breaks if separated.]
- [The `legacy/` directory is deprecated but still imported by three production modules. Do not delete anything in it.]
- [`uv` for package management, not `pip`.]

## Boundaries
- Never commit .env files or any secrets
- Never modify CI config without asking
- Never add dependencies without checking for existing alternatives first

## Workflow
- Use red/green TDD for all feature work: write the failing test first,
  confirm it fails, then implement until it passes. Do not write tests
  after implementation — they end up testing what the code happens to do
  rather than what it should do.
- Commit after each completed task with a descriptive message.
- After completing a task, append an entry to docs/log.md with: date,
  task name, what was done, and any gotchas or deviations.

## [Module-specific notes — only if truly non-obvious]
- [e.g., "The billing service uses eventual consistency — don't add synchronous validation to payment flows."]
```

## With the playbook

When the project uses the playbook, write only the project's own lines.
Leave out the Workflow section and the generic Boundaries above: boot adds
them in marked blocks (`<!-- playbook:begin core -->` …
`<!-- playbook:end core -->`) from the profile, and keeps them current.
Never edit inside those blocks; a project-specific rule goes outside them,
in the section it belongs to. Each line that has a reason worth keeping
points to it: "(D-12)" for a decisions row, or a docs/spec section.

## Hierarchical CLAUDE.md files

In Claude Code, you can place CLAUDE.md at different directory levels.
Claude Code auto-loads the one closest to where the agent is working.
Use this to scope context:

```
repo/
├── CLAUDE.md              ← project-wide rules (commands, boundaries)
├── backend/
│   └── CLAUDE.md          ← backend-specific gotchas
└── frontend/
    └── CLAUDE.md          ← frontend-specific gotchas
```

This prevents the agent from loading backend gotchas when working on
frontend code and vice versa. Each file stays small and focused.

## Maintenance mindset

Treat every line in CLAUDE.md as a signal that something in the codebase is
confusing. The right long-term response is usually to fix the underlying
problem (rename the confusing module, add a linter rule, restructure the
directory), then delete the CLAUDE.md line.

CLAUDE.md is a living list of codebase friction you haven't fixed yet —
not a permanent configuration file.
