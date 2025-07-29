# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome extension for managing personal prompt libraries with dual interfaces:
1. **Popup Interface**: React-based prompt management system
2. **Content Script Integration**: Native integration with AI platforms (Claude, ChatGPT, Perplexity)

## Essential Commands

### Development
- `npm run dev` - Start development server with hot reload
- `npm run build` - Production build (creates `dist/` folder)
- `npm run preview` - Preview production build

### Testing
- `npm test` - Run all tests with Vitest
- `npm run test:ui` - Run tests with UI interface
- `npm run test:coverage` - Generate test coverage report

### Code Quality
- `npm run lint` - Run ESLint checks
- `npm run lint:fix` - Fix ESLint issues automatically

### Extension Packaging
- `npm run package` - Package extension for Chrome Web Store

## Architecture

### Dual Interface System
- **Popup**: React 18 + TypeScript with Tailwind CSS for prompt management
- **Content Script**: Vanilla JavaScript for AI platform integration via `content.js`

### Key Architectural Components

**Data Layer:**
- `services/storage.ts` - Chrome storage API wrapper
- `services/promptManager.ts` - Business logic and validation

**React Layer:**
- Custom hooks in `hooks/` provide data and operations to components
- `contexts/ThemeContext.tsx` manages dark/light theme state
- Components follow atomic design principles

**Integration Layer:**
- `content.js` handles AI platform detection and prompt injection
- Supports Claude, ChatGPT, Perplexity, and custom sites

### File Structure Highlights
```
src/
├── components/         # React UI components
├── hooks/             # Custom React hooks for data operations
├── services/          # Storage and business logic
├── types/             # TypeScript definitions
├── contexts/          # React contexts
├── content.js         # Content script for AI integration
└── popup.tsx          # React entry point
```

## Extension-Specific Considerations

### Chrome Extension Development
- Uses Manifest V3 with `@crxjs/vite-plugin`
- Build output goes to `dist/` folder for Chrome loading
- Content script injection handled by manifest configuration

### Platform Integration
- Content script detects input fields on AI platforms
- Uses CSS selectors to identify and inject library icons
- Supports both textarea and contenteditable elements

### Storage Management
- Uses `chrome.storage.local` API for data persistence
- Implements quota monitoring and storage warnings
- Data includes prompts, categories, and user settings

## Testing Strategy

### Test Structure
- Unit tests for hooks, services, and utilities
- Component tests using React Testing Library
- Integration tests for storage operations
- Test setup configured in `src/test/setup.ts`

### Coverage Requirements
- Excludes build files, configs, and test utilities from coverage
- Focus on business logic and component behavior

## Development Workflow

1. Load extension in Chrome via `chrome://extensions/` (Developer mode)
2. Use `npm run dev` for development with auto-reload
3. Test in popup interface and on supported AI platforms
4. Run lint and tests before committing changes

## Chrome Extension Loading

After building:
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select `dist/` folder
4. Extension appears in toolbar and integrates with AI platforms