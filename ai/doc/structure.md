# Project Structure & Organization

## Root Structure

```
├── src/                    # Source code
├── public/                 # Static assets (icons)
├── dist/                   # Build output (generated)
├── docs/                   # Documentation
├── ai/                     # AI assistant context and requirements
├── coverage/               # Test coverage reports (generated)
├── manifest.json           # Chrome extension manifest
├── package.json            # Dependencies and scripts
└── vite.config.ts          # Build configuration
```

## Source Code Organization (`src/`)

### React Components (`src/components/`)
- **Main Components**: App.tsx, LibraryView.tsx, PromptCard.tsx
- **Forms**: AddPromptForm.tsx, EditPromptForm.tsx
- **UI Elements**: SearchBar.tsx, CategoryFilter.tsx, ThemeToggle.tsx
- **Settings**: `settings/` subfolder for settings-related components
- **Icons**: `icons/` subfolder for icon components
- **Tests**: `__tests__/` subfolders for component tests

### Content Script Architecture (`src/content/`)
```
src/content/
├── index.ts                # Main entry point
├── core/                   # Core functionality
│   ├── injector.ts         # Main orchestration class
│   └── insertion-manager.ts # Platform insertion coordination
├── platforms/              # Platform-specific strategies
│   ├── base-strategy.ts    # Abstract base class
│   ├── claude-strategy.ts  # Claude.ai implementation
│   ├── chatgpt-strategy.ts # ChatGPT implementation
│   ├── perplexity-strategy.ts # Perplexity implementation
│   └── platform-manager.ts # Strategy coordinator
├── ui/                     # UI components for content script
│   ├── element-factory.ts  # Element creation
│   ├── event-manager.ts    # Event handling
│   └── keyboard-navigation.ts # Keyboard support
├── utils/                  # Utility modules
│   ├── dom.ts             # DOM utilities
│   ├── logger.ts          # Debug logging
│   ├── storage.ts         # Chrome storage wrapper
│   ├── styles.ts          # Style injection
│   └── theme-manager.ts   # Theme synchronization
└── types/                  # TypeScript definitions
    ├── platform.ts        # Platform interfaces
    └── ui.ts              # UI component types
```

### Supporting Modules
- **`src/hooks/`**: Custom React hooks (usePrompts, useCategories, useClipboard)
- **`src/contexts/`**: React context providers (ThemeContext)
- **`src/services/`**: Business logic (promptManager, storage)
- **`src/types/`**: TypeScript type definitions
- **`src/utils/`**: Shared utilities (debounce)
- **`src/background/`**: Background service worker

## File Naming Conventions

- **React Components**: PascalCase (e.g., `PromptCard.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `usePrompts.ts`)
- **Utilities**: camelCase (e.g., `debounce.ts`)
- **Types**: camelCase (e.g., `index.ts`)
- **Tests**: Same as source file + `.test.ts` suffix
- **Strategies**: kebab-case + `-strategy.ts` suffix

## Import/Export Patterns

- Use barrel exports in `index.ts` files for clean imports
- Prefer named exports over default exports
- Group imports: external libraries, internal modules, types
- Use absolute imports from `src/` root when beneficial

## Testing Structure

- **Unit Tests**: Alongside source files in `__tests__/` folders
- **Integration Tests**: In `src/test/` for cross-module testing
- **Coverage**: Comprehensive coverage with 470+ tests across 26 test files
- **Test Files**: Mirror source structure with `.test.ts` suffix

## Configuration Files Location

- **Root Level**: Build and project configuration (vite.config.ts, tsconfig.json)
- **Package Management**: package.json, package-lock.json
- **Code Quality**: eslint.config.js, .gitignore
- **Styling**: tailwind.config.js, postcss.config.js
- **Extension**: manifest.json (Chrome extension configuration)

## Documentation Structure (`docs/`)

- **Implementation Guides**: PLATFORM_INTEGRATION.md, ELEMENT_PICKER_IMPLEMENTATION.md
- **Workflow Docs**: RELEASE_WORKFLOW.md, GITHUB_ENVIRONMENTS.md
- **Security**: ELEMENT_PICKER_SECURITY.md
- **Configuration**: RENOVATE_CONFIGURATION.md