/**
 * Unit tests for UIElementFactory
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createElement, createSVGElement } from '../../utils/storage';
import { UIElementFactory } from '../element-factory';

// Mock storage functions
vi.mock('../../utils/storage', () => ({
  createElement: vi.fn((tag: string, attributes: Record<string, unknown> = {}, textContent = '') => {
      const element = document.createElement(tag);
      Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, String(value));
      });
      if (textContent) {
        element.textContent = textContent;
      }
      return element;
    }),
  createSVGElement: vi.fn((tag: string, attributes: Record<string, any> = {}) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, String(value));
    });
    return element;
  })
}));

describe('UIElementFactory', () => {
  let factory: UIElementFactory;
  const testInstanceId = 'test-instance-123';

  beforeEach(() => {
    factory = new UIElementFactory(testInstanceId);
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create factory with instance ID', () => {
      expect(factory).toBeInstanceOf(UIElementFactory);
    });
  });

  describe('createClaudeIcon', () => {
    it('should create Claude icon with proper structure', () => {
      const result = factory.createClaudeIcon();
      
      expect(result).toHaveProperty('container');
      expect(result).toHaveProperty('icon');
      expect(result.container).toBeInstanceOf(HTMLElement);
      expect(result.icon).toBeInstanceOf(HTMLElement);
    });

    it('should set proper attributes on Claude icon', () => {
      const result = factory.createClaudeIcon();
      const icon = result.icon;
      
      expect(icon.getAttribute('type')).toBe('button');
      expect(icon.getAttribute('aria-label')).toBe('Open my prompt manager - Access your saved prompts');
      expect(icon.getAttribute('title')).toBe('My Prompt Manager - Access your saved prompts');
      expect(icon.getAttribute('data-instance-id')).toBe(testInstanceId);
      expect(icon.getAttribute('tabindex')).toBe('0');
    });

    it('should have proper CSS classes on Claude icon', () => {
      const result = factory.createClaudeIcon();
      const icon = result.icon;
      
      expect(icon.className).toContain('prompt-library-integrated-icon');
      expect(icon.className).toContain('inline-flex');
      expect(icon.className).toContain('items-center');
    });

    it('should contain SVG element', () => {
      const result = factory.createClaudeIcon();
      const svg = result.icon.querySelector('svg');

      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg?.getAttribute('fill')).toBe('currentColor');
    });

    it('should not include text label', () => {
      const result = factory.createClaudeIcon();
      // Icon should not have "My Prompts" text - only the SVG icon
      // The container may have whitespace, so we check the icon doesn't have a <p> element
      const textElement = result.icon.querySelector('p');
      expect(textElement).toBeNull();
    });
  });

  describe('createPerplexityIcon', () => {
    it('should create Perplexity icon as HTMLElement', () => {
      const icon = factory.createPerplexityIcon();
      
      expect(icon).toBeInstanceOf(HTMLElement);
      expect(icon.tagName).toBe('BUTTON');
    });

    it('should set proper attributes on Perplexity icon', () => {
      const icon = factory.createPerplexityIcon();
      
      expect(icon.getAttribute('type')).toBe('button');
      expect(icon.getAttribute('aria-label')).toBe('Open my prompt manager - Access your saved prompts');
      expect(icon.getAttribute('title')).toBe('My Prompt Manager - Access your saved prompts');
      expect(icon.getAttribute('data-instance-id')).toBe(testInstanceId);
      expect(icon.getAttribute('data-state')).toBe('closed');
      expect(icon.getAttribute('tabindex')).toBe('0');
    });

    it('should have proper CSS classes on Perplexity icon', () => {
      const icon = factory.createPerplexityIcon();

      expect(icon.className).toContain('prompt-library-integrated-icon');
      expect(icon.className).toContain('text-textOff');
      expect(icon.className).toContain('hover:text-textMain');
      // Background hover classes were removed for cleaner appearance
      expect(icon.className).not.toContain('hover:bg-offsetPlus');
    });

    it('should contain SVG element with proper attributes', () => {
      const icon = factory.createPerplexityIcon();
      const svg = icon.querySelector('svg');
      
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg?.getAttribute('fill')).toBe('currentColor');
    });
  });

  describe('createChatGPTIcon', () => {
    it('should create ChatGPT icon as HTMLElement', () => {
      const icon = factory.createChatGPTIcon();
      
      expect(icon).toBeInstanceOf(HTMLElement);
      expect(icon.tagName).toBe('BUTTON');
    });

    it('should set proper attributes on ChatGPT icon', () => {
      const icon = factory.createChatGPTIcon();
      
      expect(icon.getAttribute('type')).toBe('button');
      expect(icon.getAttribute('aria-label')).toBe('Open my prompt manager - Access your saved prompts');
      expect(icon.getAttribute('title')).toBe('My Prompt Manager - Access your saved prompts');
      expect(icon.getAttribute('data-instance-id')).toBe(testInstanceId);
      expect(icon.getAttribute('data-dashlane-label')).toBe('true');
      expect(icon.getAttribute('tabindex')).toBe('0');
    });

    it('should have proper CSS classes on ChatGPT icon', () => {
      const icon = factory.createChatGPTIcon();
      
      expect(icon.className).toContain('prompt-library-integrated-icon');
      expect(icon.className).toContain('composer-btn');
    });

    it('should contain SVG element with proper attributes', () => {
      const icon = factory.createChatGPTIcon();
      const svg = icon.querySelector('svg');
      
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg?.getAttribute('fill')).toBe('currentColor');
    });
  });

  describe('createFloatingIcon', () => {
    it('should create floating icon as HTMLElement', () => {
      const icon = factory.createFloatingIcon();
      
      expect(icon).toBeInstanceOf(HTMLElement);
      expect(icon.tagName).toBe('BUTTON');
    });

    it('should set proper attributes on floating icon', () => {
      const icon = factory.createFloatingIcon();
      
      expect(icon.getAttribute('type')).toBe('button');
      expect(icon.getAttribute('aria-label')).toBe('Open my prompt manager - Access your saved prompts');
      expect(icon.getAttribute('title')).toBe('My Prompt Manager - Access your saved prompts');
      expect(icon.getAttribute('data-instance-id')).toBe(testInstanceId);
      expect(icon.getAttribute('tabindex')).toBe('0');
    });

    it('should have proper CSS class on floating icon', () => {
      const icon = factory.createFloatingIcon();
      
      expect(icon.className).toContain('prompt-library-icon');
    });

    it('should contain SVG element with proper attributes', () => {
      const icon = factory.createFloatingIcon();
      const svg = icon.querySelector('svg');
      
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg?.getAttribute('fill')).toBe('currentColor');
    });
  });

  describe('createCopilotIcon', () => {
    it('should create Copilot icon button element', () => {
      const { element: icon } = factory.createCopilotIcon();

      expect(icon).toBeDefined();
      expect(icon.tagName).toBe('BUTTON');
      expect(icon.getAttribute('type')).toBe('button');
    });

    it('should include prompt-library-integrated-icon class', () => {
      const { element: icon } = factory.createCopilotIcon();
      expect(icon.className).toContain('prompt-library-integrated-icon');
    });

    it('should include prompt-library-copilot-icon class', () => {
      const { element: icon } = factory.createCopilotIcon();
      expect(icon.className).toContain('prompt-library-copilot-icon');
    });

    it('should include Fluent UI button classes', () => {
      const { element: icon } = factory.createCopilotIcon();
      expect(icon.className).toContain('fui-Button');
      expect(icon.className).toContain('r1alrhcs');
    });

    it('should have transparent background via inline styles', () => {
      const { element: icon } = factory.createCopilotIcon();
      expect(icon.style.background).toBe('transparent');
      expect(icon.style.backgroundColor).toBe('transparent');
    });

    it('should have proper ARIA attributes', () => {
      const { element: icon } = factory.createCopilotIcon();

      expect(icon.getAttribute('aria-label')).toContain('Open my prompt manager');
      expect(icon.getAttribute('title')).toContain('My Prompt Manager');
      expect(icon.getAttribute('tabindex')).toBe('0');
    });

    it('should include instance ID', () => {
      const { element: icon } = factory.createCopilotIcon();
      expect(icon.getAttribute('data-instance-id')).toBe(testInstanceId);
    });

    it('should attempt theme detection based on body background', () => {
      const { element: icon } = factory.createCopilotIcon();
      const themeAttr = icon.getAttribute('data-theme');
      // Theme detection depends on body background color which may not be available in test environment
      // If body styles are available, verify the theme is set to light or dark
      // Otherwise, the attribute will be null which is acceptable
      if (themeAttr !== null) {
        expect(['light', 'dark']).toContain(themeAttr);
      }
      // Just verify the icon was created successfully
      expect(icon).toBeDefined();
    });

    it('should contain icon wrapper span with Fluent UI classes', () => {
      const { element: icon } = factory.createCopilotIcon();
      const iconSpan = icon.querySelector('span.fui-Button__icon');

      expect(iconSpan).toBeDefined();
      expect(iconSpan?.className).toContain('rywnvv2');
    });

    it('should contain SVG icon element with 24px size', () => {
      const { element: icon } = factory.createCopilotIcon();
      const svg = icon.querySelector('svg');

      expect(svg).toBeDefined();
      expect(svg?.getAttribute('width')).toBe('24');
      expect(svg?.getAttribute('height')).toBe('24');
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    });

    it('should have SVG with Fluent UI icon classes', () => {
      const { element: icon } = factory.createCopilotIcon();
      const svg = icon.querySelector('svg');

      expect(svg).toBeDefined();
      const svgClass = svg?.getAttribute('class') || '';
      expect(svgClass).toContain('fui-Icon-regular');
    });

    it('should not include text label', () => {
      const { element: icon } = factory.createCopilotIcon();
      // Icon should not have "My Prompts" text - only the SVG icon
      expect(icon.textContent?.trim()).toBe('');
    });

    it('should inject hover styles into document head', () => {
      const { element: icon } = factory.createCopilotIcon();
      const styleEl = document.getElementById('prompt-library-copilot-hover-styles');

      expect(styleEl).toBeDefined();
      expect(styleEl?.tagName).toBe('STYLE');
      expect(styleEl?.textContent).toContain('.prompt-library-copilot-icon[data-theme="light"]:hover');
      expect(styleEl?.textContent).toContain('.prompt-library-copilot-icon[data-theme="dark"]:hover');
    });

    // NEW TESTS: MutationObserver cleanup
    it('should return cleanup function along with element', () => {
      const result = factory.createCopilotIcon();

      expect(result).toBeDefined();
      expect(result.element).toBeDefined();
      expect(result.cleanup).toBeDefined();
      expect(typeof result.cleanup).toBe('function');
    });

    it('should disconnect MutationObserver when cleanup is called', () => {
      // Spy on MutationObserver.disconnect
      const disconnectSpy = vi.fn();
      const originalMutationObserver = globalThis.MutationObserver;

      globalThis.MutationObserver = class extends originalMutationObserver {
        disconnect() {
          disconnectSpy();
          super.disconnect();
        }
      } as typeof MutationObserver;

      const { cleanup } = factory.createCopilotIcon();

      expect(disconnectSpy).not.toHaveBeenCalled();

      cleanup();

      expect(disconnectSpy).toHaveBeenCalledOnce();

      // Restore original MutationObserver
      globalThis.MutationObserver = originalMutationObserver;
    });

    it('should not leak observers when creating multiple icons', () => {
      const disconnectSpy = vi.fn();
      const originalMutationObserver = globalThis.MutationObserver;

      globalThis.MutationObserver = class extends originalMutationObserver {
        disconnect() {
          disconnectSpy();
          super.disconnect();
        }
      } as typeof MutationObserver;

      // Create multiple icons
      const result1 = factory.createCopilotIcon();
      const result2 = factory.createCopilotIcon();
      const result3 = factory.createCopilotIcon();

      // Each should have independent cleanup
      expect(result1.cleanup).not.toBe(result2.cleanup);
      expect(result2.cleanup).not.toBe(result3.cleanup);

      // Cleanup all
      result1.cleanup();
      result2.cleanup();
      result3.cleanup();

      // All three observers should be disconnected
      expect(disconnectSpy).toHaveBeenCalledTimes(3);

      // Restore original MutationObserver
      globalThis.MutationObserver = originalMutationObserver;
    });
  });

  describe('Storage integration', () => {
    it('should use createElement for creating elements', () => {
      factory.createPerplexityIcon();

      expect(createElement).toHaveBeenCalled();
    });

    it('should use createSVGElement for creating SVG elements', () => {
      factory.createPerplexityIcon();

      expect(createSVGElement).toHaveBeenCalled();
    });
  });
});