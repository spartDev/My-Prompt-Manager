---
inclusion: always
---

# Technology Stack & Development Guidelines

## Critical Rules for AI Assistants

### MUST Always Do
- **ALWAYS** sanitize user input with DOMPurify before DOM insertion
- **ALWAYS** use `StorageManager` singleton for Chrome storage operations
- **ALWAYS** define explicit return types for async functions
- **ALWAYS** co-locate tests in `__tests__/` directories
- **ALWAYS** extend `PlatformStrategy` for new AI platform support
- **ALWAYS** validate imported configuration data with proper error handling

### NEVER Do
- **NEVER** put business logic in React components - use services and hooks
- **NEVER** use inline scripts or CSP-violating event handling
- **NEVER** create components without corresponding tests
- **NEVER** use class components - functional components only
- **NEVER** skip cleanup in useEffect hooks

## Core Technology Stack

- **React 18.3.1**: Functional components with custom hooks only
- **TypeScript 5.5.3**: Strict mode, explicit async return types required
- **Tailwind CSS 3.4.4**: Utility-first styling, system dark mode support
- **Vite 6.3.6**: Build tool with HMR, separate extension context bundles
- **Chrome Extension Manifest V3**: Service workers, declarative permissions only

## Architecture Implementation Patterns

### Strategy Pattern (AI Platform Integration)
**When to use**: Adding support for new AI platforms
**Location**: `src/content/platforms/[platform]-strategy.ts`
**Steps**:
1. Extend `PlatformStrategy` base class
2. Implement required methods: `getInsertionPoint()`, `createPromptIcon()`, `insertPrompt()`
3. Register in `PlatformManager` constructor
4. Add comprehensive tests for platform-specific DOM handling

### Service Layer Pattern
**When to use**: All business logic and data operations
**Location**: `src/services/[serviceName].ts`
**Rules**:
- Use singleton pattern for `StorageManager`
- Handle Chrome storage quota limits with user warnings at 80%
- Implement proper error handling with user-friendly messages
- Keep all business logic out of UI components

### Custom Hook Pattern
**When to use**: Reusable stateful logic for React components
**Location**: `src/hooks/use[Name].ts`
**Rules**:
- State management logic belongs in hooks, NOT components
- Implement proper cleanup to prevent memory leaks
- Use debouncing for user input operations (300ms standard)

## Code Style & Naming Conventions

### File Naming (Strict)
- **Components**: PascalCase (`PromptCard.tsx`)
- **Hooks**: camelCase with `use` prefix (`usePrompts.ts`)
- **Services**: camelCase (`promptManager.ts`)
- **Platform Strategies**: kebab-case (`claude-strategy.ts`)
- **Tests**: Source name + `.test.ts` suffix

### TypeScript Standards
- Use `import type` for type-only imports
- Prefer interfaces over types for object shapes
- Define explicit return types for all async functions
- Use strict mode configuration

### React Standards
- Functional components with custom hooks exclusively
- Use React.memo() for performance-critical components
- Implement proper error boundaries
- Handle loading and error states consistently

## Security & Performance Constraints

### Security Requirements (CRITICAL)
- **Input Sanitization**: Use DOMPurify for all user content before DOM insertion
- **CSP Compliance**: No inline scripts, use proper event delegation
- **Data Validation**: Validate ALL imported configuration with error handling
- **Chrome Extension**: Use service workers only, declarative permissions

### Performance Constraints
- **Bundle Size**: Keep content scripts under 100KB
- **Debouncing**: 300ms for search operations, 500ms for auto-save
- **Memory Management**: Implement cleanup in useEffect hooks
- **SPA Handling**: Handle route changes with proper cleanup to prevent leaks

## Testing & Quality Standards

### Required Test Coverage
- Maintain 470+ test suite
- Mock Chrome APIs properly in all tests
- Test error conditions and edge cases
- Use descriptive test names explaining scenarios

### Development Workflow
```bash
npm run dev              # Development with HMR
npm run build           # Production build
npm test                # Run full test suite
npm run lint:fix        # Auto-fix code issues
npm run typecheck       # TypeScript validation
npm run package         # Chrome Web Store package
```

### Quality Gates
- All tests must pass before code changes
- TypeScript strict mode compliance required
- ESLint rules must be followed
- No console.log statements in production code