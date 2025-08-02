/**
 * Unit tests for DOMUtils utility module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { DOMUtils } from '../dom';
import * as Logger from '../logger';

// Mock Logger
vi.mock('../logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn().mockReturnValue(false),
  showDebugNotification: vi.fn()
}));

// Mock DOM methods
const documentMock = {
  createElement: vi.fn(),
  createElementNS: vi.fn(),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(),
  getElementById: vi.fn(),
  documentElement: {
    clientHeight: 800,
    clientWidth: 1200,
  },
};

const windowMock = {
  innerHeight: 800,
  innerWidth: 1200,
  getComputedStyle: vi.fn(),
};

describe('DOMUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup global mocks
    Object.defineProperty(global, 'document', {
      value: documentMock,
      writable: true,
    });
    
    Object.defineProperty(global, 'window', {
      value: windowMock,
      writable: true,
    });
  });

  describe('createElement', () => {
    it('should create DOM element with attributes and text content', () => {
      const mockElement = {
        setAttribute: vi.fn(),
        textContent: '',
      };
      documentMock.createElement.mockReturnValue(mockElement);

      const result = DOMUtils.createElement('div', { class: 'test', id: 'test-id' }, 'Test content');

      expect(documentMock.createElement).toHaveBeenCalledWith('div');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('class', 'test');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('id', 'test-id');
      expect(mockElement.textContent).toBe('Test content');
      expect(result).toBe(mockElement);
    });

    it('should handle creation errors gracefully', () => {
      documentMock.createElement.mockImplementation((tag) => {
        if (tag === 'invalid') {
          throw new Error('Invalid tag');
        }
        return { setAttribute: vi.fn(), textContent: '' };
      });

      const result = DOMUtils.createElement('invalid');
      
      expect(Logger.error).toHaveBeenCalledWith(
        'Failed to create DOM element',
        expect.any(Error),
        expect.objectContaining({ tag: 'invalid' })
      );
      expect(result).toBeDefined(); // Should return fallback div
    });
  });

  describe('createSVGElement', () => {
    it('should create SVG element with attributes', () => {
      const mockElement = {
        setAttribute: vi.fn(),
      };
      documentMock.createElementNS.mockReturnValue(mockElement);

      const result = DOMUtils.createSVGElement('path', { d: 'M0,0 L10,10', fill: 'red' });

      expect(documentMock.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'path');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('d', 'M0,0 L10,10');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('fill', 'red');
      expect(result).toBe(mockElement);
    });

    it('should handle creation errors gracefully', () => {
      documentMock.createElementNS.mockImplementation((namespace, tag) => {
        if (tag === 'path') {
          throw new Error('SVG creation error');
        }
        return { setAttribute: vi.fn() }; // Fallback for 'g' element
      });

      const result = DOMUtils.createSVGElement('path');
      
      expect(Logger.error).toHaveBeenCalledWith(
        'Failed to create SVG element',
        expect.any(Error),
        expect.objectContaining({ tag: 'path' })
      );
      expect(result).toBeDefined(); // Should return fallback element
    });
  });

  describe('querySelector', () => {
    it('should query selector successfully', () => {
      const mockElement = { id: 'test' };
      documentMock.querySelector.mockReturnValue(mockElement);

      const result = DOMUtils.querySelector('.test-class');

      expect(documentMock.querySelector).toHaveBeenCalledWith('.test-class');
      expect(result).toBe(mockElement);
    });

    it('should handle query errors gracefully', () => {
      documentMock.querySelector.mockImplementation(() => {
        throw new Error('Invalid selector');
      });

      const result = DOMUtils.querySelector('invalid[selector');

      expect(Logger.error).toHaveBeenCalledWith(
        'Failed to query selector',
        expect.any(Error),
        expect.objectContaining({ selector: 'invalid[selector' })
      );
      expect(result).toBeNull();
    });

    it('should use custom context when provided', () => {
      const mockContext = { querySelector: vi.fn() };
      const mockElement = { id: 'test' };
      mockContext.querySelector.mockReturnValue(mockElement);

      const result = DOMUtils.querySelector('.test', mockContext as any);

      expect(mockContext.querySelector).toHaveBeenCalledWith('.test');
      expect(result).toBe(mockElement);
    });
  });

  describe('querySelectorAll', () => {
    it('should query all selectors successfully', () => {
      const mockElements = [{ id: 'test1' }, { id: 'test2' }];
      documentMock.querySelectorAll.mockReturnValue(mockElements);

      const result = DOMUtils.querySelectorAll('.test-class');

      expect(documentMock.querySelectorAll).toHaveBeenCalledWith('.test-class');
      expect(result).toEqual(mockElements);
    });

    it('should handle query errors gracefully', () => {
      documentMock.querySelectorAll.mockImplementation(() => {
        throw new Error('Invalid selector');
      });

      const result = DOMUtils.querySelectorAll('invalid[selector');

      expect(Logger.error).toHaveBeenCalledWith(
        'Failed to query selector all',
        expect.any(Error),
        expect.objectContaining({ selector: 'invalid[selector' })
      );
      expect(result).toEqual([]);
    });
  });

  describe('getElementById', () => {
    it('should get element by ID successfully', () => {
      const mockElement = { id: 'test' };
      documentMock.getElementById.mockReturnValue(mockElement);

      const result = DOMUtils.getElementById('test');

      expect(documentMock.getElementById).toHaveBeenCalledWith('test');
      expect(result).toBe(mockElement);
    });

    it('should handle errors gracefully', () => {
      documentMock.getElementById.mockImplementation(() => {
        throw new Error('DOM error');
      });

      const result = DOMUtils.getElementById('test');

      expect(Logger.error).toHaveBeenCalledWith(
        'Failed to get element by ID',
        expect.any(Error),
        expect.objectContaining({ id: 'test' })
      );
      expect(result).toBeNull();
    });
  });

  describe('addEventListener', () => {
    it('should add event listener successfully', () => {
      const mockElement = { addEventListener: vi.fn() };
      const mockHandler = vi.fn();

      const result = DOMUtils.addEventListener(mockElement as any, 'click', mockHandler);

      expect(mockElement.addEventListener).toHaveBeenCalledWith('click', mockHandler, undefined);
      expect(result).toBe(true);
    });

    it('should handle errors gracefully', () => {
      const mockElement = {
        addEventListener: vi.fn().mockImplementation(() => {
          throw new Error('Event error');
        })
      };
      const mockHandler = vi.fn();

      const result = DOMUtils.addEventListener(mockElement as any, 'click', mockHandler);

      expect(Logger.error).toHaveBeenCalledWith(
        'Failed to add event listener',
        expect.any(Error),
        expect.objectContaining({ event: 'click' })
      );
      expect(result).toBe(false);
    });
  });

  describe('removeEventListener', () => {
    it('should remove event listener successfully', () => {
      const mockElement = { removeEventListener: vi.fn() };
      const mockHandler = vi.fn();

      const result = DOMUtils.removeEventListener(mockElement as any, 'click', mockHandler);

      expect(mockElement.removeEventListener).toHaveBeenCalledWith('click', mockHandler, undefined);
      expect(result).toBe(true);
    });

    it('should handle errors gracefully', () => {
      const mockElement = {
        removeEventListener: vi.fn().mockImplementation(() => {
          throw new Error('Event error');
        })
      };
      const mockHandler = vi.fn();

      const result = DOMUtils.removeEventListener(mockElement as any, 'click', mockHandler);

      expect(Logger.error).toHaveBeenCalledWith(
        'Failed to remove event listener',
        expect.any(Error),
        expect.objectContaining({ event: 'click' })
      );
      expect(result).toBe(false);
    });
  });

  describe('appendChild', () => {
    it('should append child successfully', () => {
      const mockParent = { appendChild: vi.fn(), tagName: 'DIV' };
      const mockChild = { tagName: 'SPAN' };

      const result = DOMUtils.appendChild(mockParent as any, mockChild as any);

      expect(mockParent.appendChild).toHaveBeenCalledWith(mockChild);
      expect(result).toBe(true);
    });

    it('should handle errors gracefully', () => {
      const mockParent = {
        appendChild: vi.fn().mockImplementation(() => {
          throw new Error('Append error');
        }),
        tagName: 'DIV'
      };
      const mockChild = { tagName: 'SPAN' };

      const result = DOMUtils.appendChild(mockParent as any, mockChild as any);

      expect(Logger.error).toHaveBeenCalledWith(
        'Failed to append child',
        expect.any(Error),
        expect.objectContaining({ parentTag: 'DIV', childTag: 'SPAN' })
      );
      expect(result).toBe(false);
    });
  });

  describe('removeElement', () => {
    it('should remove element with parent node', () => {
      const mockParent = { removeChild: vi.fn() };
      const mockElement = { 
        parentNode: mockParent,
        tagName: 'DIV',
        id: 'test',
        className: 'test-class'
      };

      const result = DOMUtils.removeElement(mockElement as any);

      expect(mockParent.removeChild).toHaveBeenCalledWith(mockElement);
      expect(result).toBe(true);
    });

    it('should remove element without parent node', () => {
      const mockElement = { 
        parentNode: null,
        remove: vi.fn(),
        tagName: 'DIV',
        id: 'test',
        className: 'test-class'
      };

      const result = DOMUtils.removeElement(mockElement as any);

      expect(mockElement.remove).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle errors gracefully', () => {
      const mockElement = {
        parentNode: null,
        remove: vi.fn().mockImplementation(() => {
          throw new Error('Remove error');
        }),
        tagName: 'DIV',
        id: 'test',
        className: 'test-class'
      };

      const result = DOMUtils.removeElement(mockElement as any);

      expect(Logger.error).toHaveBeenCalledWith(
        'Failed to remove element',
        expect.any(Error),
        expect.objectContaining({ elementTag: 'DIV', elementId: 'test', elementClass: 'test-class' })
      );
      expect(result).toBe(false);
    });
  });

  describe('isElementVisible', () => {
    it('should return true for visible element', () => {
      const mockElement = {
        getBoundingClientRect: vi.fn().mockReturnValue({
          top: 100,
          left: 100,
          bottom: 200,
          right: 200
        })
      };

      const result = DOMUtils.isElementVisible(mockElement as any);

      expect(result).toBe(true);
    });

    it('should return false for element outside viewport', () => {
      const mockElement = {
        getBoundingClientRect: vi.fn().mockReturnValue({
          top: -100,
          left: -100,
          bottom: -50,
          right: -50
        })
      };

      const result = DOMUtils.isElementVisible(mockElement as any);

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', () => {
      const mockElement = {
        getBoundingClientRect: vi.fn().mockImplementation(() => {
          throw new Error('Rect error');
        })
      };

      const result = DOMUtils.isElementVisible(mockElement as any);

      expect(Logger.error).toHaveBeenCalledWith(
        'Failed to check element visibility',
        expect.any(Error)
      );
      expect(result).toBe(false);
    });
  });

  describe('getComputedStyleProperty', () => {
    it('should get computed style property', () => {
      const mockComputedStyle = {
        getPropertyValue: vi.fn().mockReturnValue('red')
      };
      windowMock.getComputedStyle.mockReturnValue(mockComputedStyle);
      const mockElement = {};

      const result = DOMUtils.getComputedStyleProperty(mockElement as any, 'color');

      expect(windowMock.getComputedStyle).toHaveBeenCalledWith(mockElement);
      expect(mockComputedStyle.getPropertyValue).toHaveBeenCalledWith('color');
      expect(result).toBe('red');
    });

    it('should handle errors gracefully', () => {
      windowMock.getComputedStyle.mockImplementation(() => {
        throw new Error('Style error');
      });
      const mockElement = {};

      const result = DOMUtils.getComputedStyleProperty(mockElement as any, 'color');

      expect(Logger.error).toHaveBeenCalledWith(
        'Failed to get computed style',
        expect.any(Error),
        expect.objectContaining({ property: 'color' })
      );
      expect(result).toBeNull();
    });
  });

  describe('setAttributes', () => {
    it('should set attributes successfully', () => {
      const mockElement = { setAttribute: vi.fn() };
      const attributes = { class: 'test', id: 'test-id', 'data-value': 123 };

      const result = DOMUtils.setAttributes(mockElement as any, attributes);

      expect(mockElement.setAttribute).toHaveBeenCalledWith('class', 'test');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('id', 'test-id');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('data-value', '123');
      expect(result).toBe(true);
    });

    it('should handle errors gracefully', () => {
      const mockElement = {
        setAttribute: vi.fn().mockImplementation(() => {
          throw new Error('Attribute error');
        })
      };
      const attributes = { class: 'test' };

      const result = DOMUtils.setAttributes(mockElement as any, attributes);

      expect(Logger.error).toHaveBeenCalledWith(
        'Failed to set attributes',
        expect.any(Error),
        expect.objectContaining({ attributes })
      );
      expect(result).toBe(false);
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML characters', () => {
      const input = '<script>alert("xss")</script>';
      const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;';
      
      expect(DOMUtils.escapeHtml(input)).toBe(expected);
    });

    it('should handle non-string input', () => {
      expect(DOMUtils.escapeHtml(123 as any)).toBe('123');
      expect(Logger.warn).toHaveBeenCalledWith(
        'escapeHtml received non-string input',
        expect.objectContaining({ type: 'number', value: 123 })
      );
    });

    it('should handle errors gracefully', () => {
      const result = DOMUtils.escapeHtml('test');
      expect(result).toBe('test');
    });
  });
});