---
inclusion: always
---

# Project Structure & Architecture Guidelines

## Critical Architecture Patterns

### Strategy Pattern for AI Platform Integration
**When to use**: Adding support for new AI platforms (Claude, ChatGPT, etc.)
**Location**: `src/content/platforms/`
**Implementation**:
1. Extend `PlatformStrategy` base class
2. Implement required methods: `getInsertionPoint()`, `createPromptIcon()`, `insertPrompt()`
3. Register in `PlatformManager` constructor
4. Use kebab-case naming: `[platform]-strategy.ts`

### Service Layer Pattern
**When to use**: All business logic and data operations
**Location**: `src/services/`
**Critical Rule**: ALL Chrome storage operations MUST go through `StorageManager` singleton
**Key Services**: `StorageManager`, `PromptManager`
**Naming**: camelCase (e.g., `promptManager.ts`)

### Custom Hook Pattern
**When to use**: Reusable stateful logic for React components
**Location**: `src/hooks/`
**Critical Rule**: State management logic belongs in hooks, NOT components
**Naming**: camelCase with `use` prefix (e.g., `usePrompts.ts`)

## File Naming & Organization Rules

### Strict Naming Conventions
- **Components**: PascalCase (`PromptCard.tsx`)
- **Hooks**: camelCase with `use` prefix (`usePrompts.ts`)
- **Services**: camelCase (`promptManager.ts`)
- **Platform Strategies**: kebab-case (`claude-strategy.ts`)
- **Tests**: Source name + `.test.ts` suffix

### Directory Structure
```
src/
├── components/           # React components (PascalCase)
│   ├── settings/        # Settings-specific components
│   └── __tests__/       # Co-located component tests
├── content/             # Content script architecture
│   ├── platforms/       # Platform strategy implementations
│   ├── ui/             # UI injection utilities
│   ├── utils/          # Content script utilities
│   └── core/           # Core injection logic
├── services/           # Business logic (camelCase)
├── hooks/              # React hooks (use[Name].ts)
├── types/              # TypeScript definitions
└── utils/              # Shared utilities
```

## Extension Points & Implementation Steps

### Adding New AI Platform Support
1. Create `src/content/platforms/[platform]-strategy.ts`
2. Extend `PlatformStrategy` base class
3. Implement DOM integration methods
4. Add to `PlatformManager` constructor
5. Test on actual platform pages

### Adding New Components
1. Create `src/components/[ComponentName].tsx` (PascalCase)
2. Add test in `src/components/__tests__/[ComponentName].test.tsx`
3. Export from appropriate index file
4. Use functional components with hooks only

### Adding Business Logic
1. Create service in `src/services/[serviceName].ts` (camelCase)
2. Create hook in `src/hooks/use[ServiceName].ts`
3. Add comprehensive tests in `__tests__/` directories
4. Use singleton pattern for stateful services

## Code Organization Standards

### Import Order (Enforce Strictly)
1. Built-in modules (Node.js)
2. External libraries (npm packages)
3. Internal modules (relative imports)
4. Type-only imports (`import type`)

### Testing Requirements
- **Location**: Co-located `__tests__/` directories
- **Coverage**: Maintain 470+ test suite
- **Naming**: Descriptive test names explaining scenarios
- **Chrome APIs**: Always mock properly in tests

## Critical Rules for AI Assistants

1. **NEVER** put business logic in React components - use services and hooks
2. **ALWAYS** use `StorageManager` for Chrome storage operations
3. **ALWAYS** co-locate tests with source files
4. **ALWAYS** follow naming conventions exactly
5. **ALWAYS** extend `PlatformStrategy` for new AI platform support
6. **NEVER** create components without corresponding tests