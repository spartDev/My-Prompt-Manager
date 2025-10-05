# Code Style & Conventions

## TypeScript Configuration
- **Strict mode enabled**: All strict TypeScript checks
- **Target**: ES2020 with DOM support
- **Module**: ESNext with node resolution
- **JSX**: react-jsx (React 18 transform)

## ESLint Rules
- **TypeScript**: Strict type checking with recommended rules
- **React**: React 18 best practices, hooks rules
- **Import**: Alphabetical ordering with newlines between groups
- **Accessibility**: jsx-a11y recommended rules

## Naming Conventions
- **Components**: PascalCase (e.g., `PromptCard.tsx`)
- **Hooks**: camelCase with "use" prefix (e.g., `usePrompts.ts`)
- **Services**: camelCase (e.g., `storageManager.ts`)
- **Types**: PascalCase interfaces (e.g., `Prompt`, `Category`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_PROMPTS`)

## File Organization
```
src/
├── components/     # React UI components (atomic design)
├── hooks/         # Custom React hooks
├── services/      # Business logic (singletons)
├── contexts/      # React contexts
├── types/         # TypeScript type definitions
├── utils/         # Pure utility functions
└── content/       # Content script modules
    ├── core/      # Main orchestration
    ├── platforms/ # Platform strategies
    ├── ui/        # UI components
    └── utils/     # Content script utilities
```

## Import Order (ESLint enforced)
1. Built-in modules
2. External dependencies
3. Internal modules
4. Parent/sibling imports
5. Index imports

## Content Script Patterns
- **Strategy Pattern**: Platform-specific implementations extend `BaseStrategy`
- **Factory Pattern**: UI elements created via `UIElementFactory`
- **Singleton Pattern**: Storage and managers as singletons
- **Event-driven**: Use `EventManager` for cleanup

## Security Practices
- Always sanitize user input with DOMPurify
- Use helper methods for DOM element creation
- Validate external data from storage/messages
- Implement comprehensive error handling
- Never use innerHTML for dynamic content