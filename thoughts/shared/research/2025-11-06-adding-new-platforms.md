---
date: 2025-11-06T00:00:00-08:00
researcher: Claude Code
git_commit: 35837aff23e037815691373f5946a3a0549895a4
branch: main
repository: My-Prompt-Manager
topic: "How to Add a New Platform to the Chrome Extension"
tags: [research, codebase, platform-integration, strategy-pattern, architecture]
status: complete
last_updated: 2025-11-06
last_updated_by: Claude Code
---

# Research: How to Add a New Platform to the Chrome Extension

**Date**: 2025-11-06T00:00:00-08:00
**Researcher**: Claude Code
**Git Commit**: 35837aff23e037815691373f5946a3a0549895a4
**Branch**: main
**Repository**: My-Prompt-Manager

## Research Question

How can we add a new AI platform (like Gemini, Mistral, etc.) to the My Prompt Manager Chrome extension?

## Summary

The My-Prompt-Manager extension uses a centralized configuration system combined with the Strategy Pattern to add new platform support. As of v1.3+, adding a basic platform takes approximately **5 minutes** by updating a single configuration file. The extension supports two approaches:

1. **Quick Method (5 minutes)**: Add a platform configuration to `src/config/platforms.ts` - the system handles everything else automatically
2. **Advanced Method (custom logic)**: Create a custom strategy class for platforms requiring special insertion logic

The architecture uses:
- **Centralized Configuration**: Single source of truth in `src/config/platforms.ts`
- **Strategy Pattern**: Platform-specific insertion strategies extending `PlatformStrategy` base class
- **Factory Pattern**: Type-safe registry with data-driven strategy instantiation
- **Dependency Injection**: Testable hostname injection for all strategies
- **3-Tier Fallback System**: Native API → execCommand → DOM manipulation

Currently supported platforms: Claude (priority 100), ChatGPT (90), Gemini (85), Mistral (85), Perplexity (80).

## Detailed Findings

### Quick Start Method (Recommended for Most Platforms)

**Location**: [`src/config/platforms.ts`](src/config/platforms.ts)

To add a new platform in approximately 5 minutes:

#### Step 1: Add Platform Configuration

Edit `src/config/platforms.ts` and add a new entry to the `SUPPORTED_PLATFORMS` object:

```typescript
export const SUPPORTED_PLATFORMS: Record<string, PlatformDefinition> = {
  // ... existing platforms ...

  yourplatform: {
    id: 'yourplatform',                    // Unique identifier (lowercase, no spaces)
    hostname: 'your-ai-platform.com',      // Exact hostname
    displayName: 'Your AI Platform',       // Human-readable name
    priority: 70,                          // Selection priority (higher = higher priority)
    defaultEnabled: true,                  // Include in fresh installs
    selectors: [                           // CSS selectors for input elements
      'textarea[placeholder*="Ask"]',
      'div[contenteditable="true"]',
      '[role="textbox"]'
    ],
    buttonContainerSelector: '.button-container', // Where to place icon (optional)
    strategyClass: 'YourPlatformStrategy',        // For future custom logic
    hostnamePatterns: ['yourplatform']            // For hostname matching
  }
};
```

**Priority Guidelines**:
- **100**: Premium platforms (Claude, ChatGPT)
- **80-90**: Major platforms (Perplexity, Mistral, Gemini)
- **60-79**: Secondary platforms
- **40-59**: Experimental/beta platforms
- **< 40**: Custom/niche platforms

#### Step 2: Build and Test

```bash
npm run build              # Build extension
# Load in Chrome: chrome://extensions/ → Load unpacked → select dist/
# Visit your platform and verify icon appears
```

**What the centralized config system handles automatically**:
- ✅ Background script injection
- ✅ Content script default settings
- ✅ Platform detection and matching
- ✅ Type definitions

### Advanced Method (Custom Insertion Logic)

For platforms requiring special insertion handling, create a custom strategy class.

#### Architecture Overview

```
src/
├── config/platforms.ts           # ⭐ Centralized configuration
├── content/platforms/
│   ├── base-strategy.ts          # Abstract base class
│   ├── claude-strategy.ts        # Claude.ai implementation
│   ├── chatgpt-strategy.ts       # ChatGPT implementation
│   ├── gemini-strategy.ts        # Google Gemini (Quill.js)
│   ├── mistral-strategy.ts       # Mistral LeChat (ProseMirror)
│   ├── perplexity-strategy.ts    # Perplexity implementation
│   ├── default-strategy.ts       # Fallback strategy
│   ├── your-platform-strategy.ts # Your custom strategy
│   └── platform-manager.ts       # Strategy orchestration
└── background/background.ts      # Uses centralized config
```

#### Step 1: Create Strategy Class

**File**: `src/content/platforms/your-platform-strategy.ts`

```typescript
import { PlatformStrategy } from './base-strategy';
import type { InsertionResult, PlatformConfig } from '../types';
import { sanitizeUserInput } from '../utils/storage';
import { info, error as logError, debug } from '../utils/logger';

export class YourPlatformStrategy extends PlatformStrategy {
  constructor(hostname?: string) {
    const config: PlatformConfig = {
      selectors: [
        'textarea[data-testid="input"]',
        'div[contenteditable="true"]'
      ],
      buttonContainerSelector: '.input-actions-container',
      priority: 85
    };

    super('YourPlatform', 85, config, hostname);
  }

  /**
   * Determines if this strategy can handle the given element
   */
  canHandle(element: HTMLElement): boolean {
    const selectors = this.getSelectors();
    for (const selector of selectors) {
      if (element.matches(selector)) {
        debug('YourPlatformStrategy can handle element', { selector });
        return true;
      }
    }
    return false;
  }

  /**
   * Inserts content using platform-specific logic
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
      // Tier 1: Try native API (if available)
      const apiResult = this._tryNativeAPI(element, sanitizedContent);
      if (apiResult.success) return apiResult;

      // Tier 2: execCommand fallback
      const execResult = await this._tryExecCommand(element, sanitizedContent);
      if (execResult.success) return execResult;

      // Tier 3: DOM manipulation (last resort)
      return this._tryDOMManipulation(element, sanitizedContent);

    } catch (err) {
      logError('YourPlatform insertion failed', err as Error, {
        component: 'YourPlatformStrategy'
      });
      return {
        success: false,
        error: (err as Error).message
      };
    }
  }

  /**
   * Required method: returns CSS selectors
   */
  getSelectors(): string[] {
    return this.config?.selectors || [];
  }

  // Private helper methods for insertion tiers...
}
```

#### Step 2: Register Strategy in Factory

**File**: `src/content/platforms/platform-manager.ts`

```typescript
// Add import
import { YourPlatformStrategy } from './your-platform-strategy';

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
    'yourplatform': YourPlatformStrategy, // ✅ Add here
  };
}
```

#### Step 3: Write Tests

**File**: `src/content/platforms/__tests__/your-platform-strategy.test.ts`

Test coverage requirements:
- Constructor & configuration: 2-3 tests
- Platform detection (`canHandle`): 3-5 tests
- Content insertion: 5-8 tests
- Error handling: 2-3 tests
- **Minimum**: 15-20 tests per platform strategy

## Code References

### Core Platform Files

- [`src/config/platforms.ts`](src/config/platforms.ts) - Centralized platform definitions
- [`src/content/platforms/base-strategy.ts`](src/content/platforms/base-strategy.ts) - Abstract base class
- [`src/content/platforms/platform-manager.ts`](src/content/platforms/platform-manager.ts) - Strategy orchestration
- [`src/content/ui/element-factory.ts`](src/content/ui/element-factory.ts) - Icon creation

### Example Platform Implementations

- [`src/content/platforms/claude-strategy.ts`](src/content/platforms/claude-strategy.ts) - ProseMirror editor (3-tier fallback)
- [`src/content/platforms/chatgpt-strategy.ts`](src/content/platforms/chatgpt-strategy.ts) - React-aware insertion
- [`src/content/platforms/gemini-strategy.ts`](src/content/platforms/gemini-strategy.ts) - Quill.js with caching
- [`src/content/platforms/mistral-strategy.ts`](src/content/platforms/mistral-strategy.ts) - ProseMirror with sanitization
- [`src/content/platforms/perplexity-strategy.ts`](src/content/platforms/perplexity-strategy.ts) - Comprehensive events

## Architecture Documentation

### Base Strategy Pattern

**Location**: [`src/content/platforms/base-strategy.ts`](src/content/platforms/base-strategy.ts)

The `PlatformStrategy` abstract base class defines the contract for all platform-specific insertion strategies:

#### Required Abstract Methods

1. **`canHandle(element: HTMLElement): boolean`**
   - Determines if strategy can handle insertion for given element
   - Returns `true` if element matches platform criteria

2. **`insert(element: HTMLElement, content: string): Promise<InsertionResult>`**
   - Platform-specific insertion logic
   - Returns `InsertionResult` with success status and method used

3. **`getSelectors(): string[]`**
   - Returns CSS selectors for finding input elements

#### Optional Override Methods

1. **`getButtonContainerSelector(): string | null`**
   - Returns selector for button container
   - Default: returns `config.buttonContainerSelector`

2. **`createIcon?(uiFactory: UIElementFactory): HTMLElement | null`**
   - Creates platform-specific custom icon
   - Default: returns `null` (uses default icon)

3. **`cleanup?(): void`**
   - Cleans up platform-specific resources
   - Default: no-op

#### Protected Helper Methods

- `_debug(message: string, context?: Record<string, unknown>): void`
- `_warn(message: string, errorOrContext?: Record<string, unknown> | Error): void`
- `_error(message: string, errorObj: Error, context?: Record<string, unknown>): void`

All logging methods automatically prefix with platform name: `[platformName] message`

### Platform Manager

**Location**: [`src/content/platforms/platform-manager.ts`](src/content/platforms/platform-manager.ts)

The `PlatformManager` orchestrates platform strategy registration, initialization, selection, and content insertion.

#### Strategy Registry

```typescript
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
```

**Type Safety**: Registry ensures all constructors accept optional `hostname` parameter.

#### Initialization Flow

```
1. initializeStrategies() - Public entry point
   ↓
2. _loadCustomSiteConfig() - Load user-defined custom sites
   ↓
3. _initializeStrategies() - Create and register strategies
   ↓
4. _createStrategyForHostname(hostname) - Factory method
   ↓
5. Look up platform from getPlatformByHostname(hostname)
   ↓
6. Get constructor from STRATEGY_REGISTRY[platform.id]
   ↓
7. Instantiate: new StrategyConstructor(hostname)
   ↓
8. Add DefaultStrategy as fallback
   ↓
9. Sort by priority (descending)
```

#### Strategy Selection Flow

```
1. findBestStrategy(element)
   ↓
2. Filter strategies where canHandle(element) === true
   ↓
3. Return first compatible strategy (highest priority)
```

#### Content Insertion Flow

```
1. insertContent(element, content)
   ↓
2. Find best strategy using findBestStrategy()
   ↓
3. Call strategy.insert(element, content)
   ↓
4. If successful, set activeStrategy and return result
   ↓
5. If failed, return error result
```

### Dependency Injection Architecture

All strategies support hostname injection for testing:

```typescript
// Production: Uses current hostname
const strategy = new ClaudeStrategy(); // hostname = window.location.hostname

// Testing: Injects test hostname
const strategy = new ClaudeStrategy('test.claude.ai'); // hostname = 'test.claude.ai'
```

**Benefits**:
- Testability without DOM manipulation
- Same strategy class for different hostnames
- No dependency on global `window.location`

### Priority System

**Current Priorities**:
- Claude: 100 (highest)
- ChatGPT: 90
- Gemini: 85
- Mistral: 85
- Perplexity: 80
- Default: 0 (fallback)

**Selection Impact**: `findBestStrategy()` returns first compatible strategy (highest priority wins).

### Common Insertion Patterns

#### Pattern 1: 3-Tier Fallback (Claude, Gemini, Mistral)

```
Tier 1: Platform-specific API (ProseMirror, Quill)
  ↓ (if fails)
Tier 2: execCommand (contentEditable)
  ↓ (if fails)
Tier 3: DOM manipulation (textContent/value)
```

#### Pattern 2: React-Aware (ChatGPT)

```
1. Get native property setter from prototype
2. Bind setter to element
3. Call setter with content
4. Dispatch 'input' and 'change' events
```

#### Pattern 3: Comprehensive Events (Perplexity)

```
1. execCommand insertion
2. Dispatch: InputEvent, change, keyup, compositionend, blur, focus
```

### Event Dispatching Patterns

Common events across platforms:

- **input** (always with `InputEvent` type, `inputType: 'insertText'`)
- **change** (always)
- **compositionend** (Claude, Gemini, Mistral)
- **blur/focus** (Claude DOM, Gemini comprehensive, Perplexity)
- **keyup** (Perplexity only)
- **text-change** (Gemini Quill only)

### Performance Optimizations

**Gemini Strategy Caching** (unique among platforms):

```typescript
private _quillEditorCache: WeakMap<HTMLElement, HTMLElement | null> = new WeakMap();
private _lastPageWideSearchTime = 0;
private static readonly PAGE_WIDE_SEARCH_THROTTLE_MS = 1000;
```

**Performance Impact**:
- First lookup: 1-5ms (page-wide search)
- Subsequent lookups: <0.1ms (cache hit)
- Memory overhead: <200 bytes (WeakMap auto-GC)

### Platform Configuration Structure

```typescript
interface PlatformDefinition {
  id: string;                        // Registry key (e.g., 'claude')
  hostname: string;                  // Primary hostname (e.g., 'claude.ai')
  displayName: string;               // UI display name
  priority: number;                  // Strategy selection priority
  defaultEnabled: boolean;           // Default enable status
  selectors: string[];               // Input element selectors
  buttonContainerSelector?: string;  // Icon placement selector
  strategyClass: string;             // Strategy class name
  hostnamePatterns?: string[];       // Additional hostname patterns
}
```

### Example Platform Configurations

#### Claude

```typescript
claude: {
  id: 'claude',
  hostname: 'claude.ai',
  displayName: 'Claude',
  priority: 100,
  defaultEnabled: true,
  selectors: [
    'div[contenteditable="true"][role="textbox"].ProseMirror'
  ],
  buttonContainerSelector: '.relative.flex-1.flex.items-center.gap-2.shrink.min-w-0',
  strategyClass: 'ClaudeStrategy',
  hostnamePatterns: ['claude']
}
```

#### Gemini

```typescript
gemini: {
  id: 'gemini',
  hostname: 'gemini.google.com',
  displayName: 'Google Gemini',
  priority: 85,
  defaultEnabled: true,
  selectors: [
    'div.ql-editor[contenteditable="true"][role="textbox"]',
    'rich-textarea .ql-editor'
  ],
  buttonContainerSelector: '.input-buttons-wrapper-bottom',
  strategyClass: 'GeminiStrategy',
  hostnamePatterns: ['gemini']
}
```

## Historical Context

### Evolution of Platform Addition Process

**Pre-v1.3** (Complex Multi-File Approach):
1. Create strategy class
2. Register in platform manager
3. Update manifest permissions
4. Update UI components
5. Add icon components
6. Write tests
7. Update documentation

**v1.3+** (Centralized Configuration):
1. Add platform configuration to `platforms.ts` (~5 minutes)
2. System handles everything automatically

**Key Architectural Shift**: Migration from manual multi-file approach to data-driven configuration system.

### Platform Addition Timeline

1. **Claude.ai** (Priority: 100) - ProseMirror editor with 3-tier fallback
2. **ChatGPT** (Priority: 90) - React-specific insertion with native setter
3. **Gemini** (Priority: 85) - Quill.js editor with caching and Angular zone.js
4. **Mistral** (Priority: 85) - ProseMirror with content sanitization
5. **Perplexity** (Priority: 80) - Comprehensive event dispatching

### Design Decisions

**Why Strategy Pattern over Conditional Chains?**
- Open/Closed Principle: Add platforms without modifying existing code
- Encapsulation: Platform-specific quirks isolated in strategy classes
- Testability: Each strategy testable in isolation

**Why Centralized Configuration?**
- Single source of truth
- No conditional chains (`if platform === 'claude' else if ...`)
- TypeScript enforces registry completeness at compile time

**Why Dependency Injection?**
- Testability: Strategies testable with mock hostnames
- Flexibility: Same strategy class for different hostnames
- Isolation: No dependency on global state

**Why 3-Tier Fallback?**
- Graceful degradation: Try best method first, fallback to universal methods
- Reliability: Platform UI changes don't break extension
- Performance: Native APIs faster than DOM manipulation

### Performance Trade-offs

**Gemini Caching Decision**:
- **Cost**: 200 bytes per WeakMap entry
- **Benefit**: 1-5ms → <0.1ms lookup time (5-50x faster)
- **Rationale**: Gemini has frequent re-queries during typing

**Element Fingerprinting Decision**:
- **Cost**: 750 bytes per fingerprint vs 50 bytes for selector
- **Benefit**: 95%+ match rate after DOM changes (vs <20% for selectors)
- **Rationale**: Reliability prioritized over storage efficiency

**Floating UI Decision**:
- **Cost**: 13KB bundle increase
- **Benefit**: 98%+ browser coverage (vs 65% for CSS Anchor API alone)
- **Rationale**: Better UX for 35% more users

## Testing Requirements

### Platform Strategy Test Coverage

**Minimum Requirements**: 15-20 tests per platform strategy

**Test Categories**:

1. **Constructor & Configuration** (2-3 tests)
   - Correct initialization of name, priority, config
   - Hostname dependency injection

2. **Platform Detection** (3-5 tests)
   - `canHandle()` returns true for matching elements
   - `canHandle()` returns false for non-matching elements
   - Edge cases (null, invalid elements)

3. **Content Insertion** (5-8 tests)
   - Content sanitization before insertion
   - Each insertion tier (native API, execCommand, DOM)
   - Event dispatching after insertion
   - Successful insertion result format

4. **Error Handling** (2-3 tests)
   - Graceful failure handling
   - Error result format
   - Fallback tier progression

### Example Test Structure

```typescript
describe('YourPlatformStrategy', () => {
  describe('Constructor & Configuration', () => {
    it('should initialize with correct name and priority', () => {
      expect(strategy.name).toBe('YourPlatform');
      expect(strategy.priority).toBe(85);
    });
  });

  describe('Platform Detection', () => {
    it('should handle textarea elements with correct data-testid', () => {
      expect(strategy.canHandle(mockElement)).toBe(true);
    });
  });

  describe('Content Insertion', () => {
    it('should sanitize content before insertion', async () => {
      await strategy.insert(mockElement, 'test content');
      expect(sanitizeUserInput).toHaveBeenCalledWith('test content');
    });
  });
});
```

## Checklist for Adding New Platform

```markdown
- [ ] Platform configuration added to `config/platforms.ts`
- [ ] (Optional) Strategy class created in `platforms/your-platform-strategy.ts`
- [ ] (Optional) Strategy registered in `STRATEGY_REGISTRY`
- [ ] (Optional) Icon component created (content script + React)
- [ ] Settings UI updated with platform info (if custom icon)
- [ ] Manifest permissions added (`host_permissions`, `content_scripts`)
- [ ] Unit tests written (15+ tests if custom strategy)
- [ ] All tests passing (`npm test`)
- [ ] Linting clean (`npm run lint`)
- [ ] Manual testing completed on real site
- [ ] Documentation updated (README, PLATFORM_INTEGRATION.md)
- [ ] Performance benchmarks met (<100ms insertion)
- [ ] Security verified (content sanitization)
```

## Related Documentation

- [docs/PLATFORM_INTEGRATION.md](docs/PLATFORM_INTEGRATION.md) - Comprehensive platform integration guide
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Complete system architecture
- [docs/TESTING.md](docs/TESTING.md) - Testing strategies and patterns
- [docs/DESIGN_GUIDELINES.md](docs/DESIGN_GUIDELINES.md) - Visual design system
- [docs/ELEMENT_FINGERPRINTING_DESIGN.md](docs/ELEMENT_FINGERPRINTING_DESIGN.md) - Element fingerprinting system
- [docs/POSITIONING_SOLUTION_ANALYSIS.md](docs/POSITIONING_SOLUTION_ANALYSIS.md) - Icon positioning strategies

## Open Questions

None - the platform addition process is well-documented and tested across 5 existing platform implementations.
