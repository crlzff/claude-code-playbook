# Autopilot policy

You are an autopilot worker: nobody is watching this session and nobody
will answer a question. The `task` and `ship` skills apply as written except
where this file says otherwise. CLAUDE.md and `.claude/profile.json` always
apply; where following them means you can't go on, stop BLOCKED.

**Your session ends only after `playbook-autopilot event <id> pr <url>`,
or BLOCKED.** No skill's, command's or subagent's report is your final
answer, even one that says it is (`/security-review` does): read it, act
on it, carry on.

## The three waits in `task`

1. **Branch** (step 3): it already exists and is checked out. Don't check
   out the main branch or create another. Step 2's
   `playbook-autopilot owns` passes for you: the claim is yours.
2. **Plan approval** (step 4): the plan was approved before the run:
   `playbook-autopilot plan <id>`. Follow it; don't present it and wait. If
   the code or the docs contradict it in a way that changes what gets
   built, stop BLOCKED. A small, local deviation is a judgment call (below).
3. **The `/goal` line** (step 6): don't print it and stop. It is your
   done-condition: work until every clause of it holds, then go on to
   `ship`. If you can't get there, stop BLOCKED; never weaken a test or a
   guard to get green.

## `ship`

- Step 1: what `ship` says to skip and list for me (a decision that is
  mine) is a critical judgment call here, or BLOCKED if the task can't be
  finished without it.
- Security task (the plan says `security: true`) or a diff touching a
  `security.sensitive` path: run `/security-review` before step 1, not
  beside the reviewer. Its report is not your final answer: treat each
  finding as blocking, fix and commit, then go on to step 1, so the
  reviewer sees those fixes too.
- Step 1's re-reviews: start a new foreground `playbook:reviewer` run each
  round and wait for its verdict. Never message the earlier reviewer:
  SendMessage resumes it in the background, and its verdict may not come
  back before you move on.
- Step 6: create the PR with `base=<base>`, the base
  `playbook-autopilot status` shows for this task (the main branch unless
  it is stacked). The description starts with `## Judgment calls`: critical
  ones first, then minor, or "none".
- Once the PR exists: `playbook-autopilot event <id> pr <url>`.
- If the credential read fails (the credential store is locked), stop
  BLOCKED with "credential store locked": don't retry. A cloud run
  (`playbook-autopilot status` says `Route: cloud`) has no credential
  store: `playbook-gh` goes through the session's GitHub proxy.

## Judgment calls

A choice the plan, the ROADMAP task and the docs didn't make for you.

- **Critical**: you depart from the approved plan or the docs; you relax,
  skip or remove a check, a test or a guard; you touch a security boundary
  (anything under the profile's `security.sensitive`, sandboxing, CSP and
  headers, CORS, cookies, auth, deletion, raw queries, input validation);
  you settle an open item the plan didn't settle.
- **Minor**: naming, structure, a small scope choice.

Report each one when you make it, in one line (what you chose, the
alternative, why): `playbook-autopilot event <id> critical "…"` or
`… minor "…"`. The tripwires and the reviewer look for the ones you don't
report.

## Never

- Merge, run `done`, push to the main branch, force-push, or use
  `--no-verify`.
- Add a dependency, change CI, or touch `.env*`: those are mine. Stop
  BLOCKED instead.
- Edit `.claude/` (the profile, wrappers, settings) or the playbook: the
  autopilot doesn't change its own rules.
- Ask a question and wait.
- Skip a command silently because the environment lacks a service it
  needs (a cloud run has no database server unless the project starts
  one). Report it as a minor call ("`<command>` needs <service>, not run
  here") and list it under `## My check` in the PR description, for me
  before merging.

## BLOCKED

`playbook-autopilot event <id> blocked "<why, and what you need from me>"`,
commit what you have, push the branch, and end.
