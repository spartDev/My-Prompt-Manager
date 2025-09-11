# Content Script Documentation

## Overview

The `src/content/` directory contains the modular TypeScript content script that enables seamless integration of the My Prompt Manager extension with AI chat platforms. It dynamically injects a prompt library icon into supported websites, allowing users to access and insert their saved prompts directly into chat interfaces.

## Modular Architecture

The content script has been refactored from a monolithic JavaScript file into a well-organized TypeScript module structure:

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
│   ├── styles.ts              # CSS injection utilities
│   └── theme-manager.ts       # Theme synchronization utilities
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
├── modules/
│   └── element-picker.ts      # Security-focused element picker with audit logging
└── core/
    ├── injector.ts           # Main prompt library injector
    └── insertion-manager.ts   # Platform insertion manager
```

## Core Components

### Entry Point (`src/content/index.ts`)
The main entry point that:
- Initializes CSS injection
- Creates and starts the main injector
- Sets up cleanup handlers
- Maintains backward compatibility

### Core Components (`src/content/core/`)

#### **PromptLibraryInjector** (`core/injector.ts`)
The primary orchestrator that manages the entire lifecycle of prompt library integration.

**Key Responsibilities:**
- Detects and validates text input areas on AI platforms
- Manages icon injection and positioning
- Handles prompt selector UI creation and interaction
- Implements performance optimizations and cleanup routines

#### **PlatformInsertionManager** (`core/insertion-manager.ts`)
Manages the insertion of prompts into different AI platforms using the strategy pattern.

### Utility Modules (`src/content/utils/`)

#### **StorageManager** (`utils/storage.ts`)
Handles all Chrome storage operations and data security.

**Key Methods:**
- `getPrompts()`: Retrieves and validates prompts from Chrome storage
- `sanitizeUserInput()`: Removes potentially dangerous content from user input
- `escapeHtml()`: Prevents XSS by escaping HTML entities
- `createElement()`: Safely creates DOM elements with text content
- `createSVGElement()`: Creates SVG elements with proper namespace
- `validatePromptData()`: Ensures prompt objects contain safe, expected properties
- `createPromptListItem()`: Generates secure prompt list items for display

**Security Features:**
- Comprehensive input sanitization (removes HTML tags, dangerous URLs, event handlers)
- 50KB length limit on inputs to prevent DoS attacks
- HTML entity escaping for all user-generated content
- Validation of all prompt data before processing

#### **Logger** (`utils/logger.ts`)
Provides structured logging with debug mode support.

**Log Levels:**
- `error()`: Critical errors with stack traces
- `warn()`: Warning conditions
- `info()`: Informational messages (debug mode only)
- `debug()`: Detailed debugging information (debug mode only)

**Features:**
- Automatic timestamp and context inclusion
- Debug mode toggle via localStorage
- Visual debug notifications in development
- Privacy-conscious data truncation

#### **StylesManager** (`utils/styles.ts`)
Manages CSS injection for the content script UI.

**Key Methods:**
- `injectCSS()`: Injects the content script styles
- `getCSS()`: Returns the CSS string

#### **DOM Utilities** (`utils/dom.ts`)
Provides safe DOM manipulation utilities with proper TypeScript typing.

#### **ThemeManager** (`utils/theme-manager.ts`)
Handles theme synchronization between the extension and host platforms.

**Key Features:**
- Automatic theme detection from host platform
- Synchronization with extension popup theme
- Support for light/dark mode switching
- CSS custom property management

### UI Components (`src/content/ui/`)

#### **EventManager** (`ui/event-manager.ts`)
Centralizes event listener management for proper cleanup.

**Key Features:**
- Tracks all registered event listeners
- Provides centralized cleanup mechanism
- Prevents memory leaks from orphaned listeners
- Error handling for listener removal

#### **UIElementFactory** (`ui/element-factory.ts`)
Creates platform-specific UI elements with consistent security practices.

**Platform Support:**
- `createClaudeIcon()`: Claude.ai specific styling
- `createPerplexityIcon()`: Perplexity.ai specific styling
- `createChatGPTIcon()`: ChatGPT specific styling
- `createFloatingIcon()`: Generic floating icon for custom sites

#### **KeyboardNavigationManager** (`ui/keyboard-navigation.ts`)
Implements comprehensive keyboard navigation for the prompt selector.

**Features:**
- Arrow key navigation through prompt list
- Enter to select, Escape to close
- Tab key support for focus management
- Auto-focus search input on open
- Smooth scrolling to selected items

### Platform Strategy System (`src/content/platforms/`)

#### **PlatformStrategy** (`platforms/base-strategy.ts`)
Abstract base class that defines the interface for platform-specific implementations.

**Key Methods:**
- `canHandle(element)`: Determines if the strategy can handle a given element
- `insert(element, content)`: Inserts content into the element
- `getSelectors()`: Returns CSS selectors for the platform
- `getButtonContainerSelector()`: Returns selector for button container
- `createIcon()`: Creates platform-specific icon (optional)

#### **Platform Implementations:**
- **ClaudeStrategy** (`platforms/claude-strategy.ts`): Claude.ai specific implementation
- **ChatGPTStrategy** (`platforms/chatgpt-strategy.ts`): ChatGPT specific implementation  
- **PerplexityStrategy** (`platforms/perplexity-strategy.ts`): Perplexity.ai specific implementation
- **DefaultStrategy** (`platforms/default-strategy.ts`): Fallback implementation for generic sites

#### **PlatformManager** (`platforms/platform-manager.ts`)
Manages platform strategies and handles strategy selection.

**Key Features:**
- Strategy registration and management
- Automatic strategy selection based on element compatibility
- Fallback handling for unsupported platforms

### Security Modules (`src/content/modules/`)

#### **ElementPicker** (`modules/element-picker.ts`)
Provides secure element selection functionality with comprehensive security safeguards.

**Security Features:**
- **Blocked Selectors**: 20+ patterns preventing interaction with sensitive fields
- **Domain Sensitivity Detection**: Pattern-based identification of financial, government, and healthcare sites
- **Audit Logging**: Session storage-based security incident tracking
- **Visual Security Feedback**: Color-coded highlighting (red for blocked, purple for allowed)
- **Data Minimization**: Zero extraction of sensitive field content

**Key Constants:**
- `BLOCKED_SELECTORS`: Array of security-focused CSS selectors
- `SENSITIVE_DOMAINS`: Pattern-based domain classification
- `MAX_AUDIT_ENTRIES`: Audit log size management
- `WARNING_DISMISS_TIMEOUT`: User notification timing

**Core Methods:**
- `startPicking()`: Initiates secure element selection mode
- `stopPicking()`: Cleanly exits selection mode with cleanup
- `auditLog()`: Records security events for compliance
- `isElementBlocked()`: Multi-layer security validation
- `showSecurityWarning()`: User-facing security notifications

### Type Definitions (`src/content/types/`)

#### **Core Types** (`types/index.ts`)
- `Prompt`: Prompt data structure
- `InsertionResult`: Result of content insertion
- `DebugInfo`: Debug logging information

#### **Platform Types** (`types/platform.ts`)
- `PlatformConfig`: Platform configuration
- `PlatformStrategyInterface`: Strategy interface definition

#### **UI Types** (`types/ui.ts`)
- `KeyboardNavigationOptions`: Keyboard navigation configuration
- `UIElementFactoryOptions`: UI factory options

### Performance Optimizations

#### 1. **Mutation Observer Throttling**
- Intelligent filtering of DOM mutations
- Adaptive throttling based on mutation frequency
- Burst detection to prevent observer overload
- Relevant mutation detection (only process input-related changes)

#### 2. **DOM Query Caching**
- 2-second cache for selector results
- Cache validation before reuse
- Automatic cache size management
- Combined selector queries for efficiency

#### 3. **Icon Position Updates**
- RequestAnimationFrame-based updates
- Intersection Observer for visibility tracking
- Position change detection to avoid unnecessary updates
- Passive event listeners for scroll/resize

#### 4. **SPA Navigation Support**
- History API monitoring (pushState/replaceState)
- URL change detection
- Debounced re-initialization after navigation
- Custom selector retry with exponential backoff

### Site Integration

#### Supported Platforms

**1. Claude.ai**
- Selectors: `div[contenteditable="true"]`, `textarea`, `[role="textbox"]`
- Integration: Inline button next to research button
- Button container: `.relative.flex-1.flex.items-center.gap-2.shrink.min-w-0`

**2. ChatGPT**
- Selectors: `textarea[data-testid="chat-input"]`, `textarea[placeholder*="Message"]`
- Integration: Inline button in composer actions
- Button container: `div[data-testid="composer-trailing-actions"] .ms-auto.flex.items-center`

**3. Perplexity.ai**
- Selectors: `textarea[placeholder*="Ask"]`, `textarea[placeholder*="follow"]`
- Integration: Inline button near voice mode
- Button container: `.bg-background-50.dark\\:bg-offsetDark.flex.items-center`

**4. Custom Sites**
- Configurable via extension settings
- Support for custom CSS selectors
- Flexible positioning options (before, after, inside-start, inside-end)
- Z-index customization

### Security Implementation

#### Element Picker Security (New in v1.1)
- **Multi-Layer Validation**: Direct selector matching, parent container analysis, attribute pattern matching
- **Sensitive Field Detection**: 20+ blocked selector patterns for passwords, payments, SSNs, etc.
- **Domain Classification**: Automatic detection of financial, government, and healthcare sites
- **Audit Logging System**: Comprehensive security event tracking with session storage
- **Visual Security Feedback**: Color-coded element highlighting for user awareness
- **Zero Data Extraction**: Complete elimination of sensitive content extraction

#### DOM Construction Security
- **No innerHTML Usage**: All dynamic content uses `textContent` or `createTextNode()`
- **Attribute Validation**: Only string/number attributes are set
- **Namespace Handling**: Proper SVG namespace for vector graphics
- **Secure Factories**: Helper methods ensure consistent security practices

#### Input Sanitization
- **HTML Tag Removal**: Complete stripping of HTML/XML tags
- **URL Filtering**: Blocks `javascript:`, `data:`, and `vbscript:` URLs
- **Event Handler Removal**: Strips `on*` attributes (onclick, onload, etc.)
- **Character Filtering**: Removes control characters and dangerous Unicode
- **Length Limits**: 50KB maximum to prevent memory exhaustion

#### Content Insertion Security
- **Pre-insertion Sanitization**: All content sanitized before DOM insertion
- **Text Node Creation**: Uses `createTextNode()` for contenteditable elements
- **Native API Validation**: Checks for compromised property setters
- **Framework Compatibility**: Safe event dispatching for React/Vue

### Lifecycle Management

#### Initialization Flow
1. Check if site is enabled in settings
2. Inject CSS styles
3. Set up SPA monitoring
4. Start text area detection
5. Initialize mutation observer
6. Set up event listeners

#### Detection Process
1. Query DOM for text input elements
2. Validate element visibility and interactivity
3. Check for existing icon to prevent duplicates
4. Inject appropriate icon style
5. Position icon relative to input

#### Cleanup Process
1. Remove all DOM elements (icons, selectors)
2. Disconnect observers (mutation, intersection)
3. Clear all event listeners
4. Reset caches and state
5. Cancel pending operations

### Custom Site Configuration

Custom sites can be configured with:
- **Hostname**: Target website domain
- **Enabled**: Toggle for activation
- **Positioning Mode**: 'auto' or 'custom'
- **CSS Selector**: Target element for icon placement
- **Placement**: before, after, inside-start, inside-end
- **Offset**: X/Y pixel adjustments
- **Z-index**: Stacking order control

### Message Handling

The content script responds to:
- `cleanup`: Remove all injected elements
- `reinitialize`: Re-run initialization
- `settingsUpdated`: Apply new settings
- `testSelector`: Preview custom positioning

## Build Process and TypeScript Configuration

### Build System Integration

The modular TypeScript content script is built using Vite with the CRX plugin:

**Key Configuration (`vite.config.ts`):**
- TypeScript compilation with strict mode
- Source map generation for debugging
- Module bundling for content script context
- Chrome extension manifest integration
- Side panel and multi-entry point support

**Build Commands:**
```bash
npm run build          # Production build
npm run dev            # Development with HMR
npm test               # Run test suite (470+ tests)
npm run lint           # Code linting
npm run package        # Package for Chrome Web Store
```

### TypeScript Configuration

The content script uses strict TypeScript configuration:
- Strict type checking enabled
- Proper module resolution
- Chrome extension API types
- DOM API types for content script context

### Testing Strategy

Each module can be tested independently:
- **Unit Tests**: Individual module functionality
- **Integration Tests**: Cross-module interactions
- **Platform Tests**: Platform-specific strategy testing
- **Performance Tests**: Memory usage and performance benchmarks

**Test Structure:**
```
src/content/
├── __tests__/              # Integration tests
├── core/__tests__/         # Core component tests
├── platforms/__tests__/    # Platform strategy tests
├── ui/__tests__/           # UI component tests
├── modules/__tests__/      # Security module tests
└── utils/__tests__/        # Utility tests
```

## Developer Guide

### Adding New Platform Support

1. **Create Platform Strategy:**
   ```typescript
   // src/content/platforms/new-platform-strategy.ts
   import { PlatformStrategy } from './base-strategy';
   
   export class NewPlatformStrategy extends PlatformStrategy {
     constructor() {
       super('NewPlatform', 100, {
         selectors: ['textarea[data-platform="new"]'],
         buttonContainerSelector: '.button-container',
         priority: 100
       });
     }
     
     canHandle(element: HTMLElement): boolean {
       // Implementation
     }
     
     async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
       // Implementation
     }
   }
   ```

2. **Register Strategy:**
   ```typescript
   // In platform manager initialization
   platformManager.registerStrategy(new NewPlatformStrategy());
   ```

3. **Add Platform-Specific Icon (Optional):**
   ```typescript
   // In UIElementFactory
   createNewPlatformIcon(): HTMLElement {
     // Platform-specific icon creation
   }
   ```

4. **Write Tests:**
   ```typescript
   // src/content/platforms/__tests__/new-platform-strategy.test.ts
   describe('NewPlatformStrategy', () => {
     // Test implementation
   });
   ```

### Extending Platform Strategies

**Example: Adding Custom Insertion Logic**
```typescript
export class CustomStrategy extends PlatformStrategy {
  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      // Custom insertion logic
      const sanitizedContent = StorageManager.sanitizeUserInput(content);
      
      // Platform-specific insertion
      if (element.contentEditable === 'true') {
        // ContentEditable handling
        const textNode = document.createTextNode(sanitizedContent);
        element.appendChild(textNode);
      } else {
        // Input/textarea handling
        element.value = sanitizedContent;
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      return { success: true, method: 'custom' };
    } catch (error) {
      this._error('Custom insertion failed', error);
      return { success: false, error: error.message };
    }
  }
}
```

### Best Practices for Developers

#### Module Development
1. **Single Responsibility**: Each module should have a clear, focused purpose
2. **Type Safety**: Use proper TypeScript types for all interfaces
3. **Error Handling**: Implement comprehensive error handling with logging
4. **Testing**: Write unit tests for all public methods
5. **Documentation**: Document complex logic and public APIs

#### Adding New Platform Support
1. Extend `PlatformStrategy` base class
2. Define appropriate selectors for text inputs
3. Specify button container selector for inline integration
4. Create platform-specific icon in `UIElementFactory` if needed
5. Test with various page states and layouts
6. Add comprehensive test coverage

#### Security Considerations
1. **Always sanitize user input** before any DOM operation
2. **Use helper methods** for element creation
3. **Validate external data** from storage or messages
4. **Limit resource usage** with throttling and caching
5. **Handle errors gracefully** with fallbacks

#### Performance Guidelines
1. **Cache DOM queries** when appropriate
2. **Throttle expensive operations** (mutations, positioning)
3. **Use passive event listeners** for scroll/resize
4. **Batch DOM operations** when possible
5. **Clean up resources** on page unload

#### Testing Recommendations
1. Test on all supported platforms
2. Verify SPA navigation handling
3. Check memory usage over time
4. Validate keyboard navigation
5. Test with large prompt libraries
6. Verify cleanup on tab switching

### Debugging

Enable debug mode:
```javascript
localStorage.setItem('prompt-library-debug', 'true');
```

Debug features:
- Verbose console logging
- Visual notifications for events
- Performance statistics
- Mutation observer metrics

### Error Handling

The content script implements multiple layers of error handling:
1. **Try-catch blocks** around all major operations
2. **Graceful fallbacks** for missing elements
3. **Validation** before operations
4. **Safe defaults** for missing data
5. **User-friendly error states**

### Browser Compatibility

- Chrome/Chromium: Full support (primary target)
- Manifest V3: Required
- DOM APIs: Standard web platform features
- No external dependencies

### Maintenance Notes

- Regular selector updates may be needed as platforms evolve
- Monitor console errors in production for selector failures
- Keep mutation observer filters updated for performance
- Review security practices with each major update