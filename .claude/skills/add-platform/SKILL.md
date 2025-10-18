---
name: Platform Integration Workflow
description: Guide for adding new AI platform support (e.g., Gemini, Mistral, Anthropic) to the Chrome extension with strategy pattern and testing requirements
---

# Platform Integration Workflow

This skill guides you through adding support for new AI platforms (like Gemini, Mistral.ai, Meta AI, etc.) to the My Prompt Manager Chrome extension.

## When to Use This Skill

- User asks to add support for a new AI platform or website
- User mentions "add platform", "support [platform name]", "integrate with [AI]"
- User wants the prompt library icon to appear on a new AI chat interface
- User asks about platform compatibility or extending platform support

## Overview

Adding a new platform requires a **10-step workflow** using the centralized configuration system introduced in v1.3+. The process takes approximately 15-30 minutes for basic support.

**Architecture Pattern:** Strategy Pattern + Centralized Configuration
- Each platform has a strategy class extending `PlatformStrategy`
- All platforms are registered in `src/config/platforms.ts`
- Platform detection, injection, and insertion are handled automatically

## Prerequisites

Before starting, ensure you have:
1. The target platform URL (e.g., `gemini.google.com`)
2. Browser DevTools open on the target platform
3. Understanding of the input element type (textarea vs contenteditable)

## 10-Step Integration Workflow

### Step 1: Inspect the Target Platform

**Action:** Open browser DevTools on the target platform and identify:

```javascript
// In browser console, test selectors:
document.querySelectorAll('textarea[placeholder*="message"]')
document.querySelectorAll('div[contenteditable="true"]')
document.querySelectorAll('[role="textbox"]')
```

**What to find:**
- CSS selector for the text input element
- Container where the icon should be placed
- Input element type (textarea, contenteditable, or custom)

**Common patterns:**
- ChatGPT: `textarea[data-testid="chat-input"]`
- Claude: `div[contenteditable="true"][role="textbox"]`
- Perplexity: `textarea[placeholder*="Ask"]`

### Step 2: Add Platform Configuration

**File:** `src/config/platforms.ts`

**Action:** Add a new entry to the `SUPPORTED_PLATFORMS` object:

```typescript
export const SUPPORTED_PLATFORMS: Record<string, PlatformDefinition> = {
  // ... existing platforms ...

  yourplatform: {
    id: 'yourplatform',                          // Unique ID (lowercase, no spaces)
    hostname: 'your-ai-platform.com',            // Exact hostname
    displayName: 'Your AI Platform',             // Human-readable name
    priority: 70,                                 // 60-79 for new platforms
    defaultEnabled: true,                         // Include in fresh installs
    selectors: [                                  // CSS selectors (most specific first)
      'textarea[data-testid="chat-input"]',
      'div[contenteditable="true"][role="textbox"]',
      '[role="textbox"]'                         // Generic fallback
    ],
    buttonContainerSelector: '.toolbar-container', // Where to place icon (optional)
    strategyClass: 'YourPlatformStrategy',        // Strategy class name
    hostnamePatterns: ['yourplatform', 'your-ai'] // Additional hostname patterns
  }
};
```

**Priority Guidelines:**
- 100: Premium platforms (Claude, ChatGPT)
- 80-90: Major platforms (Perplexity, Mistral, Gemini)
- 60-79: Secondary platforms (new additions)
- < 60: Experimental/beta platforms

### Step 3: Create the Platform Strategy

**File:** `src/content/platforms/yourplatform-strategy.ts`

**Action:** Create a new strategy class:

```typescript
import { getPlatformById } from '../../config/platforms';
import type { InsertionResult } from '../types/index';
import type { UIElementFactory } from '../ui/element-factory';
import { PlatformStrategy } from './base-strategy';

export class YourPlatformStrategy extends PlatformStrategy {
  constructor(hostname?: string) {
    super('yourplatform', 70, {
      selectors: [
        'textarea[placeholder*="Enter your message"]',
        'div[contenteditable="true"][role="textbox"]'
      ],
      buttonContainerSelector: '.toolbar-container',
      priority: 70
    }, hostname);
  }

  /**
   * Determines if this strategy can handle the element
   * Handles any element on your-ai-platform.com
   */
  canHandle(_element: HTMLElement): boolean {
    return this.hostname === getPlatformById('yourplatform')?.hostname;
  }

  /**
   * Inserts content using platform-compatible methods
   */
  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      // Focus the element first
      element.focus();
      element.click();

      // Wait for platform initialization
      await new Promise(resolve => setTimeout(resolve, 50));

      // Method 1: Try for textarea elements
      if (element.tagName === 'TEXTAREA') {
        (element as HTMLTextAreaElement).value = content;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true, method: 'yourplatform-textarea' };
      }

      // Method 2: Try for contenteditable elements
      if (element.contentEditable === 'true') {
        // Clear existing content
        element.textContent = '';

        // Insert new content
        const inserted = document.execCommand('insertText', false, content);

        if (inserted) {
          // Trigger platform events
          element.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: content
          }));

          return { success: true, method: 'yourplatform-execCommand' };
        }
      }

      return { success: false, error: 'Unsupported element type' };

    } catch (error) {
      this._error('Insertion failed', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Gets selectors for finding input elements
   */
  getSelectors(): string[] {
    return this.config?.selectors || [];
  }

  /**
   * Creates platform-specific icon using the UI factory
   */
  createIcon(uiFactory: UIElementFactory): HTMLElement | null {
    return uiFactory.createFloatingIcon(); // Use generic icon
    // OR: return uiFactory.createYourPlatformIcon(); // Custom icon
  }
}
```

**Reference Example:** See `src/content/platforms/perplexity-strategy.ts` for a complete implementation with multiple fallback methods.

### Step 4: Register the Strategy

**File:** `src/content/platforms/index.ts`

**Action:** Add export for your strategy:

```typescript
export { YourPlatformStrategy } from './yourplatform-strategy';
```

**File:** `src/content/platforms/platform-manager.ts`

**Action:** Import and register in the constructor:

```typescript
// Add import at top
import { YourPlatformStrategy } from './yourplatform-strategy';

// In the constructor, add to the strategies array:
constructor(options: PlatformManagerOptions = {}) {
  this.strategies = [
    new ClaudeStrategy(),
    new ChatGPTStrategy(),
    new PerplexityStrategy(),
    new MistralStrategy(),
    new GeminiStrategy(),
    new YourPlatformStrategy(), // Add your strategy here
    new DefaultStrategy()       // IMPORTANT: Keep DefaultStrategy last
  ];
  // ... rest of constructor
}
```

### Step 5: Update Manifest Permissions (if needed)

**File:** `manifest.json`

**Action:** If the platform hostname is not already covered by `<all_urls>`, add it to content_scripts matches:

```json
{
  "content_scripts": [
    {
      "matches": [
        "https://*.your-ai-platform.com/*"
      ],
      "js": ["src/content/index.ts"],
      "css": ["src/content/styles/injected-icon.css"]
    }
  ]
}
```

**Note:** The extension uses `<all_urls>` host_permissions, so this step is usually not needed.

### Step 6: Create Unit Tests

**File:** `src/content/platforms/__tests__/yourplatform-strategy.test.ts`

**Action:** Create comprehensive tests:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { YourPlatformStrategy } from '../yourplatform-strategy';

describe('YourPlatformStrategy', () => {
  let strategy: YourPlatformStrategy;

  beforeEach(() => {
    strategy = new YourPlatformStrategy('your-ai-platform.com');
  });

  describe('canHandle', () => {
    it('returns true for your-ai-platform.com', () => {
      const element = document.createElement('textarea');
      expect(strategy.canHandle(element)).toBe(true);
    });

    it('returns false for other hostnames', () => {
      const otherStrategy = new YourPlatformStrategy('other-site.com');
      const element = document.createElement('textarea');
      expect(otherStrategy.canHandle(element)).toBe(false);
    });
  });

  describe('insert', () => {
    it('inserts content into textarea element', async () => {
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      const result = await strategy.insert(textarea, 'Test content');

      expect(result.success).toBe(true);
      expect(textarea.value).toBe('Test content');
      expect(result.method).toBe('yourplatform-textarea');

      document.body.removeChild(textarea);
    });

    it('inserts content into contenteditable element', async () => {
      const div = document.createElement('div');
      div.contentEditable = 'true';
      div.setAttribute('role', 'textbox');
      document.body.appendChild(div);

      const result = await strategy.insert(div, 'Test content');

      expect(result.success).toBe(true);
      expect(div.textContent).toContain('Test content');

      document.body.removeChild(div);
    });

    it('returns error for unsupported elements', async () => {
      const span = document.createElement('span');
      const result = await strategy.insert(span, 'Test content');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getSelectors', () => {
    it('returns configured selectors', () => {
      const selectors = strategy.getSelectors();
      expect(selectors).toBeInstanceOf(Array);
      expect(selectors.length).toBeGreaterThan(0);
    });
  });
});
```

### Step 7: Test Locally

**Action:** Build and load the extension:

```bash
# Build the extension
npm run build

# Load in Chrome:
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select the dist/ folder
```

**Manual Testing Checklist:**
- [ ] Visit your-ai-platform.com
- [ ] Verify the prompt library icon appears
- [ ] Check icon positioning is correct
- [ ] Click the icon to open prompt selector
- [ ] Select a prompt from the library
- [ ] Verify content is inserted into the input field
- [ ] Confirm the platform recognizes the inserted content
- [ ] Test in both light and dark mode
- [ ] Check browser console for errors

**Debug Mode:**
```javascript
// Enable debug logging in browser console:
localStorage.setItem('prompt-library-debug', 'true');
// Then reload the page

// Check debug interface:
console.log(window.__promptLibraryDebug?.strategies);
console.log(window.__promptLibraryDebug?.activeStrategy);
console.log(window.__promptLibraryDebug?.foundElements);
```

### Step 8: Run Automated Tests

**Action:** Ensure all tests pass:

```bash
# Run unit tests
npm test

# Run specific test file
npm test -- yourplatform-strategy.test.ts

# Run with coverage
npm run test:coverage
```

**CRITICAL:** Both tests and linting MUST pass before proceeding:

```bash
# Run linting
npm run lint

# Fix linting issues automatically
npm run lint:fix
```

### Step 9: Create Platform Icon (Optional)

**File:** `src/components/icons/SiteIcons.tsx`

**Action:** Add a custom icon component:

```typescript
export const YourPlatformIcon: React.FC<{ className?: string; disabled?: boolean }> = ({
  className = 'h-6 w-6',
  disabled = false
}) => {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      {/* Your platform's SVG path */}
      <path
        d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"
        fill={disabled ? 'currentColor' : '#YOUR_BRAND_COLOR'}
      />
    </svg>
  );
};
```

**File:** `src/content/ui/element-factory.ts`

**Action:** Add icon creation method:

```typescript
createYourPlatformIcon(): HTMLElement {
  const button = this._createBaseButton();
  button.innerHTML = `
    <svg class="prompt-library-icon" viewBox="0 0 24 24">
      <!-- Your platform's SVG path -->
    </svg>
    <span class="prompt-library-tooltip">My Prompts</span>
  `;
  return button;
}
```

### Step 10: Update Documentation

**File:** `docs/PLATFORM_INTEGRATION.md`

**Action:** Add your platform to the examples section:

```markdown
### Example: Your Platform

\`\`\`typescript
export class YourPlatformStrategy extends PlatformStrategy {
  constructor() {
    super('yourplatform', 70, {
      selectors: ['textarea[data-testid="input"]'],
      priority: 70
    });
  }

  canHandle(_element: HTMLElement): boolean {
    return this.hostname === 'your-ai-platform.com';
  }

  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    // Implementation details...
  }
}
\`\`\`
```

**File:** `README.md`

**Action:** Add to the supported platforms list:

```markdown
- **Your Platform** - Full support for prompt injection
```

## Common Pitfalls and Solutions

### Pitfall 1: Button Doesn't Appear

**Symptoms:** Icon doesn't show up on the platform

**Solutions:**
1. Check `canHandle()` returns true for your domain
2. Verify selectors match actual DOM elements using DevTools
3. Ensure strategy is registered in `platform-manager.ts`
4. Check browser console for injection errors
5. Verify hostname in `platforms.ts` matches exactly

**Debug:**
```javascript
// In browser console:
document.querySelectorAll('your-selector-here')
window.__promptLibraryDebug?.strategies
```

### Pitfall 2: Button Appears in Wrong Location

**Symptoms:** Icon is visible but poorly positioned

**Solutions:**
1. Update `buttonContainerSelector` in `platforms.ts`
2. Add platform-specific positioning in `src/content/core/injector.ts`
3. Use multiple container selectors (comma-separated) for fallbacks

**Example:**
```typescript
buttonContainerSelector: [
  '.primary-container',   // Try first
  '.fallback-container',  // Then this
  '.generic-container'    // Final fallback
].join(', ')
```

### Pitfall 3: Content Doesn't Insert

**Symptoms:** Icon works, but prompt doesn't appear in input

**Solutions:**
1. Verify correct element type (textarea vs contenteditable)
2. Try multiple insertion methods (execCommand, textContent, value)
3. Add comprehensive event triggering
4. Wait for platform initialization (50-100ms delay)

**Pattern - Multiple Fallback Methods:**
```typescript
async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
  // Method 1: execCommand
  const execResult = await this._tryExecCommand(element, content);
  if (execResult.success) return execResult;

  // Method 2: Direct assignment
  const directResult = this._tryDirectAssignment(element, content);
  if (directResult.success) return directResult;

  // Method 3: DOM manipulation
  return this._tryDOMManipulation(element, content);
}
```

### Pitfall 4: Platform Doesn't Recognize Content

**Symptoms:** Text appears but submit button stays disabled

**Solutions:**
1. Add platform-specific events (input, change, keyup)
2. Trigger composition events (compositionstart, compositionend)
3. Set focus properly before insertion
4. Check if platform uses React/Vue (may need special handling)

**Comprehensive Event Triggering:**
```typescript
private _triggerEvents(element: HTMLElement, content: string): void {
  // Primary input event
  element.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: content
  }));

  // Secondary events
  const events = ['change', 'keyup', 'compositionend', 'blur', 'focus'];
  events.forEach(eventType => {
    element.dispatchEvent(new Event(eventType, { bubbles: true }));
  });
}
```

### Pitfall 5: Tests Fail After Implementation

**Symptoms:** Manual testing works but automated tests fail

**Solutions:**
1. Ensure DOM elements are properly created in tests
2. Mock `getPlatformById()` if needed
3. Add elements to `document.body` before testing
4. Clean up DOM elements after each test

**Proper Test Setup:**
```typescript
describe('insert', () => {
  it('inserts into textarea', async () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea); // Add to DOM

    const result = await strategy.insert(textarea, 'Test');

    expect(result.success).toBe(true);

    document.body.removeChild(textarea); // Clean up
  });
});
```

## Advanced Patterns

### Pattern 1: React-Based Platforms

For platforms using React, you may need to trigger React's internal event system:

```typescript
private _setReactValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value'
  )?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
```

### Pattern 2: Shadow DOM Elements

For platforms using Shadow DOM:

```typescript
getSelectors(): string[] {
  // Check for shadow DOM
  const shadowHost = document.querySelector('your-shadow-host');
  if (shadowHost?.shadowRoot) {
    const shadowInput = shadowHost.shadowRoot.querySelector('textarea');
    if (shadowInput) {
      return []; // Handle separately
    }
  }
  return this.config?.selectors || [];
}
```

### Pattern 3: Dynamic Input Elements

For platforms that create inputs dynamically:

```typescript
async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
  // Wait for element to be fully initialized
  await this._waitForReady(element);

  // Then proceed with insertion
  // ...
}

private async _waitForReady(element: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    if (element.isConnected && element.offsetParent !== null) {
      resolve();
    } else {
      const observer = new MutationObserver(() => {
        if (element.isConnected && element.offsetParent !== null) {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  });
}
```

## Quick Reference Checklist

Use this checklist when adding a new platform:

- [ ] **Step 1:** Identified input element selector
- [ ] **Step 2:** Added platform to `src/config/platforms.ts`
- [ ] **Step 3:** Created strategy class in `src/content/platforms/`
- [ ] **Step 4:** Registered strategy in `platform-manager.ts` and `index.ts`
- [ ] **Step 5:** Updated manifest permissions (if needed)
- [ ] **Step 6:** Created unit tests
- [ ] **Step 7:** Tested manually in browser
- [ ] **Step 8:** All tests pass (`npm test`)
- [ ] **Step 8:** Linting passes (`npm run lint`)
- [ ] **Step 9:** Created custom icon (optional)
- [ ] **Step 10:** Updated documentation

## Related Documentation

- **Architecture Deep Dive:** `docs/ARCHITECTURE.md`
- **Platform Integration Guide:** `docs/PLATFORM_INTEGRATION.md` (comprehensive examples)
- **Testing Guide:** `docs/TESTING.md`
- **Component Catalog:** `docs/COMPONENTS.md`

## Success Criteria

Your platform integration is complete when:

1. Icon appears on the target platform without errors
2. Icon is positioned correctly and doesn't interfere with UI
3. Clicking icon opens the prompt selector
4. Selected prompts insert correctly into the input field
5. Platform recognizes the inserted content (submit button enabled)
6. All automated tests pass
7. ESLint shows no errors or warnings
8. Works in both light and dark mode
9. No console errors or warnings
10. Code follows existing patterns and style

---

**Last Updated:** 2025-10-18
**Skill Version:** 1.0.0
