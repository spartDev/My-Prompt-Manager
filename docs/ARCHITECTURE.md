# Architecture Documentation

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Design Patterns](#design-patterns)
- [Core Components](#core-components)
- [Data Flow](#data-flow)
- [Adding New Platforms](#adding-new-platforms)
- [Testing Strategy](#testing-strategy)
- [Performance Considerations](#performance-considerations)
- [Security Architecture](#security-architecture)

---

## Overview

My Prompt Manager is a Chrome extension built with a modular, extensible architecture that separates concerns across three main execution contexts:

1. **Extension UI** (React-based popup/side panel)
2. **Content Scripts** (Platform integration layer)
3. **Background Service Worker** (Minimal coordination layer)

### Key Architectural Principles

- **Strategy Pattern**: Platform-specific insertion strategies
- **Factory Pattern**: Data-driven strategy instantiation
- **Dependency Injection**: Testable, decoupled components
- **Singleton Pattern**: Centralized storage and prompt management
- **Observer Pattern**: Event-driven communication

---

## System Architecture

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐     ┌──────────────────┐              │
│  │  Extension UI   │     │  Content Script  │              │
│  │  (React)        │     │  (Injected)      │              │
│  ├─────────────────┤     ├──────────────────┤              │
│  │ - Popup         │     │ - Platform       │              │
│  │ - Side Panel    │     │   Detection      │              │
│  │ - Settings      │     │ - Strategy       │              │
│  │ - Prompt CRUD   │     │   Selection      │              │
│  └────────┬────────┘     │ - Icon Injection │              │
│           │              │ - Text Insertion │              │
│           │              └────────┬─────────┘              │
│           │                       │                         │
│           ├───────────────────────┤                         │
│           │                       │                         │
│  ┌────────▼───────────────────────▼─────┐                  │
│  │     Chrome Storage API (Local)       │                  │
│  ├──────────────────────────────────────┤                  │
│  │ - StorageManager (Singleton)         │                  │
│  │ - PromptManager (Business Logic)     │                  │
│  └──────────────────────────────────────┘                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Execution Contexts

| Context | Technology | Purpose | Lifecycle |
|---------|-----------|---------|-----------|
| **Extension UI** | React 18 + TypeScript | Prompt management interface | On-demand (popup/side panel) |
| **Content Script** | TypeScript modules | Platform integration | Per-tab, per-site |
| **Background** | Service Worker | Side panel API, tab management | Event-driven |

---

## Design Patterns

### 1. Strategy Pattern

**Purpose**: Encapsulate platform-specific text insertion logic

**Implementation**: Each AI platform (Claude, ChatGPT, Gemini, etc.) has a dedicated strategy class that extends `PlatformStrategy`.

**File Structure**:
```
src/content/platforms/
├── base-strategy.ts            # Abstract base class
├── react-platform-strategy.ts  # React-specific base class
├── claude-strategy.ts          # Claude.ai implementation
├── chatgpt-strategy.ts         # ChatGPT implementation
├── gemini-strategy.ts          # Google Gemini implementation
├── mistral-strategy.ts         # Mistral.ai implementation
├── perplexity-strategy.ts      # Perplexity implementation
├── copilot-strategy.ts         # Microsoft Copilot (extends React)
├── m365copilot-strategy.ts     # M365 Copilot (extends React)
├── default-strategy.ts         # Fallback for unknown sites
└── platform-manager.ts         # Strategy orchestration
```

**Key Interfaces**:

```typescript
// base-strategy.ts
export abstract class PlatformStrategy {
  constructor(
    name: string,
    priority: number,
    config?: PlatformConfig,
    hostname?: string // Dependency injection for testing
  ) {
    this.hostname = hostname ?? window.location.hostname;
  }

  abstract canHandle(element: HTMLElement): boolean;
  abstract async insert(element: HTMLElement, content: string): Promise<InsertionResult>;

  getSelectors(): string[];
  getButtonContainerSelector(): string | null;
  createIcon?(): HTMLElement;
}
```

**Benefits**:
- Easy to add new platforms without modifying existing code (Open/Closed Principle)
- Each strategy encapsulates platform-specific quirks
- Testable in isolation with dependency injection

#### React Platform Strategy (Specialized Base Class)

**Purpose**: Provide shared functionality for React-based AI platforms

**When to Use**: Platforms that use React for their input controls (e.g., Microsoft Copilot, M365 Copilot)

**Implementation**: `ReactPlatformStrategy` extends `PlatformStrategy` and provides:

1. **Native Value Setter Caching**: Caches React's native HTMLTextAreaElement value setter for 90% performance improvement
2. **Content Type Check**: `validateContent()` confirms the content is a string; the content itself is never changed (see [Security Architecture](#security-architecture))
3. **React-Compatible Insertion**: Handles React's synthetic events and state updates

**Example**:

```typescript
// copilot-strategy.ts
import { ReactPlatformStrategy } from './react-platform-strategy';

export class CopilotStrategy extends ReactPlatformStrategy {
  constructor(hostname?: string) {
    super('copilot', 80, { selectors, buttonContainerSelector }, hostname);

    // Initialize native value setter cache
    ReactPlatformStrategy.initializeNativeValueSetter();
  }

  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    // Check the content type using base class method
    const validation = this.validateContent(content);
    if (!validation.valid) {
      return await Promise.resolve({ success: false, error: validation.error });
    }

    // Insert the content exactly as given, using base class React-compatible method
    return await this.insertIntoReactTextarea(
      element as HTMLTextAreaElement,
      content,
      'Copilot React',
      'copilot-react'
    );
  }
}
```

**Shared Methods**:
- `initializeNativeValueSetter()`: Static initialization method
- `validateContent(content)`: Type check only (the content must be a string); content is never trimmed, shortened or sanitized
- `insertIntoReactTextarea(element, content, platformName, methodName?)`: React-compatible textarea insertion

**Benefits**:
- **Code Reuse**: 120+ lines eliminated across Copilot strategies
- **Single Source of Truth**: React patterns centralized
- **Future Scalability**: Easy to add new React-based platforms
- **Consistent Behavior**: All React platforms use same insertion logic

---

### 2. Factory Pattern with Strategy Registry

**Purpose**: Data-driven strategy instantiation without conditional logic

**Implementation**:

```typescript
// platform-manager.ts
export class PlatformManager {
  // Type-safe registry mapping platform IDs to constructor functions
  private static readonly STRATEGY_REGISTRY: Record<
    string,
    new (hostname?: string) => PlatformStrategy
  > = {
    'claude': ClaudeStrategy,
    'chatgpt': ChatGPTStrategy,
    'gemini': GeminiStrategy,
    'mistral': MistralStrategy,
    'perplexity': PerplexityStrategy
  };

  private _createStrategyForHostname(hostname: string): PlatformStrategy[] {
    const platform = getPlatformByHostname(hostname);
    const strategies: PlatformStrategy[] = [];

    if (platform) {
      const StrategyConstructor = PlatformManager.STRATEGY_REGISTRY[platform.id];
      if (StrategyConstructor) {
        strategies.push(new StrategyConstructor(hostname));
      }
    }

    // Always add fallback
    strategies.push(new DefaultStrategy(hostname));
    return strategies;
  }
}
```

**Configuration-Driven Architecture**:

```typescript
// config/platforms.ts
export const SUPPORTED_PLATFORMS = {
  gemini: {
    id: 'gemini',
    hostname: 'gemini.google.com',
    displayName: 'Google Gemini',
    priority: 85,
    defaultEnabled: true,
    selectors: ['div.ql-editor[contenteditable="true"]', ...],
    buttonContainerSelector: '.input-buttons-wrapper-bottom',
    strategyClass: 'GeminiStrategy',
    hostnamePatterns: ['gemini']
  },
  // ... other platforms
};
```

**Benefits**:
- Single source of truth for platform configuration
- No conditional chains (`if platform === 'claude' else if ...`)
- TypeScript enforces registry completeness at compile time
- Easy to add platforms by updating config + registry

---

### 3. Dependency Injection

**Purpose**: Decouple components from global state for testability

**Examples**:

**Before (hard dependency on window.location)**:
```typescript
export class ClaudeStrategy extends PlatformStrategy {
  constructor() {
    super('Claude', 100);
    this.hostname = window.location.hostname; // ❌ Hard to test
  }
}
```

**After (dependency injection)**:
```typescript
export class ClaudeStrategy extends PlatformStrategy {
  constructor(hostname?: string) {
    super('Claude', 100, config, hostname); // ✅ Injectable
    this.hostname = hostname ?? window.location.hostname;
  }
}

// Test usage
const strategy = new ClaudeStrategy('claude.ai'); // No mocking needed!
```

**Applied Throughout**:
- `PlatformStrategy` accepts optional `hostname`
- `StorageManager` accepts optional `chrome` object (test mocking)
- `PromptManager` accepts `StorageManager` instance

---

### 4. Singleton Pattern

**Purpose**: Centralized storage access with keyed locks shared across contexts (Web Locks API)

**Implementation**:

```typescript
// services/storage.ts
export class StorageManager {
  private static instance: StorageManager | null = null;
  // Keyed locks shared across the popup, the side panel and the service worker (Web Locks API)
  private readonly mutex = new AsyncMutex({ scope: 'StorageManager' });

  private constructor(private chrome: typeof chrome = globalThis.chrome) {}

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  // Mutex-locked operations
  async getPrompts(): Promise<StoredPrompt[]> {
    return this.mutex.withLock('prompts', async () => {
      const data = await this.chrome.storage.local.get('prompts');
      // Reading never writes and never changes text (see Security Architecture)
      return readPrompts(data.prompts);
    });
  }

  // AsyncMutex (src/utils/asyncMutex.ts): navigator.locks.request('StorageManager:' + key, operation),
  // with the in-memory queue where the Web Locks API is missing
}
```

**Benefits**:
- Prevents race conditions on storage operations, within a context and across contexts
- One write path: Prompt text is admitted (Hidden characters removed, limits enforced) inside the text-writing methods, so no route can skip it
- Testable via constructor injection

---

### 5. Observer Pattern

**Purpose**: Event-driven communication between contexts

**Implementation**:

```typescript
// Content Script → Extension UI communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'cleanup':
      injector.cleanup();
      sendResponse({ success: true });
      break;
    case 'reinitialize':
      injector.initialize();
      sendResponse({ success: true });
      break;
  }
});

// Extension UI → Content Script broadcast
chrome.tabs.query({ active: true }, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, { type: 'settingsUpdated' });
});
```

**Event Types**:
- `cleanup`: Remove all injected UI elements
- `reinitialize`: Re-run platform detection
- `settingsUpdated`: Reload configuration
- `testSelector`: Preview custom positioning

---

## Core Components

### Content Script Architecture

```
src/content/
├── index.ts                    # Entry point
├── types/                      # TypeScript definitions
│   ├── index.ts               # Core types
│   ├── platform.ts            # Platform-specific types
│   └── ui.ts                  # UI types
├── utils/                      # Utilities
│   ├── logger.ts              # Centralized logging
│   ├── dom.ts                 # DOM manipulation
│   ├── storage.ts             # Storage access
│   ├── styles.ts              # CSS injection
│   └── theme-manager.ts       # Theme sync
├── ui/                         # UI components
│   ├── element-factory.ts     # Platform-specific UI creation
│   ├── keyboard-navigation.ts # Keyboard nav manager
│   └── event-manager.ts       # Event listener cleanup
├── platforms/                  # Strategy implementations
│   ├── base-strategy.ts       # Abstract base
│   ├── claude-strategy.ts     # Claude.ai
│   ├── chatgpt-strategy.ts    # ChatGPT
│   ├── gemini-strategy.ts     # Google Gemini
│   ├── mistral-strategy.ts    # Mistral.ai
│   ├── perplexity-strategy.ts # Perplexity
│   ├── default-strategy.ts    # Fallback
│   └── platform-manager.ts    # Orchestration
├── modules/
│   └── element-picker.ts      # Security-focused element picker
└── core/
    ├── injector.ts            # Main orchestrator
    └── insertion-manager.ts   # Platform insertion coordinator
```

### Component Responsibilities

| Component | Responsibility | Pattern |
|-----------|---------------|---------|
| `PromptLibraryInjector` | Detect inputs, inject icons, manage lifecycle | Orchestrator |
| `PlatformInsertionManager` | Coordinate strategy selection and insertion | Mediator |
| `PlatformManager` | Manage strategy registry and instantiation | Factory |
| `UIElementFactory` | Create platform-specific UI elements | Factory |
| `StorageManager` | Centralized storage with keyed locks shared across contexts (Web Locks API) | Singleton |
| `promptAdmission` | Admission of Prompt text, the one reader of stored Prompts, the upgrade scrubs (shared by popup, service worker and content script) | Pure module |
| `PromptManager` | Business logic (search, validation, duplicates) | Service |
| `KeyboardNavigationManager` | Handle keyboard interactions | Controller |
| `EventManager` | Centralized event listener cleanup | Manager |

---

## Data Flow

### 1. Prompt Insertion Flow

```
User clicks library icon
    │
    ▼
PromptLibraryInjector.handleIconClick()
    │
    ├─► Display prompt selector UI
    │
    ▼
User selects prompt
    │
    ▼
PlatformInsertionManager.insertContent(element, content)
    │
    ├─► PlatformManager.getStrategyForElement(element)
    │   │
    │   ├─► Iterate registered strategies
    │   │   │
    │   │   ├─► strategy.canHandle(element)?
    │   │   │       Yes → Return strategy
    │   │   │       No  → Next strategy
    │   │   │
    │   │   └─► Fallback: DefaultStrategy
    │   │
    │   └─► Return selected strategy
    │
    ▼
strategy.insert(element, content)
    │
    ├─► Content is inserted exactly as stored (Verbatim, no sanitizing)
    │
    ├─► Platform-specific insertion logic
    │   │
    │   ├─► Tier 1: Native API (e.g., Quill.js)
    │   │       Success → Dispatch events → Return
    │   │       Failure → ▼
    │   │
    │   ├─► Tier 2: execCommand fallback
    │   │       Success → Dispatch events → Return
    │   │       Failure → ▼
    │   │
    │   └─► Tier 3: DOM manipulation (last resort)
    │           Success → Dispatch events → Return
    │           Failure → Return error
    │
    ▼
InsertionResult { success, method, error? }
    │
    └─► Close prompt selector
```

### 2. Storage Data Flow

```
Chrome Storage API (storage.local)
    │
    ├─► StorageManager (Singleton with mutex)
    │   │
    │   ├─► Read: readPrompts() (shape and defaults only; never writes, never alters text)
    │   │
    │   ├─► Write: Admission (Hidden characters removed once, limits refused not shortened)
    │   │
    │   └─► PromptManager (Business Logic)
    │       │
    │       ├─► Search (fuzzy matching)
    │       ├─► Duplicate detection (Levenshtein distance)
    │       └─► Category management
    │
    ▼
React Hooks (usePrompts, useCategories, useSettings)
    │
    └─► React Components (PromptList, SettingsView, etc.)
```

---

## Adding New Platforms

### Step-by-Step Guide

#### 1. Define Platform Configuration

**File**: `src/config/platforms.ts`

```typescript
export const SUPPORTED_PLATFORMS = {
  // ... existing platforms

  newplatform: {
    id: 'newplatform',
    hostname: 'newplatform.com',
    displayName: 'New Platform',
    priority: 85, // Higher = appears first in UI
    defaultEnabled: true,
    selectors: [
      'textarea[data-testid="input"]',
      'div[contenteditable="true"]',
      '[role="textbox"]'
    ],
    buttonContainerSelector: '.input-actions-container',
    strategyClass: 'NewPlatformStrategy',
    hostnamePatterns: ['newplatform', 'newplatform.com']
  }
};
```

**Priority Guidelines**:
- Claude: 100 (highest)
- ChatGPT: 90
- Gemini/Mistral: 85
- Perplexity: 80
- Custom sites: 50 (lowest)

---

#### 2. Choose the Right Base Class

**Decision Tree**: Which base class should your strategy extend?

```
Is the platform's input field powered by React?
│
├─ YES → Use ReactPlatformStrategy
│   │
│   └─ Examples:
│       • Microsoft Copilot (copilot.microsoft.com)
│       • M365 Copilot (m365.cloud.microsoft)
│       • Any platform with React-managed textarea/input
│   │
│   └─ Benefits:
│       • Automatic React event handling
│       • Native value setter caching (~90% faster)
│       • Built-in content type check
│
└─ NO → Use PlatformStrategy
    │
    └─ Examples:
        • Claude (claude.ai) - Custom contenteditable
        • ChatGPT (chatgpt.com) - Custom ProseMirror editor
        • Gemini (gemini.google.com) - Quill editor
    │
    └─ Implementation:
        • Full manual control over insertion logic
        • No React-specific assumptions
```

**How to Detect React Input Fields**:
1. Check browser DevTools: Look for `__reactFiber$` or `__reactProps$` on the textarea element
2. Monitor value changes: React inputs often use property setters instead of native DOM events
3. Test insertion: If `element.value = 'test'` doesn't trigger UI updates, it's likely React-controlled

---

#### 3a. Create Strategy Class (Standard Platform)

**File**: `src/content/platforms/newplatform-strategy.ts`

**Use this template for non-React platforms**:

```typescript
import { PlatformStrategy } from './base-strategy';
import type { InsertionResult, PlatformConfig } from '../types';
import { info, error as logError, debug } from '../utils/logger';

export class NewPlatformStrategy extends PlatformStrategy {
  constructor(hostname?: string) {
    const config: PlatformConfig = {
      selectors: [
        'textarea[data-testid="input"]',
        'div[contenteditable="true"]'
      ],
      buttonContainerSelector: '.input-actions-container',
      priority: 85
    };

    super('NewPlatform', 85, config, hostname);
  }

  /**
   * Determines if this strategy can handle the given element
   */
  canHandle(element: HTMLElement): boolean {
    // Check if element matches platform selectors
    const selectors = this.getSelectors();
    for (const selector of selectors) {
      if (element.matches(selector)) {
        debug('NewPlatformStrategy can handle element', { selector });
        return true;
      }
    }
    return false;
  }

  /**
   * Inserts content into the element using platform-specific logic
   */
  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    // Content is Verbatim: insert it exactly as given. Do not sanitize, trim or
    // shorten it here; it was admitted once, when the Prompt was saved.
    try {
      // Tier 1: Native API (if available)
      const apiResult = this._tryNativeAPI(element, content);
      if (apiResult.success) return apiResult;

      // Tier 2: execCommand fallback
      const execResult = await this._tryExecCommand(element, content);
      if (execResult.success) return execResult;

      // Tier 3: DOM manipulation (last resort)
      return this._tryDOMManipulation(element, content);

    } catch (err) {
      logError('NewPlatform insertion failed', err as Error, {
        component: 'NewPlatformStrategy'
      });
      return {
        success: false,
        error: (err as Error).message
      };
    }
  }

  /**
   * Tier 1: Try native API if platform provides one
   */
  private _tryNativeAPI(element: HTMLElement, content: string): InsertionResult {
    // Example: Check for custom editor instance
    const editor = (element as any).__customEditor;

    if (editor && typeof editor.setText === 'function') {
      editor.setText(content);
      this._dispatchEvents(element, content);
      info('NewPlatform native API insertion successful');
      return { success: true, method: 'newplatform-native-api' };
    }

    return { success: false };
  }

  /**
   * Tier 2: execCommand fallback for contenteditable
   */
  private async _tryExecCommand(
    element: HTMLElement,
    content: string
  ): Promise<InsertionResult> {
    if (element.contentEditable === 'true') {
      element.focus();

      // Select all existing content
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      // Use insertText (NOT insertHTML for security)
      const inserted = document.execCommand('insertText', false, content);

      if (inserted) {
        this._dispatchEvents(element, content);
        info('NewPlatform execCommand insertion successful');
        return { success: true, method: 'newplatform-execCommand' };
      }
    }

    return { success: false };
  }

  /**
   * Tier 3: DOM manipulation fallback
   */
  private _tryDOMManipulation(
    element: HTMLElement,
    content: string
  ): InsertionResult {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      // Standard input elements
      (element as HTMLInputElement).value = content;
      this._dispatchEvents(element, content);
      info('NewPlatform DOM manipulation (input) successful');
      return { success: true, method: 'newplatform-dom-input' };

    } else if (element.contentEditable === 'true') {
      // ContentEditable elements - use text nodes (security)
      element.focus();

      // Clear safely
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }

      // Insert as text node (prevents XSS)
      const textNode = document.createTextNode(content);
      element.appendChild(textNode);

      this._dispatchEvents(element, content);
      info('NewPlatform DOM manipulation (contenteditable) successful');
      return { success: true, method: 'newplatform-dom-contenteditable' };
    }

    return {
      success: false,
      error: 'All insertion methods failed for NewPlatform'
    };
  }

  /**
   * Dispatch events to trigger platform's change detection
   */
  private _dispatchEvents(element: HTMLElement, content: string): void {
    // InputEvent with proper properties
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: content
    });
    element.dispatchEvent(inputEvent);

    // Additional events for framework compatibility
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    element.dispatchEvent(new Event('focus', { bubbles: true }));
  }
}
```

---

#### 3b. Create Strategy Class (React Platform)

**File**: `src/content/platforms/newreactplatform-strategy.ts`

**Use this template for React-based platforms**:

```typescript
import { getPlatformById } from '../../config/platforms';
import type { InsertionResult } from '../types/index';
import type { UIElementFactory } from '../ui/element-factory';

import { ReactPlatformStrategy } from './react-platform-strategy';

export class NewReactPlatformStrategy extends ReactPlatformStrategy {
  constructor(hostname?: string) {
    const platform = getPlatformById('newreactplatform');

    super('newreactplatform', 85, {
      selectors: platform?.selectors || [
        'textarea[data-testid="input"]',
        'textarea.react-input'
      ],
      buttonContainerSelector: platform?.buttonContainerSelector,
      priority: 85
    }, hostname);

    // Initialize React native value setter cache (REQUIRED)
    ReactPlatformStrategy.initializeNativeValueSetter();
  }

  /**
   * Determines if this strategy can handle the given element
   */
  canHandle(element: HTMLElement): boolean {
    const isCorrectHostname = this.hostname === getPlatformById('newreactplatform')?.hostname;
    const isTextarea = element.tagName === 'TEXTAREA';

    return isCorrectHostname && isTextarea;
  }

  /**
   * Inserts content using React-compatible methods
   */
  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      // Check the content type using base class method
      const validation = this.validateContent(content);
      if (!validation.valid) {
        return await Promise.resolve({
          success: false,
          error: validation.error
        });
      }

      // Insert the content exactly as given, using base class React-compatible method
      return await this.insertIntoReactTextarea(
        element as HTMLTextAreaElement,
        content,
        'NewReactPlatform',
        'newreactplatform-textarea'
      );
    } catch (error) {
      this._warn('React insertion failed', error as Error);
      return await Promise.resolve({
        success: false,
        error: (error as Error).message
      });
    }
  }

  /**
   * Gets selectors for finding input elements
   */
  getSelectors(): string[] {
    return this.config?.selectors || [];
  }

  /**
   * Creates platform-specific icon (optional)
   */
  createIcon(uiFactory: UIElementFactory): HTMLElement | null {
    const { element, cleanup } = uiFactory.createDefaultIcon();
    (element as HTMLElement & { __cleanup?: () => void }).__cleanup = cleanup;
    return element;
  }
}
```

**Key Points for React Platforms**:
1. **Must call** `ReactPlatformStrategy.initializeNativeValueSetter()` in constructor
2. **Use** `validateContent()` for the content type check, then insert the content exactly as given (never sanitize, trim or shorten it)
3. **Use** `insertIntoReactTextarea()` for insertion (handles all React events)
4. **Handle errors** with try-catch and proper async/await
5. **Custom logging**: Pass platform name to `insertIntoReactTextarea()` for branded logs

**What You Get for Free**:
- ✅ React event handling (input, change)
- ✅ Native value setter caching (~90% performance boost)
- ✅ Content type check
- ✅ Consistent error handling
- ✅ Security: content is set as the textarea `value`, never parsed as markup

---

#### 4. Register Strategy in Factory

**File**: `src/content/platforms/platform-manager.ts`

```typescript
// Add to imports
import { NewPlatformStrategy } from './newplatform-strategy';

export class PlatformManager {
  private static readonly STRATEGY_REGISTRY: Record<
    string,
    new (hostname?: string) => PlatformStrategy
  > = {
    'claude': ClaudeStrategy,
    'chatgpt': ChatGPTStrategy,
    'gemini': GeminiStrategy,
    'mistral': MistralStrategy,
    'perplexity': PerplexityStrategy,
    'newplatform': NewPlatformStrategy, // ✅ Add here
  };

  // ... rest of implementation
}
```

---

#### 5. Create Platform-Specific Icon (Optional)

**File**: `src/content/ui/element-factory.ts`

```typescript
export class UIElementFactory {
  // ... existing methods

  createNewPlatformIcon(): HTMLElement {
    const icon = document.createElement('button');
    icon.className = 'prompt-library-integrated-icon newplatform-icon';
    icon.setAttribute('aria-label', 'Open prompt library');

    // Add platform-specific styles
    icon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
        <!-- Platform-specific SVG path -->
        <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"
              fill="currentColor"/>
      </svg>
    `;

    return icon;
  }
}
```

**File**: `src/components/icons/SiteIcons.tsx` (React component for settings UI)

```typescript
import type { FC } from 'react';

interface NewPlatformIconProps {
  className?: string;
  disabled?: boolean;
}

export const NewPlatformIcon: FC<NewPlatformIconProps> = ({
  className = '',
  disabled = false
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`w-6 h-6 ${className}`}
      fill={disabled ? '#9ca3af' : 'currentColor'}
    >
      <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
    </svg>
  );
};
```

---

#### 6. Update Settings UI

**File**: `src/components/SettingsView.tsx`

```typescript
// Add to imports
import { NewPlatformIcon } from './icons/SiteIcons';

const SettingsView: FC<SettingsViewProps> = ({ ... }) => {
  const siteInfo = useMemo(() => ({
    'newplatform.com': {
      name: 'New Platform',
      description: 'Description of the platform',
      icon: <NewPlatformIcon />
    },
    // ... other platforms
  }), []);

  // ... rest of component
};
```

---

#### 7. Update Manifest Permissions

**File**: `manifest.json`

```json
{
  "host_permissions": [
    "https://claude.ai/*",
    "https://chatgpt.com/*",
    "https://gemini.google.com/*",
    "https://newplatform.com/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://claude.ai/*",
        "https://chatgpt.com/*",
        "https://gemini.google.com/*",
        "https://newplatform.com/*"
      ],
      "js": ["src/content/index.ts"]
    }
  ]
}
```

---

#### 8. Write Comprehensive Tests

**File**: `src/content/platforms/__tests__/newplatform-strategy.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HOSTILE_TEXTS, expectNoMarkupIn } from '../../../test/helpers/hostile-text';
import { NewPlatformStrategy } from '../newplatform-strategy';

describe('NewPlatformStrategy', () => {
  let strategy: NewPlatformStrategy;
  let mockElement: HTMLElement;

  beforeEach(() => {
    strategy = new NewPlatformStrategy('newplatform.com');
    mockElement = document.createElement('textarea');
    mockElement.setAttribute('data-testid', 'input');
    document.body.appendChild(mockElement);
  });

  describe('Constructor & Configuration', () => {
    it('should initialize with correct name and priority', () => {
      expect(strategy.name).toBe('NewPlatform');
      expect(strategy.priority).toBe(85);
    });

    it('should accept hostname via dependency injection', () => {
      const customStrategy = new NewPlatformStrategy('custom.newplatform.com');
      expect(customStrategy.hostname).toBe('custom.newplatform.com');
    });
  });

  describe('Platform Detection', () => {
    it('should handle textarea elements with correct data-testid', () => {
      expect(strategy.canHandle(mockElement)).toBe(true);
    });

    it('should handle contenteditable elements', () => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      expect(strategy.canHandle(div)).toBe(true);
    });

    it('should reject non-input elements', () => {
      const span = document.createElement('span');
      expect(strategy.canHandle(span)).toBe(false);
    });
  });

  describe('Content Insertion', () => {
    it('should insert content exactly as given', async () => {
      const content = '  Summarize the metadata: <example>text</example>\n';
      const result = await strategy.insert(mockElement, content);

      expect(result.success).toBe(true);
      expect((mockElement as HTMLTextAreaElement).value).toBe(content);
    });

    it.each(HOSTILE_TEXTS)('should keep hostile-looking text %j as plain text', async (text) => {
      const result = await strategy.insert(mockElement, text);

      expect(result.success).toBe(true);
      expect((mockElement as HTMLTextAreaElement).value).toBe(text);
      expectNoMarkupIn(document.body, ['textarea']);
    });

    it('should insert content into textarea elements', async () => {
      const result = await strategy.insert(mockElement, 'Test content');
      expect(result.success).toBe(true);
      expect((mockElement as HTMLTextAreaElement).value).toBe('Test content');
    });

    it('should dispatch events after insertion', async () => {
      const inputSpy = vi.fn();
      const changeSpy = vi.fn();

      mockElement.addEventListener('input', inputSpy);
      mockElement.addEventListener('change', changeSpy);

      await strategy.insert(mockElement, 'Test');

      expect(inputSpy).toHaveBeenCalled();
      expect(changeSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      const invalidElement = null as unknown as HTMLElement;
      const result = await strategy.insert(invalidElement, 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
```

**Test Coverage Goals**:
- Constructor & configuration: 2-3 tests
- Platform detection: 3-5 tests
- Content insertion: 5-8 tests
- Error handling: 2-3 tests
- **Minimum**: 15-20 tests per platform strategy

---

#### 9. Create Manual QA Document

**File**: `docs/NEWPLATFORM_MANUAL_QA.md`

```markdown
# New Platform Manual QA Test Plan

## Prerequisites
- Chrome browser (v120+)
- Extension loaded as unpacked
- New Platform account
- Debug mode enabled

## Test Scenarios

### 1. Icon Visibility
**Steps:**
1. Navigate to newplatform.com
2. Locate input field
3. Verify icon appears

**Expected:**
- [ ] Icon visible and positioned correctly
- [ ] Icon has proper hover state
- [ ] Icon matches platform's design system

### 2. Content Insertion
**Steps:**
1. Click library icon
2. Select test prompt
3. Verify insertion

**Expected:**
- [ ] Content appears in input field
- [ ] No XSS vulnerabilities
- [ ] Send button becomes enabled

### 3. Performance
**Measurement:**
- Insertion time: <100ms
- No memory leaks after 50 insertions

<!-- Add comprehensive scenarios -->
```

---

#### 10. Build and Test

```bash
# Run unit tests
npm test

# Run linting
npm run lint

# Build extension
npm run build

# Load in Chrome
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Load unpacked → select dist/
# 4. Navigate to newplatform.com
# 5. Test icon appears and insertion works
```

---

#### 11. Update Documentation

**Files to update**:
- `README.md` - Add to supported platforms table
- `docs/PLATFORM_INTEGRATION.md` - Add platform-specific notes
- `docs/CHROME_WEBSTORE_GUIDE.md` - Update supported platforms list

---

### Checklist for New Platform

```markdown
- [ ] Platform configuration added to `config/platforms.ts`
- [ ] Strategy class created in `platforms/newplatform-strategy.ts`
- [ ] Strategy registered in `STRATEGY_REGISTRY`
- [ ] Icon component created (content script + React)
- [ ] Settings UI updated with platform info
- [ ] Manifest permissions added (`host_permissions`, `content_scripts`)
- [ ] Unit tests written (15+ tests)
- [ ] Manual QA document created
- [ ] All tests passing (`npm test`)
- [ ] Linting clean (`npm run lint`)
- [ ] Manual testing completed on real site
- [ ] Documentation updated (README, content-script.md)
- [ ] Performance benchmarks met (<100ms insertion)
- [ ] Security verified (no XSS vulnerabilities)
```

---

## Testing Strategy

### Test Pyramid

```
       ┌─────────────┐
       │   Manual    │
       │   Testing   │  (QA documents, real browser testing)
       └─────────────┘
      ┌───────────────┐
      │  Integration  │
      │     Tests     │  (Cross-module interactions)
      └───────────────┘
    ┌───────────────────┐
    │    Unit Tests     │
    │   (470+ tests)    │  (Individual modules, strategies)
    └───────────────────┘
```

### Testing Levels

| Level | Tools | Coverage | Example |
|-------|-------|----------|---------|
| **Unit** | Vitest + JSDOM | Individual functions, classes | Strategy `canHandle()` method |
| **Integration** | Vitest + JSDOM | Cross-module interactions | Storage → PromptManager flow |
| **Manual** | Chrome DevTools | Real browser, visual, UX | Icon positioning, theme sync |

### Key Test Categories

1. **Strategy Tests** (`platforms/__tests__/`)
   - Constructor configuration
   - `canHandle()` platform detection
   - Insertion method fallback tiers
   - Event dispatching
   - Error handling
   - Performance (caching, throttling)

2. **Component Tests** (`components/__tests__/`)
   - React component rendering
   - User interactions
   - State management
   - Hook behavior

3. **Service Tests** (`services/__tests__/`)
   - Storage operations
   - Prompt management (CRUD, search, duplicates)
   - Settings persistence

4. **Security Tests**
   - Admission (Hidden characters removed, limits refused not shortened, idempotent)
   - Verbatim delivery (text arrives exactly as stored)
   - XSS prevention (`HOSTILE_TEXTS` run through the prompt selector and each insertion path, asserting no markup is created)

---

## Performance Considerations

### 1. Content Script Performance

**Optimization Techniques**:

| Technique | Implementation | Benefit |
|-----------|---------------|---------|
| **WeakMap Caching** | Cache DOM element references | O(n) → O(1) lookups |
| **Query Throttling** | 1-second throttle on page-wide searches | Reduces CPU usage |
| **Mutation Observer Filtering** | Only process input-related mutations | 90% reduction in observer calls |
| **RequestAnimationFrame** | Icon position updates | Smooth 60fps rendering |
| **Intersection Observer** | Visibility tracking | Efficient scroll performance |

**Example: Gemini Strategy Caching**

```typescript
private _quillEditorCache: WeakMap<HTMLElement, HTMLElement | null> = new WeakMap();
private _lastPageWideSearchTime = 0;
private static readonly PAGE_WIDE_SEARCH_THROTTLE_MS = 1000;

private _findQuillEditor(element: HTMLElement): HTMLElement {
  // Cache hit: O(1)
  const cached = this._quillEditorCache.get(element);
  if (cached && document.contains(cached)) {
    return cached;
  }

  // Throttled page-wide search
  const now = Date.now();
  if (now - this._lastPageWideSearchTime > 1000) {
    this._lastPageWideSearchTime = now;
    const quillEditor = document.querySelector('.ql-editor');
    this._quillEditorCache.set(element, quillEditor);
  }

  return element; // Fallback
}
```

**Performance Impact**:
- First lookup: 1-5ms (page-wide search)
- Subsequent lookups: <0.1ms (cache hit)
- Memory overhead: <200 bytes (WeakMap auto-GC)

---

### 2. React Component Performance

**Optimization Techniques**:

```typescript
// Memoization
const siteInfo = useMemo(() => ({
  'claude.ai': { name: 'Claude', ... },
  // ... expensive computation
}), []);

// Callback stability
const handleToggle = useCallback((site: string) => {
  // ... handler logic
}, [dependencies]);

// Conditional rendering
{isLoading ? <Spinner /> : <PromptList prompts={prompts} />}
```

---

### 3. Storage Performance

**Locking for Race Conditions** (`AsyncMutex`, `src/utils/asyncMutex.ts`):

```typescript
// StorageManager: one keyed lock per storage key, shared across the popup, the side panel
// and the service worker through the Web Locks API (in-memory queue where it is missing)
private readonly mutex = new AsyncMutex({ scope: 'StorageManager' });

return this.mutex.withLock('prompts', async () => {
  // read, decide, write: no other context can write 'prompts' in between
});
```

**Benefits**:
- Prevents race conditions on concurrent storage access
- Ensures data consistency
- No data corruption

---

## Security Architecture

Prompt text is **Verbatim**: what the user saves is what the popup shows, what Copy copies and what Insertion delivers, with nothing stripped, escaped or shortened on the way. Safety rests on three things rather than on layers of pattern-based sanitizing: text is checked **once**, at Admission, on the write path; no place in the extension interprets Prompt text as markup; and the write path is enforced by the compiler.

The terms (Prompt, Admission, Verbatim, Hidden character) are defined in [`CONTEXT.md`](../CONTEXT.md). The decision and its trade-offs are recorded in [ADR-001](./adr/ADR-001-store-and-deliver-prompts-verbatim.md).

### Defense Layers

```
Text enters the Library
(create, edit, Share code, Backup restore; Category create, rename, restore)
    ↓
┌─────────────────────────────────────┐
│ Layer 1: Admission (once, on write) │
│ - Hidden characters removed         │
│ - Title and Category trimmed        │
│ - Empty or over-limit text refused  │
│   (never shortened)                 │
└─────────────────────────────────────┘
    ↓
Stored Verbatim
    ↓
┌─────────────────────────────────────┐
│ Layer 2: Verbatim delivery          │
│ - Reading never writes              │
│ - No sanitizing, trimming or        │
│   truncating on read or insertion   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Layer 3: No HTML sink for text      │
│ - textContent / value               │
│ - execCommand('insertText')         │
│ - Editor text APIs, React text      │
│ - Never innerHTML                   │
└─────────────────────────────────────┘
    ↓
Prompt selector / chat input (text stays text)
```

### Admission (the write path)

`src/services/promptAdmission.ts` is a pure module (no `chrome.*`) shared by the popup, the service worker and the content script. Every route that puts text into the Library is admitted the same way, including text the user typed or pasted: creating or editing a Prompt, opening a Share code, restoring a Backup, and creating, renaming or restoring a Category. The check runs inside the text-writing methods of `StorageManager` (`savePrompt`, `updatePrompt`, `importPrompt`, `saveCategory`, `updateCategory`, `importCategory`), so no route can skip it. Callers handle a refusal (`AdmissionRefusedError`); a form can ask the same module whether text would be admitted, without saving, by calling the pure `admit()`.

| Rule | Behaviour |
|------|-----------|
| **Hidden characters** | Removed, and nothing else is removed: control characters other than newline, carriage return and tab; U+200B; bidirectional embeddings, overrides and isolates; U+2060-U+206F; the byte-order mark; Unicode tag characters (U+E0000-U+E007F) except inside the England, Scotland and Wales flag emoji |
| **Kept** | U+200C and U+200D (joiners in emoji, Persian and Indic words), U+200E and U+200F (direction marks), variation selectors, and all visible text, including angle-bracket tags such as `<example>` |
| **Trimming** | Title and Category names are trimmed; content never is. Content that is only whitespace is refused as empty |
| **Size limits** | `PROMPT_LIMITS`: title 100, content 20,000, Category name 50 characters. Over-limit text is refused, never shortened. A Backup restore skips and reports refused Prompts and restores the rest |
| **Idempotent** | Admitting text that has already been admitted changes nothing |

### Types and the single typed writer

- `StoredPrompt` is a Prompt as read from storage; `AdmittedPrompt` is a Prompt whose text has just been through Admission. Both are classes with a private member, so they are nominal: an object literal or an object spread cannot be assigned to them (a `unique symbol` brand would survive spread and could be forged). They widen to a plain `Prompt`, so UI code is unaffected.
- Only `readPrompt()` / `readPrompts()` make a `StoredPrompt`, and only `admitNew()`, `admitEdit()` and `admitRestored()` make an `AdmittedPrompt`.
- `StorageManager.writePrompts()` is the only way to write the `prompts` key and accepts only those types, so a route that skips Admission does not compile.
- The one documented exception is `StorageManager.writeScrubbed()`, used only by `upgradeStoredData()`. The upgrade pass works on raw stored entries and must keep ones that are malformed or already over the limits rather than drop them, so it cannot go through the typed writer. It writes only the keys it is given, in one atomic `set`.
- The guarantee covers the write method, not raw `chrome.storage.local` calls, and `as unknown as` casts still compile. The types do not survive JSON or messaging, so a receiver re-parses with `readPrompts()`.

### Existing data (upgrade pass)

On extension update the service worker (`chrome.runtime.onInstalled`, reason `update`) calls `StorageManager.upgradeStoredData()`, which cleans stored Prompts and Category names of Hidden characters once. It works on raw stored values, never refuses, trims, shortens or deletes a Prompt (including one already over the limits), writes nothing when there is nothing to clean, and is safe to run any number of times. If cleaning makes two Category names the same, the later Category is merged into the first; its Prompts already name the kept one.

### Delivery: no HTML sink for Prompt text

- **Reading**: the content script reads Prompts through the shared `readPrompts()` (`getPrompts()` in `src/content/utils/storage.ts`). Reading never writes. Entries that are not Prompts at all are skipped, but no Prompt is changed, truncated or dropped because of what its text says.
- **Prompt selector**: `createPromptListItem()` sets title, Category and preview as text and passes the Prompt id through unchanged.
- **Insertion**: strategies only set text, through `value`, `textContent` or text nodes, `document.execCommand('insertText')`, or the editor's own text API (ProseMirror `insertText`, Quill `setText`). Nothing is parsed as markup.
- **No HTML sink**: the only `innerHTML` assignment in the extension source sets a static help banner in the element picker, with no interpolated text.

### Where DOMPurify is still used

DOMPurify is not applied to Prompt text on write, on read, on insertion or on display (the search highlight in `PromptCard` splits the stored title around matches and React renders every part as text). One narrow role remains:

- **Configuration security** (`src/utils/configurationSecurity.ts`): text fields of custom site configurations, which can arrive through shared configuration codes, are sanitized with no tags or attributes allowed.

### Security Best Practices

1. **Never use `innerHTML` for Prompt text** - Always use `createTextNode()`, `textContent` or `value`
2. **Admit once** - At the write path (`promptAdmission`), never again on read or insertion
3. **Never rewrite Prompt text on read or insertion** - It is Verbatim; over-limit text is refused at Admission, never shortened
4. **Never write the `prompts` key directly** - Go through `StorageManager`, whose typed writer is what makes Admission impossible to skip
5. **Read stored Prompts with `readPrompts()`** - One definition of a stored Prompt for every bundle; entries that are not Prompts are skipped
6. **Use Content Security Policy** - Compatible with strict CSP
7. **Audit sensitive operations** - Element picker logs security events

**Example: Secure DOM Construction**

```typescript
// ❌ UNSAFE - Prompt text would be parsed as markup
element.innerHTML = promptContent;

// ✅ SAFE - Prompt text stays text, exactly as stored
const textNode = document.createTextNode(promptContent);
element.appendChild(textNode);
```

---

## Conclusion

This architecture provides:

- ✅ **Extensibility**: Easy to add new platforms (Strategy Pattern)
- ✅ **Testability**: Dependency injection, modular design
- ✅ **Performance**: Caching, throttling, efficient DOM operations
- ✅ **Security**: Admission once at the write path, Verbatim delivery, no HTML sink for Prompt text
- ✅ **Maintainability**: Clear separation of concerns, comprehensive documentation

Follow this guide when adding new platforms or modifying existing components to maintain architectural consistency and code quality.

---

**Last Updated**: 2026-10-12
**Version**: 1.5.0
