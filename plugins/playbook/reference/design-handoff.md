# Design with Claude Design

Used when profile `design.tool` is `claude-design`. Claude Design is where
screens and the design system are explored and approved; the repository is
where the design system *lives*. Design flows to code through a handoff;
code flows back to Claude Design with `/design-sync` from Claude Code.

## Source of truth

- Tokens and components in the repository are the truth. Claude Design
  reads the repository back to stay aligned, so designs start from what the
  code actually is, deviations included.
- Never edit the same thing in both places between two syncs.
- Claude Design keeps no version history: the exported bundle saved in
  `design.handoffs` is the history.
- Screens use only the design system's components and token names: no
  one-off colours or sizes. Needing a new token name is a change to the
  design system itself (a decisions row), applied everywhere, not a local
  exception.

## The round trip

1. **Context.** Give the Claude Design project the brief and the reference
   notes, and the repository once tokens and components exist
   (`/design-sync` from Claude Code).
2. **Design** in Claude Design until approved. This is a ROADMAP task with
   `Env: **Design**`: it is yours, never delegated.
3. **Handoff.** Export → Handoff to Claude Code ("Send to local coding
   agent"), or import it from Claude Code with `/design`.
4. **Save the bundle** under `<design.handoffs><yyyy-mm-dd>-<task-id>/` in
   the landing task's PR, with a `README.md` holding the Claude Design link.
   Later sessions read intent from there instead of guessing.
5. **Land it** in the task whose `Design:` line names the design task:
   tokens into the token files (checked against the token contract),
   components using the token variables only, screens as routes.
   **Implement it, don't redesign it**: a deviation is a judgment call,
   written in the PR and the log.
6. **Review** the PR with screenshots of the implemented screen next to the
   design export. A landing task is settled by eye: Env **Local**, never the
   autopilot's.
7. **Log** the handoff: task id, design link, deviations.
8. **Sync back** with `/design-sync` before the next design round.

## References

Screenshots and material from other products are inspiration only, and
follow the research rules: they stay in `research/` (gitignored), with only
our own notes, in our own words, committed. Never copy their assets, names
or exact styles into a design or the repository.
