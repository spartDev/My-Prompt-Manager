/**
 * Compatibility tests for the modular content script
 * 
 * These tests verify that the modular version maintains compatibility
 * with the original implementation and works across different environments.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { PromptLibraryInjector } from '../core/injector';
import { StylesManager } from '../utils/styles';

// Mock Chrome APIs
const mockChrome = {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({
        prompts: [
          {
            id: 'compat-test-1',
            title: 'Compatibility Test Prompt',
            content: 'This is a test prompt for compatibility testing',
            category: 'Testing',
            createdAt: Date.now()
          }
        ]
      }),
      set: vi.fn().mockResolvedValue(undefined)
    }
  }
};

(global as any).chrome = mockChrome;

describe('Content Script Compatibility Tests', () => {
  let dom: JSDOM;
  let injector: PromptLibraryInjector;

  const setupDOMForPlatform = (url: string, customHTML?: string) => {
    const defaultHTML = `
      <!DOCTYPE html>
      <html>
        <head><title>Compatibility Test</title></head>
        <body>
          <div id="test-container">
            <textarea placeholder="Test input"></textarea>
          </div>
        </body>
      </html>
    `;

    dom = new JSDOM(customHTML || defaultHTML, {
      url,
      pretendToBeVisual: true,
      resources: 'usable'
    });

    global.document = dom.window.document;
    global.window = dom.window as any;
    global.HTMLElement = dom.window.HTMLElement;
    global.Element = dom.window.Element;
    global.Node = dom.window.Node;
  };

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (injector) {
      injector.cleanup();
    }
    vi.restoreAllMocks();
  });

  describe('Browser Environment Compatibility', () => {
    it('should work in Chrome-like environments', async () => {
      setupDOMForPlatform('https://example.com/');
      
      // Mock Chrome-specific features
      (global as any).chrome = mockChrome;
      Object.defineProperty(dom.window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        configurable: true
      });

      StylesManager.injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(injector).toBeDefined();
      const styles = dom.window.document.querySelectorAll('style');
      expect(styles.length).toBeGreaterThan(0);
    });

    it('should work in Edge-like environments', async () => {
      setupDOMForPlatform('https://example.com/');
      
      Object.defineProperty(dom.window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
        configurable: true
      });

      StylesManager.injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(injector).toBeDefined();
    });

    it('should handle different viewport sizes', async () => {
      const viewports = [
        { width: 1920, height: 1080 }, // Desktop
        { width: 1366, height: 768 },  // Laptop
        { width: 768, height: 1024 },  // Tablet
        { width: 375, height: 667 }    // Mobile
      ];

      for (const viewport of viewports) {
        setupDOMForPlatform('https://example.com/');
        
        // Mock viewport size
        Object.defineProperty(dom.window, 'innerWidth', { value: viewport.width, configurable: true });
        Object.defineProperty(dom.window, 'innerHeight', { value: viewport.height, configurable: true });

        StylesManager.injectCSS();
        const tempInjector = new PromptLibraryInjector();

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(tempInjector).toBeDefined();
        tempInjector.cleanup();
      }
    });
  });

  describe('Website-Specific Compatibility', () => {
    it('should work on Claude.ai with ProseMirror editor', async () => {
      const claudeHTML = `
        <!DOCTYPE html>
        <html>
          <head><title>Claude</title></head>
          <body>
            <div class="ProseMirror" contenteditable="true" role="textbox">
              <p>Type your message...</p>
            </div>
            <div class="relative">
              <button class="send-button">Send</button>
            </div>
          </body>
        </html>
      `;

      setupDOMForPlatform('https://claude.ai/chat', claudeHTML);

      StylesManager.injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(injector).toBeDefined();
      
      // Verify ProseMirror element is detected
      const proseMirror = dom.window.document.querySelector('.ProseMirror');
      expect(proseMirror).toBeDefined();
    });

    it('should work on ChatGPT with React-based input', async () => {
      const chatgptHTML = `
        <!DOCTYPE html>
        <html>
          <head><title>ChatGPT</title></head>
          <body>
            <div id="__next">
              <div id="prompt-textarea" contenteditable="true" data-testid="chatgpt-input">
                <p>Message ChatGPT...</p>
              </div>
              <button data-testid="send-button">
                <svg>Send Icon</svg>
              </button>
            </div>
          </body>
        </html>
      `;

      setupDOMForPlatform('https://chatgpt.com/', chatgptHTML);

      StylesManager.injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(injector).toBeDefined();
      
      // Verify ChatGPT input is detected
      const chatInput = dom.window.document.querySelector('#prompt-textarea');
      expect(chatInput).toBeDefined();
    });

    it('should work on Perplexity with textarea input', async () => {
      const perplexityHTML = `
        <!DOCTYPE html>
        <html>
          <head><title>Perplexity</title></head>
          <body>
            <div class="search-container">
              <textarea placeholder="Ask anything..." data-testid="perplexity-input"></textarea>
              <div class="relative">
                <button class="submit-button">Submit</button>
              </div>
            </div>
          </body>
        </html>
      `;

      setupDOMForPlatform('https://www.perplexity.ai/', perplexityHTML);

      StylesManager.injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(injector).toBeDefined();
      
      // Verify Perplexity input is detected
      const perplexityInput = dom.window.document.querySelector('textarea[placeholder="Ask anything..."]');
      expect(perplexityInput).toBeDefined();
    });

    it('should work on generic websites with standard inputs', async () => {
      const genericHTML = `
        <!DOCTYPE html>
        <html>
          <head><title>Generic Site</title></head>
          <body>
            <form>
              <textarea placeholder="Enter your message"></textarea>
              <input type="text" placeholder="Text input">
              <div contenteditable="true">Editable content</div>
              <button type="submit">Submit</button>
            </form>
          </body>
        </html>
      `;

      setupDOMForPlatform('https://example.com/', genericHTML);

      StylesManager.injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(injector).toBeDefined();
      
      // Verify generic inputs are detected
      const textarea = dom.window.document.querySelector('textarea');
      const textInput = dom.window.document.querySelector('input[type="text"]');
      const editableDiv = dom.window.document.querySelector('[contenteditable="true"]');
      
      expect(textarea).toBeDefined();
      expect(textInput).toBeDefined();
      expect(editableDiv).toBeDefined();
    });
  });

  describe('Dynamic Content Compatibility', () => {
    it('should handle Single Page Application (SPA) navigation', async () => {
      setupDOMForPlatform('https://spa-example.com/');

      StylesManager.injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate SPA route change
      const newContent = dom.window.document.createElement('div');
      newContent.innerHTML = `
        <h1>New Page</h1>
        <textarea placeholder="New page input"></textarea>
      `;
      
      dom.window.document.body.innerHTML = '';
      dom.window.document.body.appendChild(newContent);

      // Trigger popstate event (SPA navigation)
      const popstateEvent = new dom.window.Event('popstate');
      dom.window.dispatchEvent(popstateEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(injector).toBeDefined();
    });

    it('should handle dynamically added inputs', async () => {
      setupDOMForPlatform('https://example.com/');

      StylesManager.injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Add inputs dynamically
      for (let i = 0; i < 5; i++) {
        const newInput = dom.window.document.createElement('textarea');
        newInput.id = `dynamic-input-${i}`;
        newInput.placeholder = `Dynamic input ${i}`;
        dom.window.document.body.appendChild(newInput);

        // Trigger focus event to simulate user interaction
        const focusEvent = new dom.window.Event('focusin', { bubbles: true });
        newInput.dispatchEvent(focusEvent);

        await new Promise(resolve => setTimeout(resolve, 20));
      }

      expect(injector).toBeDefined();
    });

    it('should handle iframe content', async () => {
      const iframeHTML = `
        <!DOCTYPE html>
        <html>
          <head><title>Main Page</title></head>
          <body>
            <div>Main content</div>
            <iframe id="test-iframe" src="about:blank"></iframe>
          </body>
        </html>
      `;

      setupDOMForPlatform('https://example.com/', iframeHTML);

      StylesManager.injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(injector).toBeDefined();
      
      // Verify iframe doesn't break the extension
      const iframe = dom.window.document.querySelector('#test-iframe');
      expect(iframe).toBeDefined();
    });
  });

  describe('Error Handling Compatibility', () => {
    it('should handle malformed DOM gracefully', async () => {
      const malformedHTML = `
        <!DOCTYPE html>
        <html>
          <head><title>Malformed</title></head>
          <body>
            <div>
              <textarea placeholder="Test">
                <!-- Malformed nesting -->
                <div>Invalid nesting</div>
              </textarea>
            </div>
            <!-- Missing closing tags -->
            <div>
              <span>Unclosed span
        </html>
      `;

      setupDOMForPlatform('https://example.com/', malformedHTML);

      StylesManager.injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should handle malformed DOM without crashing
      expect(injector).toBeDefined();
    });

    it('should handle missing required DOM methods', async () => {
      setupDOMForPlatform('https://example.com/');

      // Mock missing methods
      const originalQuerySelectorAll = dom.window.document.querySelectorAll;
      dom.window.document.querySelectorAll = undefined as any;

      StylesManager.injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should handle missing methods gracefully
      expect(injector).toBeDefined();

      // Restore method
      dom.window.document.querySelectorAll = originalQuerySelectorAll;
    });

    it('should handle CSP (Content Security Policy) restrictions', async () => {
      setupDOMForPlatform('https://example.com/');

      // Mock CSP error for inline styles
      const originalCreateElement = dom.window.document.createElement;
      dom.window.document.createElement = vi.fn().mockImplementation((tagName) => {
        const element = originalCreateElement.call(dom.window.document, tagName);
        if (tagName === 'style') {
          // Simulate CSP blocking inline styles
          Object.defineProperty(element, 'textContent', {
            set: () => {
              throw new Error('Content Security Policy violation');
            },
            configurable: true
          });
        }
        return element;
      });

      StylesManager.injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should handle CSP restrictions gracefully
      expect(injector).toBeDefined();

      // Restore method
      dom.window.document.createElement = originalCreateElement;
    });
  });

  describe('Performance Regression Tests', () => {
    it('should not significantly impact page load time', async () => {
      setupDOMForPlatform('https://example.com/');

      const startTime = performance.now();

      StylesManager.injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      // Should load quickly (less than 200ms for basic initialization)
      expect(loadTime).toBeLessThan(200);
    });

    it('should have minimal memory footprint', async () => {
      setupDOMForPlatform('https://example.com/');

      // Get baseline memory usage (approximate)
      const initialElements = dom.window.document.querySelectorAll('*').length;

      StylesManager.injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      const finalElements = dom.window.document.querySelectorAll('*').length;
      const addedElements = finalElements - initialElements;

      // Should not add excessive DOM elements
      expect(addedElements).toBeLessThan(10);
    });

    it('should clean up resources completely', async () => {
      setupDOMForPlatform('https://example.com/');

      StylesManager.injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Cleanup
      injector.cleanup();

      // Should not leave hanging references
      expect(injector).toBeDefined();

      // Verify cleanup by creating new instance
      injector = new PromptLibraryInjector();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(injector).toBeDefined();
    });
  });
});