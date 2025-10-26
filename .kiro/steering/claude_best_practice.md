---
inclusion: always
---

# AI Assistant Quick Reference

## Critical Safety Rules (NEVER BREAK)

### Security & Data Safety
- **ALWAYS** sanitize user input with `DOMPurify` before DOM insertion
- **NEVER** use inline scripts - CSP violations will break the extension
- **ONLY** use `StorageManager` singleton for Chrome storage - never direct calls
- **ALWAYS** validate imported data before processing

### Code Safety
- **NEVER** put business logic in React components - use services/hooks
- **ALWAYS** create tests alongside new files - no exceptions
- **NEVER** skip `useEffect` cleanup - prevents memory leaks
- **ALWAYS** use functional components with hooks - no class components

## Quality Gates (Run After Each Task)

```bash
npm test           # Must pass - maintain 470+ tests
npm run lint       # Must pass - zero ESLint errors
npm run typecheck  # Must pass - TypeScript strict mode
```

## Quick Decision Tree

**Adding UI?** → `src/components/ComponentName.tsx` + test file
**Adding logic?** → `src/services/serviceName.ts` + hook + tests  
**Adding AI platform?** → `src/content/platforms/platform-strategy.ts` + tests
**Adding utility?** → `src/utils/utilName.ts` + test

## Common Pitfalls to Avoid

### Performance Killers
- Content script bundles >100KB
- Missing debouncing on user input (use 300ms)
- Forgetting cleanup in useEffect hooks
- Not handling SPA route changes

### Breaking Changes
- Direct Chrome storage calls (use `StorageManager`)
- Business logic in components (use services)
- Missing error boundaries in React
- Skipping input sanitization

### Test Failures
- Not mocking Chrome APIs properly
- Missing edge case testing
- Vague test descriptions
- Forgetting to test error conditions

## File Naming Quick Reference

- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Services: `camelCase.ts`
- Strategies: `kebab-case.ts`
- Tests: `SourceName.test.ts`