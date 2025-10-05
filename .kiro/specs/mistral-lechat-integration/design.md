# Design Document

## Overview

The Mistral Le Chat integration follows the established Strategy pattern used for other AI platform integrations. It implements a `MistralStrategy` class that extends `PlatformStrategy` and provides platform-specific logic for detecting input elements, creating appropriate UI elements, and inserting prompts into the Mistral chat interface.

The integration will be automatically activated when users visit `chat.mistral.ai` and will provide seamless access to the prompt library through a platform-appropriate button integrated into the Mistral UI.

## Architecture

### Strategy Pattern Implementation

The integration follows the existing Strategy pattern architecture:

```
PlatformManager
├── MistralStrategy (new)
├── ClaudeStrategy
├── ChatGPTStrategy
├── PerplexityStrategy
└── DefaultStrategy (fallback)
```

### Component Interaction Flow

1. **Detection**: `PlatformManager` detects `chat.mistral.ai` hostname
2. **Strategy Selection**: `MistralStrategy` is instantiated and registered
3. **Element Detection**: Strategy identifies Mistral input elements using CSS selectors
4. **UI Injection**: Platform-specific button is created and injected
5. **Event Handling**: Click events trigger prompt library interface
6. **Content Insertion**: Selected prompts are inserted using Mistral-compatible methods

## Components and Interfaces

### MistralStrategy Class

**Location**: `src/content/platforms/mistral-strategy.ts`

**Key Methods**:
- `canHandle(element: HTMLElement): boolean` - Validates elements on chat.mistral.ai
- `insert(element: HTMLElement, content: string): Promise<InsertionResult>` - Handles prompt insertion
- `getSelectors(): string[]` - Returns Mistral-specific CSS selectors
- `createIcon(uiFactory: UIElementFactory): HTMLElement | null` - Creates Mistral-styled button

**Configuration**:
```typescript
{
  selectors: [
    'textarea[placeholder*="Ask me anything"]',
    'div[contenteditable="true"][role="textbox"]',
    'textarea',
    'input[type="text"]'
  ],
  buttonContainerSelector: '.flex.items-center.gap-2, .toolbar, .input-actions',
  priority: 85
}
```

### UI Element Factory Extension

**Location**: `src/content/ui/element-factory.ts`

**New Method**: `createMistralIcon(): HTMLElement`

**Design Considerations**:
- Follow Mistral's design language (likely modern, clean styling)
- Use consistent 18px SVG icon sizing
- Apply appropriate hover/focus states
- Include "My Prompts" text label for clarity
- Implement proper accessibility attributes

### Platform Manager Integration

**Location**: `src/content/platforms/platform-manager.ts`

**Changes Required**:
- Add `chat.mistral.ai` case to hostname switch statement
- Import and instantiate `MistralStrategy`
- Maintain priority-based strategy ordering

## Data Models

### Strategy Configuration

```typescript
interface MistralStrategyConfig {
  selectors: string[];           // CSS selectors for input elements
  buttonContainerSelector: string; // Where to inject the button
  priority: number;              // Strategy priority (85)
}
```

### Insertion Methods

The strategy will implement multiple insertion approaches in order of preference:

1. **Native Input Events**: Direct value setting with proper event triggering
2. **ExecCommand**: Using `document.execCommand('insertText')` for contenteditable elements
3. **DOM Manipulation**: Direct textContent/innerHTML modification as fallback

## Error Handling

### Graceful Degradation

1. **Element Detection Failure**: Fall back to DefaultStrategy
2. **Insertion Method Failure**: Try alternative insertion methods in sequence
3. **DOM Structure Changes**: Use multiple selector patterns for resilience
4. **Event Triggering Issues**: Implement comprehensive event dispatching

### Logging Strategy

- Use existing logger utility (`src/content/utils/logger.ts`)
- Debug-level logging for successful operations
- Warning-level logging for fallback scenarios
- Error-level logging for complete failures

### Fallback Mechanisms

```typescript
async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
  // Method 1: Try native input handling
  const nativeResult = await this._tryNativeInput(element, content);
  if (nativeResult.success) return nativeResult;
  
  // Method 2: Try execCommand for contenteditable
  const execResult = await this._tryExecCommand(element, content);
  if (execResult.success) return execResult;
  
  // Method 3: Direct DOM manipulation fallback
  return this._tryDOMManipulation(element, content);
}
```

## Testing Strategy

### Unit Tests

**Location**: `src/content/platforms/__tests__/mistral-strategy.test.ts`

**Test Coverage**:
- Strategy instantiation and configuration
- Element detection and validation (`canHandle` method)
- Each insertion method independently
- Error handling and fallback scenarios
- Icon creation and DOM structure

### Integration Tests

**Location**: `tests/e2e/content/mistral-integration.spec.ts`

**Test Scenarios**:
- End-to-end prompt insertion workflow
- Button injection and positioning
- Cross-browser compatibility
- Performance impact measurement

### Mock Requirements

- Mock Mistral DOM structure for consistent testing
- Mock Chrome extension APIs
- Mock UIElementFactory for icon creation tests
- Mock logger utilities for error handling tests

## Security Considerations

### Content Sanitization

- All user-generated content MUST be sanitized using DOMPurify before DOM insertion
- Follow CSP-compliant event handling patterns
- Validate all imported configuration data

### DOM Safety

- Use secure DOM construction methods (`createElement`, `createSVGElement`)
- Avoid innerHTML for dynamic content
- Implement proper event delegation without inline scripts

### Privacy Protection

- No external data transmission
- All operations remain local to the browser
- Follow existing privacy patterns from other strategies

## Performance Guidelines

### Optimization Strategies

1. **Lazy Loading**: Strategy only initializes when visiting Mistral
2. **Efficient Selectors**: Use specific, performant CSS selectors
3. **Event Debouncing**: Prevent excessive DOM queries
4. **Memory Management**: Proper cleanup of event listeners and DOM references

### Resource Constraints

- Keep strategy bundle size minimal
- Avoid blocking main thread during initialization
- Use mutation observers efficiently for dynamic content detection
- Implement proper cleanup in strategy lifecycle

## Implementation Phases

### Phase 1: Core Strategy Implementation
- Create `MistralStrategy` class with basic functionality
- Implement element detection and insertion methods
- Add strategy registration to `PlatformManager`

### Phase 2: UI Integration
- Implement `createMistralIcon` in `UIElementFactory`
- Style button to match Mistral's design language
- Add proper accessibility and interaction states

### Phase 3: Testing and Refinement
- Comprehensive unit and integration tests
- Performance optimization and error handling
- Cross-browser compatibility validation

### Phase 4: Documentation and Deployment
- Update platform documentation
- Add Mistral to supported platforms list
- Prepare for release integration