---
inclusion: always
---

# My Prompt Manager - AI Assistant Development Guide

**Chrome Extension for AI Platform Prompt Management**

## Critical Rules for AI Assistants

### ALWAYS Do
- **Sanitize ALL user input** with DOMPurify before DOM insertion
- **Use `StorageManager` singleton** for ALL Chrome storage operations
- **Co-locate tests** in `__tests__/` directories next to source files
- **Extend `PlatformStrategy`** for new AI platform support
- **Define explicit return types** for async functions
- **Run quality checks** after each task: `npm test`, `npm run lint`, `npm run typecheck`

### NEVER Do
- **Business logic in React components** - use services and hooks instead
- **Inline scripts or CSP violations** - use proper event delegation only
- **Components without tests** - every component needs corresponding tests
- **Class components** - functional components with hooks only
- **Skip useEffect cleanup** - always prevent memory leaks
- **Direct Chrome storage calls** - use StorageManager singleton

## Architecture Patterns (Required)

### Strategy Pattern - AI Platform Integration
**When**: Adding support for new AI platforms (Claude, ChatGPT, etc.)
**Location**: `src/content/platforms/[platform]-strategy.ts`
**Steps**:
1. Extend `PlatformStrategy` base class
2. Implement: `getInsertionPoint()`, `createPromptIcon()`, `insertPrompt()`
3. Register in `PlatformManager` constructor
4. Add platform-specific tests
5. Test on actual platform pages

### Service Layer - Business Logic
**When**: All data operations and business logic
**Location**: `src/services/[serviceName].ts`
**Rules**:
- ALL Chrome storage operations MUST go through `StorageManager` singleton
- Handle storage quota limits (warn at 80%)
- Keep ALL business logic out of UI components
- Implement comprehensive error handling

### Custom Hooks - React State Management
**When**: Reusable stateful logic for React components
**Location**: `src/hooks/use[Name].ts`
**Rules**:
- State management belongs in hooks, NOT components
- Implement proper cleanup to prevent memory leaks
- Use 300ms debouncing for user input operations

## File Naming Conventions (Strict)

| Type | Pattern | Example |
|------|---------|---------|
| Components | PascalCase | `PromptCard.tsx` |
| Hooks | camelCase with `use` prefix | `usePrompts.ts` |
| Services | camelCase | `promptManager.ts` |
| Platform Strategies | kebab-case | `claude-strategy.ts` |
| Tests | Source name + `.test.ts` | `PromptCard.test.tsx` |

## Technology Stack & Standards

- **React 18.3.1** + **TypeScript 5.5.3** (strict mode)
- **Tailwind CSS 3.4.4** (utility-first, dark mode support)
- **Vite 6.3.6** (build tool with HMR)
- **Chrome Extension Manifest V3** (service workers only)

### TypeScript Rules
- Use `import type` for type-only imports
- Prefer interfaces over types for object shapes
- Explicit return types for all async functions
- Strict mode configuration required

### React Rules
- Functional components with custom hooks only
- Use `React.memo()` for performance-critical components
- Implement error boundaries and loading states
- Handle cleanup in useEffect hooks

## Security Requirements (CRITICAL)

- **Input Sanitization**: DOMPurify for ALL user content before DOM insertion
- **CSP Compliance**: No inline scripts, proper event delegation only
- **Data Validation**: Validate ALL imported configuration with error handling
- **Chrome Extension**: Service workers only, declarative permissions
- **Local Storage Only**: No external data transmission
- **Defensive Programming**: Handle platform DOM changes gracefully

## Performance & Quality Standards

### Performance Constraints
- **Content Scripts**: Keep bundles under 100KB
- **Debouncing**: 300ms for search, 500ms for auto-save
- **Memory Management**: Cleanup in useEffect hooks
- **SPA Handling**: Handle route changes with proper cleanup

### Testing Requirements
- **Coverage**: Maintain 470+ test suite
- **Chrome APIs**: Mock properly in all tests
- **Edge Cases**: Test error conditions and edge cases
- **Descriptive Names**: Test names should explain scenarios
- **Co-location**: Tests in `__tests__/` directories next to source

### Quality Gates (Run After Each Task)
```bash
npm test           # Must pass - maintain 470+ tests
npm run lint       # Must pass - no ESLint errors
npm run typecheck  # Must pass - TypeScript strict mode
```

## Common Implementation Patterns

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

### Error Handling Standards
- Provide clear, actionable error messages
- Use toast notifications for user feedback
- Implement error boundaries in React components
- Handle storage errors and network failures gracefully