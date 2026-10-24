<!-- rule: design; included when: design.tool is claude-design. Lines go under these CLAUDE.md sections. -->

## Product
- Design intent is in `design/handoffs/<date>-<task-id>/` (the Claude Design bundle and its link): read it before building a screen; implement it, don't redesign it. A deviation goes in the PR and the log.
- Tokens and components in the repository are the design system's truth; Claude Design reads them back with `/design-sync`. Never change the same thing in both between two syncs.
- Screens use only design-system components and token names: no raw colour or size values outside the token files (lint enforces it where it can). A new token name is a design-system change, with a decisions row.
- Material from other products is inspiration only: it stays in `research/`, never in a design or the repository.
