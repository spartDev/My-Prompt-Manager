---
inclusion: always
---

# Project Structure & Code Organization Guide

## Code Organization Decision Tree

**Need to add UI functionality?** → `src/components/[ComponentName].tsx` (PascalCase)
**Need to manage state/data?** → `src/hooks/use[Name].ts` (camelCase with `use` prefix)  
**Need business logic/data operations?** → `src/services/[serviceName].ts` (camelCase)
**Need AI platform integration?** → `src/content/platforms/[platform]-strategy.ts` (kebab-case)
**Need shared utilities?** → `src/utils/[utilName].ts` (camelCase)
**Need type definitions?** → `src/types/[typeName].ts` (camelCase)

## File Naming Conventions (Strict)

| Code Type | Naming Pattern | Location | Example |
|-----------|---------------|----------|---------|
| React Components | PascalCase | `src/components/` | `PromptCard.tsx` |
| Custom Hooks | `use` + camelCase | `src/hooks/` | `usePrompts.ts` |
| Services | camelCase | `src/services/` | `promptManager.ts` |
| Platform Strategies | kebab-case | `src/content/platforms/` | `claude-strategy.ts` |
| Utilities | camelCase | `src/utils/` | `textHighlight.ts` |
| Types | camelCase | `src/types/` | `components.ts` |
| Tests | Source name + `.test.ts` | `__tests__/` | `PromptCard.test.tsx` |

## Directory Structure & Purpose

```
src/
├── components/              # React UI components (PascalCase files)
│   ├── settings/           # Settings-specific components
│   ├── icons/              # Icon components
│   └── __tests__/          # Component tests (co-located)
├── content/                # Content script architecture
│   ├── platforms/          # AI platform integration strategies
│   ├── core/               # Core injection logic
│   ├── ui/                 # UI injection utilities
│   ├── utils/              # Content script utilities
│   └── types/              # Content script type definitions
├── services/               # Business logic & data operations
├── hooks/                  # React state management hooks
├── types/                  # Shared TypeScript definitions
├── utils/                  # Shared utility functions
├── contexts/               # React context providers
└── constants/              # Application constants
```

## Architecture Pattern Selection

### When to Use Strategy Pattern
- **Trigger**: Adding support for new AI platforms (Claude, ChatGPT, Gemini, etc.)
- **Location**: `src/content/platforms/[platform]-strategy.ts`
- **Action**: Extend `PlatformStrategy` base class, implement required methods

### When to Use Service Layer
- **Trigger**: Need data operations, business logic, or Chrome API interactions
- **Location**: `src/services/[serviceName].ts`
- **Action**: Create service class, use singleton pattern for stateful services

### When to Use Custom Hooks
- **Trigger**: Need reusable stateful logic for React components
- **Location**: `src/hooks/use[Name].ts`
- **Action**: Extract state management from components into custom hooks

## Common Task Workflows

### Adding New AI Platform Support
1. Create `src/content/platforms/[platform]-strategy.ts` (kebab-case)
2. Extend `PlatformStrategy` base class
3. Implement: `getInsertionPoint()`, `createPromptIcon()`, `insertPrompt()`
4. Register in `PlatformManager` constructor
5. Add tests in `src/content/platforms/__tests__/[platform]-strategy.test.ts`

### Adding New React Component
1. Create `src/components/[ComponentName].tsx` (PascalCase)
2. Create test `src/components/__tests__/[ComponentName].test.tsx`
3. Export from `src/components/index.ts` if needed
4. Use functional components with hooks only

### Adding Business Logic
1. Create service `src/services/[serviceName].ts` (camelCase)
2. Create hook `src/hooks/use[ServiceName].ts` for React integration
3. Add tests in respective `__tests__/` directories
4. Use `StorageManager` singleton for Chrome storage operations

### Adding Shared Utilities
1. Create `src/utils/[utilName].ts` (camelCase)
2. Add tests in `src/utils/__tests__/[utilName].test.ts`
3. Export from `src/utils/index.ts`

## File Creation Rules

### Always Create Together
- **Component** → Always create corresponding test file
- **Service** → Create service + hook + tests
- **Platform Strategy** → Create strategy + tests + register in manager

### Import Organization (Enforce Order)
1. Node.js built-in modules
2. External npm packages  
3. Internal modules (relative imports)
4. Type-only imports (`import type`)

### Test Co-location
- Place tests in `__tests__/` directory next to source files
- Use descriptive test names that explain scenarios
- Mock Chrome APIs properly in all tests

## Critical Structural Rules

1. **Component Logic**: Keep components pure - move state to hooks, business logic to services
2. **Storage Operations**: ALL Chrome storage MUST go through `StorageManager` singleton
3. **Test Coverage**: Every new file requires corresponding test file
4. **Naming Consistency**: Follow naming patterns exactly - no exceptions
5. **Architecture Patterns**: Use Strategy for platforms, Services for business logic, Hooks for state