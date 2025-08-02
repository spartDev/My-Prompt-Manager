/**
 * Unit tests for StorageManager utility module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import * as Logger from '../logger';
import { getPrompts, sanitizeUserInput, validatePromptData, createPromptListItem, escapeHtml, createElement, createSVGElement } from '../storage';

// Mock Logger
vi.mock('../logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn().mockReturnValue(false),
  showDebugNotification: vi.fn()
}));


// Mock Chrome storage API
const chromeMock = {
  storage: {
    local: {
      get: vi.fn(),
    },
  },
  runtime: {
    lastError: null,
  },
};

// Mock DOM methods
const documentMock = {
  createElement: vi.fn(),
  createElementNS: vi.fn(),
};

describe('StorageManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup global mocks
    Object.defineProperty(global, 'chrome', {
      value: chromeMock,
      writable: true,
    });
    
    Object.defineProperty(global, 'document', {
      value: documentMock,
      writable: true,
    });
    
    // Reset chrome runtime error
    chromeMock.runtime.lastError = null;
  });

  describe('getPrompts', () => {
    it('should return validated prompts from storage', async () => {
      const mockPrompts = [
        {
          id: 'test-1',
          title: 'Test Prompt',
          content: 'Test content',
          category: 'Test',
          createdAt: 1234567890,
        },
      ];
      
      chromeMock.storage.local.get.mockImplementation((keys, callback) => {
        callback({ prompts: mockPrompts });
      });

      const result = await getPrompts();

      expect(result).toEqual(mockPrompts);
      expect(chromeMock.storage.local.get).toHaveBeenCalledWith(['prompts'], expect.any(Function));
      expect(Logger.debug).toHaveBeenCalledWith(
        'Retrieved and validated prompts from storage',
        { count: 1 }
      );
    });

    it('should handle chrome storage errors gracefully', async () => {
      chromeMock.runtime.lastError = { message: 'Storage error' };
      chromeMock.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      const result = await getPrompts();

      expect(result).toEqual([]);
      expect(Logger.error).toHaveBeenCalledWith(
        'Failed to retrieve prompts from storage',
        expect.any(Error)
      );
    });

    it('should filter out invalid prompts', async () => {
      const mockPrompts = [
        {
          id: 'valid-1',
          title: 'Valid Prompt',
          content: 'Valid content',
          category: 'Test',
          createdAt: 1234567890,
        },
        {
          id: '', // Invalid - empty id
          title: 'Invalid Prompt',
          content: 'Invalid content',
          category: 'Test',
        },
        null, // Invalid - null prompt
      ];
      
      chromeMock.storage.local.get.mockImplementation((keys, callback) => {
        callback({ prompts: mockPrompts });
      });

      const result = await getPrompts();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('valid-1');
      expect(Logger.warn).toHaveBeenCalledWith(
        'Filtered out invalid prompts',
        expect.objectContaining({
          originalCount: 3,
          validCount: 1,
          invalidCount: 2,
        })
      );
    });

    it('should handle unexpected errors', async () => {
      chromeMock.storage.local.get.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await getPrompts();

      expect(result).toEqual([]);
      expect(Logger.error).toHaveBeenCalledWith(
        'Unexpected error accessing chrome storage',
        expect.any(Error)
      );
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML characters', () => {
      const input = '<script>alert("xss")</script>';
      const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;';
      
      expect(escapeHtml(input)).toBe(expected);
    });

    it('should handle non-string input', () => {
      expect(escapeHtml(123 as any)).toBe('123');
      expect(Logger.warn).toHaveBeenCalledWith(
        'escapeHtml received non-string input',
        expect.objectContaining({ type: 'number', value: 123 })
      );
    });

    it('should handle errors gracefully', () => {
      // Test with a problematic input that could cause errors
      const result = escapeHtml('test');
      expect(result).toBe('test');
    });
  });

  describe('createElement', () => {
    it('should create DOM element with attributes and text content', () => {
      const mockElement = {
        setAttribute: vi.fn(),
        textContent: '',
      };
      documentMock.createElement.mockReturnValue(mockElement);

      const result = createElement('div', { class: 'test', id: 'test-id' }, 'Test content');

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

      const result = createElement('invalid');
      
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

      const result = createSVGElement('path', { d: 'M0,0 L10,10', fill: 'red' });

      expect(documentMock.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'path');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('d', 'M0,0 L10,10');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('fill', 'red');
      expect(result).toBe(mockElement);
    });

    it('should handle creation errors gracefully', () => {
      // Mock createElementNS to throw error, but also provide fallback
      documentMock.createElementNS.mockImplementation((namespace, tag) => {
        if (tag === 'path') {
          throw new Error('SVG creation error');
        }
        return { setAttribute: vi.fn() }; // Fallback for 'g' element
      });

      const result = createSVGElement('path');
      
      expect(Logger.error).toHaveBeenCalledWith(
        'Failed to create SVG element',
        expect.any(Error),
        expect.objectContaining({ tag: 'path' })
      );
      expect(result).toBeDefined(); // Should return fallback element
    });
  });

  describe('sanitizeUserInput', () => {
    it('should remove dangerous content', () => {
      const input = '<script>alert("xss")</script>javascript:void(0)';
      const result = sanitizeUserInput(input);
      
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('javascript:');
    });

    it('should remove control characters', () => {
      const input = 'test\x00\x01\x02content';
      const result = sanitizeUserInput(input);
      
      expect(result).toBe('testcontent');
    });

    it('should truncate long input', () => {
      const longInput = 'a'.repeat(60000);
      const result = sanitizeUserInput(longInput);
      
      expect(result.length).toBeLessThan(longInput.length);
      expect(result.endsWith('...')).toBe(true);
      expect(Logger.warn).toHaveBeenCalledWith(
        'Input truncated due to length limit',
        expect.objectContaining({
          originalLength: 60000,
          maxLength: 50000,
        })
      );
    });

    it('should handle non-string input', () => {
      expect(sanitizeUserInput(123 as any)).toBe('');
      expect(Logger.warn).toHaveBeenCalledWith(
        'sanitizeUserInput received non-string input',
        expect.objectContaining({ type: 'number', value: 123 })
      );
    });
  });

  describe('validatePromptData', () => {
    it('should validate and sanitize valid prompt data', () => {
      const input = {
        id: 'test-id',
        title: 'Test Title',
        content: 'Test content',
        category: 'Test Category',
        createdAt: 1234567890,
      };

      const result = validatePromptData(input);

      expect(result).toEqual(input);
    });

    it('should provide defaults for missing fields', () => {
      const input = {
        id: 'test-id',
        content: 'Test content',
      };

      const result = validatePromptData(input);

      expect(result).toEqual({
        id: 'test-id',
        title: 'Untitled',
        content: 'Test content',
        category: 'General',
        createdAt: expect.any(Number),
      });
    });

    it('should return null for invalid data', () => {
      expect(validatePromptData(null)).toBeNull();
      expect(validatePromptData('invalid')).toBeNull();
      expect(validatePromptData({})).toBeNull(); // Missing required fields
    });

    it('should return null when required fields are empty after sanitization', () => {
      const input = {
        id: '',
        title: 'Test',
        content: 'Test content',
      };

      const result = validatePromptData(input);
      expect(result).toBeNull();
      expect(Logger.warn).toHaveBeenCalledWith(
        'Prompt failed validation - empty required fields',
        expect.any(Object)
      );
    });
  });

  describe('createPromptListItem', () => {
    beforeEach(() => {
      const mockElement = {
        setAttribute: vi.fn(),
        textContent: '',
        appendChild: vi.fn(),
      };
      documentMock.createElement.mockReturnValue(mockElement);
    });

    it('should create prompt list item with all elements', () => {
      const prompt = {
        id: 'test-id',
        title: 'Test Title',
        content: 'Test content that is longer than 100 characters to test the truncation functionality properly',
        category: 'Test Category',
        createdAt: 1234567890,
      };

      const result = createPromptListItem(prompt, 0);

      expect(documentMock.createElement).toHaveBeenCalledWith('div');
      expect(result.appendChild).toHaveBeenCalledTimes(3); // title, category, preview
    });

    it('should handle creation errors gracefully', () => {
      let callCount = 0;
      documentMock.createElement.mockImplementation((tag) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Creation error');
        }
        // Return mock for fallback div element
        return {
          setAttribute: vi.fn(),
          textContent: '',
          appendChild: vi.fn(),
        };
      });

      const prompt = {
        id: 'test-id',
        title: 'Test Title',
        content: 'Test content',
        category: 'Test Category',
        createdAt: 1234567890,
      };

      const result = createPromptListItem(prompt, 0);

      // The error is caught by createElement, not createPromptListItem
      expect(Logger.error).toHaveBeenCalledWith(
        'Failed to create DOM element',
        expect.any(Error),
        expect.objectContaining({ tag: 'div' })
      );
      expect(result).toBeDefined(); // Should return fallback element
    });
  });
});