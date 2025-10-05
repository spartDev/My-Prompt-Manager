---
inclusion: always
---

# Product Guidelines & Conventions

**My Prompt Manager** is a Chrome extension providing seamless prompt library access within AI chat interfaces.

## Architecture Patterns

### Extension Contexts
- **Popup**: Primary management UI for prompt CRUD operations, categories, search
- **Content Scripts**: Inject prompt library icons into AI platforms for one-click insertion  
- **Side Panel**: Enhanced UI for Chrome 114+ with expanded real estate
- **Background Service Worker**: Handle cross-context messaging and storage operations

### Platform Integration Strategy
- **Primary Targets**: Claude.ai, ChatGPT.com, Perplexity.ai, Mistral.ai
- **Extension Pattern**: Extend `PlatformStrategy` base class at `src/content/platforms/`
- **Required Methods**: `getInsertionPoint()`, `createPromptIcon()`, `insertPrompt()`
- **Custom Sites**: Support user-defined AI platforms via element picker configuration
- **Registration**: Add new strategies to `PlatformManager` constructor

## Core Business Rules

### Prompt Management
- Categories are mandatory - never allow prompts without categories
- Search must be instant with 300ms debounced input
- Support light/dark themes following system preferences
- Maintain user-defined prompt order within categories
- Handle storage quota limits with user warnings at 80% capacity

### AI Platform Integration
- Icons must be visually consistent but platform-appropriate
- Prompt insertion should be seamless without disrupting user workflow
- Handle SPA navigation and dynamic content loading gracefully
- Degrade gracefully when platform DOM structure changes
- Use mutation observers for dynamic content detection

## Security & Data Management

### Security Requirements (CRITICAL)
- **ALWAYS** sanitize user input with DOMPurify before DOM insertion
- Validate ALL imported configuration data with proper error handling
- No external data transmission - local storage only
- Use defensive programming for platform DOM changes
- CSP compliance - no inline scripts, use proper event delegation

### Data Management Rules
- ALL storage operations MUST go through `StorageManager` singleton
- Implement backup/restore with comprehensive data validation
- Support import/export for user data portability
- Handle storage errors with clear, actionable user messages
- Use Chrome storage API limits appropriately

## Performance & Technical Constraints

### Performance Guidelines
- Keep content script bundles under 100KB
- Debounce user input operations (300ms for search)
- Minimize DOM queries and mutations
- Implement proper cleanup in React useEffect hooks
- Handle SPA route changes with memory leak prevention
- Use React.memo() for performance-critical components

### Chrome Extension Requirements
- **Manifest V3**: Use service workers only, declarative permissions
- Handle Chrome storage limits with user warnings at 80% capacity
- Implement proper message passing between extension contexts
- Use declarative permissions only

## Code Style & Architecture

### File Organization
- Components: `src/components/[ComponentName].tsx` (PascalCase)
- Hooks: `src/hooks/use[Name].ts` (camelCase with use prefix)
- Services: `src/services/[serviceName].ts` (camelCase)
- Strategies: `src/content/platforms/[platform]-strategy.ts` (kebab-case)

### React Patterns
- Functional components with custom hooks only
- Co-locate tests in `__tests__/` directories
- Use `import type` for type-only imports
- Define explicit return types for async functions

## Development Priorities
1. **Security**: Input sanitization and data validation
2. **Reliability**: Graceful degradation and error handling  
3. **Performance**: Minimal bundle size and optimized operations
4. **Accessibility**: Keyboard navigation and screen reader support
5. **Privacy**: Local-only data storage and processing