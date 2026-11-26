# Platform Integration Guide

This guide explains how a Platform's content script works (`src/content`: where the Prompts button goes, Insertion) and how to add a Platform to the My Prompt Manager extension.

## Table of Contents

- [🚀 Quick Start (New Method)](#-quick-start-new-method)
- [📋 Configuration Reference](#-configuration-reference)
- [🔧 Advanced Integration](#-advanced-integration)
- [🧪 Testing and Debugging](#-testing-and-debugging)
- [💡 Best Practices](#-best-practices)
- [📚 Examples](#-examples)
- [🐛 Troubleshooting](#-troubleshooting)

## 🚀 Quick Start (New Method)

A new Platform is defined in `src/config/platforms.ts`, and its host must also go into `manifest.json`: in `host_permissions` and in the content script's `matches`, or the content script never runs there. Only the owner decides that change, because a host the published Release lacks disables the extension on update for every user ([PROGRAMMATIC_INJECTION.md](./PROGRAMMATIC_INJECTION.md), `src/test/guardrails/manifestHosts.test.ts`). Tests that must follow:

- add the new hostname to `ADDED_AFTER_THE_PLATFORM_CHOICES` in `src/services/__tests__/siteSettings.test.ts`, never to `PLATFORMS_OF_THE_ENABLED_LIST` in `src/services/siteSettings.ts`, which is frozen;
- update the count in `should have 7 total platforms` of `src/config/__tests__/platforms.test.ts`; its `manifest.json` test fails until the manifest holds the host;
- `src/test/guardrails/manifestHosts.test.ts` fails on the new host until the owner's decision updates it.

The `add-platform` skill (`.claude/skills/add-platform/SKILL.md`) lists every step.

### Step 1: Add Platform Configuration

Edit `src/config/platforms.ts` and add your platform to the `SUPPORTED_PLATFORMS` object:

```typescript
export const SUPPORTED_PLATFORMS: Readonly<Record<string, Readonly<PlatformDefinition>>> = Object.freeze({
  // ... existing platforms ...

  yourplatform: {
    id: 'yourplatform',
    hostname: 'your-ai-platform.com',
    displayName: 'Your AI Platform',
    priority: 70, // Orders the Platforms in lists; lower than existing platforms
    defaultEnabled: true, // On for every user who never switched it, existing users included
    selectors: [ // Read only by the strategies that ask for them (Copilot, M365 Copilot): see the reference below
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
    strategyClass: 'YourPlatformStrategy', // Its key in STRATEGY_CONSTRUCTORS (strategy-constructors.ts)
    brandColors: {
      enabled: 'bg-[#123456] text-white shadow-xs' // Matches platform brand styling
    }
  }
});
```

### Step 2: Test Your Integration

1. Build the extension: `npm run build`
2. Load in Chrome and visit your platform
3. With the host in `manifest.json`, Chrome runs the content script there, and the Prompts button shows in the composer.

From the configuration alone, the extension takes:
- the Site settings default (`defaultEnabled`);
- the Platform's detection by hostname (`getPlatformByHostname`);
- the strategy, through `strategyClass`.

Written by hand: the Platform's row in Settings, with its logo (`siteConfigs` in `src/components/SettingsView.tsx`), and the `PlatformName` and `KnownPlatformType` unions (see [TypeScript Errors](#typescript-errors)).

## 📋 Configuration Reference

### PlatformDefinition Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique platform identifier (lowercase, no spaces) |
| `hostname` | string | ✅ | Exact hostname (e.g., 'claude.ai'): the one the Platform's row in Settings and its Platform choice go by |
| `otherHostnames` | string[] | ❌ | Other hosts the same Platform is served on, such as the host a sign-in redirects to. None in 2.0.0: M365 Copilot's `copilot.cloud.microsoft` (`M365_WORK_ACCOUNT_HOSTNAME`) comes back with ticket My-Prompt-Manager-j74b. Each needs its origin in `host_permissions` and the content script `matches` of `manifest.json` (the test `manifest.json` in `src/config/__tests__/platforms.test.ts` fails otherwise), which only the owner decides: a new origin there disables the extension on update for every user (`src/test/guardrails/manifestHosts.test.ts`, ticket My-Prompt-Manager-totf), and its hostname in `ADDED_AFTER_THE_PLATFORM_CHOICES` of `src/services/__tests__/siteSettings.test.ts`. Without a choice of its own, a host follows the Platform choice of its Platform. Icon placement repairs treat each one as where `hostname` redirects to: a report from it drops a repair at `hostname` that no open tab holds, never the reverse (`redirectSourcesOf`) |
| `displayName` | string | ✅ | Human-readable name shown in UI |
| `priority` | number | ✅ | Orders the Platforms, highest first: `getDefaultEnabledPlatforms()`, `getPlatformsByPriority()` and the Welcome's list of Platforms. The strategies are sorted by the priority each passes to `super()`, not by this field |
| `defaultEnabled` | boolean | ✅ | On for every user who never switched it, existing users included (the Site settings store the user's Platform choices) |
| `selectors` | string[] | ✅ | CSS selectors of the input field, read only by the strategies that ask for them (`CopilotStrategy`, `M365CopilotStrategy`) and by `npm run composers:capture`. The input field is found by each strategy's own `getSelectors()`. On a built-in Platform only a `textarea` or a `contenteditable` element they name is taken (`PlatformManager.getAllSelectors()` narrows every strategy's selectors, the fallback's included), so a search box (`input[type="text"]`) or a row whose class holds `input` gets no Prompts button; a custom site keeps every selector as it is |
| `pagesWithoutComposer` | string[] | ❌ | Paths of the Platform's pages that have no composer (`/settings` covers `/settings/...`): no input field is looked for there, so a search box or a form field gets no Prompts button (ChatGPT: `/settings`). `PlatformManager.getAllSelectors()` returns none on those pages, read on each call, since the Platform moves between pages without reloading |
| `iconPlacement` | `IconPlacement` | ✅ (optional in the type, required by the test "Icon placement selectors") | Where the icon goes: `composer`, a selector found with `editor.closest()`, and `anchors`, each `{ find, relation }` with `relation` one of `before`, `after`, `inside-start`, `inside-end`, tried in order inside the composer; the first found wins. The one source: `PlatformManager.getIconPlacement()` reads it, no strategy keeps a copy. When no anchor is found, the icon is anchored inside the editor's bottom-end corner by `src/content/core/anchored-overlay.ts`, and goes into the toolbar if the Platform renders it within `IconPlacementController.TOOLBAR_GRACE_MS` (`awaitToolbar`: a toolbar may render after its editor; the same holds for an icon at the element the user picked, which only the chain's first anchor takes the icon from, since a later one may show only at times, like a send button). Still not found by then, a warning is logged and the overlay is reported, so Settings offers to place the icon; the icon keeps looking for the chain's first anchor, or for the element the user picked, at most once a second (`LATE_TOOLBAR_CHECK_MS`), and goes there if it shows later, which replaces the overlay report. A later anchor does not count then: it may show only once the draft holds text (a send button), and would move the icon as the user types. A composer whose usual anchor is a later one (Fluent's `.fai-ChatInput__actions` on m365.cloud.microsoft) therefore keeps the icon on the overlay when its toolbar comes late. The picked element is looked for then by its selector only, not its fingerprint, which scores every element of its tag: a pick whose selector no longer matches is not found late |
| `strategyClass` | string | ✅ | The strategy's key in `STRATEGY_CONSTRUCTORS` (`src/content/platforms/strategy-constructors.ts`), from which `PlatformManager` builds its registry. An unknown name logs a warning, and the Platform gets only `DefaultStrategy` |
| `hostnamePatterns` | string[] | ❌ | Read only by `getAllHostnamePatterns()` and `isHostnameSupported()`, which no detection code calls: a Platform is detected by `hostname` and `otherHostnames` |
| `brandColors` | `{ enabled: string }` | ❌ | Tailwind classes of the logo square when the site is on; the accent (`bg-accent-subtle text-accent`) when omitted. Every site shares one disabled state (`bg-muted text-tertiary`, `src/constants/brandColors.ts`), so its logo component takes `disabled` and draws in `currentColor` |
| `iconMethod` | PlatformIconMethod | ❌ | The UIElementFactory method that renders the icon. When omitted, each strategy's `createIcon()` is asked, highest priority first, and `createFloatingIcon()` is the last fallback |
| `linkedPlatforms` | string[] | ❌ | Platform ids shown as one with this one (Copilot and M365 Copilot): the Welcome names the group once, and the Settings row lists the hosts of the group (`getLinkedPlatformHostnames()`). Each id must exist, checked when the module loads |

#### Writing an anchor chain

Name each anchor by what the element is for: a `data-testid`, a custom element (`speech-dictation-mic-button`), an ARIA label, a button `type`, a semantic class name (`.input-buttons-wrapper-bottom`, Fluent's `.fai-ChatInput__actions`). Never a Tailwind utility chain, a hashed CSS-in-JS class or SVG path data: the guard "Icon placement selectors" in `src/config/__tests__/platforms.test.ts` fails on those. Prefer anchors that do not depend on the language (test ids, custom elements) over ARIA labels, which follow the user's locale (Gemini shows French labels to a French user).

The placed icon carries `data-mpm-placement="toolbar"` and `data-mpm-anchor="<index>"`: `0` means the anchor the chain was written for was found.

A new Platform also saves a sanitized copy of its live composer as `tests/fixtures/composers/<id>.html` and adds its id to the `it.each` list of `src/content/core/__tests__/icon-placement-chains.test.ts`, which checks that the chain resolves anchor 0 on that fixture.

### Priority Guidelines

- **100**: Claude
- **80-90**: ChatGPT (90), Mistral and Gemini (85), Perplexity, Copilot and M365 Copilot (80)
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

If `iconMethod` is omitted, the manager asks each strategy's `createIcon()`, highest priority first, and falls back to `createFloatingIcon` when none returns an icon.

### Architecture Overview

```
src/
├── config/platforms.ts             # ⭐ Centralized configuration
├── content/platforms/
│   ├── base-strategy.ts            # Base class with common functionality
│   ├── react-platform-strategy.ts  # React-specific base class
│   ├── lexical-strategy.ts         # Base class: Insertion and Undo of a Lexical editor, as a paste
│   ├── claude-strategy.ts          # Claude.ai (ProseMirror)
│   ├── chatgpt-strategy.ts         # ChatGPT (ProseMirror)
│   ├── gemini-strategy.ts          # Gemini (Quill)
│   ├── mistral-strategy.ts         # Mistral LeChat
│   ├── perplexity-strategy.ts      # Perplexity (extends Lexical)
│   ├── copilot-strategy.ts         # Microsoft Copilot (extends React)
│   ├── m365copilot-strategy.ts     # M365 Copilot (extends Lexical)
│   ├── default-strategy.ts         # The fallback every page also gets
│   ├── your-platform-strategy.ts   # Your custom strategy
│   ├── strategy-constructors.ts    # strategyClass names to strategy classes
│   ├── index.ts                    # Re-exports the strategies
│   └── platform-manager.ts         # Builds its registry from strategy-constructors.ts and picks a strategy
└── background/background.ts        # Reads the Site settings through src/services/siteSettings.ts
```

## Step-by-Step Guide

### Step 1: Choose Your Base Class

Before creating your strategy, determine which base class to use:

**🔍 Decision: What is the platform's input field?** Ask in this order: a Lexical editor on a React page is still a Lexical editor.

```
Is the field a Lexical editor (data-lexical-editor on the field)?
│
├─ ✅ YES → Use LexicalStrategy
│   │
│   └─ Examples:
│       • Perplexity (www.perplexity.ai)
│       • Microsoft 365 Copilot (m365.cloud.microsoft)
│
├─ A textarea that React manages? → Use ReactPlatformStrategy
│   │
│   ├─ How to detect:
│   │   • Check DevTools: Look for __reactFiber$ or __reactProps$ on textarea
│   │   • Test: element.value = 'test' doesn't update UI → it's React
│   │   • React DevTools shows component wrapping the input
│   │
│   ├─ Examples:
│   │   • Microsoft Copilot (copilot.microsoft.com)
│   │
│   └─ Benefits:
│       • ✅ Automatic React event handling
│       • ✅ Built-in content type check
│       • ✅ Consistent error handling
│
└─ ❌ Neither → Use PlatformStrategy
    │
    ├─ Examples:
    │   • Claude (claude.ai) - ProseMirror editor
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
  constructor(hostname?: string) {
    super('YourPlatform', 90, {
      selectors: [
        // CSS selectors for finding text input elements
        'textarea[placeholder*="Enter your message"]',
        'div[contenteditable="true"][role="textbox"]'
      ],
      priority: 90 // Higher = more priority (Claude: 100, ChatGPT: 90, Perplexity: 80)
    }, hostname);
  }

  /**
   * The selectors PlatformManager finds the input field with (required: abstract in PlatformStrategy)
   */
  getSelectors(): string[] {
    return this.config?.selectors || [];
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

**For React-based platforms**, create: `src/content/platforms/your-platform-strategy.ts`

```typescript
import { getPlatformById } from '../../config/platforms';
import type { InsertionResult } from '../types/index';
import type { UIElementFactory } from '../ui/element-factory';

import { ReactPlatformStrategy } from './react-platform-strategy';

export class YourPlatformStrategy extends ReactPlatformStrategy {
  constructor(hostname?: string) {
    const platform = getPlatformById('yourplatform');

    super('yourplatform', 85, {
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
    const isCorrectHostname = this.hostname === getPlatformById('yourplatform')?.hostname;
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
        'yourplatform-textarea'
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
    return uiFactory.createFloatingIcon();
    // createCopilotIcon() alone returns { element, cleanup }: CopilotStrategy stores the cleanup
    // on the element as __cleanup
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

#### 3a. Register in `src/content/platforms/strategy-constructors.ts`:

```typescript
// Add import at top
import { YourPlatformStrategy } from './your-platform-strategy';

// Add it under the strategyClass name it has in platforms.ts; the manager builds its registry from this map
export const STRATEGY_CONSTRUCTORS: Record<string, new (hostname?: string) => PlatformStrategy> = {
  // ... existing strategies ...
  'YourPlatformStrategy': YourPlatformStrategy,
  'DefaultStrategy': DefaultStrategy
};
```

#### 3b. Re-export it from `src/content/platforms/index.ts`, beside the other strategies:

```typescript
export { YourPlatformStrategy } from './your-platform-strategy';
```

The registration is 3a alone: nothing in `src/` imports the strategies through this index.

### Step 4: Test the Integration

1. **Build the extension**: `npm run build`
2. **Load in Chrome**: Load unpacked from `dist/` folder
3. **Visit your platform**: Go to your-platform.com
4. **Check button appears**: Look for the prompt library button
5. **Test insertion**: Click button, select a prompt, verify it inserts

### Step 5: Debug and Refine

Use the browser console to debug. `window.__promptLibraryDebug` lives in the content script's isolated world: pick the extension's context in the DevTools console's context menu first, or the page's console does not see it.

```javascript
// Is the content script running?
window.__promptLibraryDebug?.isInitialized()

// The injector, and through it the platform manager and its strategies
window.__promptLibraryDebug?.getInstance()

// Test selectors manually (works in the page's own context too)
document.querySelectorAll('your-selector-here')
```

The API also has `reinitialize()`, `cleanup()` and `getLogger()` (`src/content/index.ts`).

## Platform Strategy Patterns

**The rule every pattern follows:** an Insertion puts the Prompt where the caret of the input field is, in place of the text selected there. The text before and after stays, and a field with no caret takes the Prompt at its end (see `CONTEXT.md`, Insertion). A strategy never sets the whole value of the field and never clears it: it calls `insertIntoTextControl()` for a `<textarea>` or an `<input>`, `insertEditableText()` for a contenteditable editor, or `insertIntoReactTextarea()` in a `ReactPlatformStrategy`. Some strategies first take the editor's own path, at the editor's selection, and fall back on those helpers: `LexicalStrategy` pastes, `GeminiStrategy` goes through its Quill instance, and `ClaudeStrategy` through ProseMirror. The selector controller selects the caret again right before it calls the strategy, so a strategy inserts at the field's current selection and does not look for the caret itself. Only `restore()`, which Undo calls, replaces the whole field. When you add a Platform, add it to `PLATFORMS` in `src/content/platforms/__tests__/caret-insertion.test.ts` and to the stand-in pages that `tests/e2e/content/caret-insertion.spec.ts` runs on (`tests/e2e/fixtures/platform-pages.ts`).

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

On a development build (`npm run dev`), enable debug logging by opening the browser console and running:

```javascript
localStorage.setItem('prompt-library-debug', 'true');
// Then reload the page
```

A development build also turns it on at `localhost`. A release build (`npm run build`, the build the e2e suite and `live:check` load) reads neither: the page owns its localStorage, so `src/content/utils/logger.ts` reads the flag only when `import.meta.env.DEV` is true, and the release build drops that code (ticket My-Prompt-Manager-j3i6). There, the Debug mode switch in Settings → Advanced is the only way: it turns on the same logging on every Platform, and also shows the Welcome, then What's new, at every opening of the popup and side panel. The localStorage flag does not: the popup reads Debug mode only from the stored Site settings.

### Debug Interface

`window.__promptLibraryDebug` (`src/content/index.ts`), from the extension's context of the DevTools console (see [Step 5](#step-5-debug-and-refine)):

```javascript
window.__promptLibraryDebug?.isInitialized();  // the content script started
window.__promptLibraryDebug?.getInstance();    // the injector
window.__promptLibraryDebug?.reinitialize();   // cleanup, then start again
window.__promptLibraryDebug?.cleanup();        // remove the button and stop
window.__promptLibraryDebug?.getLogger();      // error, warn, info, debug
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
- Check the host is in `manifest.json` (`host_permissions` and the content script's `matches`)
- Verify the strategy's `getSelectors()` match actual DOM elements (`PlatformManager.getAllSelectors()` finds the field with them)
- Check the strategy's `createIcon()`, or the `iconMethod` of the config, returns an icon
- Check strategy is registered in strategy-constructors.ts
- `canHandle()` decides only which strategy inserts and undoes, not whether the button shows

**Button appears in wrong location:**
- Adjust the `iconPlacement` chain in `platforms.ts` (no strategy keeps a copy)
- With debug mode on (see [Debug Mode](#debug-mode); warnings are silent otherwise), a warning `No anchor of this Platform found in its composer, the icon is anchored on the editor instead` in the console means no anchor was found and the icon fell back to the editor's corner. It comes 5 seconds after the icon was placed on the editor (`IconPlacementController.TOOLBAR_GRACE_MS`), not at once: until then the icon waits there for a toolbar the Platform renders after it
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

The Prompts button looks the same on every Platform and follows the extension's theme, not the Platform's. `ThemeManager` (`src/content/utils/theme-manager.ts`) reads the theme the user chose (`settings.theme` in `chrome.storage.local`, `system` resolved through `prefers-color-scheme`) and sets `dark-theme` or `light-theme` on every `.prompt-library-pill`. The colors are CSS variables in `getCSS()` of `src/content/utils/styles.ts`, light on `.prompt-library-pill` and dark on `.prompt-library-pill.dark-theme`, injected into the page. No Tailwind class reaches the Platform's page. The Prompt selector carries its own stylesheet in its shadow root (`src/content/selector/selectorStyles.ts`).

## Examples

The real strategies are the examples: start from the one whose editor is closest to your Platform's.

| Platform | Strategy | Base class | Insertion |
|----------|----------|------------|-----------|
| Gemini | `src/content/platforms/gemini-strategy.ts` | `PlatformStrategy` | its Quill instance's API first (`gemini-quill-api`), then the browser's editing command at the caret |
| Microsoft Copilot | `src/content/platforms/copilot-strategy.ts` | `ReactPlatformStrategy` | `validateContent()`, then `insertIntoReactTextarea()` in its textarea |
| Mistral LeChat | `src/content/platforms/mistral-strategy.ts` | `PlatformStrategy` | `insertIntoTextControl()` in a textarea, else `insertEditableText()` in its ProseMirror editor |
| Perplexity, M365 Copilot | `src/content/platforms/perplexity-strategy.ts`, `src/content/platforms/m365copilot-strategy.ts` | `LexicalStrategy` | a paste |

Each one's `canHandle()` checks the hostname and the kind of field: Gemini a Quill editor, Copilot a `textarea`, Mistral a chat textarea, its ProseMirror editor or a `role="textbox"`.

Two anchor chains of `src/config/platforms.ts`, as examples:

- Copilot: before the audio call button (`button[data-testid="audio-call-button"]`), then before the submit button.
- Mistral: before the `<div>` that holds the voice button alone, then before the voice button, then after the settings button. The ARIA labels are English: in another locale the icon falls to the Anchored overlay.

## 🐛 Troubleshooting

### Button Doesn't Appear

**Symptoms:** Icon doesn't show up on the target platform

**Possible Causes:**
1. The host is missing from `manifest.json`, so the content script never runs
2. The strategy's selectors don't match actual DOM elements
3. Strategy not registered in strategy-constructors.ts
4. Content script not injected properly

**Solutions:**
```javascript
// In browser console, test your selectors:
document.querySelectorAll('your-selector-here')

// From the extension's context of the console: is the content script running?
window.__promptLibraryDebug?.isInitialized()

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
// (src/content/core/anchored-overlay.ts), and goes into the toolbar if the Platform renders it; after the
// grace period, only the chain's first anchor, or the element the user picked, takes the icon from there.
// Still not found 5 seconds after that placement (IconPlacementController.TOOLBAR_GRACE_MS), the console shows a warning:
// "No anchor of this Platform found in its composer, the icon is anchored on the editor instead".
// If the Platform re-renders its Toolbar, src/content/core/icon-placement.ts places the icon again on its own.
```

After fixing the chain, refresh `tests/fixtures/composers/<id>.html` from the live composer with `npm run composers:capture -- --only <id>` (sign in once with `--login`), which runs the chain tests on what it captured.

Until a release fixes the chain, a user can repair it: the Platform's row in Settings says its toolbar changed and offers **Place the icon**, which opens the Element picker on the Platform's tab. The pick is stored under `iconPlacementRepairs` (`src/services/iconPlacementRepairs.ts`) and the icon goes before the picked element; it is dropped on its own once the chain finds its anchor again: its first anchor while the picked element is on the page, a later one only once the grace period is over without it.

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
// 1. Add the platform's id to the hand-written unions: KnownPlatformType in src/types/index.ts,
//    and the PlatformName of src/content/types/platform.ts and of src/config/platforms.ts
//    (deprecated). Only KnownPlatformType is read by the code; leaving the other two out
//    breaks no build (m365copilot is missing from the first one today).
export type KnownPlatformType = 'claude' | 'chatgpt' | 'gemini' | 'perplexity' | 'copilot' | 'mistral' | 'm365copilot' | 'yourplatform' | 'custom';

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

// 4. Strategy not properly mocked (the path from src/content/platforms/__tests__/):
vi.mock('../../../config/platforms', () => ({
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

**Last Updated:** 2026-11-21
**Version:** 2.0.0 (Centralized Configuration)