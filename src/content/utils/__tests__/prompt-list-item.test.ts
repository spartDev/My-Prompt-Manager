/**
 * Unit tests for createPromptListItem: the Prompt selector's list item.
 *
 * These render into the real DOM and read back what a user would see, because the item
 * has to show a Prompt exactly as saved (Verbatim): no escaping, and ids passed through.
 */

import { describe, it, expect, vi } from 'vitest';

import { HOSTILE_TEXTS, expectNoMarkupIn } from '../../../test/helpers/hostile-text';
import type { Prompt } from '../../types/index';
import { createPromptListItem } from '../storage';

vi.mock('../logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn().mockReturnValue(false),
  showDebugNotification: vi.fn()
}));

function buildPrompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: 'test-id',
    title: 'Test Title',
    content: 'Test content',
    category: 'Test Category',
    createdAt: 1234567890,
    updatedAt: 1234567890,
    usageCount: 0,
    lastUsedAt: 1234567890,
    ...overrides
  };
}

const text = (item: HTMLElement, selector: string): string | null | undefined =>
  item.querySelector(selector)?.textContent;

describe('createPromptListItem', () => {
  it('should show the title, category and content of the Prompt', () => {
    const item = createPromptListItem(buildPrompt(), 0);

    expect(item.className).toBe('prompt-item');
    expect(text(item, '.prompt-title')).toBe('Test Title');
    expect(text(item, '.prompt-category')).toBe('Test Category');
    expect(text(item, '.prompt-preview')).toBe('Test content');
  });

  it('should set up the option for assistive technology', () => {
    const item = createPromptListItem(buildPrompt(), 3, 'filtered-prompt-item');

    expect(item.getAttribute('role')).toBe('option');
    expect(item.getAttribute('tabindex')).toBe('-1');
    expect(item.getAttribute('aria-describedby')).toBe('filtered-prompt-item-3-desc');
    expect(item.querySelector('.prompt-preview')?.id).toBe('filtered-prompt-item-3-desc');
  });

  it('should show text exactly as saved, with nothing escaped', () => {
    const item = createPromptListItem(
      buildPrompt({
        title: 'Q&A / "FAQ" <b>it\'s</b>',
        category: 'R&D / <Ops>',
        content: 'Use <example>text</example> & "quotes" / slashes'
      }),
      0
    );

    expect(text(item, '.prompt-title')).toBe('Q&A / "FAQ" <b>it\'s</b>');
    expect(text(item, '.prompt-category')).toBe('R&D / <Ops>');
    expect(text(item, '.prompt-preview')).toBe('Use <example>text</example> & "quotes" / slashes');
  });

  it('should put the id in the attribute unchanged', () => {
    const id = 'a/b & "c" <d> \'e\'';

    const item = createPromptListItem(buildPrompt({ id }), 0);

    expect(item.getAttribute('data-prompt-id')).toBe(id);
    expect(item.dataset.promptId).toBe(id);
  });

  describe('preview', () => {
    it('should show the first 100 characters followed by "..." when the content is longer', () => {
      const content = `${'a'.repeat(100)}b`;

      const item = createPromptListItem(buildPrompt({ content }), 0);

      expect(text(item, '.prompt-preview')).toBe(`${'a'.repeat(100)}...`);
    });

    it('should show content of exactly 100 characters in full', () => {
      const content = 'a'.repeat(100);

      const item = createPromptListItem(buildPrompt({ content }), 0);

      expect(text(item, '.prompt-preview')).toBe(content);
    });

    it('should cut the preview from the text as saved, tags and entities included', () => {
      const content = `<${'a'.repeat(98)}>&amp;tail`;

      const item = createPromptListItem(buildPrompt({ content }), 0);

      expect(text(item, '.prompt-preview')).toBe(`${content.substring(0, 100)}...`);
    });

    describe('with emoji, which take two code units each', () => {
      const EMOJI = '\u{1F600}';
      const HIGH_SURROGATE = String.fromCharCode(0xd83d);
      // With the u flag a surrogate pair is one code point, so this matches only a lone surrogate
      const LONE_SURROGATE = /[\u{D800}-\u{DFFF}]/u;

      const previewOf = (content: string): string | null | undefined =>
        text(createPromptListItem(buildPrompt({ content }), 0), '.prompt-preview');

      it('should leave out an emoji that straddles the 100th code unit instead of splitting it', () => {
        const content = `${'a'.repeat(99)}${EMOJI} and more`;

        expect(previewOf(content)).toBe(`${'a'.repeat(99)}...`);
      });

      it('should leave out an emoji that ends the content one code unit past the limit', () => {
        const content = `${'a'.repeat(99)}${EMOJI}`;

        expect(previewOf(content)).toBe(`${'a'.repeat(99)}...`);
      });

      it('should keep an emoji that fits entirely in the first 100 code units', () => {
        const content = `${'a'.repeat(98)}${EMOJI} and more`;

        expect(previewOf(content)).toBe(`${'a'.repeat(98)}${EMOJI}...`);
      });

      it('should show content of exactly 100 code units that ends with an emoji in full', () => {
        const content = `${'a'.repeat(98)}${EMOJI}`;

        expect(previewOf(content)).toBe(content);
      });

      it('should show content shorter than 100 code units in full', () => {
        const content = `${EMOJI} Summarize this ${EMOJI}`;

        expect(previewOf(content)).toBe(content);
      });

      it.each([96, 97, 98, 99, 100, 101])(
        'should never end the preview inside an emoji (emoji at code unit %i)',
        (position) => {
          const content = `${'a'.repeat(position)}${EMOJI}${'b'.repeat(20)}`;

          const preview = previewOf(content)?.replace(/\.\.\.$/, '') ?? '';

          expect(preview).not.toMatch(LONE_SURROGATE);
          expect(content.startsWith(preview)).toBe(true);
          expect(preview.length).toBeGreaterThanOrEqual(99);
          expect(preview.length).toBeLessThanOrEqual(100);
        }
      );

      it('should keep a lone surrogate that is already in the saved text, since it splits no pair', () => {
        const content = `${'a'.repeat(99)}${HIGH_SURROGATE}bc`;

        expect(previewOf(content)).toBe(`${'a'.repeat(99)}${HIGH_SURROGATE}...`);
      });
    });
  });

  describe('when something goes wrong', () => {
    it('should return an error item instead of throwing', () => {
      const broken = buildPrompt({ content: undefined as unknown as string });

      const item = createPromptListItem(broken, 0);

      expect(item.className).toBe('prompt-item-error');
      expect(item.textContent).toBe('Error loading prompt');
    });
  });

  describe.each(HOSTILE_TEXTS)('hostile-looking text %j', (hostile) => {
    it('should appear literally in the title, category and preview', () => {
      const item = createPromptListItem(buildPrompt({ title: hostile, category: hostile, content: hostile }), 0);

      expect(text(item, '.prompt-title')).toBe(hostile);
      expect(text(item, '.prompt-category')).toBe(hostile);
      expect(text(item, '.prompt-preview')).toBe(hostile);
    });

    it('should not create any element or event handler from it', () => {
      const item = createPromptListItem(buildPrompt({ id: hostile, title: hostile, category: hostile, content: hostile }), 0);
      document.body.appendChild(item);

      expectNoMarkupIn(item, ['div']);
      expect(item.querySelectorAll('.prompt-title > *, .prompt-category > *, .prompt-preview > *')).toHaveLength(0);

      item.remove();
    });

    it('should keep it intact as an id', () => {
      const item = createPromptListItem(buildPrompt({ id: hostile }), 0);

      expect(item.getAttribute('data-prompt-id')).toBe(hostile);
      expect(item.getAttributeNames().sort()).toEqual(
        ['aria-describedby', 'class', 'data-prompt-id', 'role', 'tabindex']
      );
    });
  });
});
