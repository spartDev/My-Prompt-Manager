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
