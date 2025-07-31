# Technology Stack

## Core Technologies

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite with @crxjs/vite-plugin for Chrome extension development
- **Styling**: Tailwind CSS with dark mode support
- **Extension**: Chrome Manifest V3
- **Storage**: Chrome Storage API (chrome.storage.local)
- **Testing**: Vitest with React Testing Library and jsdom

## Key Dependencies

- **React Ecosystem**: react, react-dom, @types/react, @types/react-dom
- **Chrome Extension**: @types/chrome, @crxjs/vite-plugin
- **Utilities**: uuid (for ID generation), dompurify (for content sanitization)
- **Development**: TypeScript, ESLint with strict TypeScript rules, Tailwind CSS

## Build System

### Development Commands
```bash
npm run dev          # Start development server with HMR
npm run build        # Production build
npm run package      # Package extension for distribution
npm run preview      # Preview production build
```

### Testing Commands
```bash
npm run test         # Run tests
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage report
```

### Code Quality
```bash
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues automatically
```

## Configuration Files

- **vite.config.ts**: Vite configuration with React and CRX plugins
- **vitest.config.ts**: Test configuration with jsdom environment
- **tsconfig.json**: TypeScript configuration with strict mode
- **eslint.config.js**: ESLint with TypeScript, React, and accessibility rules
- **tailwind.config.js**: Tailwind with dark mode and custom focus utilities
- **manifest.json**: Chrome extension manifest with permissions and content scripts

## Architecture Patterns

- **Singleton Pattern**: StorageManager and PromptManager use singleton instances
- **Custom Hooks**: Business logic encapsulated in reusable hooks (usePrompts, useCategories, etc.)
- **Error Boundaries**: React error boundaries for graceful error handling
- **Service Layer**: Separate services for storage operations and business logic
- **Type Safety**: Comprehensive TypeScript types with strict configuration