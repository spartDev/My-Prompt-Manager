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
      expect(svg?.getAttribute('viewBox')).toBe('0 0 256 256');
    });

    it('should contain text element with "My Prompts"', () => {
      const result = factory.createClaudeIcon();
      const textElement = result.icon.querySelector('p');
      
      expect(textElement).toBeTruthy();
      expect(textElement?.textContent).toBe('My Prompts');
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
      expect(icon.className).toContain('focus-visible:bg-offsetPlus');
      expect(icon.className).toContain('hover:bg-offsetPlus');
    });

    it('should contain SVG element with proper attributes', () => {
      const icon = factory.createPerplexityIcon();
      const svg = icon.querySelector('svg');
      
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg?.getAttribute('stroke')).toBe('currentColor');
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
      expect(svg?.getAttribute('stroke')).toBe('currentColor');
      expect(svg?.getAttribute('stroke-width')).toBe('2');
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