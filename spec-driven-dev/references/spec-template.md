# SPEC.md Template

Use this template when drafting a project specification. Adapt sections to fit
the project — not every project needs every section. Remove what's irrelevant,
but never skip starred (*) sections; those are always needed.

Aim for under 2,000 words total. If the spec grows longer, split it: keep the
starred sections in SPEC.md as the summary that agents load every session, and
move detailed reference sections (data model, API design, detailed user
journeys) into separate files in a `docs/` folder that get loaded only when
relevant.

---

```markdown
# [Project Name] — Specification

## Vision *

[One-sentence elevator pitch. What is this and why does it exist?]

## Users and Problem *

[Who is this for? What specific problem does it solve? Be concrete about
the pain point. Write it so a non-technical person would understand.]

## Success Criteria *

[What does "done" look like? List concrete, testable conditions.
These become your acceptance tests.]

- [ ] [User can do X]
- [ ] [System handles Y correctly]
- [ ] [Performance meets Z threshold]

## Non-Goals *

[What are we explicitly NOT building? Agents will fill ambiguity with
assumptions — non-goals prevent them from over-building. Be specific.]

- Not building X
- Not supporting Y in this version
- Out of scope: Z

## Open Questions *

[Things you haven't decided yet. It's better to name them than to let
agents guess. Every unnamed ambiguity becomes an agent assumption that
compounds. Remove individual questions as they're resolved, but keep the
section header — an empty Open Questions section confirms nothing was
left unnamed.]

- [ ] [Decision needed: X or Y approach for Z?]
- [ ] [Unclear: how should the system handle edge case Q?]
- [ ] [TBD: which third-party service for R?]

## User Journeys

[Walk through 1-3 key user flows step by step. What does the user do?
What do they see? What happens when things go wrong? Error cases are
as important as happy paths — agents need to know both.]

### Journey 1: [Name]
1. User does X
2. System responds with Y
3. User sees Z

### Error case: [Name]
1. User does X incorrectly
2. System responds with clear error message
3. User can recover by doing Y

## Tech Stack *

[Be specific with names and versions. Vague stacks produce vague code.]

- Frontend: [e.g., React 18, TypeScript 5.x, Vite 6, Tailwind CSS 4]
- Backend: [e.g., Python 3.12, FastAPI, PostgreSQL 16, SQLAlchemy 2]
- Testing: [e.g., Vitest for unit, Playwright for e2e]
- Deployment: [e.g., Fly.io, Render, a Docker host]

## Architecture

[How components connect. Data flow, module boundaries, API surface.
Keep it high-level. A few clear sentences are better than a vague
diagram. Complex systems might need more detail — if so, put the
detailed version in docs/architecture.md and summarize here.]

## Data Model

[Entities and their relationships. Even a rough schema helps agents
enormously — they anchor on this when generating code.]

### [Entity Name]
- id: uuid (primary key)
- field_name: type — description
- created_at: timestamp

### Relationships
- [Entity A] has many [Entity B]
- [Entity B] belongs to [Entity A]

## API / Interface Design

[Key endpoints, routes, or interfaces. Include request/response shapes
for the most important ones. Skip this for purely frontend projects.
For large APIs, move the full reference to docs/api.md and list only
the most critical endpoints here.]

### POST /api/[resource]
- Request: `{ field: type }`
- Response: `{ id: uuid, field: type }`
- Errors: 400 (validation), 401 (unauthorized)

## Commands *

[Full executable commands with flags. Agents reference these constantly.
Include every command someone needs to go from clone to running.]

- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`
- Type check: `npx tsc --noEmit`
- Database migrate: `npm run db:migrate`

## Project Structure *

[Where things live. Be explicit. Agents use this to know where to put
new files and where to find existing ones.]

```
src/             — Application source code
  components/    — UI components
  routes/        — API routes or pages
  lib/           — Shared utilities and helpers
  types/         — TypeScript type definitions
  db/            — Database schema and migrations
tests/           — Test files (mirror src/ structure)
docs/            — Project documentation and devlog
public/          — Static assets
scripts/         — Build and deploy scripts
```

## Code Style

[One real code snippet showing your conventions is worth more than
paragraphs of description. Include naming, formatting, import order.]

```typescript
// Example: typical component style for this project
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Task } from "@/types";

export function TaskCard({ task }: { task: Task }) {
  const [isOpen, setIsOpen] = useState(false);
  // ...
}
```

## Testing Strategy *

[Be specific. This section directly impacts agent output quality —
agents with good test suites produce dramatically better code.]

- Unit tests: [framework] in [location], covering [what]
- Integration tests: [framework] in [location], covering [what]
- E2E tests: [framework] in [location], covering [key user flows]
- Coverage target: [e.g., >80% for business logic]
- TDD workflow: For every feature task, write the test first based on the
  acceptance criteria. Run it to confirm it fails (red phase). Then
  implement until it passes (green phase). Then refactor if needed. This
  sequence is not ceremony — it's the mechanism that prevents agents from
  writing tests that pass regardless of whether the implementation is
  correct. Scaffold tasks (project init, config, tooling) are exempt.

## Git Workflow

[Branch naming, commit format, PR requirements.]

- Branch naming: `type/short-description` (e.g., `feat/user-auth`)
- Commit format: conventional commits (`feat:`, `fix:`, `refactor:`, etc.)
- PRs: must include description, test evidence, and pass CI

[With the playbook, replace this section's bullets with one line: "How work
runs: `.claude/profile.json` and the playbook's routine."]

## Security *[if project touches auth, payments, user data, or untrusted input]

[This section is required — not optional — when the project handles
authentication, payments, personal data, or accepts untrusted input.
45% of AI-generated code contains security flaws. Be explicit about
your security approach so agents don't introduce vulnerabilities.]

- Auth approach: [e.g., JWT with httpOnly cookies, OAuth2 via provider X]
- Data handling: [what's encrypted, what's hashed, PII handling]
- Input validation: [strategy for untrusted input — sanitization, CSP]
- Sensitive areas: [each area and where it lives, planned paths included:
  "auth — `src/auth/`", "account deletion — `src/jobs/delete-account.ts`".
  These get interactive work (or the autopilot's security gates),
  line-by-line review and a security review.]
- Secrets management: [how secrets are stored and accessed — env vars,
  vault, etc. Never committed to repo, never in a cloud environment.]
```
