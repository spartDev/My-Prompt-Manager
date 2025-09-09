# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension for managing personal prompt libraries with dual interfaces:
- **Popup/Side Panel**: React-based prompt management UI
- **Content Script**: Native integration with AI platforms (Claude, ChatGPT, Perplexity)

## Essential Commands

```bash
# Development
npm run dev          # Start development server with hot reload
npm run build        # Production build (creates dist/ folder)
npm run preview      # Preview production build

# Testing
npm test             # Run all tests with Vitest
npm run test:ui      # Run tests with UI interface
npm run test:coverage # Generate test coverage report

# Code Quality - MANDATORY after every change
npm run lint         # Run ESLint checks
npm run lint:fix     # Fix ESLint issues automatically

# Packaging
npm run package      # Package extension for Chrome Web Store
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
   - React 18 + TypeScript + Tailwind CSS
   - Entry points: `src/popup.tsx`, `src/sidepanel.tsx`
   - Shared component tree via `src/App.tsx`
   - State management through React contexts and hooks

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

### File Organization

```
src/
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
- Uses `@crxjs/vite-plugin` for development experience
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
- 470+ tests across 26 test files
- Unit tests for services and utilities
- Component tests with React Testing Library
- Integration tests for storage operations
- Mock Chrome APIs in `src/test/setup.ts`

## Development Guidelines

### Adding New Features
1. Check existing patterns in similar components/services
2. Use singleton instances: `StorageManager.getInstance()`, `PromptManager.getInstance()`
3. Follow TypeScript strict mode requirements
4. Add tests for new functionality
5. Run `npm test` and `npm run lint` before committing

### Modifying Content Scripts
- Content scripts bundle separately from popup
- Use `@content` alias for imports within content script
- Maintain platform strategy pattern for new sites
- Test on actual AI platforms after changes

### Chrome Extension Loading
1. Run `npm run build` to create dist/ folder
2. Open chrome://extensions/
3. Enable Developer mode
4. Load unpacked → select dist/ folder
5. Test both popup and content script functionality