/**
 * Unit tests for UIElementFactory: the Prompts button of each Platform
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fitPromptsPill, UIElementFactory } from '../element-factory';

const theme = vi.hoisted(() => ({ current: 'light' as 'light' | 'dark' }));

vi.mock('../../utils/theme-manager', () => ({
  ThemeManager: { getInstance: () => ({ getCurrentTheme: () => theme.current }) }
}));

vi.mock('../../utils/storage', () => ({
  createSVGElement: vi.fn((tag: string, attributes: Record<string, string | number> = {}) => {
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

  const buttons = (): [string, HTMLElement][] => [
    ['Claude', factory.createClaudeIcon().icon],
    ['ChatGPT', factory.createChatGPTIcon()],
    ['Perplexity', factory.createPerplexityIcon()],
    ['Mistral', factory.createMistralIcon()],
    ['Gemini', factory.createGeminiIcon()],
    ['Copilot', factory.createCopilotIcon().element],
    ['custom site', factory.createFloatingIcon()]
  ];

  beforeEach(() => {
    theme.current = 'light';
    factory = new UIElementFactory(testInstanceId);
  });

  describe('the Prompts button', () => {
    it('is the same pill on every Platform: a badge and the label "Prompts"', () => {
      for (const [platform, button] of buttons()) {
        expect(button.tagName, platform).toBe('BUTTON');
        expect(button.getAttribute('type'), platform).toBe('button');
        expect(button.classList.contains('prompt-library-pill'), platform).toBe(true);
        expect(button.querySelector('.prompt-library-pill-label')?.textContent, platform).toBe('Prompts');
        expect(button.querySelector('.prompt-library-pill-badge svg path'), platform).not.toBeNull();
        expect(button.querySelector('svg')?.getAttribute('aria-hidden'), platform).toBe('true');
      }
    });

    it('has an accessible name that holds its visible label, and says it opens a dialog, closed at first', () => {
      for (const [platform, button] of buttons()) {
        expect(button.getAttribute('aria-label'), platform).toMatch(/^Prompts/);
        expect(button.getAttribute('aria-haspopup'), platform).toBe('dialog');
        expect(button.getAttribute('aria-expanded'), platform).toBe('false');
        expect(button.getAttribute('title'), platform).toBe('My Prompt Manager');
        expect(button.getAttribute('tabindex'), platform).toBe('0');
      }
    });

    it('carries the instance id', () => {
      for (const [platform, button] of buttons()) {
        expect(button.getAttribute('data-instance-id'), platform).toBe(testInstanceId);
      }
    });

    it('takes none of the Platform\'s own button classes', () => {
      for (const [platform, button] of buttons()) {
        const foreign = [...button.classList].filter((name) => !name.startsWith('prompt-library-'));
        expect(foreign, platform).toEqual([]);
      }
    });

    it('follows the extension\'s theme', () => {
      expect(factory.createChatGPTIcon().classList.contains('dark-theme')).toBe(false);

      theme.current = 'dark';
      expect(factory.createChatGPTIcon().classList.contains('dark-theme')).toBe(true);
    });

    it('sets its label as text, never as markup', () => {
      const button = factory.createChatGPTIcon();

      expect(button.querySelectorAll('script, img, iframe').length).toBe(0);
      expect(button.querySelector('.prompt-library-pill-label')?.children.length).toBe(0);
    });
  });

  describe('createClaudeIcon', () => {
    it('wraps the button the way Claude\'s action bar wraps its own', () => {
      const { container, icon } = factory.createClaudeIcon();

      expect(container.className).toBe('relative shrink-0');
      expect(container.contains(icon)).toBe(true);
      expect(icon.parentElement?.className).toBe('flex shrink-0');
      expect(icon.parentElement?.getAttribute('data-state')).toBe('closed');
    });

    it('is found by the class the injector looks for', () => {
      expect(factory.createClaudeIcon().icon.classList.contains('prompt-library-integrated-icon')).toBe(true);
    });
  });

  describe('integrated buttons', () => {
    it('ChatGPT, Perplexity, Mistral and Gemini are found by the integrated class', () => {
      for (const button of [factory.createChatGPTIcon(), factory.createPerplexityIcon(), factory.createMistralIcon(), factory.createGeminiIcon()]) {
        expect(button.classList.contains('prompt-library-integrated-icon')).toBe(true);
      }
    });
  });

  describe('createCopilotIcon', () => {
    it('is found by the Copilot class, and its cleanup does nothing', () => {
      const { element, cleanup } = factory.createCopilotIcon();

      expect(element.classList.contains('prompt-library-integrated-icon')).toBe(true);
      expect(element.classList.contains('prompt-library-copilot-icon')).toBe(true);
      expect(() => { cleanup(); }).not.toThrow();
    });

    it('adds nothing to the page\'s head', () => {
      const before = document.head.children.length;
      factory.createCopilotIcon();

      expect(document.head.children.length).toBe(before);
    });
  });

  describe('createFloatingIcon', () => {
    it('is absolutely positioned by default', () => {
      const icon = factory.createFloatingIcon();

      expect(icon.classList.contains('prompt-library-icon-base')).toBe(true);
      expect(icon.classList.contains('prompt-library-icon-absolute')).toBe(true);
    });

    it('can be relatively positioned, for a button inserted in the page', () => {
      expect(factory.createFloatingIcon('relative').classList.contains('prompt-library-icon-relative')).toBe(true);
      expect(factory.createRelativeIcon().classList.contains('prompt-library-icon-relative')).toBe(true);
      expect(factory.createAbsoluteIcon().classList.contains('prompt-library-icon-absolute')).toBe(true);
    });
  });

  describe('positioning conversion', () => {
    it('converts an absolute button to a relative one', () => {
      const icon = factory.createFloatingIcon('absolute');
      UIElementFactory.convertToRelativePositioning(icon);

      expect(icon.classList.contains('prompt-library-icon-relative')).toBe(true);
      expect(icon.classList.contains('prompt-library-icon-absolute')).toBe(false);
      expect(icon.classList.contains('prompt-library-pill')).toBe(true);
    });

    it('converts a relative button to an absolute one', () => {
      const icon = factory.createFloatingIcon('relative');
      UIElementFactory.convertToAbsolutePositioning(icon);

      expect(icon.classList.contains('prompt-library-icon-absolute')).toBe(true);
      expect(icon.classList.contains('prompt-library-icon-relative')).toBe(false);
    });
  });

  describe('fitPromptsPill', () => {
    const inBar = (scrollWidth: number, clientWidth: number): HTMLElement => {
      const bar = document.createElement('div');
      Object.defineProperty(bar, 'scrollWidth', { configurable: true, value: scrollWidth });
      Object.defineProperty(bar, 'clientWidth', { configurable: true, value: clientWidth });
      const button = factory.createChatGPTIcon();
      bar.appendChild(button);
      return button;
    };

    it('keeps the label when the bar has room', () => {
      const button = inBar(300, 300);
      fitPromptsPill(button);

      expect(button.classList.contains('prompt-library-pill-compact')).toBe(false);
    });

    it('shrinks the button to its badge when the bar overflows', () => {
      const button = inBar(340, 300);
      fitPromptsPill(button);

      expect(button.classList.contains('prompt-library-pill-compact')).toBe(true);
    });

    it('finds Claude\'s action bar above the wrappers that grow with the button', () => {
      const { container, icon } = factory.createClaudeIcon();
      // The injector wraps Claude's container once more before it goes into the bar
      const wrapper = document.createElement('div');
      const bar = document.createElement('div');
      Object.defineProperty(bar, 'scrollWidth', { configurable: true, value: 500 });
      Object.defineProperty(bar, 'clientWidth', { configurable: true, value: 300 });
      wrapper.appendChild(container);
      bar.appendChild(wrapper);
      document.body.appendChild(bar);
      fitPromptsPill(container);

      expect(icon.classList.contains('prompt-library-pill-compact')).toBe(true);
      bar.remove();
    });

    it('ignores an overflow far above the button, which says nothing about its bar', () => {
      let node: HTMLElement = factory.createChatGPTIcon();
      const button = node;
      for (let i = 0; i < 8; i++) {
        const parent = document.createElement('div');
        parent.appendChild(node);
        node = parent;
      }
      Object.defineProperty(node, 'scrollWidth', { configurable: true, value: 900 });
      Object.defineProperty(node, 'clientWidth', { configurable: true, value: 300 });
      fitPromptsPill(button);

      expect(button.classList.contains('prompt-library-pill-compact')).toBe(false);
    });

    it('does nothing for a button that is not in the page', () => {
      expect(() => { fitPromptsPill(factory.createChatGPTIcon()); }).not.toThrow();
    });
  });
});
