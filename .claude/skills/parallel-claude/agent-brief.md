## Working beside other agents

- **Scratch**: write every scratch file (logs, command output, PR body drafts) under `${TMPDIR:-/tmp}/my-prompt-manager-scratch/<branch>/`, made with `mkdir -p`. That directory is yours alone; a shared scratchpad is written by the other agents at the same moment.
- **Finish**: once `npm test && npm run lint && npm run lint:changed && npm run typecheck` is green, commit, push, and open the pull request on `.github/PULL_REQUEST_TEMPLATE.md`.
- **Hand back once**: report the PR URL and the head SHA (`git rev-parse HEAD`), then end your turn. The coordinator watches CI on every pull request and sends you any fix it needs, so your watch ends with the hand-back: no `gh pr checks --watch` or Monitor of your own.
- **Ticket**: leave it open; the coordinator closes it after the merge.
