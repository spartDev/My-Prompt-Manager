/**
 * Unit tests for StylesManager utility module
 */

 

import { describe, it, expect, vi, beforeEach } from 'vitest';

import * as Logger from '../logger';
import { injectCSS, getCSS, removeCSS, isInjected } from '../styles';

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
  getElementById: vi.fn(),
  createElement: vi.fn(),
  head: {
    appendChild: vi.fn(),
  },
};

describe('StylesManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup global mocks
    Object.defineProperty(globalThis, 'document', {
      value: documentMock,
      writable: true,
    });
  });

  describe('injectCSS', () => {
    it('should inject CSS styles when not already present', () => {
      documentMock.getElementById.mockReturnValue(null); // No existing styles
      const mockStyleElement = {
        id: '',
        textContent: '',
      };
      documentMock.createElement.mockReturnValue(mockStyleElement);

      injectCSS();

      expect(documentMock.getElementById).toHaveBeenCalledWith('prompt-library-styles');
      expect(documentMock.createElement).toHaveBeenCalledWith('style');
      expect(mockStyleElement.id).toBe('prompt-library-styles');
      expect(mockStyleElement.textContent).toContain('.prompt-library-icon');
      expect(documentMock.head.appendChild).toHaveBeenCalledWith(mockStyleElement);
      expect(Logger.debug).toHaveBeenCalledWith('CSS styles injected successfully');
    });

    it('should skip injection when styles already exist', () => {
      const existingStyleElement = { id: 'prompt-library-styles' };
      documentMock.getElementById.mockReturnValue(existingStyleElement);

      injectCSS();

      expect(documentMock.getElementById).toHaveBeenCalledWith('prompt-library-styles');
      expect(documentMock.createElement).not.toHaveBeenCalled();
      expect(documentMock.head.appendChild).not.toHaveBeenCalled();
      expect(Logger.debug).toHaveBeenCalledWith('CSS styles already injected, skipping');
    });

    it('should handle injection errors gracefully', () => {
      documentMock.getElementById.mockReturnValue(null);
      documentMock.createElement.mockImplementation(() => {
        throw new Error('DOM error');
      });

      injectCSS();

      expect(Logger.error).toHaveBeenCalledWith(
        'Failed to inject CSS styles',
        expect.any(Error)
      );
    });
  });

  describe('getCSS', () => {
    it('should return CSS string with all required classes', () => {
      const css = getCSS();

      expect(css).toContain('.prompt-library-icon');
      expect(css).toContain('.prompt-library-selector');
      expect(css).toContain('.prompt-selector-header');
      expect(css).toContain('.prompt-search');
      expect(css).toContain('.search-input');
      expect(css).toContain('.prompt-list');
      expect(css).toContain('.prompt-item');
      expect(css).toContain('.prompt-title');
      expect(css).toContain('.prompt-category');
      expect(css).toContain('.prompt-preview');
      expect(css).toContain('.no-prompts');
      expect(css).toContain('.insertion-feedback');
      expect(css).toContain('.insertion-debug');
    });

    it('should include dark mode styles', () => {
      const css = getCSS();

      expect(css).toContain('.prompt-library-selector.dark-theme');
      expect(css).toContain('.prompt-library-selector.light-theme');
    });

    it('should include responsive design styles', () => {
      const css = getCSS();

      expect(css).toContain('@media (max-width: 480px)');
    });

    it('should include animations', () => {
      const css = getCSS();

      expect(css).toContain('@keyframes promptSelectorFadeIn');
    });

    it('should include accessibility styles', () => {
      const css = getCSS();

      expect(css).toContain('.sr-only');
      expect(css).toContain('focus-visible');
    });
  });

  describe('removeCSS', () => {
    it('should remove existing styles', () => {
      const mockStyleElement = {
        remove: vi.fn(),
      };
      documentMock.getElementById.mockReturnValue(mockStyleElement);

      removeCSS();

      expect(documentMock.getElementById).toHaveBeenCalledWith('prompt-library-styles');
      expect(mockStyleElement.remove).toHaveBeenCalled();
      expect(Logger.debug).toHaveBeenCalledWith('CSS styles removed successfully');
    });

    it('should handle case when no styles exist', () => {
      documentMock.getElementById.mockReturnValue(null);

      removeCSS();

      expect(documentMock.getElementById).toHaveBeenCalledWith('prompt-library-styles');
      expect(Logger.info).not.toHaveBeenCalled();
    });

    it('should handle removal errors gracefully', () => {
      const mockStyleElement = {
        remove: vi.fn().mockImplementation(() => {
          throw new Error('Removal error');
        }),
      };
      documentMock.getElementById.mockReturnValue(mockStyleElement);

      removeCSS();

      expect(Logger.error).toHaveBeenCalledWith(
        'Failed to remove CSS styles',
        expect.any(Error)
      );
    });
  });

  describe('isInjected', () => {
    it('should return true when styles are injected', () => {
      const mockStyleElement = { id: 'prompt-library-styles' };
      documentMock.getElementById.mockReturnValue(mockStyleElement);

      const result = isInjected();

      expect(result).toBe(true);
      expect(documentMock.getElementById).toHaveBeenCalledWith('prompt-library-styles');
    });

    it('should return false when styles are not injected', () => {
      documentMock.getElementById.mockReturnValue(null);

      const result = isInjected();

      expect(result).toBe(false);
      expect(documentMock.getElementById).toHaveBeenCalledWith('prompt-library-styles');
    });
  });

  describe('CSS content validation', () => {
    it('should have consistent CSS structure', () => {
      const css = getCSS();

      // Check for proper CSS syntax
      expect(css).not.toContain('undefined');
      expect(css).not.toContain('null');
      
      // Check for balanced braces (basic validation)
      const openBraces = (css.match(/{/g) || []).length;
      const closeBraces = (css.match(/}/g) || []).length;
      expect(openBraces).toBe(closeBraces);
    });

    it('should include all essential UI components', () => {
      const css = getCSS();

      // Essential components for functionality
      const requiredClasses = [
        '.prompt-library-icon',
        '.prompt-library-selector',
        '.prompt-item',
        '.search-input',
        '.close-selector',
      ];

      requiredClasses.forEach(className => {
        expect(css).toContain(className);
      });
    });

    it('should include proper z-index values for layering', () => {
      const css = getCSS();

      expect(css).toContain('z-index: 999999'); // Icon
      expect(css).toContain('z-index: 1000000'); // Selector
      expect(css).toContain('z-index: 1000001'); // Feedback
      expect(css).toContain('z-index: 1000002'); // Debug
    });
  });
});