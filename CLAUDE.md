# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension for managing personal prompt libraries with dual interfaces:
- **Popup/Side Panel**: React-based prompt management UI
- **Content Script**: Native integration with AI platforms (Claude, ChatGPT, Perplexity)

## Essential Commands

```bash
# Development
npm run dev          # Start development server with hot reload (WXT)
npm run build        # Production build (creates .output/chrome-mv3/ folder)
npm run preview      # Preview production build

# Testing
npm test             # Run all tests with Vitest
npm run test:ui      # Run tests with UI interface
npm run test:coverage # Generate test coverage report

# Code Quality - MANDATORY after every change
npm run lint         # Run ESLint checks
npm run lint:fix     # Fix ESLint issues automatically

# Packaging
npm run package      # Package extension for Chrome Web Store (wxt zip)
```

## Development Workflow

**CRITICAL**: After EVERY code change, you MUST run:
1. `npm test` - Ensure all tests pass
2. `npm run lint` - Verify code quality

Never proceed without both passing. No exceptions for "small changes".

## Architecture

### High-Level Structure

The extension operates in three main contexts:

1. **Extension UI (Popup & Side Panel)**
   - React 19 + TypeScript + Tailwind CSS
   - Entry points: `src/popup.tsx`, `src/sidepanel.tsx`
   - Shared component tree via `src/App.tsx`
   - State management through React contexts and hooks
   - Modern form handling with `useActionState` and optimistic updates with `useOptimistic`

2. **Content Script System**
   - Modular TypeScript architecture in `src/content/`
   - Platform detection and strategy pattern for AI site integration
   - Singleton pattern for storage and prompt management
   - Event-driven communication with extension UI

3. **Background Service Worker**
   - Handles side panel API and tab management
   - Minimal logic - primarily routing

### Key Architectural Patterns

**Data Flow:**
```
Chrome Storage API ← → StorageManager (singleton)
                       ↓
                   PromptManager (business logic)
                       ↓
    React Hooks ← → Components ← → Content Scripts
```

**Content Script Strategy Pattern:**
- `PlatformManager` detects current site and selects strategy
- Each platform (Claude, ChatGPT, etc.) extends `BaseStrategy`
- Strategies handle platform-specific DOM manipulation and text insertion
- `PromptLibraryInjector` orchestrates the entire injection process

**Critical Services:**
- `StorageManager`: Singleton with mutex locking for concurrent operations
- `PromptManager`: Search, validation, duplicate detection (Levenshtein distance)
- `InsertionManager`: Platform-agnostic text insertion coordination

### Detailed Documentation

For comprehensive technical documentation, see:

- **[Architecture Deep Dive](docs/ARCHITECTURE.md)** - Complete system design, design patterns, and adding new platforms
- **[Component Catalog](docs/COMPONENTS.md)** - All 40+ React components with examples and patterns
- **[React 19 Migration](docs/REACT_19_MIGRATION.md)** - Form handling with `useActionState`, optimistic updates, migration patterns
- **[Services & Hooks](docs/SERVICES_AND_HOOKS.md)** - Business logic layer, algorithms, and data flow
- **[Platform Integration](docs/PLATFORM_INTEGRATION.md)** - Adding new AI platform support
- **[Custom Sites Guide](docs/ELEMENT_FINGERPRINTING_DESIGN.md)** - Element fingerprinting and custom positioning
- **[Testing Guide](docs/TESTING.md)** - Testing strategies, patterns, and coverage
- **[Design Guidelines](docs/DESIGN_GUIDELINES.md)** - Visual design system and UI patterns

### File Organization

```
src/
├── entrypoints/       # WXT extension entry points
│   ├── background.ts # Background service worker
│   ├── content.ts    # Content script
│   ├── popup.html    # Popup interface
│   └── sidepanel.html # Side panel interface
├── components/        # React UI components (atomic design)
├── hooks/            # Custom React hooks for data operations
├── services/         # Core business logic (storage, prompt management)
├── contexts/         # React contexts (theme, etc.)
├── content/          # Content script modules
│   ├── core/        # Main orchestration (injector, insertion)
│   ├── platforms/   # Platform-specific strategies
│   ├── ui/          # UI factory, keyboard nav, events
│   └── utils/       # Logger, storage, DOM, styles
└── test/            # Test setup and utilities
```

## Technical Implementation Details

### Chrome Extension Specifics
- Manifest V3 with service worker background script
- Built with **WXT framework** (https://wxt.dev) for modern extension development
- Entry points in `entrypoints/` directory (background.ts, content.ts, popup.html, sidepanel.html)
- Configuration in `wxt.config.ts` (replaces vite.config.ts + manifest.json)
- Host permissions for `<all_urls>` to work on any site
- Side panel API for enhanced UI (Chrome 114+)

### Storage Architecture
- Chrome storage.local API with quota monitoring
- Atomic operations to prevent race conditions
- Data structure: prompts, categories, settings, custom sites
- Import/export functionality for data portability

### Platform Integration
- CSS selectors for input field detection
- Supports both textarea and contenteditable elements
- Custom site configuration with user-defined selectors
- Debug interface: `window.__promptLibraryDebug`

### Testing Strategy
- 1211 tests across 57 test files
- Unit tests for services and utilities
- Component tests with React Testing Library
- Integration tests for storage operations
- Mock Chrome APIs in `src/test/setup.ts`
- **Test environment**: happy-dom (faster and more modern than jsdom)
- **Note**: React 19 hooks (`useActionState`, `useOptimistic`) tested manually in browser (not supported in Node.js test environments)

## Development Guidelines

### Adding New Features
1. Check existing patterns in similar components/services
2. Use singleton instances: `StorageManager.getInstance()`, `PromptManager.getInstance()`
3. Follow TypeScript strict mode requirements
4. Add tests for new functionality
5. Run `npm test` and `npm run lint` before committing

### Creating New Form Components (React 19)

When creating new forms, use React 19's modern patterns. See **[React 19 Migration Guide](docs/REACT_19_MIGRATION.md)** for comprehensive examples.

**Quick Start:**

```typescript
import { useActionState, useState } from 'react';

interface FieldErrors {
  fieldName?: string;
  general?: string;
}

const MyForm: FC<Props> = ({ onSubmit, onCancel }) => {
  const [charCount, setCharCount] = useState(0);

  const [errors, submitAction, isPending] = useActionState(
    async (_prevState: FieldErrors | null, formData: FormData) => {
      const field = formData.get('fieldName') as string;

      // Validation
      const validationErrors: FieldErrors = {};
      if (!field.trim()) {
        validationErrors.fieldName = 'Field is required';
      }
      if (Object.keys(validationErrors).length > 0) {
        return validationErrors;
      }

      // Submission
      try {
        await onSubmit({ field });
        return null;
      } catch (err) {
        return { general: (err as Error).message };
      }
    },
    null
  );

  return (
    <form action={submitAction}>
      {errors?.general && <ErrorBanner message={errors.general} />}

      <input
        name="fieldName"
        onChange={(e) => setCharCount(e.target.value.length)}
        disabled={isPending}
        className={errors?.fieldName ? 'border-red-300' : 'border-purple-200'}
      />
      {errors?.fieldName && <FieldError message={errors.fieldName} />}
      <p>{charCount}/100 characters</p>

      <button type="submit" disabled={isPending}>
        {isPending ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
};
```

**Key Points:**
- Use `useActionState` for form handling (not manual `useState`)
- All inputs need `name` attributes for FormData API
- Return `null` on success, `FieldErrors` object on validation failure
- Use local `useState` for UI-only state (character counts, etc.)
- See existing implementations: `AddPromptForm.tsx`, `EditPromptForm.tsx`

### Logging Guidelines

**IMPORTANT**: Never use `console.*` statements directly. Always use the centralized logger.

#### Import the Logger

**For popup/sidepanel components:**
```typescript
import { Logger, toError } from '../utils';
```

**For content scripts:**
```typescript
import { error, warn, info, debug } from '@content/utils/logger';
```

#### When to Use Each Log Level

**`Logger.error()` - Critical Errors (Always Logged)**
- Use for errors that must be visible in production
- Always include context object with `component` field
- Use `toError()` utility to ensure Error type
```typescript
try {
  await saveData();
} catch (err) {
  Logger.error('Failed to save data', toError(err), {
    component: 'Storage',
    operation: 'save'
  });
}
```

**`Logger.warn()` - Warnings (Dev Only)**
- Non-critical issues that should be investigated
- Suppressed in production builds
```typescript
Logger.warn('Storage quota exceeded', {
  component: 'Storage',
  usagePercent: 95
});
```

**`Logger.info()` - Informational (Dev Only)**
- General information about application state
- Suppressed in production builds
```typescript
Logger.info('Settings updated', {
  component: 'SettingsView',
  theme: 'dark'
});
```

**`Logger.debug()` - Debugging (Dev Only)**
- Detailed debugging information
- Suppressed in production builds
```typescript
Logger.debug('Cache hit', {
  component: 'Storage',
  key: 'prompts',
  size: 42
});
```

#### Context Object Best Practices

Always include a `component` field to identify the source:
```typescript
{
  component: 'Background',        // Required: identifies the component
  tabId: 123,                     // Optional: relevant IDs
  url: 'https://example.com',     // Optional: related URLs
  operation: 'inject',            // Optional: operation name
  error: 'Network timeout'        // Optional: additional context
}
```

### Visual Design Guidelines

**CRITICAL**: When creating or modifying UI components, you MUST follow the design guidelines in `docs/DESIGN_GUIDELINES.md`.

**Quick Reference:**
- **Colors**: Use purple-indigo gradient for primary actions, predefined status colors (green/red/yellow/blue)
- **Typography**: system-ui font stack, text-sm (14px) for body, font-semibold for emphasis
- **Spacing**: Use p-5 for cards, p-6 for containers, space-x-3 for button groups
- **Borders**: rounded-xl (12px) for all cards, inputs, buttons
- **Effects**: backdrop-blur-sm with semi-transparent backgrounds (bg-white/70 dark:bg-gray-800/70)
- **Dark Mode**: MUST include dark: variants for all styles
- **Focus States**: Use predefined classes (.focus-primary, .focus-input, .focus-interactive)
- **Transitions**: transition-all duration-200 for smooth interactions

**Complete Guidelines:** See `docs/DESIGN_GUIDELINES.md` for:
- Complete color palette and usage patterns
- Typography system and font guidelines
- Component patterns (buttons, inputs, cards, modals)
- Animation and transition specifications
- Dark mode implementation details
- Accessibility requirements

**Example Primary Button:**
```tsx
<button className="
  px-6 py-3 text-sm font-semibold text-white
  bg-gradient-to-r from-purple-600 to-indigo-600
  rounded-xl hover:from-purple-700 hover:to-indigo-700
  transition-all duration-200 shadow-lg hover:shadow-xl
  disabled:opacity-50 focus-primary
">
  Save Prompt
</button>
```

### Modifying Content Scripts
- Content scripts bundle separately from popup
- Use `@content` alias for imports within content script
- Maintain platform strategy pattern for new sites
- Test on actual AI platforms after changes

### Chrome Extension Loading
1. Run `npm run build` to create .output/chrome-mv3/ folder
2. Open chrome://extensions/
3. Enable Developer mode
4. Load unpacked → select .output/chrome-mv3/ folder
5. Test both popup and content script functionality

### WXT Framework Notes
- **Source Directory**: All source code lives in `src/` (configured via `srcDir: 'src'`)
- **Entry Points**: Extension entry points are in `src/entrypoints/` directory
  - `background.ts`: Service worker wrapped in `defineBackground()`
  - `content.ts`: Content script wrapped in `defineContentScript()`
  - `popup.html` / `sidepanel.html`: HTML entry points
- **Configuration**: `wxt.config.ts` contains manifest definition and build configuration
- **Build Output**: `.output/chrome-mv3/` (gitignored, excluded from ESLint)
- **Type Generation**: `wxt prepare` generates TypeScript definitions (runs via postinstall)
- **Auto-imports**: WXT auto-imports from `components/`, `hooks/`, and `utils/` directories