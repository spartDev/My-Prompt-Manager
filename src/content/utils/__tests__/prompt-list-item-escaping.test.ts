/**
 * @vitest-environment jsdom
 *
 * Picker list items must show prompt text literally (no double escaping like "&amp;")
 * while never interpreting it as markup.
 */
import { describe, expect, it } from 'vitest';

import type { Prompt } from '../../types';
import { createPromptListItem } from '../storage';

const makePrompt = (overrides: Partial<Prompt>): Prompt => ({
  id: 'prompt-1',
  title: 'Title',
  content: 'Content',
  category: 'General',
  createdAt: 1,
  updatedAt: 1,
  usageCount: 0,
  lastUsedAt: 1,
  ...overrides,
});

const SPECIAL = `Decisions & Owners <b>bold</b> "quoted" 'single' a/b`;

describe('createPromptListItem text rendering', () => {
  it('renders & < > " \' / literally in title, category and preview', () => {
    const item = createPromptListItem(
      makePrompt({ title: SPECIAL, content: SPECIAL, category: SPECIAL }),
      0,
    );

    expect(item.querySelector('.prompt-title')?.textContent).toBe(SPECIAL);
    expect(item.querySelector('.prompt-category')?.textContent).toBe(SPECIAL);
    expect(item.querySelector('.prompt-preview')?.textContent).toBe(SPECIAL);
    expect(item.querySelector('b')).toBeNull();
  });

  it('never interprets prompt text as markup', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const item = createPromptListItem(
      makePrompt({ title: payload, content: payload, category: payload }),
      0,
    );

    expect(item.querySelector('img')).toBeNull();
    expect(item.querySelector('.prompt-title')?.textContent).toBe(payload);
    expect(item.querySelector('.prompt-category')?.textContent).toBe(payload);
    expect(item.querySelector('.prompt-preview')?.textContent).toBe(payload);
  });

  it('keeps the raw prompt id in data-prompt-id so the click lookup matches', () => {
    const item = createPromptListItem(makePrompt({ id: 'a&b' }), 0);

    expect(item.dataset.promptId).toBe('a&b');
  });

  it('truncates long content to 100 characters plus an ellipsis without escaping', () => {
    const content = '&'.repeat(150);
    const item = createPromptListItem(makePrompt({ content }), 0);

    expect(item.querySelector('.prompt-preview')?.textContent).toBe(`${'&'.repeat(100)}...`);
  });
});
