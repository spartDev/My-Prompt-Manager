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
    hostnamePatterns: ['yourplatform'] // For hostname matching
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

## Examples

### Example 1: Gemini (Google AI)

```typescript
export class GeminiStrategy extends PlatformStrategy {
  constructor() {
    super('gemini', 95, {
      selectors: [
        'div[contenteditable="true"][data-testid="input-area"]',
        'textarea[aria-label*="Enter a prompt"]'
      ],
      buttonContainerSelector: '.input-area-container .actions',
      priority: 95
    });
  }

  canHandle(_element: HTMLElement): boolean {
    return this.hostname === 'gemini.google.com' || 
           this.hostname === 'bard.google.com';
  }

  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      element.focus();
      
      if (element.contentEditable === 'true') {
        // Clear existing content
        element.textContent = '';
        
        // Insert new content
        document.execCommand('insertText', false, content);
        
        // Trigger Gemini events
        element.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: content
        }));
        
        return { success: true, method: 'gemini-execCommand' };
      }
      
      return { success: false, error: 'Unsupported element' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}
```

### Example 2: Mistral.ai

```typescript
export class MistralStrategy extends PlatformStrategy {
  constructor() {
    super('mistral', 85, {
      selectors: [
        'textarea[placeholder*="Ask me anything"]',
        'div[contenteditable="true"].chat-input'
      ],
      buttonContainerSelector: '.chat-input-actions',
      priority: 85
    });
  }

  canHandle(_element: HTMLElement): boolean {
    return this.hostname === 'chat.mistral.ai';
  }

  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      element.focus();
      
      if (element.tagName === 'TEXTAREA') {
        (element as HTMLTextAreaElement).value = content;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true, method: 'mistral-textarea' };
      }
      
      return { success: false };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}
```

### Example 3: Custom Platform with Complex Insertion

```typescript
export class ComplexPlatformStrategy extends PlatformStrategy {
  constructor() {
    super('complex', 80, {
      selectors: ['div[data-editor="true"]'],
      buttonContainerSelector: '.editor-toolbar',
      priority: 80
    });
  }

  canHandle(_element: HTMLElement): boolean {
    return this.hostname === 'complex-platform.com';
  }

  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    // Try multiple methods in order
    const methods = [
      () => this._tryReactMethod(element, content),
      () => this._tryExecCommand(element, content), 
      () => this._tryDOMMethod(element, content)
    ];
    
    for (const method of methods) {
      try {
        const result = await method();
        if (result.success) return result;
      } catch (error) {
        this._warn('Method failed, trying next...', error);
      }
    }
    
    return { success: false, error: 'All insertion methods failed' };
  }

  private async _tryReactMethod(element: HTMLElement, content: string): Promise<InsertionResult> {
    // Custom React-specific insertion logic
    // ...
  }
  
  private async _tryExecCommand(element: HTMLElement, content: string): Promise<InsertionResult> {
    // Standard execCommand approach
    // ...
  }
  
  private _tryDOMMethod(element: HTMLElement, content: string): InsertionResult {
    // Direct DOM manipulation
    // ...
  }
}
```

## Troubleshooting

### Issue: "Strategy not found for hostname"

**Solution**: Check that `canHandle()` method returns true for your domain:

```typescript
canHandle(_element: HTMLElement): boolean {
  // Make sure this matches your domain exactly
  return this.hostname === 'your-exact-domain.com';
}
```

### Issue: "No input elements found"

**Solution**: Inspect the page and update your selectors:

```typescript
// Test selectors in browser console:
document.querySelectorAll('your-selector-here')

// Update selectors to match actual DOM:
selectors: [
  'div[contenteditable="true"]', // Generic
  'textarea',                    // Fallback
  '[data-testid="input"]'        // Specific
]
```

### Issue: "Button appears but prompts don't insert"

**Solution**: Debug the insertion method:

1. Check if the right element is being targeted
2. Try different insertion approaches
3. Check what events the platform expects
4. Use browser inspector to understand the input structure

### Issue: "Button appears in wrong location"

**Solution**: Adjust button container selector or add custom positioning:

```typescript
// Option 1: Update selector
buttonContainerSelector: '.correct-container-class'

// Option 2: Add custom positioning in injector.ts
if (this.state.hostname === 'your-platform.com' && !injected) {
  const customContainer = document.querySelector('.your-custom-selector');
  if (customContainer) {
    customContainer.appendChild(icon);
    injected = true;
  }
}
```

## Advanced Customization

### Custom Button Styling

Add a custom icon method in `src/content/ui/element-factory.ts`:

```typescript
createYourPlatformIcon(): HTMLElement {
  const icon = document.createElement('button');
  icon.className = 'your-platform-button-classes';
  icon.innerHTML = `
    <svg><!-- Your custom icon --></svg>
    <span>My Prompts</span>
  `;
  return icon;
}
```

### Platform-Specific Positioning

Add custom positioning logic in `src/content/core/injector.ts`:

```typescript
// For YourPlatform, find specific container and position
if (this.state.hostname === 'your-platform.com' && !injected) {
  const specificContainer = document.querySelector('.your-specific-container');
  if (specificContainer) {
    // Custom positioning logic
    specificContainer.insertBefore(icon, specificContainer.firstChild);
    injected = true;
  }
}
```

### Custom Event Handling

For platforms with special requirements:

```typescript
private _triggerCustomEvents(element: HTMLElement, content: string): void {
  // Platform-specific events
  element.dispatchEvent(new CustomEvent('your-platform-change', {
    detail: { content },
    bubbles: true
  }));
  
  // Standard events
  element.dispatchEvent(new Event('input', { bubbles: true }));
}
```

## Contributing

When you've successfully added a new platform:

1. **Test thoroughly** on the target platform
2. **Add tests** in `src/content/platforms/__tests__/your-platform-strategy.test.ts`
3. **Update documentation** with your platform example
4. **Submit a pull request** with your changes

## Need Help?

- Check existing strategy implementations for reference
- Use browser developer tools to inspect the target platform
- Enable debug mode for detailed logging
- Ask questions in GitHub issues

Happy coding! 🚀