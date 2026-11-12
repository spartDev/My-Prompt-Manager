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
    iconPlacement: {                     // Where the icon goes in the composer (see the reference below)
      composer: 'form',                  // Found with editor.closest()
      anchors: [                         // Tried in order inside the composer; the first found wins
        { find: 'button[data-testid="voice-button"]', relation: 'before' },
        { find: 'button[type="submit"]', relation: 'before' }
      ]
    },
    strategyClass: 'YourPlatformStrategy', // For future custom logic
    hostnamePatterns: ['yourplatform'], // For hostname matching
    brandColors: {
      enabled: 'bg-[#123456] text-white shadow-xs' // Matches platform brand styling
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
| `iconPlacement` | `IconPlacement` | ❌ | Where the icon goes: `composer`, a selector found with `editor.closest()`, and `anchors`, each `{ find, relation }` with `relation` one of `before`, `after`, `inside-start`, `inside-end`, tried in order inside the composer; the first found wins. The one source: `PlatformManager.getIconPlacement()` reads it, no strategy keeps a copy. When no anchor is found, the icon is anchored inside the editor's bottom-end corner by `src/content/core/anchored-overlay.ts` and a warning is logged |
| `strategyClass` | string | ✅ | Class name for custom strategy (future use) |
| `hostnamePatterns` | string[] | ❌ | Additional hostname patterns for detection |
| `brandColors` | `{ enabled: string }` | ❌ | Tailwind classes of the logo square when the site is on; the accent (`bg-accent-subtle text-accent`) when omitted. Every site shares one disabled state (`bg-muted text-tertiary`, `src/constants/brandColors.ts`), so its logo component takes `disabled` and draws in `currentColor` |
| `iconMethod` | PlatformIconMethod | ❌ | Optional UIElementFactory method for rendering a platform-specific icon (`createFloatingIcon` is used when omitted) |

#### Writing an anchor chain

Name each anchor by what the element is for: a `data-testid`, a custom element (`speech-dictation-mic-button`), an ARIA label, a button `type`, a semantic class name (`.input-buttons-wrapper-bottom`, Fluent's `.fai-ChatInput__actions`). Never a Tailwind utility chain, a hashed CSS-in-JS class or SVG path data: the guard "Icon placement selectors" in `src/config/__tests__/platforms.test.ts` fails on those. Prefer anchors that do not depend on the language (test ids, custom elements) over ARIA labels, which follow the user's locale (Gemini shows French labels to a French user).

The placed icon carries `data-mpm-placement="toolbar"` and `data-mpm-anchor="<index>"`: `0` means the anchor the chain was written for was found.

A new Platform also saves a sanitized copy of its live composer as `tests/fixtures/composers/<id>.html` and adds its id to the `it.each` list of `src/content/core/__tests__/icon-placement-chains.test.ts`, which checks that the chain resolves anchor 0 on that fixture.

### Priority Guidelines

- **100**: Premium platforms (Claude, ChatGPT)
- **80-90**: Major platforms (Perplexity, Mistral)
- **60-79**: Secondary platforms
- **40-59**: Experimental/beta platforms
- **< 40**: Custom/niche platforms

## 🔧 Advanced Integration

For platforms that need custom insertion logic or special handling, you'll need to create a custom strategy class.

#### Icon Method Reference

The Prompts button looks the same on every Platform (a pill with the extension's badge and the label "Prompts"), with no wrapper; where it goes is the `iconPlacement` chain's business. Set the `iconMethod` field to one of the UI factory helpers:

- `createFloatingIcon` – default floating action button (no additional config required)
- `createAbsoluteIcon` / `createRelativeIcon` – positioning-specific variants
- `createChatGPTIcon`
- `createPerplexityIcon`
- `createMistralIcon`
- `createCopilotIcon`
- `createGeminiIcon`

If `iconMethod` is omitted, the manager falls back to `createFloatingIcon`. This keeps icon selection fully data-driven without modifying `PlatformManager`.

### Architecture Overview

```
src/
├── config/platforms.ts             # ⭐ Centralized configuration
├── content/platforms/
│   ├── base-strategy.ts            # Base class with common functionality
│   ├── react-platform-strategy.ts  # React-specific base class
│   ├── claude-strategy.ts          # Claude.ai implementation
│   ├── chatgpt-strategy.ts         # ChatGPT implementation
│   ├── mistral-strategy.ts         # Mistral LeChat implementation
│   ├── perplexity-strategy.ts      # Perplexity implementation
│   ├── copilot-strategy.ts         # Microsoft Copilot (extends React)
│   ├── m365copilot-strategy.ts     # M365 Copilot (extends React)
│   ├── your-platform-strategy.ts   # Your custom strategy
│   └── platform-manager.ts         # Registers and manages strategies
└── background/background.ts        # Uses centralized config
```

## Step-by-Step Guide

### Step 1: Choose Your Base Class

Before creating your strategy, determine which base class to use:

**🔍 Decision: Is the platform's input field powered by React?**

```
Is the platform using React for input management?
│
├─ ✅ YES → Use ReactPlatformStrategy
│   │
│   ├─ How to detect:
│   │   • Check DevTools: Look for __reactFiber$ or __reactProps$ on textarea
│   │   • Test: element.value = 'test' doesn't update UI → it's React
│   │   • React DevTools shows component wrapping the input
│   │
│   ├─ Examples:
│   │   • Microsoft Copilot (copilot.microsoft.com)
│   │   • M365 Copilot (m365.cloud.microsoft)
│   │
│   └─ Benefits:
│       • ✅ Automatic React event handling
│       • ✅ Built-in content type check
│       • ✅ Consistent error handling
│
└─ ❌ NO → Use PlatformStrategy
    │
    ├─ Examples:
    │   • Claude (claude.ai) - Custom contenteditable
    │   • ChatGPT (chatgpt.com) - ProseMirror editor
    │   • Gemini (gemini.google.com) - Quill editor
    │
    └─ Implementation:
        • Full manual control
        • Platform-specific insertion logic
```

---

### Step 2a: Create Strategy (Standard Platform)

**For non-React platforms**, create: `src/content/platforms/your-platform-strategy.ts`

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
   * Inserts content where the caret of the input field is, in place of the text selected there.
   * The base strategy does it for both kinds of field: never set the whole value or clear the
   * field here, or the user loses the text around the caret.
   */
  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      // A <textarea> or an <input>: through the native value setter, then input and change
      if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
        return this.insertIntoTextControl(element, content)
          ? { success: true, method: 'your-platform-textarea' }
          : { success: false, error: 'The input field did not keep the text' };
      }

      // A contenteditable editor: through the browser's editing command, as typing would
      if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
        return this.insertEditableText(element, content, 'your-platform');
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

---

### Step 2b: Create Strategy (React Platform)

**For React-based platforms**, create: `src/content/platforms/your-react-platform-strategy.ts`

```typescript
import { getPlatformById } from '../../config/platforms';
import type { InsertionResult } from '../types/index';
import type { UIElementFactory } from '../ui/element-factory';

import { ReactPlatformStrategy } from './react-platform-strategy';

export class YourReactPlatformStrategy extends ReactPlatformStrategy {
  constructor(hostname?: string) {
    const platform = getPlatformById('yourreactplatform');

    super('yourreactplatform', 85, {
      selectors: platform?.selectors || [
        'textarea[data-testid="input"]',
        'textarea.react-input'
      ],
      priority: 85
    }, hostname);
  }

  /**
   * Determines if this strategy should handle elements on this domain
   */
  canHandle(element: HTMLElement): boolean {
    const isCorrectHostname = this.hostname === getPlatformById('yourreactplatform')?.hostname;
    const isTextarea = element.tagName === 'TEXTAREA';

    return isCorrectHostname && isTextarea;
  }

  /**
   * Inserts content where the caret of the textarea is, using React-compatible methods
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

      // Insert the content exactly as given, where the caret is, in place of the text
      // selected there, using base class React-compatible method
      return await this.insertIntoReactTextarea(
        element as HTMLTextAreaElement,
        content,
        'YourReactPlatform',
        'yourreactplatform-textarea'
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
    const { element, cleanup } = uiFactory.createFloatingIcon();
    (element as HTMLElement & { __cleanup?: () => void }).__cleanup = cleanup;
    return element;
  }
}
```

**✨ Key Benefits of ReactPlatformStrategy**:
1. **Automatic React Compatibility**: No need to manually handle React's value setter
2. **Built-in Content Type Check**: `validateContent()` confirms the content is a string
3. **Consistent Error Handling**: Try-catch patterns are standardized
4. **Security**: Content goes into the textarea `value`, never parsed as markup

**⚠️ Important**:
- **Always await** `Promise.resolve()` returns for proper error handling
- **Use** `this.validateContent()` for the content type check
- **Use** `this.insertIntoReactTextarea()` for insertion: it puts the content where the caret is, through the base strategy's `insertIntoTextControl()`. Never assign the whole `value` of the textarea
- **Insert the content exactly as given**: Prompts are Verbatim. Never sanitize, trim or shorten the content in a strategy; it was admitted once, when the Prompt was saved (see `docs/ARCHITECTURE.md`, Security Architecture)

---

### Step 3: Register the Strategy

#### 3a. Add to exports in `src/content/platforms/index.ts`:

```typescript
export { YourPlatformStrategy } from './your-platform-strategy';
```

#### 3b. Register in `src/content/platforms/platform-manager.ts`:

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

### Step 4: Test the Integration

1. **Build the extension**: `npm run build`
2. **Load in Chrome**: Load unpacked from `dist/` folder
3. **Visit your platform**: Go to your-platform.com
4. **Check button appears**: Look for the prompt library button
5. **Test insertion**: Click button, select a prompt, verify it inserts

### Step 5: Debug and Refine

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

**The rule every pattern follows:** an Insertion puts the Prompt where the caret of the input field is, in place of the text selected there. The text before and after stays, and a field with no caret takes the Prompt at its end (see `CONTEXT.md`, Insertion). A strategy never sets the whole value of the field and never clears it: it calls `insertIntoTextControl()` for a `<textarea>` or an `<input>`, `insertEditableText()` for a contenteditable editor, or `insertIntoReactTextarea()` in a `ReactPlatformStrategy`. The selector controller selects the caret again right before it calls the strategy, so a strategy inserts at the field's current selection and does not look for the caret itself. Only `restore()`, which Undo calls, replaces the whole field. When you add a Platform, add it to `PLATFORMS` in `src/content/platforms/__tests__/caret-insertion.test.ts` and to the stand-in pages that `tests/e2e/content/caret-insertion.spec.ts` runs on (`tests/e2e/fixtures/platform-pages.ts`).

### Pattern 1: Simple Textarea Platform

For platforms with standard textarea inputs:

```typescript
async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
  if (element instanceof HTMLTextAreaElement) {
    // At the caret, through the native value setter, then input and change
    return this.insertIntoTextControl(element, content)
      ? { success: true, method: 'textarea' }
      : { success: false, error: 'The input field did not keep the text' };
  }
  return { success: false };
}
```

### Pattern 2: ContentEditable Platform

For platforms with rich text editors:

```typescript
async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
  if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
    // At the caret, through execCommand('insertText') as typing would; when the editor
    // does not take it, the base strategy writes the text directly, the text around
    // the caret included. The method in the result is 'your-platform-execCommand'
    // or 'your-platform-dom'
    return this.insertEditableText(element, content, 'your-platform');
  }
  return { success: false };
}
```

### Pattern 3: Complex Platform (Multiple Methods)

For platforms that need multiple fallback approaches:

```typescript
async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
  // Method 1: Try the editor's own API (see GeminiStrategy and its Quill instance)
  const apiResult = this._tryEditorApi(element, content);
  if (apiResult.success) return apiResult;

  // Method 2: the browser's editing command, then the base strategy's direct write
  return this.insertEditableText(element, content, 'your-platform');
}

private _tryEditorApi(element: HTMLElement, content: string): InsertionResult {
  // Insert at the editor's own selection, in place of what is selected there.
  // Never replace the whole text of the editor.
  // Implementation...
  return { success: false };
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
- [ ] With a draft in the input field and the caret in the middle of it, the Prompt goes where the caret is and the text before and after it stays
- [ ] Undo puts the draft back
- [ ] Platform recognizes the inserted content
- [ ] No console errors

### Common Issues

**Button doesn't appear:**
- Check `canHandle()` method returns true
- Verify `selectors` match actual DOM elements
- Check strategy is registered in platform-manager.ts

**Button appears in wrong location:**
- Adjust the `iconPlacement` chain in `platforms.ts` (no strategy keeps a copy)
- With debug mode on (`localStorage.setItem('prompt-library-debug', 'true')`, then reload; warnings are silent otherwise), a warning `No anchor of this Platform found in its composer, the icon is anchored on the editor instead` in the console means no anchor was found and the icon fell back to the editor's corner
- Check that `editor.closest(composer)` finds the composer, and that an anchor exists inside it

**Content doesn't insert:**
- Verify element selector matches the input
- Check the strategy calls the base helper that matches the field (`insertIntoTextControl()` for a textarea, `insertEditableText()` for a contenteditable)
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

The base helpers already dispatch the events typing would send (`input` and `change` for a textarea, `input` for a contenteditable). When a Platform expects more, trigger them after the helper returned:

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
    // At the caret, through a base helper
    const result = this.insertEditableText(element, content, 'your-platform');
    if (result.success) {
      this._debug('Insertion successful');
    }
    return result;
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

  // Proceed with insertion, at the selection the field has now
  return this.insertEditableText(element, content, 'your-platform');
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
      if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
        // Where the caret is, through execCommand for Quill compatibility.
        // The method in the result is 'gemini-execCommand' or 'gemini-dom'
        return this.insertEditableText(element, content, 'gemini');
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
- Requires `execCommand` for proper Quill integration; `insertEditableText()` calls it at the caret
- The real `GeminiStrategy` first tries the Quill instance's own API, at Quill's selection
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
      if (element instanceof HTMLTextAreaElement) {
        // Where the caret is, through the native value setter; dispatches input and change
        return this.insertIntoTextControl(element, content)
          ? { success: true, method: 'copilot-textarea' }
          : { success: false, error: 'The input field did not keep the text' };
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
- Icon placed before the audio call button (`button[data-testid="audio-call-button"]`), then before the submit button
- Custom icon with Microsoft brand styling

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
      if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
        // Where the caret is, so ProseMirror builds its paragraphs from the line breaks
        return this.insertEditableText(element, content, 'mistral');
      }

      // Fallback to textarea, where its caret is
      if (element instanceof HTMLTextAreaElement) {
        return this.insertIntoTextControl(element, content)
          ? { success: true, method: 'mistral-textarea' }
          : { success: false, error: 'The input field did not keep the text' };
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
- Icon placed before the voice button, then after the settings button (English ARIA labels: another locale falls to the anchor on the editor)
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
1. An `iconPlacement` anchor that no longer matches (`data-mpm-anchor` above `0` on the icon)
2. Platform UI changed after integration
3. A composer selector that `editor.closest()` does not reach

**Solutions:**
```typescript
// Give the chain later anchors to fall back on, each named by what the element is for:
iconPlacement: {
  composer: 'form, div:has(button[data-testid="audio-call-button"])',
  anchors: [
    { find: 'button[data-testid="audio-call-button"]', relation: 'before' }, // Written for this one
    { find: 'button[type="submit"]', relation: 'before' }                    // Then this
  ]
}

// When no anchor is found, the icon is anchored inside the editor's bottom-end corner
// (src/content/core/anchored-overlay.ts) and the console shows a warning:
// "No anchor of this Platform found in its composer, the icon is anchored on the editor instead".
// If the Platform re-renders its Toolbar, src/content/core/icon-placement.ts places the icon again on its own.
```

After fixing the chain, refresh `tests/fixtures/composers/<id>.html` from the live composer.

### Content Doesn't Insert

**Symptoms:** Icon works, prompt selector opens, but content doesn't appear in input

**Possible Causes:**
1. Wrong element type (textarea vs contenteditable)
2. Missing event triggers
3. Platform uses custom input handling
4. React/Vue component state not updating

**Solutions:**
```typescript
// Call the base helper that matches the field. Both insert where the caret is:
async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
  // A <textarea> or an <input>: native value setter, then input and change
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    return this.insertIntoTextControl(element, content)
      ? { success: true, method: 'your-platform-textarea' }
      : { success: false, error: 'The input field did not keep the text' };
  }

  // A contenteditable: execCommand('insertText') first, then a direct write of the
  // field's text when the editor did not take it. result.method says which one ran
  return this.insertEditableText(element, content, 'your-platform');
}

// Trigger comprehensive events:
private _triggerEvents(element: HTMLElement): void {
  const events = ['input', 'change', 'keyup', 'compositionend', 'blur-sm', 'focus'];
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
// For React-based platforms, the value must go through the native value setter, or React
// does not see the change. insertIntoTextControl() does it, where the caret is, then
// dispatches input and change. Do not write your own setter that assigns the whole value:
const kept = this.insertIntoTextControl(element as HTMLTextAreaElement, content);
// kept is false when the page's own handler rewrote the value

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
    expect(textarea.value).toBe('Test');

    document.body.removeChild(textarea); // ← Clean up
  });

  it('keeps the text before and after the caret', async () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.value = 'before after';
    textarea.setSelectionRange(7, 7); // ← The caret, between "before " and "after"

    const result = await strategy.insert(textarea, 'PROMPT ');

    expect(result.success).toBe(true);
    expect(textarea.value).toBe('before PROMPT after');

    document.body.removeChild(textarea);
  });
});

// 3. Platform missing from the caret tests - add it to PLATFORMS in
// src/content/platforms/__tests__/caret-insertion.test.ts

// 4. Strategy not properly mocked:
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

**Last Updated:** 2026-10-12
**Version:** 2.0.0 (Centralized Configuration)