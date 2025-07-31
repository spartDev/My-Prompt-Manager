# Content Script Documentation

## Overview

The `content.js` file is the core content script that enables seamless integration of the My Prompt Manager extension with AI chat platforms. It dynamically injects a prompt library icon into supported websites, allowing users to access and insert their saved prompts directly into chat interfaces.

## Architecture

### Core Components

#### 1. **PromptLibraryInjector** (Main Class)
The primary orchestrator that manages the entire lifecycle of prompt library integration.

**Key Responsibilities:**
- Detects and validates text input areas on AI platforms
- Manages icon injection and positioning
- Handles prompt selector UI creation and interaction
- Implements performance optimizations and cleanup routines

**Properties:**
- `icon`: Reference to the injected prompt library icon
- `currentTextarea`: Currently active text input element
- `promptSelector`: Prompt selection modal UI
- `instanceId`: Unique identifier to prevent cross-tab interference
- `eventManager`: Centralized event listener management
- `uiFactory`: Factory for creating platform-specific UI elements
- `keyboardNav`: Keyboard navigation handler for accessibility

#### 2. **StorageManager** (Static Utility Class)
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

#### 3. **Logger** (Static Utility Class)
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

#### 4. **EventManager** (Event Lifecycle Management)
Centralizes event listener management for proper cleanup.

**Key Features:**
- Tracks all registered event listeners
- Provides centralized cleanup mechanism
- Prevents memory leaks from orphaned listeners
- Error handling for listener removal

#### 5. **UIElementFactory** (Platform-Specific UI Creation)
Creates platform-specific UI elements with consistent security practices.

**Platform Support:**
- `createClaudeIcon()`: Claude.ai specific styling
- `createPerplexityIcon()`: Perplexity.ai specific styling
- `createChatGPTIcon()`: ChatGPT specific styling
- `createFloatingIcon()`: Generic floating icon for custom sites

#### 6. **KeyboardNavigationManager** (Accessibility)
Implements comprehensive keyboard navigation for the prompt selector.

**Features:**
- Arrow key navigation through prompt list
- Enter to select, Escape to close
- Tab key support for focus management
- Auto-focus search input on open
- Smooth scrolling to selected items

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

### Best Practices for Developers

#### Adding New Platform Support
1. Add platform configuration to `siteConfigs`
2. Define appropriate selectors for text inputs
3. Specify button container selector for inline integration
4. Create platform-specific icon in `UIElementFactory`
5. Test with various page states and layouts

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