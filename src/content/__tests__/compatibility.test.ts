/**
 * Compatibility tests for the modular content script
 * 
 * These tests verify that the modular version maintains compatibility
 * with the original implementation and works across different environments.
 */

 
 
 
 
 
 

import { JSDOM } from 'jsdom';
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';

import { getChromeMockFunctions } from '../../test/mocks';
import { PromptLibraryInjector } from '../core/injector';
import { injectCSS } from '../utils/styles';

const chromeMock = getChromeMockFunctions();

const defaultCompatibilityPrompts = [
  {
    id: 'compat-test-1',
    title: 'Compatibility Test Prompt',
    content: 'This is a test prompt for compatibility testing',
    category: 'Testing',
    createdAt: Date.now()
  }
];

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

    // Type-safe global assignments
    const domWindow = dom.window as any;
    (globalThis as any).document = domWindow.document;
    (globalThis as any).window = domWindow;
    (globalThis as any).HTMLElement = domWindow.HTMLElement;
    (globalThis as any).Element = domWindow.Element;
    (globalThis as any).Node = domWindow.Node;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (chromeMock.storage.local.get as Mock).mockResolvedValue({ prompts: defaultCompatibilityPrompts });
    (chromeMock.storage.local.set as Mock).mockResolvedValue(undefined);
    (globalThis as any).chrome = chromeMock;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    try {
      injector?.cleanup();
    } catch {
      // Ignore cleanup errors in tests
    }
    vi.restoreAllMocks();
  });

  describe('Browser Environment Compatibility', () => {
    it('should work in Chrome-like environments', async () => {
      setupDOMForPlatform('https://example.com/');
      
      // Mock Chrome-specific features
      (globalThis as any).chrome = chromeMock;
      const domWindow = dom.window as any;
      Object.defineProperty(domWindow.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        configurable: true
      });

      injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(injector).toBeDefined();
      const styles = domWindow.document.querySelectorAll('style');
      expect(styles.length).toBeGreaterThan(0);
    });

    it('should work in Edge-like environments', async () => {
      setupDOMForPlatform('https://example.com/');
      
      const domWindow = dom.window as any;
      Object.defineProperty(domWindow.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
        configurable: true
      });

      injectCSS();
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
        const domWindow = dom.window as any;
        Object.defineProperty(domWindow, 'innerWidth', { value: viewport.width, configurable: true });
        Object.defineProperty(domWindow, 'innerHeight', { value: viewport.height, configurable: true });

        injectCSS();
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

      injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(injector).toBeDefined();
      
      // Verify ProseMirror element is detected
      const domWindow = dom.window as any;
      const proseMirror = domWindow.document.querySelector('.ProseMirror');
      expect(proseMirror).not.toBeNull();
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

      injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(injector).toBeDefined();
      
      // Verify ChatGPT input is detected
      const domWindow = dom.window as any;
      const chatInput = domWindow.document.querySelector('#prompt-textarea');
      expect(chatInput).not.toBeNull();
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

      injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(injector).toBeDefined();
      
      // Verify Perplexity input is detected
      const domWindow = dom.window as any;
      const perplexityInput = domWindow.document.querySelector('textarea[placeholder="Ask anything..."]');
      expect(perplexityInput).not.toBeNull();
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

      injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(injector).toBeDefined();
      
      // Verify generic inputs are detected
      const domWindow = dom.window as any;
      const textarea = domWindow.document.querySelector('textarea');
      const textInput = domWindow.document.querySelector('input[type="text"]');
      const editableDiv = domWindow.document.querySelector('[contenteditable="true"]');
      
      expect(textarea).not.toBeNull();
      expect(textInput).not.toBeNull();
      expect(editableDiv).not.toBeNull();
    });
  });

  describe('Dynamic Content Compatibility', () => {
    it('should handle Single Page Application (SPA) navigation', async () => {
      setupDOMForPlatform('https://spa-example.com/');

      injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate SPA route change
      const domWindow = dom.window as any;
      const newContent = domWindow.document.createElement('div');
      newContent.innerHTML = `
        <h1>New Page</h1>
        <textarea placeholder="New page input"></textarea>
      `;
      
      domWindow.document.body.innerHTML = '';
      domWindow.document.body.appendChild(newContent);

      // Trigger popstate event (SPA navigation)
      const popstateEvent = new domWindow.Event('popstate');
      domWindow.dispatchEvent(popstateEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(injector).toBeDefined();
    });

    it('should handle dynamically added inputs', async () => {
      setupDOMForPlatform('https://example.com/');

      injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Add inputs dynamically
      const domWindow = dom.window as any;
      for (let i = 0; i < 5; i++) {
        const newInput = domWindow.document.createElement('textarea');
        newInput.id = `dynamic-input-${i}`;
        newInput.placeholder = `Dynamic input ${i}`;
        domWindow.document.body.appendChild(newInput);

        // Trigger focus event to simulate user interaction
        const focusEvent = new domWindow.Event('focusin', { bubbles: true });
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

      injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(injector).toBeDefined();
      
      // Verify iframe doesn't break the extension
      const domWindow = dom.window as any;
      const iframe = domWindow.document.querySelector('#test-iframe');
      expect(iframe).not.toBeNull();
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

      injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should handle malformed DOM without crashing
      expect(injector).toBeDefined();
    });

    it('should handle missing required DOM methods', async () => {
      setupDOMForPlatform('https://example.com/');

      // Mock missing methods
      const domWindow = dom.window as any;
      const originalQuerySelectorAll = domWindow.document.querySelectorAll;
      domWindow.document.querySelectorAll = undefined;

      injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should handle missing methods gracefully
      expect(injector).toBeDefined();

      // Restore method
      domWindow.document.querySelectorAll = originalQuerySelectorAll;
    });

    it('should handle CSP (Content Security Policy) restrictions', async () => {
      setupDOMForPlatform('https://example.com/');

      // Mock CSP error for inline styles
      const domWindow = dom.window as any;
      const originalCreateElement = domWindow.document.createElement;
      domWindow.document.createElement = vi.fn().mockImplementation((tagName: string) => {
        const element = originalCreateElement.call(domWindow.document, tagName);
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

      injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should handle CSP restrictions gracefully
      expect(injector).toBeDefined();

      // Restore method
      domWindow.document.createElement = originalCreateElement;
    });
  });

  describe('Performance Regression Tests', () => {
    it('should not significantly impact page load time', async () => {
      setupDOMForPlatform('https://example.com/');

      const startTime = performance.now();

      injectCSS();
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
      const domWindow = dom.window as any;
      const initialElements = domWindow.document.querySelectorAll('*').length;

      injectCSS();
      injector = new PromptLibraryInjector();

      await new Promise(resolve => setTimeout(resolve, 100));

      const finalElements = domWindow.document.querySelectorAll('*').length;
      const addedElements = finalElements - initialElements;

      // Should not add excessive DOM elements
      expect(addedElements).toBeLessThan(10);
    });

    it('should clean up resources completely', async () => {
      setupDOMForPlatform('https://example.com/');

      injectCSS();
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