/**
 * Test fixtures and helpers for Copilot platform tests
 *
 * This module provides reusable test utilities to eliminate duplication
 * in Copilot strategy tests and establish patterns for other platform tests.
 */

import { vi } from 'vitest';

import type { UIElementFactory } from '../../../ui/element-factory';

/**
 * Type for Copilot textarea variants
 */
export type CopilotTextareaType = 'primary' | 'userInput' | 'generic';

/**
 * Mock location object for hostname manipulation
 */
export interface MockLocation {
  hostname: string;
}

/**
 * Configuration for creating mock textareas
 */
export interface TextareaConfig {
  /**
   * Type of textarea to create (determines which attributes are set)
   */
  type?: CopilotTextareaType;
  /**
   * Custom attributes to add to the textarea
   */
  attributes?: Record<string, string>;
  /**
   * Whether to auto-append to document.body
   */
  autoAppend?: boolean;
}

/**
 * Creates a mock textarea element for Copilot tests
 *
 * @param type - Type of textarea: 'primary', 'userInput', or 'generic'
 * @param autoAppend - Whether to automatically append to document.body
 * @returns A configured HTMLTextAreaElement with mocked focus method
 *
 * @example
 * ```typescript
 * // Create primary textarea
 * const textarea = createCopilotTextarea('primary');
 *
 * // Create with auto-append
 * const textarea = createCopilotTextarea('userInput', true);
 * ```
 */
export function createCopilotTextarea(
  type: CopilotTextareaType = 'primary',
  autoAppend = false
): HTMLTextAreaElement {
  const textarea = document.createElement('textarea');
  textarea.focus = vi.fn();

  switch (type) {
    case 'primary':
      textarea.setAttribute('data-testid', 'composer-input');
      break;
    case 'userInput':
      textarea.id = 'userInput';
      break;
    case 'generic':
      textarea.setAttribute('placeholder', 'Message Copilot');
      break;
  }

  if (autoAppend) {
    document.body.appendChild(textarea);
  }

  return textarea;
}

/**
 * Creates a mock textarea with custom configuration
 *
 * @param config - Configuration object for textarea creation
 * @returns A configured HTMLTextAreaElement
 *
 * @example
 * ```typescript
 * const textarea = createCopilotTextareaWithConfig({
 *   type: 'primary',
 *   attributes: { 'aria-label': 'Chat input' },
 *   autoAppend: true
 * });
 * ```
 */
export function createCopilotTextareaWithConfig(
  config: TextareaConfig = {}
): HTMLTextAreaElement {
  const { type = 'primary', attributes = {}, autoAppend = false } = config;
  const textarea = createCopilotTextarea(type, false);

  // Apply custom attributes
  Object.entries(attributes).forEach(([key, value]) => {
    textarea.setAttribute(key, value);
  });

  if (autoAppend) {
    document.body.appendChild(textarea);
  }

  return textarea;
}

/**
 * Removes an element from the DOM if it has a parent
 *
 * @param element - Element to remove from DOM
 *
 * @example
 * ```typescript
 * const textarea = createCopilotTextarea('primary', true);
 * // ... test logic ...
 * cleanupElement(textarea);
 * ```
 */
export function cleanupElement(element: HTMLElement | null): void {
  if (element?.parentNode) {
    element.parentNode.removeChild(element);
  }
}

/**
 * Creates a mock UIElementFactory for Copilot tests
 *
 * @returns A mocked UIElementFactory with createCopilotIcon method
 *
 * @example
 * ```typescript
 * const mockUIFactory = createMockUIFactory();
 * const icon = strategy.createIcon(mockUIFactory);
 * expect(mockUIFactory.createCopilotIcon).toHaveBeenCalled();
 * ```
 */
export function createMockUIFactory(): UIElementFactory {
  return {
    createCopilotIcon: vi.fn().mockReturnValue(document.createElement('button'))
  } as any;
}

/**
 * Sets the mock window.location.hostname for testing
 *
 * @param hostname - Hostname to set
 * @returns The mock location object
 *
 * @example
 * ```typescript
 * setMockHostname('copilot.microsoft.com');
 * const strategy = new CopilotStrategy();
 * expect(strategy.canHandle(textarea)).toBe(true);
 * ```
 */
export function setMockHostname(hostname: string): MockLocation {
  const mockLocation: MockLocation = { hostname };
  Object.defineProperty(window, 'location', {
    value: mockLocation,
    writable: true,
    configurable: true
  });
  return mockLocation;
}

/**
 * Resets mock window.location.hostname to Copilot's default
 *
 * @returns The mock location object set to copilot.microsoft.com
 *
 * @example
 * ```typescript
 * // After changing hostname in a test
 * resetMockHostname();
 * ```
 */
export function resetMockHostname(): MockLocation {
  return setMockHostname('copilot.microsoft.com');
}

/**
 * Sets up mock for textarea dispatchEvent method
 *
 * @param textarea - Textarea element to mock
 * @returns The mocked dispatchEvent function
 *
 * @example
 * ```typescript
 * const textarea = createCopilotTextarea();
 * const dispatchSpy = setupDispatchEventMock(textarea);
 * await strategy.insert(textarea, 'content');
 * expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'input' }));
 * ```
 */
export function setupDispatchEventMock(textarea: HTMLTextAreaElement): ReturnType<typeof vi.fn> {
  const dispatchSpy = vi.spyOn(textarea, 'dispatchEvent').mockImplementation(() => true);
  return dispatchSpy;
}

/**
 * Configuration for native value setter mock
 */
export interface NativeValueSetterConfig {
  /**
   * Whether to simulate the setter being unavailable
   */
  unavailable?: boolean;
}

/**
 * Sets up mock for native value setter on HTMLTextAreaElement
 *
 * @param config - Configuration for the mock
 * @returns Object containing the mock setter function and restore function
 *
 * @example
 * ```typescript
 * const { mockSetter, restore } = setupNativeValueSetterMock();
 * await strategy.insert(textarea, 'content');
 * expect(mockSetter).toHaveBeenCalledWith('content');
 * restore();
 * ```
 */
export function setupNativeValueSetterMock(
  config: NativeValueSetterConfig = {}
): {
  mockSetter: ReturnType<typeof vi.fn> | null;
  restore: () => void;
} {
  const { unavailable = false } = config;
  const originalGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  const mockSetter = unavailable ? null : vi.fn();

  Object.getOwnPropertyDescriptor = vi.fn((obj: any, prop: PropertyKey) => {
    if (obj === HTMLTextAreaElement.prototype && prop === 'value') {
      if (unavailable) {
        return undefined;
      }
      return {
        set: mockSetter,
        get: vi.fn(),
        enumerable: true,
        configurable: true
      };
    }
    return originalGetOwnPropertyDescriptor.call(Object, obj, prop);
  }) as any;

  const restore = () => {
    Object.getOwnPropertyDescriptor = originalGetOwnPropertyDescriptor;
  };

  return { mockSetter, restore };
}

/**
 * Creates a textarea with React-specific value tracker
 *
 * @param type - Type of textarea to create
 * @returns Textarea with _valueTracker property
 *
 * @example
 * ```typescript
 * const reactTextarea = createReactTextarea('primary');
 * await strategy.insert(reactTextarea, 'content');
 * expect(reactTextarea._valueTracker.setValue).toHaveBeenCalled();
 * ```
 */
export function createReactTextarea(
  type: CopilotTextareaType = 'primary'
): HTMLTextAreaElement & { _valueTracker: { setValue: ReturnType<typeof vi.fn> } } {
  const textarea = createCopilotTextarea(type) as any;
  textarea._valueTracker = {
    setValue: vi.fn()
  };
  return textarea;
}

/**
 * Expected selectors for Copilot platform in priority order
 */
export const COPILOT_SELECTORS = [
  'textarea[data-testid="composer-input"]',
  'textarea#userInput',
  'textarea[placeholder*="Message"]',
  'textarea[placeholder*="Copilot"]'
] as const;

/**
 * Expected button container selector for Copilot platform
 */
export const COPILOT_BUTTON_CONTAINER_SELECTOR =
  '.relative.bottom-0.flex.justify-between.pb-0\\.5.pe-2\\.5.ps-1\\.5 > .flex.gap-2.items-center:last-child';

/**
 * Default hostname for Copilot platform
 */
export const COPILOT_HOSTNAME = 'copilot.microsoft.com';

/**
 * Strategy configuration constants
 */
export const COPILOT_CONFIG = {
  name: 'copilot',
  priority: 80,
  hostname: COPILOT_HOSTNAME,
  selectors: COPILOT_SELECTORS,
  buttonContainerSelector: COPILOT_BUTTON_CONTAINER_SELECTOR
} as const;
