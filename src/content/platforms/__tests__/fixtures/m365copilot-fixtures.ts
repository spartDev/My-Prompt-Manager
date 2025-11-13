/**
 * Test fixtures and helpers for M365 Copilot platform tests
 *
 * This module provides reusable test utilities for M365 Copilot strategy tests,
 * following the pattern established by copilot-fixtures.ts
 */

import { vi } from 'vitest';

import type { UIElementFactory } from '../../../ui/element-factory';

/**
 * Type for M365 Copilot element variants
 */
export type M365CopilotElementType = 'lexical' | 'textarea' | 'contenteditable' | 'combobox';

/**
 * Mock location object for hostname manipulation
 */
export interface MockLocation {
  hostname: string;
}

/**
 * Configuration for creating mock elements
 */
export interface ElementConfig {
  /**
   * Type of element to create
   */
  type?: M365CopilotElementType;
  /**
   * Custom attributes to add to the element
   */
  attributes?: Record<string, string>;
  /**
   * Whether to auto-append to document.body
   */
  autoAppend?: boolean;
  /**
   * Initial text content for the element
   */
  textContent?: string;
}

/**
 * Creates a mock Lexical editor element for M365 Copilot tests
 *
 * @param type - Type of element to create
 * @param autoAppend - Whether to automatically append to document.body
 * @returns A configured HTMLElement with mocked focus method
 *
 * @example
 * ```typescript
 * // Create Lexical editor element
 * const editor = createM365CopilotElement('lexical');
 *
 * // Create with auto-append
 * const editor = createM365CopilotElement('contenteditable', true);
 * ```
 */
export function createM365CopilotElement(
  type: M365CopilotElementType = 'lexical',
  autoAppend = false
): HTMLElement {
  let element: HTMLElement;

  switch (type) {
    case 'lexical':
      element = document.createElement('span');
      element.id = 'm365-chat-editor-target-element';
      element.setAttribute('contenteditable', 'true');
      element.setAttribute('data-lexical-editor', 'true');
      break;
    case 'textarea':
      element = document.createElement('textarea');
      element.setAttribute('placeholder', 'Message Copilot');
      break;
    case 'contenteditable':
      element = document.createElement('div');
      element.setAttribute('contenteditable', 'true');
      break;
    case 'combobox':
      element = document.createElement('span');
      element.setAttribute('role', 'combobox');
      element.setAttribute('contenteditable', 'true');
      break;
  }

  element.focus = vi.fn();

  if (autoAppend) {
    document.body.appendChild(element);
  }

  return element;
}

/**
 * Creates a mock element with custom configuration
 *
 * @param config - Configuration object for element creation
 * @returns A configured HTMLElement
 *
 * @example
 * ```typescript
 * const editor = createM365CopilotElementWithConfig({
 *   type: 'lexical',
 *   attributes: { 'aria-label': 'Chat input' },
 *   autoAppend: true
 * });
 * ```
 */
export function createM365CopilotElementWithConfig(
  config: ElementConfig = {}
): HTMLElement {
  const { type = 'lexical', attributes = {}, autoAppend = false, textContent = '' } = config;
  const element = createM365CopilotElement(type, false);

  // Apply custom attributes
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });

  if (textContent) {
    element.textContent = textContent;
  }

  if (autoAppend) {
    document.body.appendChild(element);
  }

  return element;
}

/**
 * Creates a textarea element for M365 Copilot fallback tests
 *
 * @param autoAppend - Whether to automatically append to document.body
 * @returns A configured HTMLTextAreaElement
 */
export function createM365CopilotTextarea(autoAppend = false): HTMLTextAreaElement {
  return createM365CopilotElement('textarea', autoAppend) as HTMLTextAreaElement;
}

/**
 * Removes an element from the DOM if it has a parent
 *
 * @param element - Element to remove from DOM
 *
 * @example
 * ```typescript
 * const editor = createM365CopilotElement('lexical', true);
 * // ... test logic ...
 * cleanupElement(editor);
 * ```
 */
export function cleanupElement(element: HTMLElement | null): void {
  if (element?.parentNode) {
    element.parentNode.removeChild(element);
  }
}

/**
 * Creates a mock UIElementFactory for M365 Copilot tests
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
 * setMockHostname('m365.cloud.microsoft');
 * const strategy = new M365CopilotStrategy();
 * expect(strategy.canHandle(editor)).toBe(true);
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
 * Resets mock window.location.hostname to M365 Copilot's default
 *
 * @returns The mock location object set to m365.cloud.microsoft
 *
 * @example
 * ```typescript
 * // After changing hostname in a test
 * resetMockHostname();
 * ```
 */
export function resetMockHostname(): MockLocation {
  return setMockHostname('m365.cloud.microsoft');
}

/**
 * Sets up mock for element dispatchEvent method
 *
 * @param element - Element to mock
 * @returns The mocked dispatchEvent function
 *
 * @example
 * ```typescript
 * const editor = createM365CopilotElement('lexical');
 * const dispatchSpy = setupDispatchEventMock(editor);
 * await strategy.insert(editor, 'content');
 * expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'input' }));
 * ```
 */
export function setupDispatchEventMock(element: HTMLElement): ReturnType<typeof vi.fn> {
  const dispatchSpy = vi.spyOn(element, 'dispatchEvent').mockImplementation(() => true);
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
 * Sets up mock for document.execCommand
 *
 * @param shouldSucceed - Whether execCommand should return true
 * @returns The mocked execCommand function
 *
 * @example
 * ```typescript
 * const execCommandSpy = setupExecCommandMock(true);
 * await strategy.insert(editor, 'content');
 * expect(execCommandSpy).toHaveBeenCalledWith('insertText', false, 'content');
 * ```
 */
export function setupExecCommandMock(shouldSucceed = true): ReturnType<typeof vi.fn> {
  const execCommandSpy = vi.spyOn(document, 'execCommand').mockReturnValue(shouldSucceed);
  return execCommandSpy;
}

/**
 * Sets up mock for window.getSelection
 *
 * @param shouldReturnSelection - Whether to return a valid selection object
 * @returns The mocked getSelection function
 *
 * @example
 * ```typescript
 * const getSelectionSpy = setupGetSelectionMock();
 * await strategy.insert(editor, 'content');
 * expect(getSelectionSpy).toHaveBeenCalled();
 * ```
 */
export function setupGetSelectionMock(shouldReturnSelection = true): ReturnType<typeof vi.fn> {
  const mockSelection = shouldReturnSelection
    ? {
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
        getRangeAt: vi.fn().mockReturnValue({
          selectNodeContents: vi.fn(),
          deleteContents: vi.fn(),
          insertNode: vi.fn(),
          setStartAfter: vi.fn(),
          setEndAfter: vi.fn()
        })
      }
    : null;

  const getSelectionSpy = vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as any);
  return getSelectionSpy;
}

/**
 * Expected selectors for M365 Copilot platform in priority order
 */
export const M365_COPILOT_SELECTORS = [
  'span[id="m365-chat-editor-target-element"]',
  'span[data-lexical-editor="true"][contenteditable="true"]',
  'span[role="combobox"][contenteditable="true"]',
  'div[contenteditable="true"]',
  'textarea[placeholder*="Message"]'
] as const;

/**
 * Expected button container selector for M365 Copilot platform
 */
export const M365_COPILOT_BUTTON_CONTAINER_SELECTOR =
  '.fai-ChatInput__actions > span.___11i0s0y, .fai-ChatInput__actions';

/**
 * Default hostname for M365 Copilot platform
 */
export const M365_COPILOT_HOSTNAME = 'm365.cloud.microsoft';

/**
 * Strategy configuration constants
 */
export const M365_COPILOT_CONFIG = {
  name: 'm365copilot',
  priority: 80,
  hostname: M365_COPILOT_HOSTNAME,
  selectors: M365_COPILOT_SELECTORS,
  buttonContainerSelector: M365_COPILOT_BUTTON_CONTAINER_SELECTOR
} as const;

/**
 * Maximum content length for M365 Copilot (from MAX_CONTENT_LENGTHS.COPILOT)
 */
export const M365_COPILOT_MAX_LENGTH = 50000;
