# Technology Stack

## Core Technologies
- **React**: 18.3.1 (UI Framework)
- **TypeScript**: 5.5.3 (Type Safety)
- **Tailwind CSS**: 3.4.4 (Styling)
- **Vite**: 6.3.5 (Build Tool)
- **Vitest**: 3.2.4 (Testing Framework)

## Chrome Extension Specific
- **Manifest V3**: Modern Chrome extension architecture
- **@crxjs/vite-plugin**: 2.2.0 (Chrome extension development with Vite)
- **@types/chrome**: 0.0.269 (Chrome API TypeScript definitions)

## Security & Utilities
- **DOMPurify**: 3.2.6 (XSS protection)
- **uuid**: 10.0.0 (Unique ID generation)
- **lz-string**: 1.5.0 (Data compression)

## Development Tools
- **ESLint**: 9.32.0 (Code linting)
- **Husky**: 9.1.7 (Git hooks)
- **@testing-library/react**: 16.3.0 (Component testing)
- **jsdom**: 26.1.0 (DOM testing environment)

## Architecture Patterns
- **Strategy Pattern**: Platform-specific implementations
- **Factory Pattern**: UI element creation
- **Observer Pattern**: Event management and DOM mutations
- **Singleton Pattern**: Storage and prompt management
- **Module Pattern**: TypeScript module organization

## Build System
- Vite with HMR for development
- TypeScript compilation with strict mode
- Chrome extension manifest integration
- Source maps for debugging (dev only)
- Tree shaking and minification (production)