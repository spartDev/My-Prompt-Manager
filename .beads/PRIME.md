# Beads workflow

Work is tracked in beads (`bd`). This text is injected at session start; run `bd prime` after a compaction or a clear if it is gone.

## Tickets

- `bd ready` — the open tickets nothing blocks. `bd show <id>` — a ticket's description, design, acceptance criteria and notes; read it before writing code.
- `bd update <id> --claim` — claim a ticket when you start on it.
- `bd create --title="…" --description="why it exists, what to do" --acceptance="how to prove it" --type=task|bug|feature|chore --priority=2 [--parent=<epic>]` — every ticket has acceptance criteria. Priority 0-4 (0 critical, 2 medium, 4 backlog).
- `bd update <id> --append-notes "…"` — add a note: a finding, a handoff for the next session, proof. The flag that replaces a ticket's notes is blocked by a hook.
- `bd close <id> --reason="…"` — close with the proof: test output, e2e evidence, screenshots light and dark for UI. Never close without it.
- `bd remember "…"` keeps a fact every session needs (the memories below); `bd memories <keyword>` searches them, `bd remember --key <key> "…"` updates one, `bd forget <key>` removes one.
- Never `bd edit`: it opens an editor and blocks the session.

## A session

1. `bd ready`, `bd show <id>`, `bd update <id> --claim`.
2. Work on a branch; before calling it done, `npm test && npm run lint && npm run lint:changed && npm run typecheck` passes.
3. Hand off in beads (`bd update <id> --append-notes`, or `bd remember`), not in a temp folder.
4. End as AGENTS.md says: branch pushed, pull request open on `.github/PULL_REQUEST_TEMPLATE.md`, checks green. Then `bd close <id> --reason="<proof>"`.

Backlog questions (ranking, priorities, duplicates): the `triage-beads` skill.
