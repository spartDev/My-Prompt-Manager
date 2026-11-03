# My Prompt Manager

Chrome extension that keeps a Library of Prompts and inserts them into AI chat platforms, through two surfaces: the React 19 popup / side panel, and content scripts injected into the platforms (`src/content/`).

Before writing or reviewing code, read `CODING_STANDARDS.md`: Verbatim Prompt text, logging, forms, colors.

Use the domain terms of `CONTEXT.md` (Prompt, Library, Category, Admission, Verbatim…) in code, tests, commits and replies.

## Done means green

After a code change, `npm test && npm run lint && npm run typecheck` passes before you call the work done.

## Work tracking

Track work in beads (`bd`). Run `bd prime` if its workflow is not already in context. A session ends with its branch pushed and a pull request open.
