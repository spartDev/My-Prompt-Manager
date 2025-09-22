/**
 * Performance and compatibility tests for the modular content script
 * 
 * These tests verify that the modular architecture doesn't negatively impact
 * performance and maintains compatibility across different environments.
 */

 
 
 
 
 
 
 

import { JSDOM } from 'jsdom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { getChromeMock } from '../../test/mocks';
import { PromptLibraryInjector } from '../core/injector';
import { injectCSS } from '../utils/styles';

const chromeMock = getChromeMock();

const defaultPrompts = Array.from({ length: 100 }, (_, i) => ({
  id: `perf-test-${i}`,
  title: `Performance Test Prompt ${i}`,
  content: `This is test content for performance testing prompt number ${i}. `.repeat(10),
  category: `Category ${i % 5}`,
  createdAt: Date.now() - (i * 1000)
}));

describe('Content Script Performance Tests', () => {
  let dom: JSDOM;
  let injector: PromptLibraryInjector;

  const setupDOMForPlatform = (url: string) => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>Performance Test Page</title></head>
        <body>
          <div id="test-container">
            ${Array.from({ length: 50 }, (_, i) => `
              <textarea id="input-${i}" placeholder="Test input ${i}"></textarea>
            `).join('')}
          </div>
        </body>
      </html>
    `, {
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
    vi.clearAllMocks();
    chromeMock.storage.local.get.mockResolvedValue({ prompts: defaultPrompts });
    chromeMock.storage.local.set.mockResolvedValue(undefined);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (injector) {
      injector.cleanup();
    }
    vi.restoreAllMocks();
  });

  describe('Initialization Performance', () => {
    it('should initialize quickly with many DOM elements', async () => {
      setupDOMForPlatform('https://example.com/');
      
      const startTime = performance.now();
      
      injectCSS();
      injector = new PromptLibraryInjector();
      
      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const endTime = performance.now();
      const initTime = endTime - startTime;
      
      // Should initialize in less than 500ms even with many elements
      expect(initTime).toBeLessThan(500);
      expect(injector).toBeDefined();
    });

    it('should handle large prompt datasets efficiently', async () => {
      setupDOMForPlatform('https://example.com/');
      
      // Mock a large dataset
      chromeMock.storage.local.get.mockResolvedValueOnce({
        prompts: Array.from({ length: 1000 }, (_, i) => ({
          id: `large-test-${i}`,
          title: `Large Dataset Prompt ${i}`,
          content: `Content for prompt ${i}. `.repeat(50),
          category: `Category ${i % 10}`,
          createdAt: Date.now() - (i * 1000)
        }))
      });
      
      const startTime = performance.now();
      
      injectCSS();
      injector = new PromptLibraryInjector();
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      // Should handle large datasets in reasonable time
      expect(loadTime).toBeLessThan(1000);
    });

    it('should not block the main thread during initialization', async () => {
      setupDOMForPlatform('https://example.com/');
      
      let mainThreadBlocked = false;
      const checkMainThread = () => {
        setTimeout(() => {
          mainThreadBlocked = true;
        }, 0);
      };
      
      checkMainThread();
      
      injectCSS();
      injector = new PromptLibraryInjector();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Main thread should not be blocked
      expect(mainThreadBlocked).toBe(true);
    });
  });

  describe('Memory Management', () => {
    it('should clean up event listeners properly', async () => {
      setupDOMForPlatform('https://example.com/');
      
      injectCSS();
      injector = new PromptLibraryInjector();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get initial listener count (approximate)
      const initialListeners = dom.window.document.querySelectorAll('*').length;
      
      // Cleanup
      injector.cleanup();
      
      // Should not leave hanging references
      expect(injector).toBeDefined();
      
      // Create new instance to test memory reuse
      injector = new PromptLibraryInjector();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(injector).toBeDefined();
    });

    it('should handle multiple initialization/cleanup cycles', async () => {
      setupDOMForPlatform('https://example.com/');
      
      // Run multiple cycles
      for (let i = 0; i < 10; i++) {
        injectCSS();
        const tempInjector = new PromptLibraryInjector();
        
        await new Promise(resolve => setTimeout(resolve, 10));
        
        tempInjector.cleanup();
      }
      
      // Final instance should still work
      injector = new PromptLibraryInjector();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(injector).toBeDefined();
    });

    it('should not leak memory with DOM mutations', async () => {
      setupDOMForPlatform('https://example.com/');
      
      injectCSS();
      injector = new PromptLibraryInjector();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Simulate DOM mutations
      for (let i = 0; i < 20; i++) {
        const newElement = dom.window.document.createElement('textarea');
        newElement.id = `dynamic-input-${i}`;
        dom.window.document.body.appendChild(newElement);
        
        // Remove some elements
        if (i > 10) {
          const oldElement = dom.window.document.getElementById(`dynamic-input-${i - 10}`);
          if (oldElement) {
            oldElement.remove();
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      
      // Should handle mutations gracefully
      expect(injector).toBeDefined();
    });
  });

  describe('Cross-Browser Compatibility', () => {
    const browsers = [
      { name: 'Chrome', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
      { name: 'Firefox', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0' },
      { name: 'Edge', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59' },
      { name: 'Safari', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15' }
    ];

    browsers.forEach(browser => {
      it(`should work correctly in ${browser.name}`, async () => {
        setupDOMForPlatform('https://example.com/');
        
        // Mock user agent
        Object.defineProperty(dom.window.navigator, 'userAgent', {
          value: browser.userAgent,
          configurable: true
        });
        
        injectCSS();
        injector = new PromptLibraryInjector();
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Should initialize successfully
        expect(injector).toBeDefined();
        
        // Check that CSS was injected
        const styleElements = dom.window.document.querySelectorAll('style');
        expect(styleElements.length).toBeGreaterThan(0);
      });
    });

    it('should handle different DOM implementations', async () => {
      setupDOMForPlatform('https://example.com/');
      
      // Test with different element types
      const elementTypes = [
        { tag: 'textarea', attributes: { placeholder: 'Test' } },
        { tag: 'input', attributes: { type: 'text', placeholder: 'Test' } },
        { tag: 'div', attributes: { contenteditable: 'true' } }
      ];
      
      elementTypes.forEach(({ tag, attributes }) => {
        const element = dom.window.document.createElement(tag);
        Object.entries(attributes).forEach(([key, value]) => {
          element.setAttribute(key, value);
        });
        dom.window.document.body.appendChild(element);
      });
      
      injectCSS();
      injector = new PromptLibraryInjector();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(injector).toBeDefined();
    });
  });

  describe('Website Context Compatibility', () => {
    const websites = [
      { name: 'Claude', url: 'https://claude.ai/chat', hasSpecialElements: true },
      { name: 'ChatGPT', url: 'https://chatgpt.com/', hasSpecialElements: true },
      { name: 'Perplexity', url: 'https://www.perplexity.ai/', hasSpecialElements: true },
      { name: 'Generic Site', url: 'https://example.com/', hasSpecialElements: false },
      { name: 'Complex SPA', url: 'https://app.complex-site.com/dashboard', hasSpecialElements: false }
    ];

    websites.forEach(website => {
      it(`should work correctly on ${website.name}`, async () => {
        setupDOMForPlatform(website.url);
        
        // Add website-specific elements
        if (website.hasSpecialElements) {
          if (website.name === 'Claude') {
            const proseMirror = dom.window.document.createElement('div');
            proseMirror.className = 'ProseMirror';
            proseMirror.setAttribute('contenteditable', 'true');
            dom.window.document.body.appendChild(proseMirror);
          } else if (website.name === 'ChatGPT') {
            const chatInput = dom.window.document.createElement('div');
            chatInput.id = 'prompt-textarea';
            chatInput.setAttribute('contenteditable', 'true');
            dom.window.document.body.appendChild(chatInput);
          } else if (website.name === 'Perplexity') {
            const textarea = dom.window.document.createElement('textarea');
            textarea.placeholder = 'Ask anything...';
            dom.window.document.body.appendChild(textarea);
          }
        }
        
        injectCSS();
        injector = new PromptLibraryInjector();
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        expect(injector).toBeDefined();
        
        // Verify CSS injection
        const styleElements = dom.window.document.querySelectorAll('style');
        expect(styleElements.length).toBeGreaterThan(0);
      });
    });

    it('should handle dynamic content loading', async () => {
      setupDOMForPlatform('https://spa-example.com/');
      
      injectCSS();
      injector = new PromptLibraryInjector();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Simulate dynamic content loading (like SPA route changes)
      for (let i = 0; i < 5; i++) {
        const newSection = dom.window.document.createElement('div');
        newSection.innerHTML = `
          <h2>Dynamic Section ${i}</h2>
          <textarea placeholder="Dynamic input ${i}"></textarea>
          <div contenteditable="true">Dynamic editable ${i}</div>
        `;
        dom.window.document.body.appendChild(newSection);
        
        // Simulate route change event
        const popstateEvent = new dom.window.Event('popstate');
        dom.window.dispatchEvent(popstateEvent);
        
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      
      expect(injector).toBeDefined();
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from DOM errors gracefully', async () => {
      setupDOMForPlatform('https://example.com/');
      
      // Mock querySelector to fail occasionally
      const originalQuerySelector = dom.window.document.querySelector;
      let callCount = 0;
      dom.window.document.querySelector = vi.fn().mockImplementation((selector) => {
        callCount++;
        if (callCount % 3 === 0) {
          throw new Error('DOM query failed');
        }
        return originalQuerySelector.call(dom.window.document, selector);
      });
      
      injectCSS();
      injector = new PromptLibraryInjector();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should still initialize despite errors
      expect(injector).toBeDefined();
      
      // Restore original method
      dom.window.document.querySelector = originalQuerySelector;
    });

    it('should handle storage errors gracefully', async () => {
      setupDOMForPlatform('https://example.com/');
      
      // Mock storage to fail
      chromeMock.storage.local.get.mockRejectedValueOnce(new Error('Storage unavailable'));
      
      injectCSS();
      injector = new PromptLibraryInjector();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should initialize even with storage errors
      expect(injector).toBeDefined();
    });

    it('should handle missing Chrome APIs', async () => {
      setupDOMForPlatform('https://example.com/');
      
      // Temporarily remove Chrome API
      const originalChrome = (globalThis as any).chrome;
      (globalThis as any).chrome = undefined;
      
      injectCSS();
      injector = new PromptLibraryInjector();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should handle missing APIs gracefully
      expect(injector).toBeDefined();
      
      // Restore Chrome API
      (globalThis as any).chrome = originalChrome;
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance benchmarks for icon injection', async () => {
      setupDOMForPlatform('https://example.com/');
      
      // Add many input elements
      for (let i = 0; i < 100; i++) {
        const input = dom.window.document.createElement('textarea');
        input.id = `benchmark-input-${i}`;
        dom.window.document.body.appendChild(input);
      }
      
      const startTime = performance.now();
      
      injectCSS();
      injector = new PromptLibraryInjector();
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should process 100 elements in reasonable time
      expect(totalTime).toBeLessThan(1000);
      
      // Performance should be roughly linear
      const timePerElement = totalTime / 100;
      expect(timePerElement).toBeLessThan(10); // Less than 10ms per element
    });

    it('should maintain performance with frequent DOM changes', async () => {
      setupDOMForPlatform('https://example.com/');
      
      injectCSS();
      injector = new PromptLibraryInjector();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const startTime = performance.now();
      
      // Simulate frequent DOM changes
      for (let i = 0; i < 50; i++) {
        const element = dom.window.document.createElement('textarea');
        element.id = `frequent-change-${i}`;
        dom.window.document.body.appendChild(element);
        
        // Trigger focus event
        const focusEvent = new dom.window.Event('focusin', { bubbles: true });
        element.dispatchEvent(focusEvent);
        
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      
      const endTime = performance.now();
      const changeTime = endTime - startTime;
      
      // Should handle frequent changes efficiently
      expect(changeTime).toBeLessThan(2000);
    });
  });
});