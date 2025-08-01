# Project Structure

## Root Directory

- `src/` - Main source code
- `public/` - Static assets (icons, manifest resources)
- `dist/` - Build output (generated)
- `coverage/` - Test coverage reports (generated)
- `ai/` - AI-related documentation and requirements
- Configuration files at root level

## Source Code Organization (`src/`)

### Core Application Files
- `App.tsx` - Main application component with view routing
- `popup.tsx` - React entry point for extension popup
- `popup.html` - HTML template for popup
- `popup.css` - Global styles
- `content/` - Modular TypeScript content script for AI platform integration

### Component Architecture (`src/components/`)
- `LibraryView.tsx` - Main prompt library interface
- `PromptCard.tsx` - Individual prompt display component
- `AddPromptForm.tsx` / `EditPromptForm.tsx` - Form components
- `CategoryManager.tsx` - Category management modal
- `SearchBar.tsx` / `CategoryFilter.tsx` - Filtering components
- `SettingsView.tsx` - Extension settings interface
- `ToastContainer.tsx` - Notification system
- `ErrorBoundary.tsx` - Error handling wrapper
- `StorageWarning.tsx` - Storage quota warnings
- `ThemeToggle.tsx` - Dark/light mode toggle
- `ConfirmDialog.tsx` - Confirmation dialogs

### Business Logic (`src/hooks/`)
- `usePrompts.ts` - Prompt CRUD operations
- `useCategories.ts` - Category management
- `useClipboard.ts` - Clipboard operations
- `useSearch.ts` / `useSearchWithDebounce.ts` - Search functionality
- `useToast.ts` - Toast notifications
- `useTheme.ts` - Theme management
- `index.ts` - Hook exports

### Services Layer (`src/services/`)
- `storage.ts` - Chrome storage API wrapper with error handling
- `promptManager.ts` - Business logic for prompt operations

### Type Definitions (`src/types/`)
- `index.ts` - Core types (Prompt, Category, Settings)
- `components.ts` - Component prop types
- `hooks.ts` - Hook return types
- `context.ts` - Context types

### Utilities (`src/utils/`)
- `debounce.ts` - Debounce utility function
- `index.ts` - Utility exports

### Context (`src/contexts/`)
- `ThemeContext.tsx` - Theme provider and context

## Testing Structure

### Component Tests (`src/components/__tests__/`)
- Unit tests for React components
- Integration tests for component interactions

### Service Tests (`src/services/__tests__/`)
- Storage service tests
- Business logic tests

### Hook Tests (`src/hooks/__tests__/`)
- Custom hook testing

### Integration Tests (`src/test/__tests__/`)
- End-to-end functionality tests
- Cross-component integration tests

## Configuration Files

- `manifest.json` - Chrome extension manifest
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Build configuration
- `vitest.config.ts` - Test configuration
- `eslint.config.js` - Linting rules
- `tailwind.config.js` - CSS framework configuration
- `postcss.config.js` - CSS processing

## Naming Conventions

- **Components**: PascalCase (e.g., `PromptCard.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `usePrompts.ts`)
- **Services**: camelCase (e.g., `storage.ts`)
- **Types**: PascalCase for interfaces/types
- **Constants**: UPPER_SNAKE_CASE
- **CSS Classes**: Tailwind utility classes

## File Organization Principles

1. **Feature-based grouping**: Related functionality grouped together
2. **Clear separation of concerns**: Components, hooks, services, types separated
3. **Co-location**: Tests alongside source files in `__tests__` folders
4. **Index files**: Clean exports from each directory
5. **Single responsibility**: Each file has a clear, focused purpose