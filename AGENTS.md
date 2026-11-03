# My Prompt Manager

Chrome extension that keeps a Library of Prompts and inserts them into AI chat platforms, through two surfaces: the React 19 popup / side panel, and content scripts injected into the platforms (`src/content/`).

Before writing or reviewing code, read `CODING_STANDARDS.md`: Verbatim Prompt text, logging, forms, colors.

Use the domain terms of `CONTEXT.md` (Prompt, Library, Category, Admission, Verbatim…) in code, tests, commits and replies.

## Done means green

After a code change, `npm test && npm run lint && npm run lint:changed && npm run typecheck` passes before you call the work done. `npm run lint` tolerates the warnings `main` already has; `lint:changed` fails on any warning in a file the branch changes, old ones included, so fix those in the files you touch.

A pull request is done when its CI checks are green. The e2e job takes about 10 minutes, longer than a foreground command may run: watch `gh pr checks <number> --watch` in the background.

## Work tracking

Track work in beads (`bd`). Run `bd prime` if its workflow is not already in context. A session ends with its branch pushed, a pull request open on `.github/PULL_REQUEST_TEMPLATE.md`, and its checks green.

Hand off in beads: `bd update <id> --append-notes` on the ticket or its epic, or `bd remember`, where the next session reads it with `bd show` or `bd memories`. A temp folder is not a handoff: a reboot can clear it.
