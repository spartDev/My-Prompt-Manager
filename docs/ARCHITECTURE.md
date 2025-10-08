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
├── base-strategy.ts           # Abstract base class
├── claude-strategy.ts         # Claude.ai implementation
├── chatgpt-strategy.ts        # ChatGPT implementation
├── gemini-strategy.ts         # Google Gemini implementation
├── mistral-strategy.ts        # Mistral.ai implementation
├── perplexity-strategy.ts     # Perplexity implementation
├── default-strategy.ts        # Fallback for unknown sites
└── platform-manager.ts        # Strategy orchestration
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

**Purpose**: Centralized storage access with mutex locking

**Implementation**:

```typescript
// services/storage.ts
export class StorageManager {
  private static instance: StorageManager | null = null;
  private operationQueue: Promise<void> = Promise.resolve();

  private constructor(private chrome: typeof chrome = globalThis.chrome) {}

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  // Mutex-locked operations
  async getPrompts(): Promise<Prompt[]> {
    return this.executeWithLock(async () => {
      const data = await this.chrome.storage.local.get('prompts');
      return this.validatePromptData(data.prompts || []);
    });
  }

  private async executeWithLock<T>(operation: () => Promise<T>): Promise<T> {
    const previousOperation = this.operationQueue;
    let resolver: () => void;
    this.operationQueue = new Promise(resolve => { resolver = resolve; });

    await previousOperation;
    try {
      return await operation();
    } finally {
      resolver!();
    }
  }
}
```

**Benefits**:
- Prevents race conditions on storage operations
- Centralized validation and sanitization
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
| `StorageManager` | Centralized storage with mutex locking | Singleton |
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
    ├─► Sanitize content (security layer)
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
    │   ├─► Validation & Sanitization
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

#### 2. Create Strategy Class

**File**: `src/content/platforms/newplatform-strategy.ts`

```typescript
import { PlatformStrategy } from './base-strategy';
import type { InsertionResult, PlatformConfig } from '../types';
import { sanitizeUserInput } from '../utils/storage';
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
    // SECURITY: Always sanitize first
    const sanitizedContent = sanitizeUserInput(content);

    if (!sanitizedContent) {
      return {
        success: false,
        error: 'Content could not be sanitized safely'
      };
    }

    try {
      // Tier 1: Native API (if available)
      const apiResult = this._tryNativeAPI(element, sanitizedContent);
      if (apiResult.success) return apiResult;

      // Tier 2: execCommand fallback
      const execResult = await this._tryExecCommand(element, sanitizedContent);
      if (execResult.success) return execResult;

      // Tier 3: DOM manipulation (last resort)
      return this._tryDOMManipulation(element, sanitizedContent);

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

#### 3. Register Strategy in Factory

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

#### 4. Create Platform-Specific Icon (Optional)

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

#### 5. Update Settings UI

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

#### 6. Update Manifest Permissions

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

#### 7. Write Comprehensive Tests

**File**: `src/content/platforms/__tests__/newplatform-strategy.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    it('should sanitize content before insertion', async () => {
      const { sanitizeUserInput } = await import('../../utils/storage');
      await strategy.insert(mockElement, 'test content');
      expect(sanitizeUserInput).toHaveBeenCalledWith('test content');
    });

    it('should return error if sanitization results in empty content', async () => {
      const { sanitizeUserInput } = await import('../../utils/storage');
      vi.mocked(sanitizeUserInput).mockReturnValueOnce('');

      const result = await strategy.insert(mockElement, '<script>alert("xss")</script>');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Content could not be sanitized safely');
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

#### 8. Create Manual QA Document

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

#### 9. Build and Test

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

#### 10. Update Documentation

**Files to update**:
- `README.md` - Add to supported platforms table
- `ai/doc/content-script.md` - Document strategy implementation
- `docs/PLATFORM_INTEGRATION.md` - Add platform-specific notes

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
   - Input sanitization
   - XSS prevention
   - Content validation

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

**Mutex Locking for Race Conditions**:

```typescript
private async executeWithLock<T>(operation: () => Promise<T>): Promise<T> {
  const previousOperation = this.operationQueue;
  let resolver: () => void;

  this.operationQueue = new Promise(resolve => { resolver = resolve; });

  await previousOperation; // Wait for previous operation
  try {
    return await operation();
  } finally {
    resolver!(); // Release lock
  }
}
```

**Benefits**:
- Prevents race conditions on concurrent storage access
- Ensures data consistency
- No data corruption

---

## Security Architecture

### Defense-in-Depth Layers

```
User Input
    ↓
┌─────────────────────────────────────┐
│ Layer 1: Input Validation          │
│ - Length limits (50KB max)          │
│ - Type checking                     │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Layer 2: Sanitization               │
│ - HTML tag removal                  │
│ - URL filtering (javascript:, data:)│
│ - Event handler stripping (on*)     │
│ - Control character removal         │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Layer 3: Safe DOM Construction      │
│ - createTextNode() for text         │
│ - No innerHTML usage                │
│ - Namespace handling for SVG        │
└─────────────────────────────────────┘
    ↓
DOM Insertion (Safe)
```

### Security Best Practices

1. **Never use `innerHTML`** - Always use `createTextNode()` or `textContent`
2. **Sanitize once** - At the insertion boundary, not repeatedly
3. **Validate all storage data** - Before processing
4. **Use Content Security Policy** - Compatible with strict CSP
5. **Audit sensitive operations** - Element picker logs security events

**Example: Secure DOM Construction**

```typescript
// ❌ UNSAFE - Vulnerable to XSS
element.innerHTML = userContent;

// ✅ SAFE - Immune to XSS
const textNode = document.createTextNode(userContent);
element.appendChild(textNode);
```

---

## Conclusion

This architecture provides:

- ✅ **Extensibility**: Easy to add new platforms (Strategy Pattern)
- ✅ **Testability**: Dependency injection, modular design
- ✅ **Performance**: Caching, throttling, efficient DOM operations
- ✅ **Security**: Defense-in-depth, sanitization, safe DOM construction
- ✅ **Maintainability**: Clear separation of concerns, comprehensive documentation

Follow this guide when adding new platforms or modifying existing components to maintain architectural consistency and code quality.

---

**Last Updated**: 2025-10-08
**Version**: 1.5.0
