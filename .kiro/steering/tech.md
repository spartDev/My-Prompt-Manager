# Technology Stack

## Core Technologies

- **Frontend Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS for utility-first styling
- **Build Tool**: Vite with @crxjs/vite-plugin for Chrome extension development
- **Extension**: Chrome Manifest V3
- **Storage**: Chrome Storage API (chrome.storage.local)
- **Content Script**: Vanilla JavaScript with CSS injection

## Key Dependencies

### Production Dependencies
- `react` & `react-dom`: UI framework
- `uuid`: Unique ID generation for prompts and categories
- `dompurify`: HTML sanitization for security

### Development Dependencies
- `@crxjs/vite-plugin`: Chrome extension build integration
- `@vitejs/plugin-react`: React support for Vite
- `typescript`: Type safety and development experience
- `@types/chrome`: Chrome extension API types
- `eslint` & `@typescript-eslint/*`: Code linting and formatting
- `vitest`: Testing framework
- `@testing-library/*`: React component testing utilities
- `@vitest/coverage-v8`: Code coverage reporting

## Build System

### Development Commands
```bash
npm run dev          # Start development server with HMR
npm run build        # Production build to dist/ folder
npm run package      # Package extension for Chrome Web Store
npm run preview      # Preview production build
```

### Testing Commands
```bash
npm test             # Run test suite
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage report
```

### Code Quality Commands
```bash
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues automatically
```

## Configuration Files

- `vite.config.ts`: Build configuration with React and CRX plugins
- `tsconfig.json`: TypeScript configuration with strict mode
- `eslint.config.js`: ESLint configuration with React, TypeScript, and accessibility rules
- `tailwind.config.js`: Tailwind CSS configuration
- `vitest.config.ts`: Test configuration
- `manifest.json`: Chrome extension manifest (Manifest V3)

## Architecture Patterns

- **Custom Hooks**: Business logic abstraction (usePrompts, useCategories, etc.)
- **Context API**: Theme management and global state
- **Service Layer**: Storage operations and business logic separation
- **Error Boundaries**: React error handling with graceful fallbacks
- **TypeScript**: Strict typing for better development experience and runtime safety