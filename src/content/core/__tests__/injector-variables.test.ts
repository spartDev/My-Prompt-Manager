/**
 * Prompt Variables in the injected prompt selector.
 *
 * Uses the real event manager and keyboard navigation so clicks and keys behave as on a page;
 * only insertion into the platform, storage, styles and the logger are mocked.
 */
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Prompt } from '../../types/index';
import { PromptLibraryInjector } from '../injector';

const { insertPromptMock, getPromptsMock } = vi.hoisted(() => ({
  insertPromptMock: vi.fn(),
  getPromptsMock: vi.fn()
}));

vi.mock('../insertion-manager', () => ({
  PlatformInsertionManager: vi.fn(function () {
    return {
      getAllSelectors: vi.fn().mockReturnValue(['textarea']),
      createIcon: vi.fn().mockReturnValue(document.createElement('button')),
      insertPrompt: insertPromptMock,
      initializeStrategies: vi.fn(),
      cleanup: vi.fn()
    };
  })
}));

vi.mock('../../utils/storage', () => ({
  getPrompts: getPromptsMock,
  createPromptListItem: vi.fn().mockImplementation((prompt: Prompt) => {
    const item = document.createElement('div');
    item.className = 'prompt-item';
    item.dataset.promptId = prompt.id;
    item.textContent = prompt.title;
    return item;
  }),
  isSiteEnabled: vi.fn().mockResolvedValue(true),
  getSettings: vi.fn().mockResolvedValue({ enabledSites: [], customSites: [], debugMode: false, floatingFallback: true })
}));

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

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

const makePrompt = (id: string, title: string, content: string): Prompt => ({
  id,
  title,
  content,
  category: 'Test',
  createdAt: 0,
  updatedAt: 0
});

const plain = makePrompt('plain', 'Plain', 'No variables at all');
const translate = makePrompt('translate', 'Translate', 'Translate {{text}} into {{ language }}. Keep {{language}} formal.');

describe('Prompt selector: filling in Variables', () => {
  let injector: PromptLibraryInjector;
  let textarea: HTMLTextAreaElement;

  const selector = () => document.querySelector<HTMLElement>('.prompt-library-selector');
  const variableForm = () => document.querySelector<HTMLFormElement>('.prompt-variables-form');
  const pick = async (title: string) => {
    const item = Array.from(document.querySelectorAll<HTMLElement>('.prompt-item')).find((el) => el.textContent === title);
    if (!item) {throw new Error(`No prompt item ${title}`);}
    await userEvent.click(item);
  };
  const field = (name: string) => {
    const form = variableForm();
    if (!form) {throw new Error('No variables form');}
    const input = Array.from(form.querySelectorAll<HTMLInputElement>('input')).find(
      (el) => el.labels?.[0]?.textContent === name
    );
    if (!input) {throw new Error(`No field labelled ${name}`);}
    return input;
  };

  beforeEach(async () => {
    insertPromptMock.mockReset().mockResolvedValue({ success: true, method: 'direct' });
    getPromptsMock.mockReset().mockResolvedValue([plain, translate]);
    textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    injector = new PromptLibraryInjector();
    await injector.showPromptSelector(textarea);
  });

  afterEach(() => {
    injector.cleanup();
    textarea.remove();
    document.querySelectorAll('.prompt-library-selector').forEach((el) => { el.remove(); });
  });

  it('inserts a prompt without variables directly, without a form', async () => {
    await pick('Plain');

    await vi.waitFor(() => { expect(insertPromptMock).toHaveBeenCalledWith(textarea, 'No variables at all'); });
    expect(variableForm()).toBeNull();
  });

  it('opens a form with one labelled field per distinct variable, in order, first field focused', async () => {
    await pick('Translate');

    const form = variableForm();
    expect(form).not.toBeNull();
    const labels = Array.from(form?.querySelectorAll('label') ?? []).map((label) => label.textContent);
    expect(labels).toEqual(['text', 'language']);
    expect(document.activeElement).toBe(field('text'));
    expect(insertPromptMock).not.toHaveBeenCalled();
    expect(selector()).not.toBeNull();
  });

  it('keeps focus on the first field when the prompt is picked right after the selector opened', async () => {
    await pick('Translate');
    // the selector focuses its search input shortly after opening; it must not steal focus from the form
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(document.activeElement).toBe(field('text'));
  });

  it('inserts the filled text when the form is submitted with Enter', async () => {
    await pick('Translate');

    await userEvent.type(field('text'), 'this note');
    await userEvent.type(field('language'), 'French{Enter}');

    await vi.waitFor(() => {
      expect(insertPromptMock).toHaveBeenCalledWith(textarea, 'Translate this note into French. Keep French formal.');
    });
    expect(selector()).toBeNull();
  });

  it('keeps unfilled variables raw', async () => {
    await pick('Translate');

    await userEvent.type(field('language'), 'German');
    await userEvent.click(variableForm()?.querySelector<HTMLButtonElement>('button[type="submit"]') as HTMLButtonElement);

    await vi.waitFor(() => {
      expect(insertPromptMock).toHaveBeenCalledWith(textarea, 'Translate {{text}} into German. Keep German formal.');
    });
  });

  it('inserts the raw text on Escape', async () => {
    await pick('Translate');

    await userEvent.type(field('text'), 'ignored');
    await userEvent.keyboard('{Escape}');

    await vi.waitFor(() => { expect(insertPromptMock).toHaveBeenCalledWith(textarea, translate.content); });
    expect(insertPromptMock).toHaveBeenCalledTimes(1);
    expect(selector()).toBeNull();
  });

  it('inserts the raw text with "Insert as is"', async () => {
    await pick('Translate');

    const skip = Array.from(variableForm()?.querySelectorAll('button') ?? []).find((b) => b.textContent === 'Insert as is');
    expect(skip).toBeDefined();
    await userEvent.click(skip as HTMLButtonElement);

    await vi.waitFor(() => { expect(insertPromptMock).toHaveBeenCalledWith(textarea, translate.content); });
  });

  it('shows user text in the form as text, never as markup', async () => {
    const tricky = makePrompt('x', '<img src=x onerror=alert(1)>', 'Hi {{<b>name</b>}}');
    getPromptsMock.mockResolvedValue([tricky]);
    await injector.showPromptSelector(textarea);

    await pick('<img src=x onerror=alert(1)>');

    const form = variableForm();
    expect(form?.querySelector('b')).toBeNull();
    expect(form?.querySelector('img')).toBeNull();
    expect(form?.querySelector('label')?.textContent).toBe('<b>name</b>');
  });
});
