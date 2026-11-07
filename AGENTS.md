# My Prompt Manager

Chrome extension that keeps a Library of Prompts and inserts them into AI chat platforms, through two surfaces: the React 19 popup / side panel, and content scripts injected into the platforms (`src/content/`).

Before writing or reviewing code, read `CODING_STANDARDS.md`: Verbatim Prompt text, logging, forms, colors, and updating every doc that states a count, limit or version you change.

Use the domain terms of `CONTEXT.md` (Prompt, Library, Category, Admission, Verbatim…) in code, tests, commits and replies.

Building, restyling or reviewing anything the user sees in the popup, side panel or Analytics page starts with the `design-system` skill (`.claude/skills/design-system/SKILL.md`). It routes into `docs/DESIGN_GUIDELINES.md` section by section and says where the Atelier 1C mockups are, so load it before grepping the code for a token, a focus class or an animation rule.

## Done means green

After a code change, `npm test && npm run lint && npm run lint:changed && npm run typecheck` passes before you call the work done. `npm run lint` tolerates the warnings `main` already has; `lint:changed` fails on any warning in a file the branch changes, old ones included, so fix those in the files you touch.

A pull request is done when its CI checks are green. The e2e job takes about 10 minutes, longer than a foreground command may run: watch `gh pr checks <number> --watch` in the background.

## Work tracking

Track work in beads (`bd`). Run `bd prime` if its workflow is not already in context. A session ends with its branch pushed, a pull request open on `.github/PULL_REQUEST_TEMPLATE.md`, and its checks green.

Any question about the backlog, whatever the words (what is left, list the tickets, triage, rank, group them, what can run in parallel; liste les tickets, ordre de priorité, regrouper, en parallèle), goes through the `triage-beads` skill (`.claude/skills/triage-beads/SKILL.md`): one compact listing read once, `bd show` only on the tickets that need a decision, and the groups of tickets that can run side by side. Do not loop `bd show` over the backlog.

Hand off in beads: `bd update <id> --append-notes` on the ticket or its epic, or `bd remember`, where the next session reads it with `bd show` or `bd memories`. A temp folder is not a handoff: a reboot can clear it.
