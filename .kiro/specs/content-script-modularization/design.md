# Design Document

## Overview

This design outlines the modularization of the monolithic content.js file into a well-structured TypeScript architecture. The design maintains all existing functionality while improving maintainability, testability, and type safety. The modular structure follows the existing class boundaries and logical separations already present in the code.

## Architecture

### Module Structure

The content script will be split into the following TypeScript modules:

```
src/content/
├── index.ts                    # Main entry point
├── types/
│   ├── index.ts               # Core type definitions
│   ├── platform.ts            # Platform-specific types
│   └── ui.ts                  # UI-related types
├── utils/
│   ├── logger.ts              # Logging utilities
│   ├── dom.ts                 # DOM manipulation utilities
│   ├── storage.ts             # Storage management utilities
│   └── styles.ts              # CSS injection utilities
├── ui/
│   ├── element-factory.ts     # UI element creation
│   ├── keyboard-navigation.ts # Keyboard navigation manager
│   └── event-manager.ts       # Event management
├── platforms/
│   ├── base-strategy.ts       # Abstract base strategy
│   ├── claude-strategy.ts     # Claude.ai implementation
│   ├── chatgpt-strategy.ts    # ChatGPT implementation
│   ├── perplexity-strategy.ts # Perplexity implementation
│   ├── default-strategy.ts    # Default/fallback implementation
│   └── platform-manager.ts    # Platform management
├── core/
│   ├── injector.ts           # Main prompt library injector
│   └── insertion-manager.ts   # Platform insertion manager
└── content.ts                 # Legacy compatibility layer (optional)
```

### Build Configuration

The build system will be configured to:
- Bundle all TypeScript modules into a single content script
- Maintain compatibility with Chrome extension manifest
- Generate source maps for debugging
- Handle proper module resolution and tree-shaking

## Components and Interfaces

### Core Types (`src/content/types/`)

```typescript
// types/index.ts
export interface Prompt {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: number;
}

export interface InsertionResult {
  success: boolean;
  method?: string;
  error?: string;
}

export interface DebugInfo {
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  message: string;
  context: Record<string, any>;
  url: string;
  userAgent?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// types/platform.ts
export interface PlatformConfig {
  selectors: string[];
  buttonContainerSelector?: string;
  priority: number;
}

export interface PlatformStrategyInterface {
  name: string;
  priority: number;
  canHandle(element: HTMLElement): boolean;
  insert(element: HTMLElement, content: string): Promise<InsertionResult>;
  getSelectors(): string[];
  getButtonContainerSelector(): string | null;
  createIcon?(uiFactory: UIElementFactory): HTMLElement | null;
  cleanup?(): void;
}

// types/ui.ts
export interface KeyboardNavigationOptions {
  selector: HTMLElement;
  eventManager: EventManager;
}

export interface UIElementFactoryOptions {
  instanceId: string;
}
```

### Utility Modules (`src/content/utils/`)

#### Logger (`utils/logger.ts`)
```typescript
export class Logger {
  static isDebugMode(): boolean;
  static error(message: string, error?: Error, context?: Record<string, any>): void;
  static warn(message: string, context?: Record<string, any>): void;
  static info(message: string, context?: Record<string, any>): void;
  static debug(message: string, context?: Record<string, any>): void;
  static showDebugNotification(message: string, type?: 'info' | 'warn' | 'error'): void;
}
```

#### Storage Manager (`utils/storage.ts`)
```typescript
export class StorageManager {
  static async getPrompts(): Promise<Prompt[]>;
  static escapeHtml(text: string): string;
  static createElement(tag: string, attributes?: Record<string, any>, textContent?: string): HTMLElement;
  static createSVGElement(tag: string, attributes?: Record<string, any>): SVGElement;
  static sanitizeUserInput(input: string): string;
  static validatePromptData(prompt: any): Prompt | null;
  static createPromptListItem(prompt: Prompt, index: number, idPrefix?: string): HTMLElement;
}
```

#### Styles (`utils/styles.ts`)
```typescript
export class StylesManager {
  static injectCSS(): void;
  static getCSS(): string;
}
```

### UI Components (`src/content/ui/`)

#### Element Factory (`ui/element-factory.ts`)
```typescript
export class UIElementFactory {
  constructor(instanceId: string);
  createClaudeIcon(): { container: HTMLElement; icon: HTMLElement };
  createPerplexityIcon(): HTMLElement;
  createChatGPTIcon(): HTMLElement;
  createFloatingIcon(): HTMLElement;
}
```

#### Event Manager (`ui/event-manager.ts`)
```typescript
export class EventManager {
  addTrackedEventListener(element: HTMLElement, event: string, handler: EventListener): void;
  cleanup(): void;
}
```

#### Keyboard Navigation (`ui/keyboard-navigation.ts`)
```typescript
export class KeyboardNavigationManager {
  constructor(selectorElement: HTMLElement, eventManager: EventManager);
  initialize(): void;
  updateItems(): void;
  destroy(): void;
}
```

### Platform Strategies (`src/content/platforms/`)

#### Base Strategy (`platforms/base-strategy.ts`)
```typescript
export abstract class PlatformStrategy implements PlatformStrategyInterface {
  constructor(name: string, priority: number, config?: PlatformConfig);
  abstract canHandle(element: HTMLElement): boolean;
  abstract insert(element: HTMLElement, content: string): Promise<InsertionResult>;
  abstract getSelectors(): string[];
  
  getButtonContainerSelector(): string | null;
  createIcon?(uiFactory: UIElementFactory): HTMLElement | null;
  cleanup?(): void;
  
  protected _debug(message: string, context?: Record<string, any>): void;
  protected _warn(message: string, errorOrContext?: any): void;
  protected _error(message: string, error: Error, context?: Record<string, any>): void;
}
```

#### Platform Manager (`platforms/platform-manager.ts`)
```typescript
export class PlatformManager {
  constructor(options?: Record<string, any>);
  registerStrategy(strategy: PlatformStrategy): void;
  findBestStrategy(element: HTMLElement): PlatformStrategy | null;
  insertContent(element: HTMLElement, content: string): Promise<InsertionResult>;
  cleanup(): void;
}
```

### Core Components (`src/content/core/`)

#### Main Injector (`core/injector.ts`)
```typescript
export class PromptLibraryInjector {
  constructor();
  initialize(): void;
  cleanup(): void;
  showPromptSelector(targetElement: HTMLElement): void;
}
```

#### Insertion Manager (`core/insertion-manager.ts`)
```typescript
export class PlatformInsertionManager {
  constructor(options?: Record<string, any>);
  insertPrompt(element: HTMLElement, content: string): Promise<InsertionResult>;
  cleanup(): void;
}
```

### Main Entry Point (`src/content/index.ts`)

The main entry point will:
1. Import all necessary modules
2. Initialize the CSS injection
3. Create and start the main injector
4. Set up cleanup handlers
5. Maintain backward compatibility

```typescript
import { StylesManager } from './utils/styles';
import { PromptLibraryInjector } from './core/injector';
import { Logger } from './utils/logger';

// Initialize styles
StylesManager.injectCSS();

// Global instance management
let promptLibraryInstance: PromptLibraryInjector | null = null;

// Initialize the extension
function initializeExtension(): void {
  try {
    if (promptLibraryInstance) {
      promptLibraryInstance.cleanup();
    }
    
    promptLibraryInstance = new PromptLibraryInjector();
    
  } catch (error) {
    Logger.error('Failed to initialize prompt library', error);
  }
}

// Cleanup handlers
window.addEventListener('beforeunload', () => {
  if (promptLibraryInstance) {
    promptLibraryInstance.cleanup();
  }
});

// Initialize
initializeExtension();
```

## Data Models

### Prompt Data Structure
The existing prompt structure will be maintained with proper TypeScript typing:

```typescript
interface Prompt {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: number;
}
```

### Platform Configuration
Each platform strategy will have a configuration object:

```typescript
interface PlatformConfig {
  selectors: string[];
  buttonContainerSelector?: string;
  priority: number;
}
```

## Error Handling

### Logging Strategy
- Maintain the existing Logger class with proper TypeScript types
- Ensure all error paths are properly typed
- Preserve debug mode functionality

### Graceful Degradation
- Each module should handle errors gracefully
- Failed imports should not break the entire content script
- Platform strategies should have proper fallbacks

## Testing Strategy

### Unit Testing
- Each module can be tested independently
- Mock dependencies for isolated testing
- Test platform strategies with different DOM structures

### Integration Testing
- Test the complete flow from icon injection to prompt insertion
- Verify cross-platform compatibility
- Test keyboard navigation and accessibility features

### Type Safety Testing
- Use TypeScript strict mode
- Ensure all interfaces are properly implemented
- Validate type definitions match runtime behavior

## Migration Strategy

### Phase 1: Extract Utilities
1. Create utility modules (Logger, StorageManager, StylesManager)
2. Add proper TypeScript types
3. Test utilities independently

### Phase 2: Extract UI Components
1. Create UI component modules
2. Maintain existing functionality
3. Add proper event handling types

### Phase 3: Extract Platform Strategies
1. Create base strategy interface
2. Extract each platform strategy to its own module
3. Ensure all strategies implement the interface correctly

### Phase 4: Create Core Components
1. Extract main injector logic
2. Create platform manager
3. Ensure proper orchestration

### Phase 5: Integration and Testing
1. Create main entry point
2. Test complete functionality
3. Verify build process works correctly

## Build System Integration

### Vite Configuration
The existing Vite configuration will need updates to handle the modular TypeScript structure:

```typescript
// vite.config.ts updates needed
export default defineConfig({
  // ... existing config
  build: {
    rollupOptions: {
      input: {
        content: 'src/content/index.ts'
      },
      output: {
        entryFileNames: '[name].js',
        format: 'iife' // Important for content scripts
      }
    }
  }
});
```

### TypeScript Configuration
Ensure proper module resolution and strict typing:

```json
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true
  },
  "include": [
    "src/content/**/*"
  ]
}
```