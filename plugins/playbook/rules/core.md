<!-- rule: core; included when: always. Lines go under these CLAUDE.md sections. Boot matches the TDD line to tdd.mode. -->

## Commands
- Never merge without reading `playbook-gh run list --branch <branch>`: nothing on GitHub requires CI.
- `git config --get core.hooksPath` must print `.githooks` (the pre-push hook is all that guards main).
- Dependency updates are Dependabot only, never a third-party app.

## Boundaries
- Never commit `.env*` except `.env.example`. Never ask for, print or write production secrets; fake what tests need.
- The one real credential is a repo-scoped GitHub PAT, borrowed per command by `playbook-gh`: never echo it, never write it to a file, never run a command carrying it with `-v`, `--debug` or `set -x`. A PreToolUse hook refusing that combination means the command was unsafe.
- Never add business information (prices, partner names, contracts). No PII (email, full IP) in events, logs or error reports.
- Other products are studied, never copied: nothing of theirs (code, assets, text, names, exact styles or values) goes into the repo or a design; keep the pattern, in our own words. Never use their unreleased content or an idea known only from their source code that isn't common practice, and never get past a login, paywall or access control. Research stays at what a normal visitor's browser receives (pages, headers, the shipped JS); ask before going further (sourcemaps, API calls, guessed paths, posing as another client).
- Committed files never name the products we study: refer to them as Source A, B…; the key stays local in `research/sources.md` (`research/` is gitignored except `notes.md`; never `git add -f` there). Grep before every commit.
- Security-sensitive tasks (SPEC → Security → Sensitive areas) are done interactively, never in cloud sessions.
- Ask before adding dependencies or changing CI. No global installs: tools live in the project.

## Workflow
- `/task <id>`, the printed `/goal` line, `/ship`, `/done`; `/milestone-review <M>` at milestone end. Settings: `.claude/profile.json`.
- Red/green TDD for feature work: the failing test is committed alone (`test: …`) before the implementation, and its red output goes in the PR description. Scaffold, spike and fixture tasks are exempt.
- Commit messages: one line, conventional commit, ≤ 72 characters. No body, no trailers, no Co-Authored-By, no "Generated with Claude Code", no session links. PR descriptions: task id, what changed, red test output; no attribution footer.
- One ROADMAP task per session. After each task: check it off in ROADMAP.md, add a log entry, and in the same PR update every doc the change made wrong (SPEC, docs/spec/*, CLAUDE.md, decisions). Architectural changes go into decisions first.
