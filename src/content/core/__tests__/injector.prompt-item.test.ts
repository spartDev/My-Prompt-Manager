/**
 * Prompt selector: choosing a list item inserts that item's Prompt.
 *
 * Uses the real list items (createPromptListItem) and the real click handling, so it proves
 * that an id is matched exactly as saved, whatever characters it holds (a restored Backup
 * can bring in ids such as `a/b`), and that the content inserted is the Prompt's own.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Prompt } from '../../types/index';
import { PromptLibraryInjector } from '../injector';

const { insertPrompt } = vi.hoisted(() => ({
  insertPrompt: vi.fn()
}));

vi.mock('../insertion-manager', () => ({
  PlatformInsertionManager: vi.fn(function () {
    return {
      getAllSelectors: vi.fn().mockReturnValue(['textarea']),
      createIcon: vi.fn().mockReturnValue(document.createElement('button')),
      insertPrompt,
      initializeStrategies: vi.fn(),
      cleanup: vi.fn()
    };
  })
}));

vi.mock('../../ui/element-factory', () => ({
  UIElementFactory: vi.fn(function () {
    return {
      createFloatingIcon: vi.fn().mockReturnValue(document.createElement('button'))
    };
  })
}));

vi.mock('../../utils/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/storage')>();
  return { ...actual, getPrompts: vi.fn() };
});

vi.mock('../../utils/styles', () => ({
  injectCSS: vi.fn(),
  isInjected: vi.fn()
}));

vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn().mockReturnValue(false),
  showDebugNotification: vi.fn()
}));

function buildPrompt(overrides: Partial<Prompt>): Prompt {
  return {
    id: 'id',
    title: 'Title',
    content: 'Content',
    category: 'General',
    createdAt: 1,
    updatedAt: 1,
    usageCount: 0,
    lastUsedAt: 1,
    ...overrides
  };
}

const SLASH_AND_AMPERSAND_ID = 'a/b & "c" <d>';

const prompts: Prompt[] = [
  buildPrompt({ id: 'plain', title: 'Plain', content: 'Plain content' }),
  buildPrompt({
    id: SLASH_AND_AMPERSAND_ID,
    title: 'Q&A / "FAQ"',
    content: '  Summarize the metadata: use <example>text</example> tags; if count=5 and onboarding = true, return data: JSON\n\n'
  })
];

const itemFor = (id: string): HTMLElement | undefined =>
  Array.from(document.querySelectorAll<HTMLElement>('.prompt-item')).find((item) => item.dataset.promptId === id);

describe('Prompt selector: choosing a Prompt', () => {
  let injector: PromptLibraryInjector;
  let textarea: HTMLTextAreaElement;

  beforeEach(async () => {
    insertPrompt.mockReset().mockResolvedValue({ success: true, method: 'direct' });

    const { getPrompts } = await import('../../utils/storage');
    vi.mocked(getPrompts).mockResolvedValue(prompts);

    textarea = document.createElement('textarea');
    textarea.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 100,
      left: 100,
      right: 200,
      bottom: 150,
      width: 100,
      height: 50
    });
    document.body.appendChild(textarea);

    injector = new PromptLibraryInjector();
    await injector.showPromptSelector(textarea);
  });

  afterEach(async () => {
    injector.cleanup();
    textarea.remove();
    document.body.innerHTML = '';
    // Let the selector's delayed outside-click setup finish
    await new Promise((resolve) => setTimeout(resolve, 150));
  });

  it('should show the Prompt text as saved, and the id unchanged in the attribute', () => {
    const item = itemFor(SLASH_AND_AMPERSAND_ID);

    expect(item).toBeDefined();
    expect(item?.querySelector('.prompt-title')?.textContent).toBe('Q&A / "FAQ"');
  });

  it('should insert the Prompt of an item whose id contains / and &', async () => {
    itemFor(SLASH_AND_AMPERSAND_ID)?.click();

    await vi.waitFor(() => {
      expect(insertPrompt).toHaveBeenCalledTimes(1);
    });
    expect(insertPrompt).toHaveBeenCalledWith(textarea, prompts[1].content);
  });

  it('should insert the content of the item that was chosen, not another one', async () => {
    itemFor('plain')?.click();

    await vi.waitFor(() => {
      expect(insertPrompt).toHaveBeenCalledTimes(1);
    });
    expect(insertPrompt).toHaveBeenCalledWith(textarea, 'Plain content');
  });

  it('should insert the right Prompt from the list narrowed by the search box', async () => {
    const search = document.querySelector<HTMLInputElement>('.search-input');
    expect(search).not.toBeNull();
    if (search) {
      search.value = 'faq';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }

    expect(document.querySelectorAll('.prompt-item')).toHaveLength(1);
    itemFor(SLASH_AND_AMPERSAND_ID)?.click();

    await vi.waitFor(() => {
      expect(insertPrompt).toHaveBeenCalledTimes(1);
    });
    expect(insertPrompt).toHaveBeenCalledWith(textarea, prompts[1].content);
  });
});
