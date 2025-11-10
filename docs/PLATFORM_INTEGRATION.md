# Platform Integration Guide

This guide explains how to add support for new LLM platforms (like Gemini, Mistral.ai, Anthropic Claude, etc.) to the My Prompt Manager extension.

> **⚡ New in v1.3+**: Adding basic platform support now takes just **5 minutes** with our centralized configuration system!

## Table of Contents

- [🚀 Quick Start (New Method)](#-quick-start-new-method)
- [📋 Configuration Reference](#-configuration-reference)
- [🔧 Advanced Integration](#-advanced-integration)
- [🧪 Testing and Debugging](#-testing-and-debugging)
- [💡 Best Practices](#-best-practices)
- [📚 Examples](#-examples)
- [🐛 Troubleshooting](#-troubleshooting)

## 🚀 Quick Start (New Method)

Adding a new platform is now incredibly simple! You only need to update **one file**.

### Step 1: Add Platform Configuration

Edit `src/config/platforms.ts` and add your platform to the `SUPPORTED_PLATFORMS` object:

```typescript
export const SUPPORTED_PLATFORMS: Record<string, PlatformDefinition> = {
  // ... existing platforms ...

  yourplatform: {
    id: 'yourplatform',
    hostname: 'your-ai-platform.com',
    displayName: 'Your AI Platform',
    priority: 70, // Lower than existing platforms
    defaultEnabled: true, // Include in fresh installs
    selectors: [
      'textarea[placeholder*="Ask"]',
      'div[contenteditable="true"]',
      '[role="textbox"]'
    ],
    buttonContainerSelector: '.button-container', // Where to place icon
    strategyClass: 'YourPlatformStrategy', // For future custom logic
    hostnamePatterns: ['yourplatform'], // For hostname matching
    brandColors: {
      enabled: 'bg-[#123456] text-white shadow-sm', // Matches platform brand styling
      disabled: 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
    }
  }
};
```

### Step 2: Test Your Integration

1. Build the extension: `npm run build`
2. Load in Chrome and visit your platform
3. The prompt library icon should appear automatically!

**That's it!** 🎉 The centralized config system handles:
- ✅ Background script injection
- ✅ Content script default settings
- ✅ Platform detection and matching
- ✅ Type definitions

## 📋 Configuration Reference

### PlatformDefinition Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique platform identifier (lowercase, no spaces) |
| `hostname` | string | ✅ | Exact hostname (e.g., 'claude.ai') |
| `displayName` | string | ✅ | Human-readable name shown in UI |
| `priority` | number | ✅ | Strategy selection priority (100 = highest) |
| `defaultEnabled` | boolean | ✅ | Include in default enabled platforms for new users |
| `selectors` | string[] | ✅ | CSS selectors for finding text input elements |
| `buttonContainerSelector` | string | ❌ | Where to place the library icon |
| `strategyClass` | string | ✅ | Class name for custom strategy (future use) |
| `hostnamePatterns` | string[] | ❌ | Additional hostname patterns for detection |
| `brandColors` | BrandColorScheme | ❌ | Tailwind class strings for enabled/disabled badges; defaults to green gradient when omitted |

### Priority Guidelines

- **100**: Premium platforms (Claude, ChatGPT)
- **80-90**: Major platforms (Perplexity, Mistral)
- **60-79**: Secondary platforms
- **40-59**: Experimental/beta platforms
- **< 40**: Custom/niche platforms

## 🔧 Advanced Integration

For platforms that need custom insertion logic or special handling, you'll need to create a custom strategy class.

### Architecture Overview

```
src/
├── config/platforms.ts           # ⭐ Centralized configuration
├── content/platforms/
│   ├── base-strategy.ts          # Base class with common functionality
│   ├── claude-strategy.ts        # Claude.ai implementation
│   ├── chatgpt-strategy.ts       # ChatGPT implementation
│   ├── mistral-strategy.ts       # Mistral LeChat implementation
│   ├── perplexity-strategy.ts    # Perplexity implementation
│   ├── your-platform-strategy.ts # Your custom strategy
│   └── platform-manager.ts      # Registers and manages strategies
└── background/background.ts      # Uses centralized config
```

## Step-by-Step Guide

### Step 1: Create the Platform Strategy

Create a new file: `src/content/platforms/your-platform-strategy.ts`

```typescript
import type { InsertionResult } from '../types/index';
import type { UIElementFactory } from '../ui/element-factory';
import { PlatformStrategy } from './base-strategy';

export class YourPlatformStrategy extends PlatformStrategy {
  constructor() {
    super('your-platform', 90, {
      selectors: [
        // CSS selectors for finding text input elements
        'textarea[placeholder*="Enter your message"]',
        'div[contenteditable="true"][role="textbox"]'
      ],
      buttonContainerSelector: '.toolbar, .input-actions', // Where to place the button
      priority: 90 // Higher = more priority (Claude: 100, ChatGPT: 90, Perplexity: 80)
    });
  }

  /**
   * Determines if this strategy should handle elements on this domain
   */
  canHandle(_element: HTMLElement): boolean {
    return this.hostname === 'your-platform.com';
  }

  /**
   * Inserts content into the target element
   */
  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      // Focus the element
      element.focus();
      element.click();
      
      // Method 1: Try for textarea elements
      if (element.tagName === 'TEXTAREA') {
        (element as HTMLTextAreaElement).value = content;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        return { success: true, method: 'textarea' };
      }
      
      // Method 2: Try for contenteditable elements  
      if (element.contentEditable === 'true') {
        element.textContent = content;
        
        // Trigger events the platform expects
        const inputEvent = new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: content
        });
        element.dispatchEvent(inputEvent);
        
        return { success: true, method: 'contenteditable' };
      }
      
      return { success: false, error: 'Unsupported element type' };
      
    } catch (error) {
      this._error('Insertion failed', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Creates platform-specific icon (optional - can use generic)
   */
  createIcon(uiFactory: UIElementFactory): HTMLElement | null {
    return uiFactory.createFloatingIcon(); // Use generic icon
    // OR create custom: uiFactory.createYourPlatformIcon();
  }
}
```

### Step 2: Register the Strategy

#### 2a. Add to exports in `src/content/platforms/index.ts`:

```typescript
export { YourPlatformStrategy } from './your-platform-strategy';
```

#### 2b. Register in `src/content/platforms/platform-manager.ts`:

```typescript
// Add import at top
import { YourPlatformStrategy } from './your-platform-strategy';

// In the constructor, add to the strategies array:
constructor(options: PlatformManagerOptions = {}) {
  this.strategies = [
    new ClaudeStrategy(),
    new ChatGPTStrategy(), 
    new PerplexityStrategy(),
    new YourPlatformStrategy(), // Add your strategy here
    new DefaultStrategy()       // Keep DefaultStrategy last
  ];
  // ... rest of constructor
}
```

### Step 3: Test the Integration

1. **Build the extension**: `npm run build`
2. **Load in Chrome**: Load unpacked from `dist/` folder
3. **Visit your platform**: Go to your-platform.com
4. **Check button appears**: Look for the prompt library button
5. **Test insertion**: Click button, select a prompt, verify it inserts

### Step 4: Debug and Refine

Use the browser console to debug:

```javascript
// Check if your strategy is loaded
window.__promptLibraryDebug?.strategies

// Test selectors manually
document.querySelectorAll('your-selector-here')

// Check what strategy is active
window.__promptLibraryDebug?.activeStrategy
```

## Platform Strategy Patterns

### Pattern 1: Simple Textarea Platform

For platforms with standard textarea inputs:

```typescript
async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
  if (element.tagName === 'TEXTAREA') {
    (element as HTMLTextAreaElement).value = content;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true, method: 'textarea' };
  }
  return { success: false };
}
```

### Pattern 2: ContentEditable Platform

For platforms with rich text editors:

```typescript
async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
  if (element.contentEditable === 'true') {
    // Method 1: Try execCommand (most compatible)
    element.focus();
    const selection = window.getSelection();
    if (selection) {
      selection.selectAllChildren(element);
    }
    
    const success = document.execCommand('insertText', false, content);
    if (success) {
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: content
      }));
      return { success: true, method: 'execCommand' };
    }
  }
  return { success: false };
}
```

### Pattern 3: Complex Platform (Multiple Methods)

For platforms that need multiple fallback approaches:

```typescript
async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
  // Method 1: Try execCommand
  const execResult = await this._tryExecCommand(element, content);
  if (execResult.success) return execResult;
  
  // Method 2: Try DOM manipulation
  const domResult = this._tryDOMManipulation(element, content);
  if (domResult.success) return domResult;
  
  // Method 3: Try direct property assignment
  return this._tryDirectAssignment(element, content);
}

private async _tryExecCommand(element: HTMLElement, content: string): Promise<InsertionResult> {
  // Implementation...
}

private _tryDOMManipulation(element: HTMLElement, content: string): InsertionResult {
  // Implementation...
}
```

## Testing and Debugging

### Debug Mode

Enable debug logging by opening browser console and running:

```javascript
localStorage.setItem('prompt-library-debug', 'true');
// Then reload the page
```

### Debug Interface

Access the debug interface:

```javascript
// Check loaded strategies
console.log(window.__promptLibraryDebug?.strategies);

// Check active strategy  
console.log(window.__promptLibraryDebug?.activeStrategy);

// Check found input elements
console.log(window.__promptLibraryDebug?.foundElements);

// Manual insertion test
window.__promptLibraryDebug?.testInsertion?.('test content');
```

### Testing Checklist

- [ ] Button appears on the platform
- [ ] Button is positioned correctly
- [ ] Clicking button opens prompt selector
- [ ] Selecting prompt inserts content
- [ ] Content appears in the input field
- [ ] Platform recognizes the inserted content
- [ ] No console errors

### Common Issues

**Button doesn't appear:**
- Check `canHandle()` method returns true
- Verify `selectors` match actual DOM elements
- Check strategy is registered in platform-manager.ts

**Button appears in wrong location:**
- Adjust `buttonContainerSelector`
- Add platform-specific positioning in injector.ts
- Check if container selector exists on page

**Content doesn't insert:**
- Verify element selector matches the input
- Try different insertion methods (execCommand, DOM, direct)
- Check what events the platform expects
- Use browser inspector to understand input structure

## Best Practices

### 1. Selector Strategy

Use multiple selectors for robustness:

```typescript
selectors: [
  // Most specific first
  'div[data-testid="chat-input"][contenteditable="true"]',
  // More generic fallbacks
  'div[contenteditable="true"][role="textbox"]',
  'textarea[placeholder*="message"]'
]
```

### 2. Event Triggering

Trigger comprehensive events for maximum compatibility:

```typescript
private _triggerEvents(element: HTMLElement, content: string): void {
  // Primary input event
  element.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: content
  }));
  
  // Additional events frameworks might expect
  const events = ['change', 'keyup', 'compositionend'];
  events.forEach(eventType => {
    element.dispatchEvent(new Event(eventType, { bubbles: true }));
  });
}
```

### 3. Error Handling

Always include comprehensive error handling:

```typescript
async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
  try {
    // Insertion logic...
    this._debug('Insertion successful');
    return { success: true, method: 'your-method' };
  } catch (error) {
    this._error('Insertion failed', error as Error);
    return { success: false, error: (error as Error).message };
  }
}
```

### 4. Timing and Focus

Handle timing issues properly:

```typescript
async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
  // Focus and wait for initialization
  element.focus();
  element.click();
  await new Promise(resolve => setTimeout(resolve, 50));

  // Proceed with insertion...
}
```

### 5. Theme Detection and Styling

Different platforms handle theme switching in different ways. Use Tailwind's `dark:` prefix for automatic theme support:

```typescript
// ✅ RECOMMENDED: Tailwind dark mode (automatic)
icon.className = 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300';
```

**Theme Detection Methods by Platform:**

| Platform | Method | Implementation |
|----------|--------|----------------|
| **Copilot** | Tailwind `dark:` prefix | Adapts to system `prefers-color-scheme` or explicit `dark` class |
| **Claude** | Tailwind `dark:` prefix | Automatic detection via Tailwind config |
| **ChatGPT** | Tailwind `dark:` prefix | Standard Tailwind dark mode |
| **Gemini** | Tailwind `dark:` prefix | Matches Google's theme system |
| **Perplexity** | Tailwind `dark:` prefix | Standard implementation |

**Why Tailwind `dark:` prefix?**
- ✅ No custom CSS required
- ✅ Works with both media queries and class-based dark mode
- ✅ Consistent across all platforms
- ✅ Automatically handles theme changes
- ✅ Easier to maintain and test

**Example Icon with Theme Support:**

```typescript
createPlatformIcon(): HTMLElement {
  const icon = document.createElement('button');

  // Theme-aware styling using Tailwind classes
  icon.className = `
    prompt-library-integrated-icon
    flex items-center gap-2 px-3 h-10
    rounded-2xl border
    border-gray-200 dark:border-gray-700
    bg-transparent
    hover:bg-gray-100 dark:hover:bg-gray-800
    text-gray-700 dark:text-gray-300
    transition-all duration-200
  `.trim().replace(/\s+/g, ' ');

  return icon;
}
```

**Key Points:**
- Light mode: Use gray-200/300/700 for borders and text
- Dark mode: Use gray-700/800/300 for contrast
- Always test both themes before deploying
- Background should be `transparent` or semi-transparent for integration
- Hover states must work in both themes

## Examples

### Example 1: Gemini (Google AI)

```typescript
export class GeminiStrategy extends PlatformStrategy {
  constructor(hostname?: string) {
    super('gemini', 85, {
      selectors: [
        'div.ql-editor[contenteditable="true"][role="textbox"]',
        'rich-textarea .ql-editor',
        '[data-placeholder*="Gemini"]',
        'div[contenteditable="true"]'
      ],
      buttonContainerSelector: '.input-buttons-wrapper-bottom',
      priority: 85
    }, hostname);
  }

  canHandle(_element: HTMLElement): boolean {
    return this.hostname === getPlatformById('gemini')?.hostname;
  }

  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      element.focus();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Gemini uses Quill editor with contenteditable
      if (element.contentEditable === 'true') {
        // Clear existing content
        element.textContent = '';

        // Insert using execCommand for Quill compatibility
        const inserted = document.execCommand('insertText', false, content);

        if (inserted) {
          element.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: content
          }));

          return { success: true, method: 'gemini-execCommand' };
        }
      }

      return { success: false, error: 'Unsupported element type' };
    } catch (error) {
      this._error('Insertion failed', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  createIcon(uiFactory: UIElementFactory): HTMLElement | null {
    return uiFactory.createGeminiIcon();
  }
}
```

**Key Points:**
- Gemini uses Quill editor (`.ql-editor` class)
- Requires `execCommand` for proper Quill integration
- Material Design 3 icon styling
- Multiple selector fallbacks for robustness

### Example 2: Microsoft Copilot

```typescript
export class CopilotStrategy extends PlatformStrategy {
  constructor(hostname?: string) {
    super('copilot', 80, {
      selectors: [
        'textarea[data-testid="composer-input"]', // Primary selector
        'textarea#userInput', // Fallback ID selector
        'textarea[placeholder*="Message"]', // Pattern match fallback
        'textarea[placeholder*="Copilot"]'
      ],
      buttonContainerSelector: '.relative.bottom-0.flex.justify-between > .flex.gap-2.items-center:last-child',
      priority: 80
    }, hostname);
  }

  canHandle(_element: HTMLElement): boolean {
    return this.hostname === getPlatformById('copilot')?.hostname;
  }

  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      element.focus();
      element.click();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Copilot uses standard textarea
      if (element.tagName === 'TEXTAREA') {
        (element as HTMLTextAreaElement).value = content;

        // Trigger comprehensive events
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        return { success: true, method: 'copilot-textarea' };
      }

      return { success: false, error: 'Unsupported element type' };
    } catch (error) {
      this._error('Insertion failed', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  createIcon(uiFactory: UIElementFactory): HTMLElement | null {
    return uiFactory.createCopilotIcon();
  }
}
```

**Key Points:**
- Uses standard textarea (simpler than Gemini)
- Specific button container selector for proper icon placement
- Custom icon with Microsoft brand styling
- Positioned before microphone button

### Example 3: Mistral LeChat

```typescript
export class MistralStrategy extends PlatformStrategy {
  constructor(hostname?: string) {
    super('mistral', 85, {
      selectors: [
        'div[contenteditable="true"]',
        'textarea[placeholder*="chat"]',
        '[role="textbox"]'
      ],
      buttonContainerSelector: [
        '.flex.w-full.max-w-full.items-center.justify-start.gap-3',
        '.flex.w-full.items-center.justify-start.gap-3',
        '.flex.items-center.justify-start.gap-3'
      ].join(', '),
      priority: 85
    }, hostname);
  }

  canHandle(_element: HTMLElement): boolean {
    return this.hostname === getPlatformById('mistral')?.hostname;
  }

  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      element.focus();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Try contenteditable first (primary method)
      if (element.contentEditable === 'true') {
        element.textContent = '';
        const inserted = document.execCommand('insertText', false, content);

        if (inserted) {
          element.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            inputType: 'insertText',
            data: content
          }));
          return { success: true, method: 'mistral-execCommand' };
        }
      }

      // Fallback to textarea
      if (element.tagName === 'TEXTAREA') {
        (element as HTMLTextAreaElement).value = content;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        return { success: true, method: 'mistral-textarea' };
      }

      return { success: false, error: 'Unsupported element type' };
    } catch (error) {
      this._error('Insertion failed', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  createIcon(uiFactory: UIElementFactory): HTMLElement | null {
    return uiFactory.createMistralIcon();
  }
}
```

**Key Points:**
- Multiple button container selectors for responsive design
- Longer timeout (100ms) for initialization
- Both contenteditable and textarea support
- Icon styled to match Mistral's Research/Think buttons

## 🐛 Troubleshooting

### Button Doesn't Appear

**Symptoms:** Icon doesn't show up on the target platform

**Possible Causes:**
1. `canHandle()` returns false for the domain
2. Selectors don't match actual DOM elements
3. Strategy not registered in platform-manager.ts
4. Content script not injected properly

**Solutions:**
```javascript
// In browser console, test your selectors:
document.querySelectorAll('your-selector-here')

// Check if strategy is loaded:
window.__promptLibraryDebug?.strategies

// Verify hostname matching:
window.location.hostname
```

### Button Appears in Wrong Location

**Symptoms:** Icon visible but poorly positioned or overlapping with other elements

**Possible Causes:**
1. Incorrect `buttonContainerSelector`
2. Platform UI changed after integration
3. Missing or dynamic container element

**Solutions:**
```typescript
// Try multiple container selectors for fallbacks:
buttonContainerSelector: [
  '.primary-container',   // Most specific
  '.fallback-container',  // Less specific
  '.generic-container'    // Generic fallback
].join(', ')

// Or use DOM-based positioning in injector.ts
// for platform-specific placement logic
```

### Content Doesn't Insert

**Symptoms:** Icon works, prompt selector opens, but content doesn't appear in input

**Possible Causes:**
1. Wrong element type (textarea vs contenteditable)
2. Missing event triggers
3. Platform uses custom input handling
4. React/Vue component state not updating

**Solutions:**
```typescript
// Try multiple insertion methods:
async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
  // Method 1: execCommand (most compatible)
  const execResult = await this._tryExecCommand(element, content);
  if (execResult.success) return execResult;

  // Method 2: Direct assignment
  const directResult = this._tryDirectAssignment(element, content);
  if (directResult.success) return directResult;

  // Method 3: DOM manipulation
  return this._tryDOMManipulation(element, content);
}

// Trigger comprehensive events:
private _triggerEvents(element: HTMLElement): void {
  const events = ['input', 'change', 'keyup', 'compositionend', 'blur', 'focus'];
  events.forEach(eventType => {
    element.dispatchEvent(new Event(eventType, { bubbles: true }));
  });
}
```

### Platform Doesn't Recognize Content

**Symptoms:** Text appears in input but submit button stays disabled or platform doesn't recognize it

**Possible Causes:**
1. Missing specific events the platform expects
2. React/Vue internal state not updated
3. Platform uses custom validation logic

**Solutions:**
```typescript
// For React-based platforms, trigger React's internal events:
private _setReactValue(element: HTMLTextAreaElement, value: string): void {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value'
  )?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// Add composition events for IME compatibility:
element.dispatchEvent(new CompositionEvent('compositionstart'));
element.dispatchEvent(new CompositionEvent('compositionend'));
```

### TypeScript Errors

**Symptoms:** Build fails with type errors after adding new platform

**Solutions:**
```typescript
// 1. Add platform to PlatformName type in src/content/types/platform.ts:
export type PlatformName = 'claude' | 'chatgpt' | 'mistral' | 'perplexity' | 'gemini' | 'copilot' | 'yourplatform' | 'default';

// 2. Ensure strategy extends PlatformStrategy properly:
export class YourPlatformStrategy extends PlatformStrategy {
  // Must implement all required methods
}

// 3. Update SUPPORTED_PLATFORMS in src/config/platforms.ts:
yourplatform: {
  // All required fields...
}
```

### Tests Failing

**Symptoms:** `npm test` fails after adding new platform

**Common Issues:**
```typescript
// 1. Missing test file - create one:
// src/content/platforms/__tests__/yourplatform-strategy.test.ts

// 2. DOM elements not properly set up:
describe('insert', () => {
  it('inserts content', async () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea); // ← Must add to DOM

    const result = await strategy.insert(textarea, 'Test');

    expect(result.success).toBe(true);

    document.body.removeChild(textarea); // ← Clean up
  });
});

// 3. Strategy not properly mocked:
vi.mock('../../config/platforms', () => ({
  getPlatformById: vi.fn((id) => {
    if (id === 'yourplatform') {
      return { hostname: 'your-platform.com' };
    }
    return undefined;
  })
}));
```

## Need Help?

- **Issues:** [GitHub Issues](https://github.com/spartDev/My-Prompt-Manager/issues)
- **Documentation:** [Architecture Guide](ARCHITECTURE.md)
- **Examples:** Check `src/content/platforms/` for reference implementations
- **Community:** Tag your questions with `platform-integration`

---

**Last Updated:** 2025-11-10
**Version:** 2.0.0 (Centralized Configuration)