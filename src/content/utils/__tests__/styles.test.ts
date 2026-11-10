/**
 * Unit tests for StylesManager utility module
 */

 

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as Logger from '../logger';
import { getCSS, injectCSS, isInjected, removeCSS } from '../styles';

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
      expect(mockStyleElement.textContent).toContain('.prompt-library-pill');
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
    it('styles the Prompts button and nothing of the Prompt selector, which has its own stylesheet in its shadow root', () => {
      const css = getCSS();

      expect(css).toContain('.prompt-library-pill');
      expect(css).toContain('.prompt-library-pill-badge');
      expect(css).toContain('.prompt-library-pill-compact');
      expect(css).not.toContain('.prompt-library-selector');
      expect(css).not.toContain('.mpm-');
    });

    it('writes only rules scoped to the Prompts button, so none can reach the Platform\'s own elements', () => {
      const rules = getCSS().replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]+\{/g, '');
      const selectors = [...rules.matchAll(/(^|\})\s*([^{}]+)\{/g)].map(([, , selector]) => selector.trim());

      expect(selectors.length).toBeGreaterThan(5);
      expect(selectors.filter((selector) => !selector.split(',').every((part) => /^(\[data-prompt-library-floating\] )?\.prompt-library-pill/.test(part.trim())))).toEqual([]);
    });

    it('includes the dark theme', () => {
      expect(getCSS()).toContain('.prompt-library-pill.dark-theme');
    });

    it('shows whether the selector is open, and answers a press with the spring curve', () => {
      const css = getCSS();

      expect(css).toContain('.prompt-library-pill[aria-expanded="true"]');
      expect(css).toContain('transform: scale(0.92)');
      expect(css).toContain('cubic-bezier(0.34, 1.56, 0.64, 1)');
      expect(css).toContain('background 300ms');
    });

    it('includes a visible focus and honors reduced motion', () => {
      const css = getCSS();

      expect(css).toContain('focus-visible');
      expect(css).toContain('@media (prefers-reduced-motion: reduce)');
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

    it('keeps the layers of the positioned buttons', () => {
      const css = getCSS();

      expect(css).toContain('z-index: 999999'); // Absolutely positioned button
      expect(css).toContain('z-index: 10'); // Button inserted in the page
    });
  });

  describe('color tokens (My-Prompt-Manager-el4.7)', () => {
    const TOKENS_CSS = readFileSync(path.resolve(__dirname, '../../../theme/tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const declarationsOf = (block: string): Record<string, string> =>
      Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim().replace(/\s+/g, ' ').toLowerCase()]));
    /** The block of the first rule whose selector is exactly `selector` (written `selector {`, starting a selector) */
    const blockOf = (css: string, selector: string): string => {
      let start = css.indexOf(`${selector} {`);
      while (start > 0 && !/[\s}]/.test(css[start - 1])) {
        start = css.indexOf(`${selector} {`, start + 1);
      }
      expect(start, `rule ${selector}`).toBeGreaterThanOrEqual(0);
      const open = css.indexOf('{', start);
      return css.slice(open + 1, css.indexOf('}', open));
    };
    /** The popup's tokens: light from @theme static, dark from the .dark override (literal values) */
    const popup = {
      light: declarationsOf(blockOf(TOKENS_CSS, '@theme static')),
      dark: declarationsOf(blockOf(TOKENS_CSS, '.dark'))
    };

    it('declares the popup tokens on the button with their light values, and on its dark-theme variant with their dark values', () => {
      const css = getCSS();
      const light = declarationsOf(blockOf(css, '.prompt-library-pill'));
      const dark = declarationsOf(blockOf(css, '.prompt-library-pill.dark-theme'));

      expect(Object.keys(light).length).toBeGreaterThanOrEqual(5);
      for (const [name, value] of Object.entries(light)) {
        expect(popup.light[name], `${name} is a token of tokens.css`).toBeDefined();
        expect(value, `${name} (light)`).toBe(popup.light[name]);
      }
      // A literal color token keeps its light value in dark only by mistake: each one is declared again
      for (const [name, value] of Object.entries(light).filter(([, value]) => /^(#|rgba?\()/.test(value))) {
        expect(dark[name], `${name} (dark)`).toBe(popup.dark[name] ?? value);
      }
      for (const [name, value] of Object.entries(dark)) {
        expect(value, `${name} (dark)`).toBe(popup.dark[name]);
      }
    });

    it('writes no color outside the token declarations', () => {
      const rules = getCSS().replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[\w-]+\s*:[^;]+;/g, '');
      const literals = rules.match(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\(|:\s*(?:white|black)\b/gi) ?? [];

      expect(literals).toEqual([]);
    });

    it('reads only tokens it declares on the button', () => {
      const css = getCSS();
      const declared = new Set(Object.keys(declarationsOf(blockOf(css, '.prompt-library-pill'))));
      const used = [...css.matchAll(/var\((--(?:background|text|border)-color-[\w-]+|--shadow-[\w-]+)/g)].map(([, name]) => name);

      expect(used.length).toBeGreaterThan(0);
      expect([...new Set(used)].filter(name => !declared.has(name)), 'tokens read but not declared').toEqual([]);
    });
  });
});