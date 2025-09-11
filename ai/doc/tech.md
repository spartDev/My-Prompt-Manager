# Technology Stack & Build System

## Core Technologies

- **Framework**: React 18.3.1 with TypeScript 5.5.3
- **Build Tool**: Vite 6.3.5 with @crxjs/vite-plugin 2.0.3 for Chrome extension support
- **Styling**: Tailwind CSS 3.4.4 with PostCSS
- **Extension**: Chrome Manifest V3 architecture
- **Testing**: Vitest 3.2.4 with @testing-library/react
- **Security**: DOMPurify 3.2.6 for XSS protection
- **Storage**: Chrome Storage API for local data persistence

## Build System

### Development Commands
```bash
npm run dev          # Start development server with HMR
npm run build        # Create production build in dist/
npm run preview      # Preview production build
npm run package      # Package extension for Chrome Web Store
```

### Testing Commands
```bash
npm test             # Run test suite (470+ tests)
npm run test:ui      # Run tests with Vitest UI
npm run test:coverage # Generate coverage report
```

### Code Quality Commands
```bash
npm run lint         # Run ESLint checks
npm run lint:fix     # Auto-fix ESLint issues
```

## Architecture Patterns

- **Strategy Pattern**: Platform-specific insertion strategies for different AI sites
- **Factory Pattern**: UI element creation through UIElementFactory
- **Observer Pattern**: Event management and DOM mutation observation
- **Module Pattern**: TypeScript module organization with clear separation of concerns

## Key Dependencies

- **@crxjs/vite-plugin**: Chrome extension development with Vite
- **@types/chrome**: TypeScript definitions for Chrome APIs
- **uuid**: Unique ID generation for prompts and categories
- **dompurify**: Content sanitization for security
- **husky**: Git hooks for code quality enforcement

## Configuration Files

- `vite.config.ts`: Build configuration with Chrome extension support
- `tsconfig.json`: TypeScript configuration with strict type checking
- `eslint.config.js`: ESLint configuration with React and TypeScript rules
- `tailwind.config.js`: Tailwind CSS configuration with dark mode support
- `manifest.json`: Chrome extension manifest (Manifest V3)

## Development Workflow

1. Use `npm run dev` for development with hot reload
2. Load unpacked extension from `dist/` folder in Chrome
3. Test on target AI platforms (Claude, ChatGPT, Perplexity)
4. Run tests with `npm test` before committing
5. Use `npm run package` to create distribution ZIP