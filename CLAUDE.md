# My Prompt Manager

Chrome extension for managing prompt libraries with React 19 popup/side panel and content script injection into AI platforms.

## Verification

Run after every code change:

```bash
npm test && npm run lint && npm run typecheck
```

## Critical Patterns

- **Singletons**: Use `StorageManager.getInstance()`, `PromptManager.getInstance()`
- **Logger**: Use `Logger` from `src/utils/logger.ts` (popup) or `@content/utils/logger` (content scripts) - never `console.*`
- **React 19 forms**: Use `useActionState` for validation/submission
- **Platform strategies**: Extend `BaseStrategy` in `src/content/platforms/`

## Workflow

- **Issue tracking**: [Beads Workflow](.claude/docs/BEADS_WORKFLOW.md)
- **Ending sessions**: [Session Protocol](.claude/docs/SESSION_PROTOCOL.md)

## Documentation

| Topic | Location |
|-------|----------|
| Architecture & data flow | `docs/ARCHITECTURE.md` |
| Component catalog | `docs/COMPONENTS.md` |
| React 19 form patterns | `docs/REACT_19_MIGRATION.md` |
| Services & hooks | `docs/SERVICES_AND_HOOKS.md` |
| UI design system | `docs/DESIGN_GUIDELINES.md` |
| Testing patterns | `docs/TESTING.md` |
| Adding AI platforms | `docs/PLATFORM_INTEGRATION.md` |
| Custom site config | `docs/ELEMENT_FINGERPRINTING_DESIGN.md` |


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
