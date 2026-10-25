# claude_code_playbook

One opinionated way to run software projects with Claude Code. Two parts:

- **spec-driven-dev**, a skill: decides *what* to build (SPEC, ROADMAP,
  CLAUDE.md, decisions, log). It works in Claude Code and on claude.ai.
- **playbook**, a plugin: runs *how* the work happens (a per-project profile,
  the task routine, review, git hooks, CI, an experimental autopilot).

Fork it to make it yours.

> **Experimental, use at your own risk.** It runs git, GitHub and shell
> commands in your projects. Read what it does before you rely on it, and
> review every change it proposes. It comes with no warranty and no
> support, and the authors accept no responsibility for any outcome of its
> use. See [LICENSE](LICENSE) (MIT).

## Set up

Needs `git` and the GitHub CLI (`gh`, which stays logged out), plus Node
22.18+ if you want to run the autopilot.

1. Register the marketplace (makes the playbook installable), once per
   machine:
   `claude plugin marketplace add <this repository's owner/name>` (to change the playbook,
   fork it and give the path of your clone instead).
2. Zip `spec-driven-dev/` and upload it on claude.ai (Settings →
   Capabilities → Skills). It is then available on claude.ai and in Claude
   Code sessions signed in with that claude.ai account.

Nothing else is installed. Outside your projects, the only change is the
marketplace entry Claude Code keeps in your user settings; every rule
lives in the projects that boot the playbook.

## How it works

1. **New project**: in an empty folder, switch the plugin on for it, from
   that folder and before starting Claude Code there:
   `claude plugin install playbook@playbook --scope project`. Then tell
   Claude Code what you want to build. The spec skill offers
   `/playbook:boot` first, which writes the profile, settings, git hooks and
   command wrappers, and prints a GitHub setup checklist.
2. **Spec**: the skill writes SPEC, ROADMAP, CLAUDE.md, decisions and the
   log, right there in Claude Code. You can also write the spec on
   claude.ai and drop the files into the folder.
3. **`/playbook:boot` again**: it reads the spec and adds the stack, the
   commands, the sensitive areas, CI, Dependabot and the CLAUDE.md rules,
   then pushes (once the GitHub repository from the checklist exists).
4. **Each task**: `/task <id>` (plan, red test) → paste the `/goal` line (in
   the terminal; the VS Code panel may not know `/goal`) →
   `/ship` (review, verify, PR) → `/done` (merge on green CI).
   `/milestone-review` at the end of each milestone.
5. **Keeping current**: update the plugin (`claude plugin update
   playbook@playbook`, or `git pull` if you use a clone); then
   `/playbook:doctor` in a project shows its drift and fixes what you
   approve.

## Main decisions

- **Spec first, one task per conversation.** Every task comes from the
  ROADMAP, with its acceptance criteria and the test that proves it.
- **Red/green TDD.** For each feature task the failing test is written
  first and committed alone, with a stub of the code so it fails on its
  assertions rather than on a missing file; its red output goes in the PR.
  Then the code, until the test passes. Scaffold, spike and fixture tasks
  are exempt, and a small project can relax it in its profile.
- **Review by fresh eyes**: three read-only reviewers in parallel, with a
  security review on sensitive code. Review is the bottleneck, so
  parallel work is allowed only where a command settles the result.
- **GitHub without a logged-in `gh`**: one repository-scoped token per
  project, borrowed for a single command; a hook blocks commands that could
  print it.
- **The main branch takes PRs only**; nothing merges before CI is read.
- **Rules live in each project's CLAUDE.md**, not on the machine, so every
  session and every machine follows them.
- **Other products are studied, never copied**, and never named in
  committed files.
- **An autopilot, experimental and off by default.** It runs the ROADMAP
  tasks whose plans you approved while you're away, locally or in a cloud
  session, and opens their PRs.

## Credits

Much of the inspiration behind the playbook comes from
[Addy Osmani](https://addyosmani.com)'s writing on
[his blog](https://addyosmani.com/blog/) about working with AI coding
agents: spec first, small tasks with tests that prove them, and
treating human review as the real bottleneck.
