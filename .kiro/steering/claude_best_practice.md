---
inclusion: always
---

# Development Best Practices

## Architecture Patterns

### Strategy Pattern (AI Platform Integration)
- Extend `PlatformStrategy` base class for new AI platforms
- Implement: `getInsertionPoint()`, `createPromptIcon()`, `insertPrompt()`
- Register in `PlatformManager` at `src/content/platforms/`
- Handle platform-specific DOM selectors and dynamic content

### Service Layer
- Use `StorageManager` singleton for all Chrome storage operations
- Keep business logic in `src/services/`, not UI components
- Implement error handling and validation in all service methods

## Code Standards

### TypeScript
- Use `import type` for type-only imports
- Define explicit return types for async functions
- Prefer interfaces over types for object shapes

### React
- Functional components with custom hooks only
- PascalCase for components, camelCase for utilities
- Co-locate tests in `__tests__/` directories
- Use React.memo() for performance-critical components

### File Naming
- Components: `PromptCard.tsx`
- Hooks: `usePrompts.ts`
- Services: `promptManager.ts`
- Strategies: `claude-strategy.ts`

## Security Requirements

### Content Script Safety
- **ALWAYS** sanitize user input with DOMPurify before DOM insertion
- Use CSP-compliant event handling (no inline scripts)
- Validate all imported configuration data
- Implement defensive programming for platform DOM changes

### Chrome Extension Security
- Use service workers (Manifest V3)
- Handle storage quota limits gracefully
- Implement proper message passing between contexts
- Use declarative permissions only

## Performance Guidelines

- Keep content script bundles minimal (<100KB)
- Debounce user input operations (300ms for search)
- Use mutation observers for dynamic content detection
- Implement proper cleanup in useEffect hooks
- Handle SPA route changes with cleanup to prevent memory leaks

## Testing Requirements

**Always run after each task:**
- `npm run test` (maintain 470+ test coverage)
- `npm run lint`
- `npm run typecheck`

**Test Standards:**
- Mock Chrome APIs properly
- Test error conditions and edge cases
- Use descriptive test names explaining scenarios
- Test content script injection on real platform pages

## Error Handling

- Provide clear, actionable error messages
- Use toast notifications for user feedback
- Implement error boundaries in React components
- Handle storage errors and network failures gracefully
- Use appropriate logging levels (dev vs production)