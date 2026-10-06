/**
 * Unit tests for StorageManager utility module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { DEFAULT_CATEGORY } from '../../../constants';
import * as Logger from '../logger';
import { getPrompts, createElement, createSVGElement } from '../storage';

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
      set: vi.fn(),
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
    Object.defineProperty(globalThis, 'chrome', {
      value: chromeMock,
      writable: true,
    });

    Object.defineProperty(globalThis, 'document', {
      value: documentMock,
      writable: true,
    });
    
    // Reset chrome runtime error
    chromeMock.runtime.lastError = null;
  });

  describe('getPrompts', () => {
    const storedPrompt = (overrides: Record<string, unknown> = {}) => ({
      id: 'test-1',
      title: 'Test Prompt',
      content: 'Test content',
      category: 'Test',
      createdAt: 1234567890,
      updatedAt: 1234567890,
      usageCount: 0,
      lastUsedAt: 1234567890,
      ...overrides
    });

    const storeRaw = (prompts: unknown) => {
      chromeMock.storage.local.get.mockImplementation((_keys, callback) => {
        callback({ prompts });
      });
    };

    it('should return the prompts from storage', async () => {
      const mockPrompts = [storedPrompt()];
      storeRaw(mockPrompts);

      const result = await getPrompts();

      expect(result).toEqual(mockPrompts);
      expect(chromeMock.storage.local.get).toHaveBeenCalledWith(['prompts'], expect.any(Function));
      expect(Logger.debug).toHaveBeenCalledWith(
        'Retrieved prompts from storage',
        { count: 1 }
      );
    });

    it('should return text exactly as stored: tags, keywords and surrounding whitespace untouched', async () => {
      const content = '  Summarize the metadata: use <example>text</example> tags; if count=5 and onboarding = true, return data: JSON\n\n';
      storeRaw([storedPrompt({ title: ' <b>Q&A</b> / "FAQ" ', content, category: 'a/b & <c>' })]);

      const [prompt] = await getPrompts();

      expect(prompt.title).toBe(' <b>Q&A</b> / "FAQ" ');
      expect(prompt.content).toBe(content);
      expect(prompt.category).toBe('a/b & <c>');
    });

    it('should return a Prompt over 50,000 characters in full, without truncating it', async () => {
      const content = 'a'.repeat(60000);
      storeRaw([storedPrompt({ content })]);

      const [prompt] = await getPrompts();

      expect(prompt.content).toBe(content);
    });

    it('should keep a Prompt whose text is only tags, instead of dropping it for being empty once stripped', async () => {
      storeRaw([storedPrompt({ id: '<id>', title: '<b></b>', content: '<br>' })]);

      const result = await getPrompts();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: '<id>', title: '<b></b>', content: '<br>' });
    });

    it('should fill in missing usage fields in memory, with no clock', async () => {
      storeRaw([{ id: 'old', title: 'Old', content: 'Body', createdAt: 1000, updatedAt: 2000 }]);

      const [prompt] = await getPrompts();

      expect(prompt).toEqual({
        id: 'old',
        title: 'Old',
        content: 'Body',
        category: DEFAULT_CATEGORY,
        createdAt: 1000,
        updatedAt: 2000,
        usageCount: 0,
        lastUsedAt: 1000
      });
    });

    it('should never write to storage', async () => {
      storeRaw([{ id: 'old', title: 'Old', content: 'Body' }]);

      await getPrompts();

      expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
    });

    it('should handle chrome storage errors gracefully', async () => {
      (chromeMock.runtime as any).lastError = { message: 'Storage error' } as chrome.runtime.LastError;
      chromeMock.storage.local.get.mockImplementation((_keys, callback) => {
        callback({});
      });

      const result = await getPrompts();

      expect(result).toEqual([]);
      expect(Logger.error).toHaveBeenCalledWith(
        'Failed to retrieve prompts from storage',
        expect.any(Error)
      );
    });

    it('should skip stored entries that are not Prompts', async () => {
      storeRaw([storedPrompt({ id: 'valid-1' }), { id: 'no-text' }, null, 'text']);

      const result = await getPrompts();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('valid-1');
      expect(Logger.warn).toHaveBeenCalledWith(
        'Filtered out invalid prompts',
        expect.objectContaining({
          originalCount: 4,
          validCount: 1,
          invalidCount: 3,
        })
      );
    });

    it('should return an empty list when nothing is stored', async () => {
      storeRaw(undefined);

      expect(await getPrompts()).toEqual([]);
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
      documentMock.createElementNS.mockImplementation((_namespace, tag) => {
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
});
