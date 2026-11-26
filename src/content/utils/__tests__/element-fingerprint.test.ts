
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ElementFingerprint } from '../../../types';
import { getElementFingerprintGenerator } from '../element-fingerprint';

describe('ElementFingerprintGenerator', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    container.innerHTML = '';
  });

  const generator = getElementFingerprintGenerator();

  describe('generate', () => {
    it('should extract primary identifiers', () => {
      const element = document.createElement('button');
      element.id = 'submit-btn';
      element.setAttribute('data-testid', 'submit-button');
      element.setAttribute('data-id', 'checkout-submit');
      element.setAttribute('name', 'submit');
      element.setAttribute('aria-label', 'Submit Form');
      container.appendChild(element);

      const fingerprint = generator.generate(element);

      expect(fingerprint.primary.id).toBe('submit-btn');
      expect(fingerprint.primary.dataTestId).toBe('submit-button');
      expect(fingerprint.primary.dataId).toBe('checkout-submit');
      expect(fingerprint.primary.name).toBe('submit');
      expect(fingerprint.primary.ariaLabel).toBe('Submit Form');
      expect(fingerprint.meta.confidence).toBe('high');
    });

    it('should extract secondary identifiers', () => {
      const element = document.createElement('input');
      element.type = 'email';
      element.setAttribute('role', 'textbox');
      element.setAttribute('placeholder', 'Enter email');
      container.appendChild(element);

      const fingerprint = generator.generate(element);

      expect(fingerprint.secondary.tagName).toBe('input');
      expect(fingerprint.secondary.type).toBe('email');
      expect(fingerprint.secondary.role).toBe('textbox');
      expect(fingerprint.secondary.placeholder).toBe('Enter email');
    });

    // My-Prompt-Manager-je37: the text of a chat box, or of the box around it, is the user's draft
    it('keeps neither the text of the element nor the address of the page', () => {
      const element = document.createElement('div');
      element.textContent = '  Some Content  ';
      container.appendChild(element);

      const fingerprint = generator.generate(element);

      expect(fingerprint.content).toEqual({});
      expect(fingerprint.meta).not.toHaveProperty('url');
    });

    // My-Prompt-Manager-je37: a record id, a user id or a token is not an identifier the page's authors wrote
    it('leaves out the ids and test ids that are not shaped as identifiers', () => {
      const parent = document.createElement('div');
      parent.id = 'thread-4815162342';
      const element = document.createElement('div');
      element.id = ['e5f6a7b8', '1c2d', '4e5f', '8a9b', '0c1d2e3f4a5b'].join('-');
      element.setAttribute('data-testid', ['jane', 'example.org'].join('@'));
      element.setAttribute('data-id', ['a8f3c2e1', 'b7d94e06'].join(''));
      element.setAttribute('name', 'message body');
      parent.appendChild(element);
      container.appendChild(parent);

      const fingerprint = generator.generate(element);

      expect(fingerprint.primary).toEqual({});
      expect(fingerprint.context.parentId).toBeUndefined();
      expect(fingerprint.attributes).toEqual({});
    });

    it('should ignore sensitive IDs and attributes', () => {
      const element = document.createElement('div');
      element.id = 'user-password';
      element.setAttribute('data-testid', 'auth-token');
      container.appendChild(element);

      const fingerprint = generator.generate(element);

      expect(fingerprint.primary.id).toBeUndefined();
      expect(fingerprint.primary.dataTestId).toBeUndefined();
    });

    it('should extract context identifiers', () => {
      const parent = document.createElement('div');
      parent.id = 'parent-container';
      parent.setAttribute('data-testid', 'parent-test');

      const sibling1 = document.createElement('span');
      const target = document.createElement('span');
      const sibling2 = document.createElement('span');

      parent.appendChild(sibling1);
      parent.appendChild(target);
      parent.appendChild(sibling2);
      container.appendChild(parent);

      const fingerprint = generator.generate(target);

      expect(fingerprint.context.parentId).toBe('parent-container');
      expect(fingerprint.context.parentDataTestId).toBe('parent-test');
      expect(fingerprint.context.siblingIndex).toBe(1);
      expect(fingerprint.context.siblingCount).toBe(3);
    });

    // My-Prompt-Manager-je37: test ids, switches and ARIA tokens; not an attribute the page may copy a draft into
    it('should extract stable attributes', () => {
      const element = document.createElement('div');
      element.setAttribute('data-qa', 'composer-field');
      element.setAttribute('data-lexical-editor', 'true');
      element.setAttribute('aria-expanded', 'true');
      element.setAttribute('aria-describedby', 'composer-hint');
      element.setAttribute('data-draft', 'hello');
      element.setAttribute('data-custom', 'value');
      element.setAttribute('ng-model', 'data');
      element.setAttribute('aria-valuetext', 'Draft saved');
      element.setAttribute('random-attr', 'random'); // Should be ignored
      container.appendChild(element);

      const fingerprint = generator.generate(element);

      expect(fingerprint.attributes).toEqual({
        'data-qa': 'composer-field',
        'data-lexical-editor': 'true',
        'aria-expanded': 'true',
        'aria-describedby': 'composer-hint'
      });
    });
  });

  describe('findElement', () => {
    it('should find exact match', () => {
      const element = document.createElement('button');
      element.id = 'unique-btn';
      element.textContent = 'Click Me';
      container.appendChild(element);

      const fingerprint = generator.generate(element);
      const found = generator.findElement(fingerprint);

      expect(found).toBe(element);
    });

    it('should find match with changed ID but stable other attributes', () => {
      // Create original element and generate fingerprint
      const original = document.createElement('button');
      original.id = 'original-id';
      original.setAttribute('data-testid', 'stable-test-id');
      original.textContent = 'Submit';
      container.appendChild(original);

      const fingerprint = generator.generate(original);

      // Simulate DOM change: ID changes, but test-id remains
      container.removeChild(original);

      const newElement = document.createElement('button');
      newElement.id = 'new-id'; // Changed ID
      newElement.setAttribute('data-testid', 'stable-test-id'); // Stable
      newElement.textContent = 'Submit';
      container.appendChild(newElement);

      const found = generator.findElement(fingerprint);

      expect(found).toBe(newElement);
    });

    it('should distinguish between similar elements', () => {
      const btn1 = document.createElement('button');
      btn1.textContent = 'Button 1';
      btn1.setAttribute('data-id', 'first');

      const btn2 = document.createElement('button');
      btn2.textContent = 'Button 2';
      btn2.setAttribute('data-id', 'second');

      container.appendChild(btn1);
      container.appendChild(btn2);

      const fingerprint1 = generator.generate(btn1);
      const found = generator.findElement(fingerprint1);

      expect(found).toBe(btn1);
      expect(found).not.toBe(btn2);
    });

    it('should return null if no match meets confidence threshold', () => {
      const element = document.createElement('button');
      element.id = 'unique-btn';
      container.appendChild(element);

      const fingerprint = generator.generate(element);

      // Remove element and add completely different one
      container.removeChild(element);
      const different = document.createElement('div');
      container.appendChild(different);

      const found = generator.findElement(fingerprint);

      expect(found).toBeNull();
    });

    it('should handle duplicate IDs gracefully (pick best score)', () => {
       // While IDs should be unique, sometimes they aren't in messy DOMs
       const btn1 = document.createElement('button');
       btn1.id = 'duplicate';
       btn1.textContent = 'Wrong';

       const btn2 = document.createElement('button');
       btn2.id = 'duplicate';
       btn2.textContent = 'Right';
       btn2.setAttribute('data-testid', 'target'); // Extra attribute makes this winner

       container.appendChild(btn1);
       container.appendChild(btn2);

       const fingerprint = generator.generate(btn2);
       const found = generator.findElement(fingerprint);

       expect(found).toBe(btn2);
    });
  });

  // My-Prompt-Manager-je37, AC3: a fingerprint stored before the change keeps the page's address and
  // the element's text; it is read as stored, and finds its element as it did
  describe('a fingerprint stored before je37', () => {
    const storedBefore = (): ElementFingerprint => ({
      primary: {},
      secondary: { tagName: 'button', type: 'button' },
      content: { textContent: 'Send', textHash: '1j5ig' },
      context: { parentTagName: 'div', siblingIndex: 1, siblingCount: 2, depth: 3 },
      attributes: {},
      classPatterns: ['toolbar-btn'],
      meta: {
        generatedAt: 1_760_000_000_000,
        url: 'https://notes.example.com/chat/42?draft=1#composer',
        confidence: 'medium'
      }
    });

    it('still finds the element by its text, which only it holds', () => {
      const toolbar = document.createElement('div');
      const attach = document.createElement('button');
      attach.type = 'button';
      attach.className = 'toolbar-btn';
      attach.textContent = 'Attach';
      const send = document.createElement('button');
      send.type = 'button';
      send.className = 'toolbar-btn';
      send.textContent = 'Send';
      toolbar.append(attach, send);
      container.appendChild(toolbar);

      expect(generator.findElement(storedBefore())).toBe(send);
      // Picked now, the same button keeps no text: its fingerprint holds neither the text nor the address
      expect(generator.generate(send).content).toEqual({});
    });
  });

  describe('Edge Cases', () => {
    it('should handle element with no attributes', () => {
      const element = document.createElement('span');
      container.appendChild(element);

      const fingerprint = generator.generate(element);
      const found = generator.findElement(fingerprint);

      // With no attributes, confidence will be low
      expect(fingerprint.meta.confidence).toBe('low');
      // It might still find it if it's the only span, but we should verify it doesn't crash
      // Both outcomes (found with correct tagName or not found) are acceptable for low-confidence matches
      const isValidResult = found === null || found.tagName === 'SPAN';
      expect(isValidResult).toBe(true);
    });

    it('should handle deeply nested elements', () => {
      let current = container;
      for (let i = 0; i < 15; i++) {
        const div = document.createElement('div');
        div.id = `level-${i}`;
        current.appendChild(div);
        current = div;
      }

      const target = document.createElement('button');
      target.id = 'deep-target';
      current.appendChild(target);

      const fingerprint = generator.generate(target);
      expect(fingerprint.context.depth).toBeGreaterThan(10);

      const found = generator.findElement(fingerprint);
      expect(found).toBe(target);
    });

    it('should handle large number of similar elements efficiently', () => {
      const count = 200;
      const elements: HTMLElement[] = [];

      // Create many similar elements with distinct attributes for matching
      for (let i = 0; i < count; i++) {
        const btn = document.createElement('button');
        btn.className = 'common-btn';
        btn.textContent = `Button ${i}`;
        // Add stable attributes to enable reliable element identification
        btn.setAttribute('type', 'button');
        btn.setAttribute('role', 'button');
        container.appendChild(btn);
        elements.push(btn);
      }

      // Pick one in the middle
      const targetIndex = Math.floor(count / 2);
      const target = elements[targetIndex];

      const fingerprint = generator.generate(target);

      const startTime = performance.now();
      const found = generator.findElement(fingerprint);
      const duration = performance.now() - startTime;

      // Should find the correct element among 200 similar elements
      expect(found).toBe(target);

      // Performance assertion: skip in CI to avoid flakiness
      // Local development: should be reasonably fast (under 100ms for 200 elements)
      // CI environments: skip this check as timing varies significantly
      if (!process.env.CI && duration >= 100) {
        // Use fail() pattern to avoid conditional expect
        throw new Error(`Performance regression: findElement took ${duration}ms, expected < 100ms`);
      }
    });
  });
});
