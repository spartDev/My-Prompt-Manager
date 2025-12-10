# CLAUDE.md

## What (Stack & Structure)

Chrome extension for managing prompt libraries with dual interfaces:
- **Popup/Side Panel**: React 19 + TypeScript + Tailwind CSS v4
- **Content Script**: Platform-agnostic AI site integration (Claude, ChatGPT, Perplexity)

**Tech Stack**: Manifest V3, Vite, Vitest, React Testing Library, happy-dom

**File Organization**:
```
src/
├── components/     # React UI (atomic design)
├── hooks/          # Custom React hooks
├── services/       # Business logic (StorageManager, PromptManager singletons)
├── contexts/       # React contexts
├── content/        # Content script (strategy pattern for platforms)
└── test/           # Test utilities
```

## Why (Purpose & Patterns)

**Extension UI**: Manages prompts in popup/side panel (entry: `src/popup.tsx`, `src/sidepanel.tsx`)
**Content Scripts**: Injects prompt library into AI platforms using strategy pattern
**Background Worker**: Routes side panel API calls

**Critical Patterns**:
- Singleton instances: `StorageManager.getInstance()`, `PromptManager.getInstance()`
- React 19 forms: `useActionState` for validation/submission (see `src/components/AddPromptForm.tsx`)
- Platform strategies: `BaseStrategy` → platform-specific implementations in `src/content/platforms/`
- Logger: Use `Logger` from `src/utils/logger.ts` (popup) or `@content/utils/logger` (content scripts) - never `console.*`

## How (Commands & Workflow)

**Development**:
```bash
npm run build        # Production build → dist/
npm test             # Run all tests (920+ tests)
npm run lint         # ESLint checks
npm run typecheck    # TypeScript checks
```

**Verification (MANDATORY after every change)**:
```bash
npm test && npm run lint && npm run typecheck
```
Never skip verification, even for "small changes". Test-lint-guard enforces this.

**Testing Extension**:
1. `npm run build`
2. chrome://extensions/ → Enable Developer mode → Load unpacked → select `dist/`

## Documentation Index (Progressive Disclosure)

**When you need details, consult these docs**:
- `docs/ARCHITECTURE.md` - System design, data flow, adding platforms
- `docs/COMPONENTS.md` - Component catalog with examples
- `docs/REACT_19_MIGRATION.md` - Form patterns with `useActionState`
- `docs/SERVICES_AND_HOOKS.md` - Business logic, algorithms
- `docs/DESIGN_GUIDELINES.md` - UI patterns, colors, spacing, dark mode
- `docs/TESTING.md` - Testing strategies and patterns
- `docs/PLATFORM_INTEGRATION.md` - Adding new AI platform support
- `docs/ELEMENT_FINGERPRINTING_DESIGN.md` - Custom site configuration

**Key Files for Reference**:
- Forms: `src/components/AddPromptForm.tsx`, `src/components/EditPromptForm.tsx`
- Services: `src/services/StorageManager.ts`, `src/services/PromptManager.ts`
- Content: `src/content/core/PromptLibraryInjector.ts`, `src/content/platforms/BaseStrategy.ts`
- Logging: `src/utils/logger.ts`, `src/content/utils/logger.ts`
